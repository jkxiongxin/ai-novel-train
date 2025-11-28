/**
 * 本地 API 服务 - 题目相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取 AI 配置 - 用于生成题目
async function getActiveAIConfig() {
  const featureConfig = queryOne(`
    SELECT f.config_id, c.api_base_url, c.api_key, c.model_name, c.max_tokens, c.temperature
    FROM ai_feature_config f
    LEFT JOIN ai_config c ON f.config_id = c.id
    WHERE f.feature_key = 'question_generate'
  `)
  
  if (featureConfig && featureConfig.api_base_url && featureConfig.api_key) {
    return featureConfig
  }
  
  // 回退到任意激活的配置
  const activeConfig = queryOne('SELECT * FROM ai_config WHERE is_active = 1')
  return activeConfig
}

// 生成题目 - 调用 AI API
export async function generateQuestion(data) {
  const { type, difficulty, extraParams = {} } = data
  
  // 获取 AI 配置
  const aiConfig = await getActiveAIConfig()
  
  if (!aiConfig || !aiConfig.api_base_url || !aiConfig.api_key) {
    throw new Error('请先配置 AI 服务')
  }
  
  // 构建题目生成 Prompt
  const prompt = buildQuestionPrompt(type, difficulty, extraParams)
  
  try {
    // 调用 AI API
    const response = await fetch(`${aiConfig.api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.api_key}`
      },
      body: JSON.stringify({
        model: aiConfig.model_name,
        messages: [
          { role: 'system', content: '你是一个专业的网文写作训练题目生成器。请根据用户的要求生成写作练习题目，返回格式为JSON。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: aiConfig.max_tokens || 4096,
        temperature: aiConfig.temperature || 0.7
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI 服务请求失败: ${errorText}`)
    }
    
    const result = await response.json()
    const content = result.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('AI 返回内容为空')
    }
    
    // 解析 AI 返回的 JSON
    const questionContent = parseAIResponse(content)
    
    // 保存到数据库
    const now = new Date().toISOString()
    const title = questionContent.title || `${getTypeName(type)}练习`
    
    const insertResult = run(
      `INSERT INTO questions (type, difficulty, title, content, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [type, difficulty, title, JSON.stringify(questionContent), now]
    )
    
    await saveDatabase()
    
    return {
      success: true,
      data: {
        id: insertResult.lastInsertRowid,
        type,
        difficulty,
        title,
        content: questionContent
      }
    }
  } catch (error) {
    console.error('生成题目失败:', error)
    throw error
  }
}

// 构建题目生成 Prompt
function buildQuestionPrompt(type, difficulty, extraParams) {
  const typeDescriptions = {
    dialogue: '人物对白写作练习，训练角色对话、语气、性格体现、潜台词等',
    emotion: '情绪渲染写作练习，训练通过文字传达情绪氛围的能力',
    battle: '战斗场景写作练习，训练动作场面、打斗描写的能力',
    psychology: '心理活动写作练习，训练角色内心独白、心理描写能力',
    environment: '环境描写写作练习，训练场景、环境、氛围描写能力',
    plot: '情节转折写作练习，训练设计和呈现情节转折的能力',
    chapter: '章节创作练习，基于细纲完成完整章节创作',
    comprehensive: '综合写作练习，融合多种元素的综合写作训练'
  }
  
  let prompt = `请生成一道${typeDescriptions[type] || type}题目。

难度：${difficulty}
${extraParams.keywords ? `关键词：${extraParams.keywords}` : ''}
${extraParams.userIdea ? `用户需求：${extraParams.userIdea}` : ''}

请返回JSON格式，包含以下字段：
{
  "title": "题目标题",
  "background": "场景背景描述",
  "characters": [
    {
      "name": "角色名",
      "identity": "身份",
      "personality": "性格特点",
      "currentEmotion": "当前情绪状态",
      "speakingStyle": "说话风格"
    }
  ],
  "objective": "写作目标要求",
  "constraints": ["约束条件1", "约束条件2"],
  "requirements": ["写作要求1", "写作要求2"],
  "evaluationFocus": ["评审重点1", "评审重点2"],
  "hints": ["写作提示1", "写作提示2"],
  "wordCountRange": { "min": 500, "max": 1000 }
}

请确保题目有趣且具有挑战性，适合网文写作训练。只返回JSON，不要有其他内容。`

  return prompt
}

// 解析 AI 返回的内容
function parseAIResponse(content) {
  // 尝试提取 JSON
  let jsonStr = content
  
  // 如果被代码块包裹，提取出来
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }
  
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    // 尝试修复常见的 JSON 问题
    jsonStr = jsonStr.trim()
    
    // 尝试找到 JSON 对象的开始和结束
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(jsonStr.substring(start, end + 1))
      } catch (e2) {
        console.error('JSON 解析失败:', e2)
      }
    }
    
    // 返回默认结构
    return {
      title: '写作练习',
      background: content,
      objective: '请根据以上内容进行创作',
      wordCountRange: { min: 500, max: 1000 }
    }
  }
}

// 获取类型名称
function getTypeName(type) {
  const names = {
    dialogue: '人物对白',
    emotion: '情绪渲染',
    battle: '战斗场景',
    psychology: '心理活动',
    environment: '环境描写',
    plot: '情节转折',
    chapter: '章节创作',
    comprehensive: '综合训练'
  }
  return names[type] || type
}

// 获取题目列表
export async function getQuestionList(params = {}) {
  const { type, difficulty, page = 1, pageSize = 20, keyword } = params
  const offset = (page - 1) * pageSize
  
  let sql = 'SELECT * FROM questions WHERE 1=1'
  const sqlParams = []
  
  if (type) {
    sql += ' AND type = ?'
    sqlParams.push(type)
  }
  
  if (difficulty) {
    sql += ' AND difficulty = ?'
    sqlParams.push(difficulty)
  }
  
  if (keyword) {
    sql += ' AND (title LIKE ? OR content LIKE ?)'
    sqlParams.push(`%${keyword}%`, `%${keyword}%`)
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  sqlParams.push(pageSize, offset)
  
  const rows = query(sql, sqlParams)
  
  // 解析 content JSON
  const list = rows.map(row => ({
    ...row,
    content: row.content ? JSON.parse(row.content) : null
  }))
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM questions WHERE 1=1'
  const countParams = []
  
  if (type) {
    countSql += ' AND type = ?'
    countParams.push(type)
  }
  
  if (difficulty) {
    countSql += ' AND difficulty = ?'
    countParams.push(difficulty)
  }
  
  if (keyword) {
    countSql += ' AND (title LIKE ? OR content LIKE ?)'
    countParams.push(`%${keyword}%`, `%${keyword}%`)
  }
  
  const countResult = queryOne(countSql, countParams)
  
  return {
    success: true,
    data: {
      list,
      total: countResult?.total || 0,
      page,
      pageSize
    }
  }
}

// 获取单个题目
export async function getQuestion(id) {
  const question = queryOne('SELECT * FROM questions WHERE id = ?', [id])
  
  if (!question) {
    throw new Error('题目不存在')
  }
  
  // 解析 content
  if (question.content) {
    question.content = JSON.parse(question.content)
  }
  
  // 获取标签
  const tags = query('SELECT tag FROM question_tags WHERE question_id = ?', [id])
  question.tags = tags.map(t => t.tag)
  
  return {
    success: true,
    data: question
  }
}

// 创建题目
export async function createQuestion(data) {
  const now = new Date().toISOString()
  const { type, difficulty, title, content, tags = [] } = data
  
  const result = run(
    `INSERT INTO questions (type, difficulty, title, content, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [type, difficulty, title, JSON.stringify(content), now]
  )
  
  // 插入标签
  for (const tag of tags) {
    run(
      'INSERT INTO question_tags (question_id, tag) VALUES (?, ?)',
      [result.lastInsertRowid, tag]
    )
  }
  
  await saveDatabase()
  
  return {
    success: true,
    data: { id: result.lastInsertRowid }
  }
}

// 更新题目
export async function updateQuestion(id, data) {
  const now = new Date().toISOString()
  const { type, difficulty, title, content, tags } = data
  
  run(
    `UPDATE questions SET type = ?, difficulty = ?, title = ?, content = ? WHERE id = ?`,
    [type, difficulty, title, JSON.stringify(content), id]
  )
  
  // 更新标签
  if (tags) {
    run('DELETE FROM question_tags WHERE question_id = ?', [id])
    for (const tag of tags) {
      run(
        'INSERT INTO question_tags (question_id, tag) VALUES (?, ?)',
        [id, tag]
      )
    }
  }
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已更新'
  }
}

// 删除题目
export async function deleteQuestion(id) {
  run('DELETE FROM question_tags WHERE question_id = ?', [id])
  run('DELETE FROM questions WHERE id = ?', [id])
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已删除'
  }
}

// 收藏/取消收藏
export async function toggleFavorite(id) {
  const question = queryOne('SELECT is_favorite FROM questions WHERE id = ?', [id])
  
  if (!question) {
    throw new Error('题目不存在')
  }
  
  const newValue = question.is_favorite ? 0 : 1
  run('UPDATE questions SET is_favorite = ? WHERE id = ?', [newValue, id])
  
  await saveDatabase()
  
  return {
    success: true,
    data: { is_favorite: newValue === 1 }
  }
}

// 获取题目类型列表
export async function getQuestionTypes() {
  const types = query('SELECT DISTINCT type FROM questions')
  return {
    success: true,
    data: types.map(t => t.type)
  }
}
