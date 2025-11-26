const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature, AI_FEATURES } = require('../services/aiService');

// 获取题目列表
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { type, difficulty, is_favorite, page = 1, pageSize = 20 } = req.query;
    
    let query = 'SELECT * FROM questions WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM questions WHERE 1=1';
    const params = [];
    
    if (type) {
      query += ' AND type = ?';
      countQuery += ' AND type = ?';
      params.push(type);
    }
    
    if (difficulty) {
      query += ' AND difficulty = ?';
      countQuery += ' AND difficulty = ?';
      params.push(difficulty);
    }
    
    if (is_favorite !== undefined) {
      query += ' AND is_favorite = ?';
      countQuery += ' AND is_favorite = ?';
      params.push(is_favorite === 'true' ? 1 : 0);
    }
    
    const total = db.prepare(countQuery).get(...params).total;
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    const questions = db.prepare(query).all(...params, parseInt(pageSize), offset);
    
    // 解析 content JSON
    questions.forEach(q => {
      try {
        q.content = JSON.parse(q.content);
      } catch {}
    });
    
    res.json({
      success: true,
      data: {
        list: questions,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取题目列表失败',
      error: error.message
    });
  }
});

// 导出题目（必须放在 /:id 之前）
router.get('/export/json', (req, res) => {
  try {
    const db = getDatabase();
    const { type, difficulty, is_favorite, ids, all } = req.query;
    
    let query = 'SELECT * FROM questions WHERE 1=1';
    const params = [];
    
    // 如果指定了 ids，只导出这些题目
    if (ids) {
      const idList = ids.split(',').map(id => parseInt(id));
      query += ` AND id IN (${idList.map(() => '?').join(',')})`;
      params.push(...idList);
    } else if (all !== 'true') {
      // 非全量导出时，按筛选条件导出
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      if (difficulty) {
        query += ' AND difficulty = ?';
        params.push(difficulty);
      }
      
      if (is_favorite !== undefined) {
        query += ' AND is_favorite = ?';
        params.push(is_favorite === 'true' ? 1 : 0);
      }
    }
    // 如果 all=true，则不添加任何筛选条件，导出全部
    
    query += ' ORDER BY created_at DESC';
    
    const questions = db.prepare(query).all(...params);
    
    // 处理导出数据
    const exportData = questions.map(q => {
      // 获取标签
      const tags = db.prepare('SELECT tag FROM question_tags WHERE question_id = ?').all(q.id);
      
      // 解析 content
      let content = q.content;
      try {
        content = JSON.parse(q.content);
      } catch {}
      
      return {
        type: q.type,
        difficulty: q.difficulty,
        title: q.title,
        content: content,
        is_favorite: q.is_favorite === 1,
        tags: tags.map(t => t.tag),
        created_at: q.created_at
      };
    });
    
    const exportPackage = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      count: exportData.length,
      questions: exportData
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=questions_export_${Date.now()}.json`);
    res.json(exportPackage);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
});

// 导入题目
router.post('/import/json', (req, res) => {
  try {
    const db = getDatabase();
    const { questions, overwrite = false } = req.body;
    
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        message: '无效的导入数据格式'
      });
    }
    
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];
    
    const insertQuestion = db.prepare(`
      INSERT INTO questions (type, difficulty, title, content, is_favorite, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const insertTag = db.prepare(`
      INSERT INTO question_tags (question_id, tag) VALUES (?, ?)
    `);
    
    const checkExists = db.prepare(`
      SELECT id FROM questions WHERE title = ? AND type = ?
    `);
    
    const importTransaction = db.transaction((questions) => {
      for (const q of questions) {
        try {
          // 检查是否已存在
          const existing = checkExists.get(q.title, q.type);
          
          if (existing && !overwrite) {
            skipped++;
            continue;
          }
          
          // 如果存在且需要覆盖，先删除
          if (existing && overwrite) {
            db.prepare('DELETE FROM question_tags WHERE question_id = ?').run(existing.id);
            db.prepare('DELETE FROM questions WHERE id = ?').run(existing.id);
          }
          
          // 处理 content
          const content = typeof q.content === 'string' ? q.content : JSON.stringify(q.content);
          
          // 插入题目
          const result = insertQuestion.run(
            q.type || 'scene',
            q.difficulty || 'medium',
            q.title || '导入题目',
            content,
            q.is_favorite ? 1 : 0,
            q.created_at || new Date().toISOString()
          );
          
          // 插入标签
          if (q.tags && Array.isArray(q.tags)) {
            for (const tag of q.tags) {
              insertTag.run(result.lastInsertRowid, tag);
            }
          }
          
          imported++;
        } catch (err) {
          failed++;
          errors.push({ title: q.title, error: err.message });
        }
      }
    });
    
    importTransaction(questions);
    
    res.json({
      success: true,
      message: `导入完成：成功 ${imported} 个，跳过 ${skipped} 个，失败 ${failed} 个`,
      data: {
        imported,
        skipped,
        failed,
        errors: errors.slice(0, 10) // 只返回前10个错误
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入失败',
      error: error.message
    });
  }
});

// 生成新题目
router.post('/generate', async (req, res) => {
  try {
    const db = getDatabase();
    const { type, difficulty, extraParams = {} } = req.body;
    
    // 获取对应的 Prompt 模板
    const template = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE category = 'generator' AND type = ? AND is_active = 1
      ORDER BY is_default DESC
      LIMIT 1
    `).get(type);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: `找不到 ${type} 类型的生成器模板`
      });
    }
    
    // 替换变量
    let promptContent = template.content;
    promptContent = promptContent.replace(/{{difficulty}}/g, difficulty);
    
    // 处理关键词和用户想法
    if (extraParams.keywords) {
      promptContent = promptContent.replace(/{{keywords}}/g, extraParams.keywords);
    }
    if (extraParams.userIdea) {
      promptContent = promptContent.replace(/{{userIdea}}/g, extraParams.userIdea);
    }
    
    // 替换其他额外参数
    Object.entries(extraParams).forEach(([key, value]) => {
      if (!['keywords', 'userIdea'].includes(key)) {
        promptContent = promptContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    });
    
    // 调用 AI 生成题目（功能锚点：question_generate）
    const response = await callAIForFeature(AI_FEATURES.QUESTION_GENERATE, [
      { role: 'user', content: promptContent }
    ]);
    
    // 解析 AI 响应
    let questionData;
    try {
      // 尝试从响应中提取 JSON
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        questionData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 AI 响应');
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: '解析 AI 响应失败',
        error: parseError.message,
        rawResponse: response.content
      });
    }
    
    // 保存到数据库
    const result = db.prepare(`
      INSERT INTO questions (type, difficulty, title, content, generated_by_prompt_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      type,
      difficulty,
      questionData.title || `${type} 训练题`,
      JSON.stringify(questionData),
      template.id
    );
    
    const savedQuestion = db.prepare('SELECT * FROM questions WHERE id = ?').get(result.lastInsertRowid);
    savedQuestion.content = questionData;
    
    res.json({
      success: true,
      data: savedQuestion,
      message: '题目生成成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成题目失败',
      error: error.message
    });
  }
});

// 获取单个题目（必须放在其他具体路由之后）
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    try {
      question.content = JSON.parse(question.content);
    } catch {}
    
    // 获取标签
    const tags = db.prepare('SELECT tag FROM question_tags WHERE question_id = ?').all(id);
    question.tags = tags.map(t => t.tag);
    
    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取题目失败',
      error: error.message
    });
  }
});

// 删除题目
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 删除相关标签
    db.prepare('DELETE FROM question_tags WHERE question_id = ?').run(id);
    // 删除题目
    db.prepare('DELETE FROM questions WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '题目删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除题目失败',
      error: error.message
    });
  }
});

// 收藏/取消收藏
router.put('/:id/favorite', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { is_favorite } = req.body;
    
    db.prepare('UPDATE questions SET is_favorite = ? WHERE id = ?').run(
      is_favorite ? 1 : 0,
      id
    );
    
    res.json({
      success: true,
      message: is_favorite ? '已收藏' : '已取消收藏'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '操作失败',
      error: error.message
    });
  }
});

// 增加使用次数
router.put('/:id/use', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    db.prepare('UPDATE questions SET use_count = use_count + 1 WHERE id = ?').run(id);
    
    res.json({
      success: true
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '操作失败',
      error: error.message
    });
  }
});

module.exports = router;
