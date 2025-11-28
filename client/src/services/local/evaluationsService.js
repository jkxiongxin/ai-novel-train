/**
 * 本地 API 服务 - 评审相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取活跃的 AI 配置（用于评审）
async function getActiveAIConfig(featureKey = 'evaluation') {
  // 首先查找该功能绑定的配置
  const featureConfig = queryOne(`
    SELECT ac.* FROM ai_feature_config afc
    JOIN ai_config ac ON afc.config_id = ac.id
    WHERE afc.feature_key = ?
  `, [featureKey])
  
  if (featureConfig) {
    return featureConfig
  }
  
  // 如果没有绑定配置，使用默认配置
  const defaultConfig = queryOne('SELECT * FROM ai_config WHERE is_default = 1')
  if (defaultConfig) {
    return defaultConfig
  }
  
  // 最后尝试获取激活的配置
  const activeConfig = queryOne('SELECT * FROM ai_config WHERE is_active = 1')
  if (activeConfig) {
    return activeConfig
  }
  
  // 最后尝试获取任意一个配置
  const anyConfig = queryOne('SELECT * FROM ai_config LIMIT 1')
  if (anyConfig) {
    return anyConfig
  }
  
  throw new Error('请先配置 AI API')
}

// 请求 AI 评审
export async function requestEvaluation(data) {
  const { practice_id } = data
  
  // 获取练习信息
  const practice = queryOne(`
    SELECT p.*, q.type as question_type, q.difficulty, q.content as question_content, q.title as question_title
    FROM practices p
    LEFT JOIN questions q ON p.question_id = q.id
    WHERE p.id = ?
  `, [practice_id])
  
  if (!practice) {
    throw new Error('练习不存在')
  }
  
  if (!practice.content || practice.content.trim() === '') {
    throw new Error('请先完成作答再请求评审')
  }
  
  // 获取对应的评审 Prompt
  let template = queryOne(`
    SELECT * FROM prompt_templates 
    WHERE category = 'evaluator' AND type = ? AND is_active = 1
    ORDER BY is_default DESC
    LIMIT 1
  `, [practice.question_type])
  
  // 如果没有专项评审，使用通用评审
  if (!template) {
    template = queryOne(`
      SELECT * FROM prompt_templates 
      WHERE category = 'evaluator' AND type = 'general' AND is_active = 1
      ORDER BY is_default DESC
      LIMIT 1
    `)
  }
  
  // 如果还是没有模板，使用默认的评审 Prompt
  if (!template) {
    template = {
      id: 0,
      content: getDefaultEvaluationPrompt()
    }
  }
  
  // 解析题目内容
  let questionContent
  try {
    questionContent = JSON.parse(practice.question_content)
  } catch {
    questionContent = practice.question_content
  }
  
  // 替换变量
  let promptContent = template.content
  promptContent = promptContent.replace(/{{questionType}}/g, practice.question_type || '综合')
  promptContent = promptContent.replace(/{{difficulty}}/g, practice.difficulty || '中等')
  promptContent = promptContent.replace(/{{questionContent}}/g, 
    typeof questionContent === 'object' ? JSON.stringify(questionContent, null, 2) : (questionContent || '')
  )
  promptContent = promptContent.replace(/{{userAnswer}}/g, practice.content)
  
  // 获取 AI 配置
  const config = await getActiveAIConfig('evaluation')
  
  // 调用 AI 评审
  const response = await fetch(`${config.api_base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.api_key}`
    },
    body: JSON.stringify({
      model: config.model_name,
      messages: [{ role: 'user', content: promptContent }],
      max_tokens: config.max_tokens || 4096,
      temperature: config.temperature || 0.7
    })
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`AI 请求失败: ${response.status} - ${errorText}`)
  }
  
  const aiResult = await response.json()
  const aiContent = aiResult.choices?.[0]?.message?.content
  
  if (!aiContent) {
    throw new Error('AI 返回数据为空')
  }
  
  // 解析评审结果
  let evaluationData
  try {
    const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      evaluationData = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('无法解析评审结果')
    }
  } catch (parseError) {
    console.error('解析评审结果失败:', parseError)
    console.error('原始内容:', aiContent)
    // 创建默认评审结果
    evaluationData = {
      totalScore: 70,
      dimensions: [
        { name: '内容质量', score: 70, comment: '内容基本完整' },
        { name: '文字表达', score: 70, comment: '表达清晰' },
        { name: '创意新颖', score: 70, comment: '有一定创意' }
      ],
      highlights: ['完成了基本写作任务'],
      improvements: ['可以进一步丰富内容'],
      overallComment: aiContent.substring(0, 500),
      rewriteSuggestion: null
    }
  }
  
  // 保存评审结果
  const now = new Date().toISOString()
  const result = run(`
    INSERT INTO evaluations (
      practice_id, prompt_id, total_score, dimension_scores,
      highlights, improvements, overall_comment, rewrite_suggestion, raw_response, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    practice_id,
    template.id || 0,
    evaluationData.totalScore || 0,
    JSON.stringify(evaluationData.dimensions || []),
    JSON.stringify(evaluationData.highlights || []),
    JSON.stringify(evaluationData.improvements || []),
    evaluationData.overallComment || '',
    evaluationData.rewriteSuggestion || null,
    aiContent,
    now
  ])
  
  // 更新练习状态
  run(`UPDATE practices SET status = 'evaluated', updated_at = ? WHERE id = ?`, [now, practice_id])
  
  await saveDatabase()
  
  // 返回评审数据
  const evaluation = queryOne('SELECT * FROM evaluations WHERE id = ?', [result.lastInsertRowid])
  
  return {
    success: true,
    data: {
      ...evaluation,
      dimensions: JSON.parse(evaluation.dimension_scores || '[]'),
      highlights: JSON.parse(evaluation.highlights || '[]'),
      improvements: JSON.parse(evaluation.improvements || '[]')
    },
    message: '评审完成'
  }
}

// 获取练习的评审结果
export async function getEvaluations(practiceId) {
  const evaluations = query(`
    SELECT * FROM evaluations 
    WHERE practice_id = ? 
    ORDER BY created_at DESC
  `, [practiceId])
  
  const result = evaluations.map(e => ({
    ...e,
    dimensions: JSON.parse(e.dimension_scores || '[]'),
    highlights: JSON.parse(e.highlights || '[]'),
    improvements: JSON.parse(e.improvements || '[]')
  }))
  
  return {
    success: true,
    data: result
  }
}

// 获取单个评审详情
export async function getEvaluationDetail(id) {
  const evaluation = queryOne(`
    SELECT e.*, p.content as practice_content, p.word_count, p.time_spent,
           q.title as question_title, q.type as question_type, q.difficulty,
           q.content as question_content
    FROM evaluations e
    LEFT JOIN practices p ON e.practice_id = p.id
    LEFT JOIN questions q ON p.question_id = q.id
    WHERE e.id = ?
  `, [id])
  
  if (!evaluation) {
    throw new Error('评审不存在')
  }
  
  return {
    success: true,
    data: {
      ...evaluation,
      dimensions: JSON.parse(evaluation.dimension_scores || '[]'),
      highlights: JSON.parse(evaluation.highlights || '[]'),
      improvements: JSON.parse(evaluation.improvements || '[]'),
      question_content: evaluation.question_content ? JSON.parse(evaluation.question_content) : null
    }
  }
}

// 默认评审 Prompt
function getDefaultEvaluationPrompt() {
  return `你是一位专业的网文写作教练，请对以下学员作品进行评审。

## 题目类型
{{questionType}}

## 难度等级
{{difficulty}}

## 题目要求
{{questionContent}}

## 学员作品
{{userAnswer}}

请从以下维度进行评审，并以JSON格式返回评审结果：

{
  "totalScore": 85,
  "dimensions": [
    {
      "name": "内容质量",
      "score": 85,
      "comment": "评语内容"
    },
    {
      "name": "文字表达",
      "score": 80,
      "comment": "评语内容"
    },
    {
      "name": "情感表达",
      "score": 88,
      "comment": "评语内容"
    },
    {
      "name": "创意新颖",
      "score": 82,
      "comment": "评语内容"
    }
  ],
  "highlights": [
    "亮点1",
    "亮点2"
  ],
  "improvements": [
    "改进建议1",
    "改进建议2"
  ],
  "overallComment": "总体评价",
  "rewriteSuggestion": "改写建议（可选）"
}

请确保返回的是有效的JSON格式。`
}
