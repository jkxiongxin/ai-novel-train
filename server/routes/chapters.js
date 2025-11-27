const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { analyzeChapter } = require('../services/aiService');

// 片段类型定义
const SEGMENT_TYPES = {
  dialogue: { name: '人物对白', description: '角色之间的对话内容' },
  emotion: { name: '情绪渲染', description: '情感氛围的描写' },
  battle: { name: '战斗场景', description: '动作打斗场面' },
  psychology: { name: '心理活动', description: '角色内心独白' },
  environment: { name: '环境描写', description: '场景环境描写' },
  plot: { name: '情节推进', description: '故事情节发展' },
  transition: { name: '过渡衔接', description: '段落之间的过渡' },
  narrative: { name: '叙事描述', description: '一般性叙述内容' }
};

// 文风类型定义
const WRITING_STYLES = {
  concise: { name: '简洁明快', description: '用词精炼，节奏快速' },
  detailed: { name: '细腻详尽', description: '描写细致，铺陈丰富' },
  poetic: { name: '诗意唯美', description: '语言优美，意境深远' },
  humorous: { name: '幽默诙谐', description: '轻松有趣，富有笑点' },
  tense: { name: '紧张刺激', description: '节奏紧凑，悬念感强' },
  lyrical: { name: '抒情感人', description: '情感真挚，打动人心' },
  plain: { name: '平实质朴', description: '语言朴素，贴近生活' },
  grand: { name: '大气磅礴', description: '气势恢宏，格局宏大' }
};

// 获取片段类型列表
router.get('/segment-types', (req, res) => {
  res.json({
    success: true,
    data: SEGMENT_TYPES
  });
});

// 获取文风类型列表
router.get('/writing-styles', (req, res) => {
  res.json({
    success: true,
    data: WRITING_STYLES
  });
});

// 获取章节列表
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, pageSize = 20, status, novel_name } = req.query;

    let query = 'SELECT * FROM novel_chapters WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM novel_chapters WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND analysis_status = ?';
      countQuery += ' AND analysis_status = ?';
      params.push(status);
    }

    if (novel_name) {
      query += ' AND novel_name LIKE ?';
      countQuery += ' AND novel_name LIKE ?';
      params.push(`%${novel_name}%`);
    }

    const total = db.prepare(countQuery).get(...params).total;

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const chapters = db.prepare(query).all(...params, parseInt(pageSize), offset);

    res.json({
      success: true,
      data: {
        list: chapters,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取章节列表失败',
      error: error.message
    });
  }
});

// 获取单个章节详情
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const chapter = db.prepare('SELECT * FROM novel_chapters WHERE id = ?').get(id);

    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    // 获取该章节的所有片段
    const segments = db.prepare(`
      SELECT * FROM chapter_segments 
      WHERE chapter_id = ? 
      ORDER BY segment_order ASC
    `).all(id);

    chapter.segments = segments.map(seg => ({
      ...seg,
      style_tags: seg.style_tags ? JSON.parse(seg.style_tags) : []
    }));

    res.json({
      success: true,
      data: chapter
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取章节详情失败',
      error: error.message
    });
  }
});

// 创建新章节
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { title, novel_name, author, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: '标题和内容不能为空'
      });
    }

    const wordCount = content.replace(/\s/g, '').length;

    const result = db.prepare(`
      INSERT INTO novel_chapters (title, novel_name, author, content, word_count)
      VALUES (?, ?, ?, ?, ?)
    `).run(title, novel_name || null, author || null, content, wordCount);

    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '章节创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建章节失败',
      error: error.message
    });
  }
});

// 更新章节
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, novel_name, author, content } = req.body;

    const chapter = db.prepare('SELECT * FROM novel_chapters WHERE id = ?').get(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    const wordCount = content ? content.replace(/\s/g, '').length : chapter.word_count;

    db.prepare(`
      UPDATE novel_chapters 
      SET title = ?, novel_name = ?, author = ?, content = ?, word_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || chapter.title,
      novel_name !== undefined ? novel_name : chapter.novel_name,
      author !== undefined ? author : chapter.author,
      content || chapter.content,
      wordCount,
      id
    );

    res.json({
      success: true,
      message: '章节更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新章节失败',
      error: error.message
    });
  }
});

// 删除章节
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const chapter = db.prepare('SELECT * FROM novel_chapters WHERE id = ?').get(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    // 删除相关片段
    db.prepare('DELETE FROM chapter_segments WHERE chapter_id = ?').run(id);
    // 删除章节
    db.prepare('DELETE FROM novel_chapters WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '章节删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除章节失败',
      error: error.message
    });
  }
});

// AI 分析章节
router.post('/:id/analyze', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;

    const chapter = db.prepare('SELECT * FROM novel_chapters WHERE id = ?').get(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    // 更新状态为分析中
    db.prepare(`
      UPDATE novel_chapters SET analysis_status = 'analyzing' WHERE id = ?
    `).run(id);

    try {
      // 调用 AI 分析
      const analysisResult = await analyzeChapter(chapter.content);

      // 清除旧的片段
      db.prepare('DELETE FROM chapter_segments WHERE chapter_id = ?').run(id);

      // 插入新的片段
      const insertSegment = db.prepare(`
        INSERT INTO chapter_segments 
        (chapter_id, segment_order, content, word_count, segment_type, writing_style, style_tags, difficulty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((segments) => {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          insertSegment.run(
            id,
            i + 1,
            seg.content,
            seg.content.replace(/\s/g, '').length,
            seg.segment_type,
            seg.writing_style,
            JSON.stringify(seg.style_tags || []),
            seg.difficulty || 'medium'
          );
        }
      });

      insertMany(analysisResult.segments);

      // 更新章节状态
      db.prepare(`
        UPDATE novel_chapters SET analysis_status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(id);

      res.json({
        success: true,
        message: '章节分析完成',
        data: {
          segments_count: analysisResult.segments.length
        }
      });
    } catch (analysisError) {
      // 分析失败，更新状态
      db.prepare(`
        UPDATE novel_chapters SET analysis_status = 'failed' WHERE id = ?
      `).run(id);

      throw analysisError;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '章节分析失败',
      error: error.message
    });
  }
});

// 获取片段列表（用于筛选抄写内容）
router.get('/segments/list', (req, res) => {
  try {
    const db = getDatabase();
    const { 
      page = 1, 
      pageSize = 20, 
      segment_type, 
      writing_style, 
      difficulty,
      chapter_id,
      min_words,
      max_words
    } = req.query;

    let query = `
      SELECT cs.*, nc.title as chapter_title, nc.novel_name, nc.author
      FROM chapter_segments cs
      LEFT JOIN novel_chapters nc ON cs.chapter_id = nc.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM chapter_segments cs WHERE 1=1';
    const params = [];

    if (segment_type) {
      query += ' AND cs.segment_type = ?';
      countQuery += ' AND cs.segment_type = ?';
      params.push(segment_type);
    }

    if (writing_style) {
      query += ' AND cs.writing_style = ?';
      countQuery += ' AND cs.writing_style = ?';
      params.push(writing_style);
    }

    if (difficulty) {
      query += ' AND cs.difficulty = ?';
      countQuery += ' AND cs.difficulty = ?';
      params.push(difficulty);
    }

    if (chapter_id) {
      query += ' AND cs.chapter_id = ?';
      countQuery += ' AND cs.chapter_id = ?';
      params.push(chapter_id);
    }

    if (min_words) {
      query += ' AND cs.word_count >= ?';
      countQuery += ' AND cs.word_count >= ?';
      params.push(parseInt(min_words));
    }

    if (max_words) {
      query += ' AND cs.word_count <= ?';
      countQuery += ' AND cs.word_count <= ?';
      params.push(parseInt(max_words));
    }

    const total = db.prepare(countQuery).get(...params).total;

    query += ' ORDER BY cs.id DESC LIMIT ? OFFSET ?';
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const segments = db.prepare(query).all(...params, parseInt(pageSize), offset);

    res.json({
      success: true,
      data: {
        list: segments.map(seg => ({
          ...seg,
          style_tags: seg.style_tags ? JSON.parse(seg.style_tags) : []
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取片段列表失败',
      error: error.message
    });
  }
});

// 手动添加片段
router.post('/:id/segments', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { content, segment_type, writing_style, style_tags, difficulty } = req.body;

    const chapter = db.prepare('SELECT * FROM novel_chapters WHERE id = ?').get(id);
    if (!chapter) {
      return res.status(404).json({
        success: false,
        message: '章节不存在'
      });
    }

    if (!content || !segment_type) {
      return res.status(400).json({
        success: false,
        message: '内容和片段类型不能为空'
      });
    }

    // 获取当前最大顺序
    const maxOrder = db.prepare(
      'SELECT MAX(segment_order) as max_order FROM chapter_segments WHERE chapter_id = ?'
    ).get(id).max_order || 0;

    const result = db.prepare(`
      INSERT INTO chapter_segments 
      (chapter_id, segment_order, content, word_count, segment_type, writing_style, style_tags, difficulty)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      maxOrder + 1,
      content,
      content.replace(/\s/g, '').length,
      segment_type,
      writing_style || null,
      JSON.stringify(style_tags || []),
      difficulty || 'medium'
    );

    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '片段添加成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '添加片段失败',
      error: error.message
    });
  }
});

// 更新片段
router.put('/segments/:segmentId', (req, res) => {
  try {
    const db = getDatabase();
    const { segmentId } = req.params;
    const { content, segment_type, writing_style, style_tags, difficulty } = req.body;

    const segment = db.prepare('SELECT * FROM chapter_segments WHERE id = ?').get(segmentId);
    if (!segment) {
      return res.status(404).json({
        success: false,
        message: '片段不存在'
      });
    }

    db.prepare(`
      UPDATE chapter_segments 
      SET content = ?, word_count = ?, segment_type = ?, writing_style = ?, style_tags = ?, difficulty = ?
      WHERE id = ?
    `).run(
      content || segment.content,
      content ? content.replace(/\s/g, '').length : segment.word_count,
      segment_type || segment.segment_type,
      writing_style !== undefined ? writing_style : segment.writing_style,
      style_tags ? JSON.stringify(style_tags) : segment.style_tags,
      difficulty || segment.difficulty,
      segmentId
    );

    res.json({
      success: true,
      message: '片段更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新片段失败',
      error: error.message
    });
  }
});

// 删除片段
router.delete('/segments/:segmentId', (req, res) => {
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

    db.prepare('DELETE FROM chapter_segments WHERE id = ?').run(segmentId);

    res.json({
      success: true,
      message: '片段删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除片段失败',
      error: error.message
    });
  }
});

module.exports = router;
