const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature, AI_FEATURES } = require('../services/aiService');
const DEFAULT_SKILLS = require('../database/seeds/defaultSkills');

// 扩展 AI_FEATURES
const SKILL_FEATURES = {
  SKILL_GENERATE: 'skill_generate',
  SKILL_PRACTICE_GENERATE: 'skill_practice_generate',
  SKILL_PRACTICE_EVALUATE: 'skill_practice_evaluate'
};

// 技巧分类定义
const SKILL_CATEGORIES = [
  { key: 'opening', name: '开篇技巧', icon: '🚀', description: '文章开头写作技巧' },
  { key: 'dialogue', name: '对白技巧', icon: '💬', description: '人物对话相关技巧' },
  { key: 'description', name: '描写技巧', icon: '🎨', description: '各类描写手法' },
  { key: 'narrative', name: '叙事技巧', icon: '📖', description: '叙事方法和视角' },
  { key: 'structure', name: '结构技巧', icon: '🏗️', description: '情节结构设计' },
  { key: 'emotion', name: '情感技巧', icon: '❤️', description: '情感表达和渲染' },
  { key: 'comprehensive', name: '综合技巧', icon: '⭐', description: '综合性写作技巧' }
];

// 获取分类列表
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    data: SKILL_CATEGORIES
  });
});

// 获取知识点列表
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { category, difficulty, source, search, page = 1, pageSize = 20 } = req.query;
    
    let query = 'SELECT * FROM writing_skills WHERE is_active = 1';
    const params = [];
    
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    
    if (difficulty) {
      query += ' AND difficulty = ?';
      params.push(difficulty);
    }
    
    if (source) {
      query += ' AND source = ?';
      params.push(source);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR summary LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).get(...params);
    
    // 分页
    const offset = (page - 1) * pageSize;
    query += ' ORDER BY category, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const skills = db.prepare(query).all(...params);
    
    // 解析 JSON 字段
    const parsedSkills = skills.map(skill => ({
      ...skill,
      key_points: skill.key_points ? JSON.parse(skill.key_points) : [],
      examples: skill.examples ? JSON.parse(skill.examples) : [],
      common_mistakes: skill.common_mistakes ? JSON.parse(skill.common_mistakes) : [],
      related_skills: skill.related_skills ? JSON.parse(skill.related_skills) : []
    }));
    
    res.json({
      success: true,
      data: parsedSkills,
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取知识点列表失败',
      error: error.message
    });
  }
});

// 获取单个知识点详情
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const skill = db.prepare('SELECT * FROM writing_skills WHERE id = ?').get(id);
    
    if (!skill) {
      return res.status(404).json({
        success: false,
        message: '知识点不存在'
      });
    }
    
    // 解析 JSON 字段
    const parsedSkill = {
      ...skill,
      key_points: skill.key_points ? JSON.parse(skill.key_points) : [],
      examples: skill.examples ? JSON.parse(skill.examples) : [],
      common_mistakes: skill.common_mistakes ? JSON.parse(skill.common_mistakes) : [],
      related_skills: skill.related_skills ? JSON.parse(skill.related_skills) : []
    };
    
    // 获取相关技巧的名称
    if (parsedSkill.related_skills.length > 0) {
      const relatedSkills = db.prepare(
        `SELECT id, name FROM writing_skills WHERE id IN (${parsedSkill.related_skills.join(',')})`
      ).all();
      parsedSkill.relatedSkillsInfo = relatedSkills;
    }
    
    // 获取练习统计
    const practiceStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'evaluated' THEN 1 ELSE 0 END) as evaluated
      FROM skill_practices WHERE skill_id = ?
    `).get(id);
    
    parsedSkill.practiceStats = practiceStats;
    
    res.json({
      success: true,
      data: parsedSkill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取知识点详情失败',
      error: error.message
    });
  }
});

// 创建知识点
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const {
      name, category, difficulty, summary, content,
      key_points, examples, common_mistakes, practice_advice,
      related_skills, source = 'user'
    } = req.body;
    
    if (!name || !category) {
      return res.status(400).json({
        success: false,
        message: '名称和分类是必填项'
      });
    }
    
    const result = db.prepare(`
      INSERT INTO writing_skills (
        name, category, difficulty, summary, content,
        key_points, examples, common_mistakes, practice_advice,
        related_skills, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      category,
      difficulty || 'medium',
      summary || '',
      content || '',
      JSON.stringify(key_points || []),
      JSON.stringify(examples || []),
      JSON.stringify(common_mistakes || []),
      practice_advice || '',
      JSON.stringify(related_skills || []),
      source
    );
    
    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
      message: '知识点创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建知识点失败',
      error: error.message
    });
  }
});

// 更新知识点
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const {
      name, category, difficulty, summary, content,
      key_points, examples, common_mistakes, practice_advice,
      related_skills, is_active
    } = req.body;
    
    const existing = db.prepare('SELECT * FROM writing_skills WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '知识点不存在'
      });
    }
    
    db.prepare(`
      UPDATE writing_skills SET
        name = ?,
        category = ?,
        difficulty = ?,
        summary = ?,
        content = ?,
        key_points = ?,
        examples = ?,
        common_mistakes = ?,
        practice_advice = ?,
        related_skills = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || existing.name,
      category || existing.category,
      difficulty || existing.difficulty,
      summary !== undefined ? summary : existing.summary,
      content !== undefined ? content : existing.content,
      key_points ? JSON.stringify(key_points) : existing.key_points,
      examples ? JSON.stringify(examples) : existing.examples,
      common_mistakes ? JSON.stringify(common_mistakes) : existing.common_mistakes,
      practice_advice !== undefined ? practice_advice : existing.practice_advice,
      related_skills ? JSON.stringify(related_skills) : existing.related_skills,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id
    );
    
    res.json({
      success: true,
      message: '知识点更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新知识点失败',
      error: error.message
    });
  }
});

// 删除知识点
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const skill = db.prepare('SELECT * FROM writing_skills WHERE id = ?').get(id);
    if (!skill) {
      return res.status(404).json({
        success: false,
        message: '知识点不存在'
      });
    }
    
    // 检查是否为预设知识点
    if (skill.source === 'preset') {
      return res.status(400).json({
        success: false,
        message: '预设知识点不能删除，可以选择禁用'
      });
    }
    
    db.prepare('DELETE FROM writing_skills WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '知识点删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除知识点失败',
      error: error.message
    });
  }
});

// AI 生成知识点
router.post('/generate', async (req, res) => {
  try {
    const db = getDatabase();
    const { skillName, category, description } = req.body;
    
    if (!skillName) {
      return res.status(400).json({
        success: false,
        message: '请提供技巧名称'
      });
    }
    
    // 获取 Prompt 模板
    const template = db.prepare(`
      SELECT content FROM prompt_templates 
      WHERE category = 'skill' AND type = 'generate' AND is_active = 1
      ORDER BY is_default DESC LIMIT 1
    `).get();
    
    if (!template) {
      return res.status(500).json({
        success: false,
        message: '未找到知识点生成 Prompt 模板'
      });
    }
    
    // 替换变量
    let prompt = template.content
      .replace(/\{\{skillName\}\}/g, skillName);
    
    if (category) {
      prompt = prompt.replace(/\{\{#category\}\}[\s\S]*?\{\{\/category\}\}/g, `所属分类：${category}`);
    } else {
      prompt = prompt.replace(/\{\{#category\}\}[\s\S]*?\{\{\/category\}\}/g, '');
    }
    
    // 添加用户提供的描述说明
    if (description) {
      prompt += `\n\n【用户对该知识点的描述说明】\n${description}\n\n请根据以上描述说明，生成更符合用户需求的知识点内容。`;
    }
    
    // 调用 AI
    const response = await callAIForFeature(SKILL_FEATURES.SKILL_GENERATE, [
      { role: 'user', content: prompt }
    ]);
    
    // 解析 AI 返回的 JSON
    let skillData;
    try {
      let jsonContent = response.content;
      
      // 如果内容被包裹在markdown代码块中，提取JSON
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      // 清理可能存在的HTML标签
      jsonContent = jsonContent.replace(/<[^>]*>/g, '');
      
      // 尝试解析JSON，如果失败则尝试提取JSON对象
      try {
        skillData = JSON.parse(jsonContent.trim());
      } catch (firstError) {
        // 如果直接解析失败，尝试查找JSON对象
        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          skillData = JSON.parse(jsonObjectMatch[0]);
        } else {
          throw firstError;
        }
      }
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: 'AI 返回数据解析失败',
        error: parseError.message
      });
    }
    
    res.json({
      success: true,
      data: skillData,
      message: '知识点生成成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI 生成知识点失败',
      error: error.message
    });
  }
});

// 记录学习
router.post('/:id/study', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { duration, completed } = req.body;
    
    // 记录学习日志
    db.prepare(`
      INSERT INTO skill_study_logs (skill_id, study_duration, completed)
      VALUES (?, ?, ?)
    `).run(id, duration || 0, completed ? 1 : 0);
    
    // 更新知识点学习次数
    db.prepare(`
      UPDATE writing_skills SET
        study_count = study_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    res.json({
      success: true,
      message: '学习记录已保存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存学习记录失败',
      error: error.message
    });
  }
});

// 生成练习题
router.post('/:id/practice/generate', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { keywords, description, saveToBank = true, wordCountMin = 200, wordCountMax = 500 } = req.body;
    
    // 验证字数区间参数
    const minCount = Math.max(10, Math.min(30000, parseInt(wordCountMin) || 200));
    const maxCount = Math.max(minCount + 10, Math.min(30000, parseInt(wordCountMax) || 500));
    
    // 获取知识点信息
    const skill = db.prepare('SELECT * FROM writing_skills WHERE id = ?').get(id);
    if (!skill) {
      return res.status(404).json({
        success: false,
        message: '知识点不存在'
      });
    }
    
    // 获取 Prompt 模板
    const template = db.prepare(`
      SELECT content FROM prompt_templates 
      WHERE category = 'skill' AND type = 'practice_generate' AND is_active = 1
      ORDER BY is_default DESC LIMIT 1
    `).get();
    
    if (!template) {
      return res.status(500).json({
        success: false,
        message: '未找到练习题生成 Prompt 模板'
      });
    }
    
    const keyPoints = skill.key_points ? JSON.parse(skill.key_points) : [];
    
    // 构建用户自定义要求
    let customRequirements = '';
    if (keywords) {
      customRequirements += `\n用户希望题目包含以下关键词或元素：${keywords}`;
    }
    if (description) {
      customRequirements += `\n用户对题目的具体要求：${description}`;
    }
    // 添加字数区间要求
    customRequirements += `\n目标字数要求：${minCount}-${maxCount}字。请确保生成的题目难度与字数要求匹配，输出JSON中的wordCountRange字段必须设置为{"min":${minCount},"max":${maxCount}}。`;
    
    // 替换变量
    let prompt = template.content
      .replace(/\{\{skillId\}\}/g, id)
      .replace(/\{\{skillName\}\}/g, skill.name)
      .replace(/\{\{category\}\}/g, skill.category)
      .replace(/\{\{difficulty\}\}/g, skill.difficulty)
      .replace(/\{\{summary\}\}/g, skill.summary || '')
      .replace(/\{\{keyPoints\}\}/g, keyPoints.join('\n'));
    
    // 添加用户自定义要求
    if (customRequirements) {
      prompt += `\n\n【用户自定义要求】${customRequirements}`;
    }
    
    // 调用 AI
    const response = await callAIForFeature(SKILL_FEATURES.SKILL_PRACTICE_GENERATE, [
      { role: 'user', content: prompt }
    ]);
    
    // 解析 AI 返回的 JSON
    let questionData;
    try {
      let jsonContent = response.content;
      
      // 如果内容被包裹在markdown代码块中，提取JSON
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      // 清理可能存在的HTML标签
      jsonContent = jsonContent.replace(/<[^>]*>/g, '');
      
      // 尝试解析JSON，如果失败则尝试提取JSON对象
      try {
        questionData = JSON.parse(jsonContent.trim());
      } catch (firstError) {
        // 如果直接解析失败，尝试查找JSON对象
        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          questionData = JSON.parse(jsonObjectMatch[0]);
        } else {
          throw firstError;
        }
      }
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: 'AI 返回数据解析失败',
        error: parseError.message
      });
    }
    
    // 保存到题库
    let questionBankId = null;
    if (saveToBank) {
      try {
        const insertResult = db.prepare(`
          INSERT INTO skill_question_bank (skill_id, title, content, keywords, difficulty)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          id,
          questionData.title || '练习题',
          JSON.stringify(questionData),
          keywords || '',
          skill.difficulty || 'medium'
        );
        questionBankId = insertResult.lastInsertRowid;
      } catch (saveError) {
        console.error('保存到题库失败:', saveError);
        // 不影响返回结果
      }
    }
    
    res.json({
      success: true,
      data: {
        ...questionData,
        questionBankId
      },
      message: '练习题生成成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI 生成练习题失败',
      error: error.message
    });
  }
});

// 获取知识点的题库列表
router.get('/:id/questions', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { page = 1, pageSize = 20 } = req.query;
    
    const offset = (page - 1) * pageSize;
    
    const questions = db.prepare(`
      SELECT * FROM skill_question_bank 
      WHERE skill_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(id, pageSize, offset);
    
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM skill_question_bank 
      WHERE skill_id = ? AND is_active = 1
    `).get(id).count;
    
    // 解析 content JSON
    const formattedQuestions = questions.map(q => ({
      ...q,
      content: JSON.parse(q.content)
    }));
    
    res.json({
      success: true,
      data: {
        list: formattedQuestions,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取题库列表失败',
      error: error.message
    });
  }
});

// 删除练习记录
router.delete('/practices/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    
    // 检查练习是否存在
    const practice = db.prepare('SELECT * FROM skill_practices WHERE id = ?').get(practiceId);
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习记录不存在'
      });
    }
    
    // 删除相关的评审记录
    db.prepare('DELETE FROM skill_evaluations WHERE practice_id = ?').run(practiceId);
    
    // 删除练习记录
    db.prepare('DELETE FROM skill_practices WHERE id = ?').run(practiceId);
    
    // 更新知识点练习次数
    db.prepare(`
      UPDATE writing_skills SET
        practice_count = practice_count - 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(practice.skill_id);
    
    res.json({
      success: true,
      message: '练习记录已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除练习记录失败',
      error: error.message
    });
  }
});

// 删除题库中的题目
router.delete('/questions/:questionId', (req, res) => {
  try {
    const db = getDatabase();
    const { questionId } = req.params;
    
    // 软删除
    db.prepare(`
      UPDATE skill_question_bank 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(questionId);
    
    res.json({
      success: true,
      message: '题目已删除'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除题目失败',
      error: error.message
    });
  }
});

// 从题库选择题目创建练习
router.post('/questions/:questionId/use', (req, res) => {
  try {
    const db = getDatabase();
    const { questionId } = req.params;
    
    // 获取题目
    const question = db.prepare(`
      SELECT * FROM skill_question_bank WHERE id = ? AND is_active = 1
    `).get(questionId);
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }
    
    // 更新使用次数
    db.prepare(`
      UPDATE skill_question_bank 
      SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(questionId);
    
    const content = JSON.parse(question.content);
    
    // 创建练习记录（尝试添加 question_bank_id，如果字段不存在则忽略）
    let result;
    try {
      result = db.prepare(`
        INSERT INTO skill_practices (skill_id, question_title, question_content, status, question_bank_id)
        VALUES (?, ?, ?, 'draft', ?)
      `).run(question.skill_id, question.title, question.content, questionId);
    } catch (e) {
      // 如果 question_bank_id 字段不存在，回退到不包含该字段的插入
      result = db.prepare(`
        INSERT INTO skill_practices (skill_id, question_title, question_content, status)
        VALUES (?, ?, ?, 'draft')
      `).run(question.skill_id, question.title, question.content);
    }
    
    // 更新知识点练习次数
    db.prepare(`
      UPDATE writing_skills SET
        practice_count = practice_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(question.skill_id);
    
    res.json({
      success: true,
      data: {
        practiceId: result.lastInsertRowid,
        skillId: question.skill_id,
        question: content
      },
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

// 创建练习
router.post('/:id/practice', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { questionTitle, questionContent } = req.body;
    
    const result = db.prepare(`
      INSERT INTO skill_practices (skill_id, question_title, question_content, status)
      VALUES (?, ?, ?, 'draft')
    `).run(id, questionTitle, JSON.stringify(questionContent));
    
    // 更新知识点练习次数
    db.prepare(`
      UPDATE writing_skills SET
        practice_count = practice_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    res.json({
      success: true,
      data: { id: result.lastInsertRowid },
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

// 获取练习列表
router.get('/:id/practices', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { status, page = 1, pageSize = 10 } = req.query;
    
    let query = 'SELECT * FROM skill_practices WHERE skill_id = ?';
    const params = [id];
    
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
    const { total } = db.prepare(countQuery).get(...params);
    
    const offset = (page - 1) * pageSize;
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const practices = db.prepare(query).all(...params);
    
    res.json({
      success: true,
      data: practices.map(p => ({
        ...p,
        question_content: p.question_content ? JSON.parse(p.question_content) : null
      })),
      pagination: {
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total,
        totalPages: Math.ceil(total / pageSize)
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

// 获取练习详情（独立路由）
router.get('/practices/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    
    const practice = db.prepare(`
      SELECT sp.*, ws.name as skill_name, ws.category, ws.key_points
      FROM skill_practices sp
      JOIN writing_skills ws ON sp.skill_id = ws.id
      WHERE sp.id = ?
    `).get(practiceId);
    
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }
    
    // 获取评审结果
    const evaluation = db.prepare(`
      SELECT * FROM skill_evaluations WHERE practice_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(practiceId);
    
    res.json({
      success: true,
      data: {
        ...practice,
        question_content: practice.question_content ? JSON.parse(practice.question_content) : null,
        key_points: practice.key_points ? JSON.parse(practice.key_points) : [],
        evaluation: evaluation ? {
          ...evaluation,
          dimension_scores: evaluation.dimension_scores ? JSON.parse(evaluation.dimension_scores) : null,
          skill_analysis: evaluation.skill_analysis ? JSON.parse(evaluation.skill_analysis) : null,
          highlights: evaluation.highlights ? JSON.parse(evaluation.highlights) : [],
          improvements: evaluation.improvements ? JSON.parse(evaluation.improvements) : []
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取练习详情失败',
      error: error.message
    });
  }
});

// 更新练习（保存草稿）
router.put('/practices/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    const { userAnswer, timeSpent } = req.body;
    
    const wordCount = userAnswer ? userAnswer.replace(/\s/g, '').length : 0;
    
    db.prepare(`
      UPDATE skill_practices SET
        user_answer = ?,
        word_count = ?,
        time_spent = COALESCE(time_spent, 0) + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userAnswer, wordCount, timeSpent || 0, practiceId);
    
    res.json({
      success: true,
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
router.post('/practices/:practiceId/submit', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    const { userAnswer, timeSpent } = req.body;
    
    const wordCount = userAnswer ? userAnswer.replace(/\s/g, '').length : 0;
    
    db.prepare(`
      UPDATE skill_practices SET
        user_answer = ?,
        word_count = ?,
        time_spent = COALESCE(time_spent, 0) + ?,
        status = 'submitted',
        submitted_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userAnswer, wordCount, timeSpent || 0, practiceId);
    
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

// AI 评审练习
router.post('/practices/:practiceId/evaluate', async (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    
    // 获取练习信息
    const practice = db.prepare(`
      SELECT sp.*, ws.name as skill_name, ws.key_points
      FROM skill_practices sp
      JOIN writing_skills ws ON sp.skill_id = ws.id
      WHERE sp.id = ?
    `).get(practiceId);
    
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }
    
    if (!practice.user_answer) {
      return res.status(400).json({
        success: false,
        message: '请先提交作品'
      });
    }
    
    // 获取 Prompt 模板
    const template = db.prepare(`
      SELECT content FROM prompt_templates 
      WHERE category = 'skill' AND type = 'evaluate' AND is_active = 1
      ORDER BY is_default DESC LIMIT 1
    `).get();
    
    if (!template) {
      return res.status(500).json({
        success: false,
        message: '未找到评审 Prompt 模板'
      });
    }
    
    const keyPoints = practice.key_points ? JSON.parse(practice.key_points) : [];
    const questionContent = practice.question_content ? JSON.parse(practice.question_content) : {};
    
    // 替换变量
    let prompt = template.content
      .replace(/\{\{skillName\}\}/g, practice.skill_name)
      .replace(/\{\{keyPoints\}\}/g, keyPoints.join('\n'))
      .replace(/\{\{questionContent\}\}/g, JSON.stringify(questionContent, null, 2))
      .replace(/\{\{userAnswer\}\}/g, practice.user_answer);
    
    // 调用 AI
    const response = await callAIForFeature(SKILL_FEATURES.SKILL_PRACTICE_EVALUATE, [
      { role: 'user', content: prompt }
    ]);
    
    // 解析 AI 返回的 JSON
    let evaluationData;
    try {
      let jsonContent = response.content;
      
      // 如果内容被包裹在markdown代码块中，提取JSON
      const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }
      
      // 清理可能存在的HTML标签
      jsonContent = jsonContent.replace(/<[^>]*>/g, '');
      
      // 尝试解析JSON，如果失败则尝试提取JSON对象
      try {
        evaluationData = JSON.parse(jsonContent.trim());
      } catch (firstError) {
        // 如果直接解析失败，尝试查找JSON对象
        const jsonObjectMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          evaluationData = JSON.parse(jsonObjectMatch[0]);
        } else {
          throw firstError;
        }
      }
    } catch (parseError) {
      return res.status(500).json({
        success: false,
        message: 'AI 返回数据解析失败',
        error: parseError.message
      });
    }
    
    // 保存评审结果
    db.prepare(`
      INSERT INTO skill_evaluations (
        practice_id, skill_id, total_score, grade, dimension_scores,
        skill_analysis, highlights, improvements, overall_comment,
        mastery_level, next_step_advice, raw_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      practiceId,
      practice.skill_id,
      evaluationData.totalScore,
      evaluationData.grade,
      JSON.stringify(evaluationData.dimensions),
      JSON.stringify(evaluationData.skillAnalysis),
      JSON.stringify(evaluationData.highlights),
      JSON.stringify(evaluationData.improvements),
      evaluationData.overallComment,
      evaluationData.masteryLevel,
      evaluationData.nextStepAdvice,
      response.content
    );
    
    // 更新练习状态
    db.prepare(`
      UPDATE skill_practices SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(practiceId);
    
    // 更新知识点平均分
    const avgScore = db.prepare(`
      SELECT AVG(total_score) as avg FROM skill_evaluations WHERE skill_id = ?
    `).get(practice.skill_id);
    
    db.prepare(`
      UPDATE writing_skills SET avg_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(avgScore.avg || 0, practice.skill_id);
    
    res.json({
      success: true,
      data: evaluationData,
      message: '评审完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI 评审失败',
      error: error.message
    });
  }
});

// 获取学习统计
router.get('/statistics/overview', (req, res) => {
  try {
    const db = getDatabase();
    
    // 总体统计
    const overview = db.prepare(`
      SELECT 
        COUNT(*) as total_skills,
        SUM(study_count) as total_study,
        SUM(practice_count) as total_practice
      FROM writing_skills WHERE is_active = 1
    `).get();
    
    // 按分类统计
    const byCategory = db.prepare(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(study_count) as study_count,
        SUM(practice_count) as practice_count,
        AVG(avg_score) as avg_score
      FROM writing_skills WHERE is_active = 1
      GROUP BY category
    `).all();
    
    // 最近练习
    const recentPractices = db.prepare(`
      SELECT sp.*, ws.name as skill_name
      FROM skill_practices sp
      JOIN writing_skills ws ON sp.skill_id = ws.id
      ORDER BY sp.created_at DESC
      LIMIT 5
    `).all();
    
    // 评审统计
    const evaluationStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score
      FROM skill_evaluations
    `).get();
    
    res.json({
      success: true,
      data: {
        overview,
        byCategory,
        recentPractices: recentPractices.map(p => ({
          ...p,
          question_content: p.question_content ? JSON.parse(p.question_content) : null
        })),
        evaluationStats
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

// ==================== 默认技巧初始化 ====================

// 检查是否已初始化默认技巧
router.get('/preset/status', (req, res) => {
  try {
    const db = getDatabase();
    
    const presetCount = db.prepare(
      "SELECT COUNT(*) as count FROM writing_skills WHERE source = 'preset'"
    ).get();
    
    const totalPresets = DEFAULT_SKILLS.length;
    
    res.json({
      success: true,
      data: {
        initialized: presetCount.count > 0,
        presetCount: presetCount.count,
        totalPresets,
        needsUpdate: presetCount.count < totalPresets
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取预设状态失败',
      error: error.message
    });
  }
});

// 初始化默认技巧
router.post('/preset/init', (req, res) => {
  try {
    const db = getDatabase();
    const { force = false } = req.body;
    
    // 如果强制重新初始化，先删除旧的预设
    if (force) {
      db.prepare("DELETE FROM writing_skills WHERE source = 'preset'").run();
    }
    
    // 获取已存在的预设名称（用于去重）
    const existingNames = db.prepare(
      "SELECT name FROM writing_skills WHERE source = 'preset'"
    ).all().map(row => row.name);
    
    // 插入语句
    const insertStmt = db.prepare(`
      INSERT INTO writing_skills (
        name, category, difficulty, summary, content,
        key_points, examples, common_mistakes, practice_advice, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'preset')
    `);
    
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const skill of DEFAULT_SKILLS) {
      // 跳过已存在的
      if (existingNames.includes(skill.name)) {
        skippedCount++;
        continue;
      }
      
      insertStmt.run(
        skill.name,
        skill.category,
        skill.difficulty,
        skill.summary,
        skill.content,
        JSON.stringify(skill.key_points || []),
        JSON.stringify(skill.examples || []),
        JSON.stringify(skill.common_mistakes || []),
        skill.practice_advice || ''
      );
      addedCount++;
    }
    
    res.json({
      success: true,
      message: `初始化完成：新增 ${addedCount} 个，跳过 ${skippedCount} 个重复项`,
      data: {
        added: addedCount,
        skipped: skippedCount,
        total: DEFAULT_SKILLS.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '初始化默认技巧失败',
      error: error.message
    });
  }
});

// ==================== 导入导出功能 ====================

// 导出知识点
router.get('/export', (req, res) => {
  try {
    const db = getDatabase();
    const { ids, category, all } = req.query;
    
    let query = 'SELECT * FROM writing_skills WHERE is_active = 1';
    const params = [];
    
    if (ids) {
      // 导出指定 ID 的知识点
      const idList = ids.split(',').map(id => parseInt(id));
      query += ` AND id IN (${idList.map(() => '?').join(',')})`;
      params.push(...idList);
    } else if (category) {
      // 导出指定分类
      query += ' AND category = ?';
      params.push(category);
    } else if (all !== 'true') {
      // 默认只导出用户创建的（非预设）
      query += " AND source != 'preset'";
    }
    
    const skills = db.prepare(query).all(...params);
    
    // 格式化为导出格式
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      count: skills.length,
      skills: skills.map(skill => ({
        name: skill.name,
        category: skill.category,
        difficulty: skill.difficulty,
        summary: skill.summary,
        content: skill.content,
        key_points: skill.key_points ? JSON.parse(skill.key_points) : [],
        examples: skill.examples ? JSON.parse(skill.examples) : [],
        common_mistakes: skill.common_mistakes ? JSON.parse(skill.common_mistakes) : [],
        practice_advice: skill.practice_advice,
        source: skill.source
      }))
    };
    
    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导出失败',
      error: error.message
    });
  }
});

// 导入知识点
router.post('/import', (req, res) => {
  try {
    const db = getDatabase();
    const { skills, overwrite = false } = req.body;
    
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要导入的知识点数据'
      });
    }
    
    // 获取已存在的知识点名称（用于去重）
    const existingSkills = db.prepare(
      'SELECT id, name FROM writing_skills'
    ).all();
    const existingNameMap = new Map(existingSkills.map(s => [s.name, s.id]));
    
    const insertStmt = db.prepare(`
      INSERT INTO writing_skills (
        name, category, difficulty, summary, content,
        key_points, examples, common_mistakes, practice_advice, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const updateStmt = db.prepare(`
      UPDATE writing_skills SET
        category = ?, difficulty = ?, summary = ?, content = ?,
        key_points = ?, examples = ?, common_mistakes = ?, practice_advice = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];
    
    for (const skill of skills) {
      try {
        // 验证必填字段
        if (!skill.name || !skill.category) {
          errors.push(`跳过无效数据：缺少名称或分类`);
          skippedCount++;
          continue;
        }
        
        const existingId = existingNameMap.get(skill.name);
        
        if (existingId) {
          if (overwrite) {
            // 覆盖更新
            updateStmt.run(
              skill.category,
              skill.difficulty || 'medium',
              skill.summary || '',
              skill.content || '',
              JSON.stringify(skill.key_points || []),
              JSON.stringify(skill.examples || []),
              JSON.stringify(skill.common_mistakes || []),
              skill.practice_advice || '',
              existingId
            );
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          // 新增
          insertStmt.run(
            skill.name,
            skill.category,
            skill.difficulty || 'medium',
            skill.summary || '',
            skill.content || '',
            JSON.stringify(skill.key_points || []),
            JSON.stringify(skill.examples || []),
            JSON.stringify(skill.common_mistakes || []),
            skill.practice_advice || '',
            'imported'
          );
          addedCount++;
        }
      } catch (itemError) {
        errors.push(`导入 "${skill.name}" 失败: ${itemError.message}`);
        skippedCount++;
      }
    }
    
    res.json({
      success: true,
      message: `导入完成：新增 ${addedCount} 个，更新 ${updatedCount} 个，跳过 ${skippedCount} 个`,
      data: {
        added: addedCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: skills.length,
        errors: errors.length > 0 ? errors : undefined
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

// 获取可用的默认技巧列表（用于选择性导入）
router.get('/preset/list', (req, res) => {
  try {
    const db = getDatabase();
    
    // 获取已存在的预设名称
    const existingNames = db.prepare(
      "SELECT name FROM writing_skills WHERE source = 'preset'"
    ).all().map(row => row.name);
    
    // 标记每个预设是否已存在
    const presetsWithStatus = DEFAULT_SKILLS.map(skill => ({
      name: skill.name,
      category: skill.category,
      difficulty: skill.difficulty,
      summary: skill.summary,
      exists: existingNames.includes(skill.name)
    }));
    
    res.json({
      success: true,
      data: presetsWithStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取默认技巧列表失败',
      error: error.message
    });
  }
});

module.exports = router;
