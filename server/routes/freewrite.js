const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature, AI_FEATURES } = require('../services/aiService');

// 获取随心练习列表
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { status, page = 1, pageSize = 20 } = req.query;
    
    let query = `
      SELECT * FROM freewrite_practices
      WHERE 1=1
    `;
    let countQuery = 'SELECT COUNT(*) as total FROM freewrite_practices WHERE 1=1';
    const params = [];
    
    if (status) {
      query += ' AND status = ?';
      countQuery += ' AND status = ?';
      params.push(status);
    }
    
    const total = db.prepare(countQuery).get(...params).total;
    
    query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
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
      message: '获取随心练习列表失败',
      error: error.message
    });
  }
});

// 获取单个随心练习
router.get('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const practice = db.prepare(`
      SELECT * FROM freewrite_practices WHERE id = ?
    `).get(id);
    
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }
    
    // 获取评审记录
    const reviews = db.prepare(`
      SELECT * FROM freewrite_reviews 
      WHERE practice_id = ? 
      ORDER BY created_at DESC
    `).all(id);
    
    practice.reviews = reviews;
    
    res.json({
      success: true,
      data: practice
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取随心练习失败',
      error: error.message
    });
  }
});

// 创建新的随心练习
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const { title, pomodoro_duration, parent_id } = req.body;
    
    // 如果是续写，获取父练习的内容
    let initialContent = '';
    if (parent_id) {
      const parentPractice = db.prepare('SELECT content FROM freewrite_practices WHERE id = ?').get(parent_id);
      if (parentPractice) {
        initialContent = parentPractice.content || '';
      }
    }
    
    const result = db.prepare(`
      INSERT INTO freewrite_practices (title, content, pomodoro_duration, parent_id, status)
      VALUES (?, ?, ?, ?, 'writing')
    `).run(title || '随心练习', initialContent, pomodoro_duration || null, parent_id || null);
    
    const practice = db.prepare('SELECT * FROM freewrite_practices WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({
      success: true,
      data: practice,
      message: '创建成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建随心练习失败',
      error: error.message
    });
  }
});

// 更新随心练习（自动保存）
router.put('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { title, content, time_spent } = req.body;
    
    // 计算字数（去除空格和标点）
    const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0;
    
    // 更新练习
    db.prepare(`
      UPDATE freewrite_practices SET
        title = COALESCE(?, title),
        content = ?,
        word_count = ?,
        time_spent = COALESCE(?, time_spent),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(title, content, wordCount, time_spent, id);
    
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

// 完成随心练习（番茄钟结束或手动结束）
router.post('/:id/finish', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { content, time_spent, finish_type } = req.body;
    
    // 计算字数
    const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0;
    
    // 更新练习状态
    db.prepare(`
      UPDATE freewrite_practices SET
        content = ?,
        word_count = ?,
        time_spent = COALESCE(?, time_spent),
        status = 'finished',
        finish_type = ?,
        finished_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, wordCount, time_spent, finish_type || 'manual', id);
    
    const practice = db.prepare('SELECT * FROM freewrite_practices WHERE id = ?').get(id);
    
    res.json({
      success: true,
      data: practice,
      message: '练习完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '完成练习失败',
      error: error.message
    });
  }
});

// 用户自评
router.post('/:id/self-review', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { score, comment, tags } = req.body;
    
    // 保存自评结果
    const result = db.prepare(`
      INSERT INTO freewrite_reviews (practice_id, review_type, score, comment, tags)
      VALUES (?, 'self', ?, ?, ?)
    `).run(id, score, comment, JSON.stringify(tags || []));
    
    // 更新练习状态
    db.prepare(`
      UPDATE freewrite_practices SET
        status = 'reviewed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    const review = db.prepare('SELECT * FROM freewrite_reviews WHERE id = ?').get(result.lastInsertRowid);
    
    res.json({
      success: true,
      data: review,
      message: '自评保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存自评失败',
      error: error.message
    });
  }
});

// AI 评审
router.post('/:id/ai-review', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 获取练习信息
    const practice = db.prepare(`
      SELECT * FROM freewrite_practices WHERE id = ?
    `).get(id);
    
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }
    
    if (!practice.content || practice.content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '练习内容为空，无法评审'
      });
    }
    
    // 获取通用评审 Prompt，如果没有则使用内置 Prompt
    let template = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE category = 'evaluator' AND type = 'freewrite' AND is_active = 1
      ORDER BY is_default DESC
      LIMIT 1
    `).get();
    
    let promptContent;
    if (template) {
      promptContent = template.content;
      promptContent = promptContent.replace(/{{userAnswer}}/g, practice.content);
      promptContent = promptContent.replace(/{{title}}/g, practice.title || '随心练习');
    } else {
      // 使用内置的评审 Prompt - 严师风格
      promptContent = `你是一位严厉但负责任的写作导师，有着多年的文学创作和教学经验。你的职责是以高标准严格审视学生的作品，指出问题所在，并给出具体可执行的改进建议。

## 评审原则
1. **不要一味夸奖**：空洞的赞美对学生没有帮助，要指出真正的问题
2. **严格但公正**：打分要客观，不要因为鼓励而虚高分数
3. **建议要具体**：不说"写得不够好"，而要说"第二段的情感转折过于突兀，建议在此处增加心理活动的铺垫"
4. **以身作则**：如有必要，可以示范如何改写某个段落
5. **着眼成长**：批评是为了帮助学生进步，要让学生知道如何改进

## 待评审作品

**标题**：${practice.title || '随心练习'}

**内容**：
${practice.content}

## 评审维度（请严格按照标准评分，70分以上应该是真正优秀的作品）

1. **表达流畅度** (0-100分)
   - 语句是否通顺自然？
   - 有无病句、歧义、重复啰嗦？
   - 段落衔接是否流畅？

2. **创意想象力** (0-100分)
   - 是否有独特的视角或切入点？
   - 是否落入俗套？有无新意？
   - 想象是否合理且有感染力？

3. **情感真实度** (0-100分)
   - 情感表达是否真挚自然？
   - 有无"为赋新词强说愁"的矫揉造作？
   - 能否引起读者共鸣？

4. **文字功底** (0-100分)
   - 用词是否准确、恰当？
   - 是否有文采，有令人印象深刻的表达？
   - 修辞运用是否得当？

## 输出格式

请以 JSON 格式返回评审结果：
{
  "totalScore": 65,
  "dimensions": [
    {"name": "表达流畅度", "score": 70, "comment": "具体指出流畅度方面的问题和优点"},
    {"name": "创意想象力", "score": 60, "comment": "具体指出创意方面的问题和优点"},
    {"name": "情感真实度", "score": 65, "comment": "具体指出情感方面的问题和优点"},
    {"name": "文字功底", "score": 65, "comment": "具体指出文字方面的问题和优点"}
  ],
  "highlights": ["值得肯定的1-2个亮点，要具体"],
  "improvements": [
    "具体问题1：说明问题在哪里，为什么是问题，如何改进",
    "具体问题2：...",
    "具体问题3：..."
  ],
  "overallComment": "整体评价，直言不讳地指出主要问题，同时指明努力方向",
  "teacherAdvice": "作为导师给出的具体练习建议或下一步行动指南"
}`;
    }
    
    // 调用 AI 评审
    const response = await callAIForFeature(AI_FEATURES.EVALUATION, [
      { role: 'user', content: promptContent }
    ]);
    
    // 解析评审结果
    let evaluationData;
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluationData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析评审结果');
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: '解析评审结果失败',
        error: parseError.message,
        rawResponse: response.content
      });
    }
    
    // 保存评审结果
    const result = db.prepare(`
      INSERT INTO freewrite_reviews (
        practice_id, review_type, score, comment, dimension_scores, 
        highlights, improvements, raw_response
      ) VALUES (?, 'ai', ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      evaluationData.totalScore,
      evaluationData.overallComment + (evaluationData.teacherAdvice ? '\n\n📚 导师建议：' + evaluationData.teacherAdvice : ''),
      JSON.stringify(evaluationData.dimensions),
      JSON.stringify(evaluationData.highlights),
      JSON.stringify(evaluationData.improvements),
      response.content
    );
    
    // 更新练习状态
    db.prepare(`
      UPDATE freewrite_practices SET
        status = 'reviewed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    // 获取完整评审数据
    const review = db.prepare('SELECT * FROM freewrite_reviews WHERE id = ?').get(result.lastInsertRowid);
    try {
      review.dimensions = JSON.parse(review.dimension_scores);
      review.highlights = JSON.parse(review.highlights);
      review.improvements = JSON.parse(review.improvements);
    } catch {}
    
    res.json({
      success: true,
      data: review,
      message: 'AI 评审完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI 评审失败',
      error: error.message
    });
  }
});

// 获取评审详情
router.get('/review/:reviewId', (req, res) => {
  try {
    const db = getDatabase();
    const { reviewId } = req.params;
    
    const review = db.prepare(`
      SELECT r.*, p.title, p.content, p.word_count, p.time_spent
      FROM freewrite_reviews r
      LEFT JOIN freewrite_practices p ON r.practice_id = p.id
      WHERE r.id = ?
    `).get(reviewId);
    
    if (!review) {
      return res.status(404).json({
        success: false,
        message: '评审不存在'
      });
    }
    
    try {
      review.dimensions = JSON.parse(review.dimension_scores);
      review.highlights = JSON.parse(review.highlights);
      review.improvements = JSON.parse(review.improvements);
      review.tags = JSON.parse(review.tags);
    } catch {}
    
    res.json({
      success: true,
      data: review
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取评审详情失败',
      error: error.message
    });
  }
});

// 删除随心练习
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 删除相关评审
    db.prepare('DELETE FROM freewrite_reviews WHERE practice_id = ?').run(id);
    // 删除练习
    db.prepare('DELETE FROM freewrite_practices WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除失败',
      error: error.message
    });
  }
});

// 获取随心练习统计
router.get('/stats/overview', (req, res) => {
  try {
    const db = getDatabase();
    
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_practices,
        SUM(word_count) as total_words,
        SUM(time_spent) as total_time,
        AVG(CASE WHEN status = 'reviewed' THEN 
          (SELECT AVG(score) FROM freewrite_reviews WHERE practice_id = freewrite_practices.id)
        END) as avg_score
      FROM freewrite_practices
    `).get();
    
    const reviewed = db.prepare(`
      SELECT COUNT(DISTINCT practice_id) as count 
      FROM freewrite_reviews
    `).get();
    
    res.json({
      success: true,
      data: {
        totalPractices: stats.total_practices || 0,
        totalWords: stats.total_words || 0,
        totalTime: stats.total_time || 0,
        avgScore: Math.round(stats.avg_score || 0),
        reviewedPractices: reviewed.count || 0
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

module.exports = router;
