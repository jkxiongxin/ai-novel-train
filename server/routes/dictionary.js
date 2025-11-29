const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature, AI_FEATURES } = require('../services/aiService');

// 获取词典分类列表
router.get('/categories', (req, res) => {
  try {
    const db = getDatabase();
    const categories = db.prepare(`
      SELECT DISTINCT category FROM dictionary_words ORDER BY category
    `).all();
    
    res.json({
      success: true,
      data: categories.map(c => c.category)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取词典词汇列表
router.get('/words', (req, res) => {
  try {
    const db = getDatabase();
    const { category, keyword, page = 1, pageSize = 50 } = req.query;
    
    let sql = 'SELECT * FROM dictionary_words WHERE 1=1';
    const params = [];
    
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    
    if (keyword) {
      sql += ' AND (word LIKE ? OR meaning LIKE ? OR examples LIKE ?)';
      const kw = `%${keyword}%`;
      params.push(kw, kw, kw);
    }
    
    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countSql).get(...params);
    
    // 分页
    sql += ' ORDER BY use_count DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    const words = db.prepare(sql).all(...params);
    
    res.json({
      success: true,
      data: {
        list: words,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 添加词汇到词典
router.post('/words', (req, res) => {
  try {
    const db = getDatabase();
    const { word, category, meaning, examples, source = 'user' } = req.body;
    
    if (!word || !category) {
      return res.status(400).json({ success: false, message: '词汇和分类不能为空' });
    }
    
    const result = db.prepare(`
      INSERT INTO dictionary_words (word, category, meaning, examples, source)
      VALUES (?, ?, ?, ?, ?)
    `).run(word, category, meaning, examples, source);
    
    res.json({
      success: true,
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 批量添加词汇
router.post('/words/batch', (req, res) => {
  try {
    const db = getDatabase();
    const { words } = req.body;
    
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ success: false, message: '请提供词汇列表' });
    }
    
    const insert = db.prepare(`
      INSERT OR IGNORE INTO dictionary_words (word, category, meaning, examples, source)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((words) => {
      for (const w of words) {
        insert.run(w.word, w.category, w.meaning || '', w.examples || '', w.source || 'ai');
      }
    });
    
    insertMany(words);
    
    res.json({
      success: true,
      message: `成功添加 ${words.length} 个词汇`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 更新词汇
router.put('/words/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { word, category, meaning, examples } = req.body;
    
    db.prepare(`
      UPDATE dictionary_words 
      SET word = ?, category = ?, meaning = ?, examples = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(word, category, meaning, examples, id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 删除词汇
router.delete('/words/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    db.prepare('DELETE FROM dictionary_words WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 增加使用次数
router.post('/words/:id/use', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    db.prepare(`
      UPDATE dictionary_words SET use_count = use_count + 1 WHERE id = ?
    `).run(id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI 查询相关词汇
router.post('/ai/search', async (req, res) => {
  try {
    const db = getDatabase();
    const { query, context } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, message: '请输入查询内容' });
    }
    
    // 获取 AI 词典查询的 Prompt 模板
    let template = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE category = 'dictionary' AND type = 'search' AND is_active = 1
      ORDER BY is_default DESC
      LIMIT 1
    `).get();
    
    let prompt;
    if (template) {
      // 使用数据库中的模板
      prompt = template.content;
      prompt = prompt.replace(/{{query}}/g, query);
      prompt = prompt.replace(/{{context}}/g, context || '');
      // 处理条件块
      if (context) {
        prompt = prompt.replace(/{{#context}}[\s\S]*?{{\/context}}/g, (match) => {
          return match.replace(/{{#context}}/g, '').replace(/{{\/context}}/g, '');
        });
      } else {
        prompt = prompt.replace(/{{#context}}[\s\S]*?{{\/context}}/g, '');
      }
    } else {
      // 使用内置默认 Prompt
      prompt = `你是一个专业的中文写作助手，特别擅长帮助网络小说作者找到精准的词汇来描述动作、情感和场景。

用户想要查找能够表达"${query}"这个意思的词汇。
${context ? `写作上下文：${context}` : ''}

请提供10-15个相关的精准词汇，按照以下JSON格式返回：
{
  "words": [
    {
      "word": "词汇",
      "meaning": "词义解释",
      "category": "分类（如：动作、情感、表情、神态、语气等）",
      "examples": "使用示例（一个简短的句子）",
      "intensity": "程度（轻/中/重）",
      "formality": "语体（口语/书面/中性）"
    }
  ],
  "tips": "选词建议（一句话）"
}

要求：
1. 词汇要精准、生动，适合网络小说写作
2. 包含不同程度和语境的词汇供选择
3. 优先推荐动词，其次是形容词
4. 示例要简短且能体现词汇用法
5. 只返回JSON，不要其他说明`;
    }

    // 调用 AI 搜索词汇（功能锚点：dictionary_search）
    const result = await callAIForFeature(AI_FEATURES.DICTIONARY_SEARCH, [
      { role: 'user', content: prompt }
    ]);
    
    // 解析 AI 响应
    let parsedResult;
    try {
      // 尝试提取 JSON
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 AI 响应');
      }
    } catch (parseError) {
      return res.json({
        success: true,
        data: {
          words: [],
          tips: '解析失败，请重试',
          rawResponse: result.content
        }
      });
    }
    
    res.json({
      success: true,
      data: parsedResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// AI 生成专题词典
router.post('/ai/generate', async (req, res) => {
  try {
    const db = getDatabase();
    const { topic, count = 20 } = req.body;
    
    if (!topic) {
      return res.status(400).json({ success: false, message: '请输入词典主题' });
    }
    
    // 获取 AI 词典生成的 Prompt 模板
    let template = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE category = 'dictionary' AND type = 'generate' AND is_active = 1
      ORDER BY is_default DESC
      LIMIT 1
    `).get();
    
    let prompt;
    if (template) {
      // 使用数据库中的模板
      prompt = template.content;
      prompt = prompt.replace(/{{topic}}/g, topic);
      prompt = prompt.replace(/{{count}}/g, count.toString());
    } else {
      // 使用内置默认 Prompt
      prompt = `你是一个专业的中文写作词典编纂专家，帮助网络小说作者建立专属词汇库。

请为"${topic}"这个主题生成${count}个精选词汇，用于网络小说写作。

按照以下JSON格式返回：
{
  "topic": "${topic}",
  "words": [
    {
      "word": "词汇",
      "meaning": "词义解释",
      "category": "${topic}",
      "examples": "使用示例",
      "tags": ["标签1", "标签2"]
    }
  ]
}

要求：
1. 词汇要精准、生动、有画面感
2. 覆盖不同程度和场景
3. 包含常用词和高级词汇
4. 示例要简短且能体现词汇用法
5. 只返回JSON`;
    }

    // 调用 AI 生成词汇（功能锚点：dictionary_generate）
    const result = await callAIForFeature(AI_FEATURES.DICTIONARY_GENERATE, [
      { role: 'user', content: prompt }
    ]);
    
    let parsedResult;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析 AI 响应');
      }
    } catch (parseError) {
      return res.json({
        success: true,
        data: { words: [], rawResponse: result.content }
      });
    }
    
    res.json({
      success: true,
      data: parsedResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取词典统计
router.get('/stats', (req, res) => {
  try {
    const db = getDatabase();
    
    const totalWords = db.prepare('SELECT COUNT(*) as count FROM dictionary_words').get().count;
    const categories = db.prepare('SELECT COUNT(DISTINCT category) as count FROM dictionary_words').get().count;
    const userWords = db.prepare("SELECT COUNT(*) as count FROM dictionary_words WHERE source = 'user'").get().count;
    const aiWords = db.prepare("SELECT COUNT(*) as count FROM dictionary_words WHERE source = 'ai'").get().count;
    
    // 常用词汇 Top 10
    const topWords = db.prepare(`
      SELECT word, category, use_count FROM dictionary_words 
      ORDER BY use_count DESC LIMIT 10
    `).all();
    
    res.json({
      success: true,
      data: {
        totalWords,
        categories,
        userWords,
        aiWords,
        topWords
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
