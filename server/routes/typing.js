const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// 获取抄书练习列表
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      pageSize = 20, 
      status, 
      segment_type, 
      writing_style 
    } = req.query;

    let query = `
      SELECT tp.*, cs.chapter_id, nc.title as chapter_title, nc.novel_name
      FROM typing_practices tp
      LEFT JOIN chapter_segments cs ON tp.segment_id = cs.id
      LEFT JOIN novel_chapters nc ON cs.chapter_id = nc.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM typing_practices WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND tp.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }

    if (segment_type) {
      query += ' AND tp.segment_type = ?';
      countQuery += ' AND segment_type = ?';
      params.push(segment_type);
    }

    if (writing_style) {
      query += ' AND tp.writing_style = ?';
      countQuery += ' AND writing_style = ?';
      params.push(writing_style);
    }

    const total = db.prepare(countQuery).get(...params).total;

    query += ' ORDER BY tp.created_at DESC LIMIT ? OFFSET ?';
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const practices = db.prepare(query).all(...params, parseInt(pageSize), offset);

    res.json({
      success: true,
      data: {
        list: practices,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取抄书练习列表失败',
      error: error.message
    });
  }
});

// 获取单个抄书练习
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const practice = db.prepare(`
      SELECT tp.*, cs.chapter_id, nc.title as chapter_title, nc.novel_name
      FROM typing_practices tp
      LEFT JOIN chapter_segments cs ON tp.segment_id = cs.id
      LEFT JOIN novel_chapters nc ON cs.chapter_id = nc.id
      WHERE tp.id = ?
    `).get(id);

    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    res.json({
      success: true,
      data: practice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取练习详情失败',
      error: error.message
    });
  }
});

// 从片段创建抄书练习
router.post('/from-segment/:segmentId', (req, res) => {
  try {
    const db = getDatabase();
    const { segmentId } = req.params;

    const segment = db.prepare('SELECT * FROM chapter_segments WHERE id = ?').get(segmentId);
    if (!segment) {
      return res.status(404).json({
        success: false,
        message: '片段不存在'
      });
    }

    const result = db.prepare(`
      INSERT INTO typing_practices 
      (segment_id, original_content, segment_type, writing_style, word_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      segmentId,
      segment.content,
      segment.segment_type,
      segment.writing_style,
      segment.word_count
    );

    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '抄书练习创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建抄书练习失败',
      error: error.message
    });
  }
});

// 创建自定义抄书练习
router.post('/custom', (req, res) => {
  try {
    const db = getDatabase();
    const { content, segment_type, writing_style } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: '内容不能为空'
      });
    }

    const wordCount = content.replace(/\s/g, '').length;

    const result = db.prepare(`
      INSERT INTO typing_practices 
      (custom_content, original_content, segment_type, writing_style, word_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      content,
      content,
      segment_type || 'narrative',
      writing_style || null,
      wordCount
    );

    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '自定义抄书练习创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建抄书练习失败',
      error: error.message
    });
  }
});

// 开始抄书练习
router.post('/:id/start', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const practice = db.prepare('SELECT * FROM typing_practices WHERE id = ?').get(id);
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    db.prepare(`
      UPDATE typing_practices 
      SET status = 'in_progress', started_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: '练习已开始'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '开始练习失败',
      error: error.message
    });
  }
});

// 保存抄书进度
router.put('/:id/progress', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { typed_content, time_spent } = req.body;

    const practice = db.prepare('SELECT * FROM typing_practices WHERE id = ?').get(id);
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    const typedCount = typed_content ? typed_content.replace(/\s/g, '').length : 0;

    db.prepare(`
      UPDATE typing_practices 
      SET typed_content = ?, typed_count = ?, time_spent = ?
      WHERE id = ?
    `).run(typed_content || '', typedCount, time_spent || 0, id);

    res.json({
      success: true,
      message: '进度已保存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存进度失败',
      error: error.message
    });
  }
});

// 完成抄书练习
router.post('/:id/complete', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { typed_content, time_spent } = req.body;

    const practice = db.prepare('SELECT * FROM typing_practices WHERE id = ?').get(id);
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    // 计算准确率
    const original = practice.original_content.replace(/\s/g, '');
    const typed = (typed_content || '').replace(/\s/g, '');
    
    let correctCount = 0;
    const minLength = Math.min(original.length, typed.length);
    for (let i = 0; i < minLength; i++) {
      if (original[i] === typed[i]) {
        correctCount++;
      }
    }
    
    const accuracy = original.length > 0 ? (correctCount / original.length) * 100 : 0;
    const typedCount = typed.length;
    
    // 计算打字速度（字/分钟）
    const minutes = (time_spent || 1) / 60;
    const speed = minutes > 0 ? typedCount / minutes : 0;

    db.prepare(`
      UPDATE typing_practices 
      SET typed_content = ?, typed_count = ?, accuracy = ?, speed = ?, 
          time_spent = ?, status = 'completed', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(typed_content || '', typedCount, accuracy, speed, time_spent || 0, id);

    // 更新统计数据
    const today = new Date().toISOString().split('T')[0];
    const existingStat = db.prepare(`
      SELECT * FROM typing_statistics 
      WHERE practice_date = ? AND segment_type = ? AND writing_style = ?
    `).get(today, practice.segment_type || 'narrative', practice.writing_style || 'plain');

    if (existingStat) {
      db.prepare(`
        UPDATE typing_statistics 
        SET total_practices = total_practices + 1,
            total_words = total_words + ?,
            total_time = total_time + ?,
            avg_accuracy = (avg_accuracy * total_practices + ?) / (total_practices + 1),
            avg_speed = (avg_speed * total_practices + ?) / (total_practices + 1)
        WHERE id = ?
      `).run(typedCount, time_spent || 0, accuracy, speed, existingStat.id);
    } else {
      db.prepare(`
        INSERT INTO typing_statistics 
        (practice_date, segment_type, writing_style, total_practices, total_words, total_time, avg_accuracy, avg_speed)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
      `).run(today, practice.segment_type || 'narrative', practice.writing_style || 'plain', typedCount, time_spent || 0, accuracy, speed);
    }

    res.json({
      success: true,
      message: '练习完成',
      data: {
        accuracy: accuracy.toFixed(2),
        speed: speed.toFixed(2),
        typed_count: typedCount,
        time_spent: time_spent
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '完成练习失败',
      error: error.message
    });
  }
});

// 删除抄书练习
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const practice = db.prepare('SELECT * FROM typing_practices WHERE id = ?').get(id);
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }

    db.prepare('DELETE FROM typing_practices WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '练习删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除练习失败',
      error: error.message
    });
  }
});

// 获取抄书统计
router.get('/stats/overview', (req, res) => {
  try {
    const db = getDatabase();
    const { days = 30 } = req.query;

    // 总体统计
    const overview = db.prepare(`
      SELECT 
        COUNT(*) as total_practices,
        SUM(typed_count) as total_words,
        SUM(time_spent) as total_time,
        AVG(accuracy) as avg_accuracy,
        AVG(speed) as avg_speed
      FROM typing_practices
      WHERE status = 'completed'
    `).get();

    // 按类型统计
    const byType = db.prepare(`
      SELECT 
        segment_type,
        COUNT(*) as count,
        SUM(typed_count) as words,
        AVG(accuracy) as accuracy,
        AVG(speed) as speed
      FROM typing_practices
      WHERE status = 'completed'
      GROUP BY segment_type
    `).all();

    // 按文风统计
    const byStyle = db.prepare(`
      SELECT 
        writing_style,
        COUNT(*) as count,
        SUM(typed_count) as words,
        AVG(accuracy) as accuracy,
        AVG(speed) as speed
      FROM typing_practices
      WHERE status = 'completed' AND writing_style IS NOT NULL
      GROUP BY writing_style
    `).all();

    // 近期趋势
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const trend = db.prepare(`
      SELECT 
        DATE(completed_at) as date,
        COUNT(*) as count,
        SUM(typed_count) as words,
        AVG(accuracy) as accuracy,
        AVG(speed) as speed
      FROM typing_practices
      WHERE status = 'completed' AND completed_at >= ?
      GROUP BY DATE(completed_at)
      ORDER BY date ASC
    `).all(startDate.toISOString());

    res.json({
      success: true,
      data: {
        overview: {
          total_practices: overview.total_practices || 0,
          total_words: overview.total_words || 0,
          total_time: overview.total_time || 0,
          avg_accuracy: (overview.avg_accuracy || 0).toFixed(2),
          avg_speed: (overview.avg_speed || 0).toFixed(2)
        },
        by_type: byType,
        by_style: byStyle,
        trend
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// 随机获取一个片段进行抄写
router.get('/random/segment', (req, res) => {
  try {
    const db = getDatabase();
    const { segment_type, writing_style, min_words, max_words } = req.query;

    let query = 'SELECT * FROM chapter_segments WHERE 1=1';
    const params = [];

    if (segment_type) {
      query += ' AND segment_type = ?';
      params.push(segment_type);
    }

    if (writing_style) {
      query += ' AND writing_style = ?';
      params.push(writing_style);
    }

    if (min_words) {
      query += ' AND word_count >= ?';
      params.push(parseInt(min_words));
    }

    if (max_words) {
      query += ' AND word_count <= ?';
      params.push(parseInt(max_words));
    }

    query += ' ORDER BY RANDOM() LIMIT 1';

    const segment = db.prepare(query).get(...params);

    if (!segment) {
      return res.status(404).json({
        success: false,
        message: '没有符合条件的片段'
      });
    }

    res.json({
      success: true,
      data: {
        ...segment,
        style_tags: segment.style_tags ? JSON.parse(segment.style_tags) : []
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取随机片段失败',
      error: error.message
    });
  }
});

module.exports = router;
