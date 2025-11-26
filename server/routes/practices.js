const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// 获取练习列表
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { status, question_id, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT p.*, q.title as question_title, q.type as question_type, q.difficulty
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM practices WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND p.status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }
    
    if (question_id) {
      query += ' AND p.question_id = ?';
      countQuery += ' AND question_id = ?';
      params.push(question_id);
    }
    
    const total = db.prepare(countQuery).get(...params).total;
    
    query += ' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?';
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
      message: '获取练习列表失败',
      error: error.message
    });
  }
});

// 获取单个练习
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const practice = db.prepare(`
      SELECT p.*, q.title as question_title, q.type as question_type, 
             q.difficulty, q.content as question_content
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      WHERE p.id = ?
    `).get(id);
    
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }
    
    try {
      practice.question_content = JSON.parse(practice.question_content);
    } catch {}
    
    // 获取最新草稿
    const latestDraft = db.prepare(`
      SELECT * FROM practice_drafts 
      WHERE practice_id = ? 
      ORDER BY saved_at DESC 
      LIMIT 1
    `).get(id);
    
    practice.latest_draft = latestDraft;
    
    res.json({
      success: true,
      data: practice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取练习失败',
      error: error.message
    });
  }
});

// 创建练习
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { question_id } = req.body;
    
    // 检查题目是否存在
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 增加题目使用次数
    db.prepare('UPDATE questions SET use_count = use_count + 1 WHERE id = ?').run(question_id);
    
    const result = db.prepare(`
      INSERT INTO practices (question_id, status)
      VALUES (?, 'draft')
    `).run(question_id);
    
    const practice = db.prepare('SELECT * FROM practices WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({
      success: true,
      data: practice,
      message: '练习创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建练习失败',
      error: error.message
    });
  }
});

// 更新练习（保存草稿）
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { content, time_spent } = req.body;
    
    // 计算字数（去除空格和标点）
    const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0;
    
    // 更新练习
    db.prepare(`
      UPDATE practices SET
        content = ?,
        word_count = ?,
        time_spent = COALESCE(?, time_spent),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, wordCount, time_spent, id);
    
    // 保存草稿历史
    db.prepare(`
      INSERT INTO practice_drafts (practice_id, content)
      VALUES (?, ?)
    `).run(id, content);
    
    res.json({
      success: true,
      data: { word_count: wordCount },
      message: '保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存失败',
      error: error.message
    });
  }
});

// 提交练习
router.post('/:id/submit', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { content, time_spent } = req.body;
    
    // 计算字数
    const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0;
    
    // 更新练习状态
    db.prepare(`
      UPDATE practices SET
        content = ?,
        word_count = ?,
        time_spent = COALESCE(?, time_spent),
        status = 'submitted',
        submitted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, wordCount, time_spent, id);
    
    res.json({
      success: true,
      message: '提交成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '提交失败',
      error: error.message
    });
  }
});

// 删除练习
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 删除相关草稿
    db.prepare('DELETE FROM practice_drafts WHERE practice_id = ?').run(id);
    // 删除相关评审
    db.prepare('DELETE FROM evaluations WHERE practice_id = ?').run(id);
    // 删除练习
    db.prepare('DELETE FROM practices WHERE id = ?').run(id);
    
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

// 获取草稿历史
router.get('/:id/drafts', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const drafts = db.prepare(`
      SELECT * FROM practice_drafts 
      WHERE practice_id = ? 
      ORDER BY saved_at DESC
      LIMIT 20
    `).all(id);
    
    res.json({
      success: true,
      data: drafts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取草稿历史失败',
      error: error.message
    });
  }
});

module.exports = router;
