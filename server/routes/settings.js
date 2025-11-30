const express = require('express');
const router = express.Router();
const { getDatabase, getMigrationStatus } = require('../database/init');
const fs = require('fs');
const path = require('path');

// 获取所有设置
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM settings').all();
    
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json({
      success: true,
      data: settingsMap
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取设置失败',
      error: error.message
    });
  }
});

// 更新设置
router.put('/', (req, res) => {
  try {
    const db = getDatabase();
    const settings = req.body;
    
    const upsert = db.prepare(`
      INSERT INTO settings (key, value, updated_at) 
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `);
    
    const updateMany = db.transaction((items) => {
      for (const [key, value] of Object.entries(items)) {
        upsert.run(key, String(value), String(value));
      }
    });
    
    updateMany(settings);
    
    res.json({
      success: true,
      message: '设置已保存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存设置失败',
      error: error.message
    });
  }
});

// 导出数据
router.post('/data/export', (req, res) => {
  try {
    const db = getDatabase();
    
    // 导出所有表数据
    const data = {
      exportTime: new Date().toISOString(),
      version: '1.0',
      tables: {
        ai_config: db.prepare('SELECT * FROM ai_config').all(),
        prompt_templates: db.prepare('SELECT * FROM prompt_templates').all(),
        questions: db.prepare('SELECT * FROM questions').all(),
        practices: db.prepare('SELECT * FROM practices').all(),
        evaluations: db.prepare('SELECT * FROM evaluations').all(),
        settings: db.prepare('SELECT * FROM settings').all()
      }
    };
    
    // 移除敏感信息
    data.tables.ai_config.forEach(c => {
      c.api_key = null;
    });
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出数据失败',
      error: error.message
    });
  }
});

// 导入数据
router.post('/data/import', (req, res) => {
  try {
    const db = getDatabase();
    const { data } = req.body;
    
    if (!data || !data.tables) {
      return res.status(400).json({
        success: false,
        message: '无效的导入数据'
      });
    }
    
    const importData = db.transaction(() => {
      // 导入题目
      if (data.tables.questions) {
        const insertQuestion = db.prepare(`
          INSERT OR REPLACE INTO questions (id, type, difficulty, title, content, is_favorite, use_count, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.tables.questions.forEach(q => {
          insertQuestion.run(q.id, q.type, q.difficulty, q.title, q.content, q.is_favorite, q.use_count, q.created_at);
        });
      }
      
      // 导入练习
      if (data.tables.practices) {
        const insertPractice = db.prepare(`
          INSERT OR REPLACE INTO practices (id, question_id, content, word_count, time_spent, status, submitted_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.tables.practices.forEach(p => {
          insertPractice.run(p.id, p.question_id, p.content, p.word_count, p.time_spent, p.status, p.submitted_at, p.created_at, p.updated_at);
        });
      }
      
      // 导入评审
      if (data.tables.evaluations) {
        const insertEvaluation = db.prepare(`
          INSERT OR REPLACE INTO evaluations (id, practice_id, total_score, dimension_scores, highlights, improvements, overall_comment, raw_response, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        data.tables.evaluations.forEach(e => {
          insertEvaluation.run(e.id, e.practice_id, e.total_score, e.dimension_scores, e.highlights, e.improvements, e.overall_comment, e.raw_response, e.created_at);
        });
      }
    });
    
    importData();
    
    res.json({
      success: true,
      message: '数据导入成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入数据失败',
      error: error.message
    });
  }
});

// 备份数据库
router.post('/data/backup', (req, res) => {
  try {
    const db = getDatabase();
    const backupDir = path.join(__dirname, '../database/backups');
    
    // 创建备份目录
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `backup_${timestamp}.db`);
    
    // 使用 SQLite 的备份功能
    db.backup(backupPath);
    
    res.json({
      success: true,
      message: '备份成功',
      data: { path: backupPath }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '备份失败',
      error: error.message
    });
  }
});

// 重置所有数据
router.post('/data/reset', (req, res) => {
  try {
    const db = getDatabase();
    const { confirmText } = req.body;
    
    if (confirmText !== 'RESET') {
      return res.status(400).json({
        success: false,
        message: '请输入确认文本 "RESET"'
      });
    }
    
    // 清空所有数据表（保留结构）
    db.exec(`
      DELETE FROM evaluations;
      DELETE FROM practice_drafts;
      DELETE FROM practices;
      DELETE FROM question_tags;
      DELETE FROM questions;
      DELETE FROM prompt_history;
    `);
    
    res.json({
      success: true,
      message: '数据已重置'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '重置失败',
      error: error.message
    });
  }
});

// 获取数据库迁移状态
router.get('/database/status', (req, res) => {
  try {
    const db = getDatabase();
    const status = getMigrationStatus(db);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取数据库状态失败',
      error: error.message
    });
  }
});

module.exports = router;
