const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature, AI_FEATURES } = require('../services/aiService');

// 请求 AI 评审
router.post('/', async (req, res) => {
  try {
    const db = getDatabase();
    const { practice_id } = req.body;
    
    // 获取练习信息
    const practice = db.prepare(`
      SELECT p.*, q.type as question_type, q.difficulty, q.content as question_content
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      WHERE p.id = ?
    `).get(practice_id);
    
    if (!practice) {
      return res.status(404).json({
        success: false,
        message: '练习不存在'
      });
    }
    
    if (!practice.content || practice.content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '请先完成作答再请求评审'
      });
    }
    
    // 获取对应的评审 Prompt
    let template = db.prepare(`
      SELECT * FROM prompt_templates 
      WHERE category = 'evaluator' AND type = ? AND is_active = 1
      ORDER BY is_default DESC
      LIMIT 1
    `).get(practice.question_type);
    
    // 如果没有专项评审，使用通用评审
    if (!template) {
      template = db.prepare(`
        SELECT * FROM prompt_templates 
        WHERE category = 'evaluator' AND type = 'general' AND is_active = 1
        ORDER BY is_default DESC
        LIMIT 1
      `).get();
    }
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: '找不到评审模板'
      });
    }
    
    // 解析题目内容
    let questionContent;
    try {
      questionContent = JSON.parse(practice.question_content);
    } catch {
      questionContent = practice.question_content;
    }
    
    // 替换变量
    let promptContent = template.content;
    promptContent = promptContent.replace(/{{questionType}}/g, practice.question_type);
    promptContent = promptContent.replace(/{{difficulty}}/g, practice.difficulty);
    promptContent = promptContent.replace(/{{questionContent}}/g, 
      typeof questionContent === 'object' ? JSON.stringify(questionContent, null, 2) : questionContent
    );
    promptContent = promptContent.replace(/{{userAnswer}}/g, practice.content);
    
    // 调用 AI 评审（功能锚点：evaluation）
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
      INSERT INTO evaluations (
        practice_id, prompt_id, total_score, dimension_scores,
        highlights, improvements, overall_comment, rewrite_suggestion, raw_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      practice_id,
      template.id,
      evaluationData.totalScore,
      JSON.stringify(evaluationData.dimensions),
      JSON.stringify(evaluationData.highlights),
      JSON.stringify(evaluationData.improvements),
      evaluationData.overallComment,
      evaluationData.rewriteSuggestion || null,
      response.content
    );
    
    // 更新练习状态
    db.prepare(`
      UPDATE practices SET status = 'evaluated', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(practice_id);
    
    // 获取完整评审数据
    const evaluation = db.prepare('SELECT * FROM evaluations WHERE id = ?').get(result.lastInsertRowid);
    evaluation.dimensions = JSON.parse(evaluation.dimension_scores);
    evaluation.highlights = JSON.parse(evaluation.highlights);
    evaluation.improvements = JSON.parse(evaluation.improvements);
    
    res.json({
      success: true,
      data: evaluation,
      message: '评审完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '评审失败',
      error: error.message
    });
  }
});

// 获取练习的评审结果
router.get('/:practiceId', (req, res) => {
  try {
    const db = getDatabase();
    const { practiceId } = req.params;
    
    const evaluations = db.prepare(`
      SELECT * FROM evaluations 
      WHERE practice_id = ? 
      ORDER BY created_at DESC
    `).all(practiceId);
    
    evaluations.forEach(e => {
      try {
        e.dimensions = JSON.parse(e.dimension_scores);
        e.highlights = JSON.parse(e.highlights);
        e.improvements = JSON.parse(e.improvements);
      } catch {}
    });
    
    res.json({
      success: true,
      data: evaluations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取评审结果失败',
      error: error.message
    });
  }
});

// 获取单个评审详情
router.get('/detail/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const evaluation = db.prepare(`
      SELECT e.*, p.content as practice_content, p.word_count, p.time_spent,
             q.title as question_title, q.type as question_type, q.difficulty,
             q.content as question_content
      FROM evaluations e
      LEFT JOIN practices p ON e.practice_id = p.id
      LEFT JOIN questions q ON p.question_id = q.id
      WHERE e.id = ?
    `).get(id);
    
    if (!evaluation) {
      return res.status(404).json({
        success: false,
        message: '评审不存在'
      });
    }
    
    try {
      evaluation.dimensions = JSON.parse(evaluation.dimension_scores);
      evaluation.highlights = JSON.parse(evaluation.highlights);
      evaluation.improvements = JSON.parse(evaluation.improvements);
      evaluation.question_content = JSON.parse(evaluation.question_content);
    } catch {}
    
    res.json({
      success: true,
      data: evaluation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取评审详情失败',
      error: error.message
    });
  }
});

module.exports = router;
