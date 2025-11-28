/**
 * 本地 API 服务 - 词典相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取 AI 配置
async function getActiveAIConfig(featureKey) {
  // 首先查找指定功能的配置
  const featureConfig = queryOne(`
    SELECT f.config_id, c.api_base_url, c.api_key, c.model_name, c.max_tokens, c.temperature
    FROM ai_feature_config f
    LEFT JOIN ai_config c ON f.config_id = c.id
    WHERE f.feature_key = ?
  `, [featureKey])
  
  if (featureConfig && featureConfig.api_base_url && featureConfig.api_key) {
    return featureConfig
  }
  
  // 回退到任意激活的配置
  const activeConfig = queryOne('SELECT * FROM ai_config WHERE is_active = 1')
  if (activeConfig && activeConfig.api_base_url && activeConfig.api_key) {
    return activeConfig
  }
  
  // 尝试获取第一个配置
  const anyConfig = queryOne('SELECT * FROM ai_config ORDER BY id LIMIT 1')
  return anyConfig
}

// 获取词典分类
export async function getCategories() {
  const categories = query('SELECT DISTINCT category FROM dictionary_words ORDER BY category')
  return {
    success: true,
    data: categories.map(c => c.category)
  }
}

// 获取词汇列表
export async function getWords(params = {}) {
  const { category, keyword, page = 1, pageSize = 50 } = params
  const offset = (page - 1) * pageSize
  
  let sql = 'SELECT * FROM dictionary_words WHERE 1=1'
  const sqlParams = []
  
  if (category) {
    sql += ' AND category = ?'
    sqlParams.push(category)
  }
  
  if (keyword) {
    sql += ' AND (word LIKE ? OR meaning LIKE ?)'
    sqlParams.push(`%${keyword}%`, `%${keyword}%`)
  }
  
  sql += ' ORDER BY use_count DESC, created_at DESC LIMIT ? OFFSET ?'
  sqlParams.push(pageSize, offset)
  
  const list = query(sql, sqlParams)
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM dictionary_words WHERE 1=1'
  const countParams = []
  
  if (category) {
    countSql += ' AND category = ?'
    countParams.push(category)
  }
  
  if (keyword) {
    countSql += ' AND (word LIKE ? OR meaning LIKE ?)'
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

// 添加词汇
export async function addWord(data) {
  const now = new Date().toISOString()
  const { word, category, meaning, examples, tags, source = 'user' } = data
  
  const result = run(
    `INSERT INTO dictionary_words (word, category, meaning, examples, tags, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [word, category, meaning || '', examples || '', tags || '', source, now, now]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    data: { id: result.lastInsertRowid }
  }
}

// 批量添加词汇
export async function addWordsBatch(data) {
  const { words } = data
  const now = new Date().toISOString()
  
  let addedCount = 0
  for (const word of words) {
    try {
      run(
        `INSERT INTO dictionary_words (word, category, meaning, examples, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          word.word,
          word.category || '未分类',
          word.meaning || '',
          word.examples || '',
          word.tags || '',
          word.source || 'ai',
          now,
          now
        ]
      )
      addedCount++
    } catch (e) {
      // 忽略重复项
      console.warn('添加词汇失败:', e)
    }
  }
  
  await saveDatabase()
  
  return {
    success: true,
    message: `成功添加 ${addedCount} 个词汇`
  }
}

// 更新词汇
export async function updateWord(id, data) {
  const now = new Date().toISOString()
  const { word, category, meaning, examples, tags } = data
  
  run(
    `UPDATE dictionary_words SET word = ?, category = ?, meaning = ?, examples = ?, tags = ?, updated_at = ? WHERE id = ?`,
    [word, category, meaning || '', examples || '', tags || '', now, id]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已更新'
  }
}

// 删除词汇
export async function deleteWord(id) {
  run('DELETE FROM dictionary_words WHERE id = ?', [id])
  await saveDatabase()
  
  return {
    success: true,
    message: '已删除'
  }
}

// 增加使用次数
export async function useWord(id) {
  run('UPDATE dictionary_words SET use_count = use_count + 1 WHERE id = ?', [id])
  await saveDatabase()
  
  return {
    success: true,
    message: '已记录'
  }
}

// AI 搜索相关词汇
export async function aiSearchWords(data) {
  const { query: searchQuery, context } = data
  
  // 获取 AI 配置
  const aiConfig = await getActiveAIConfig('dictionary_search')
  
  if (!aiConfig || !aiConfig.api_base_url || !aiConfig.api_key) {
    throw new Error('请先配置 AI 服务')
  }
  
  const prompt = `你是一个专业的网文写作词汇助手。用户想要查找与"${searchQuery}"相关的词汇表达方式。

${context ? `当前写作上下文：${context.substring(0, 500)}` : ''}

请提供 5-10 个相关的词汇或表达方式，包括：
1. 同义词/近义词
2. 更生动的表达
3. 网文常用表达
4. 不同语境下的变体

返回 JSON 格式：
{
  "words": [
    {
      "word": "词汇或短语",
      "category": "分类（如：动作、情感、神态等）",
      "meaning": "含义解释",
      "examples": "使用示例句子",
      "intensity": "语气强度（如：轻微、一般、强烈）"
    }
  ],
  "tips": "使用建议（可选）"
}

只返回 JSON，不要有其他内容。`

  try {
    const response = await fetch(`${aiConfig.api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.api_key}`
      },
      body: JSON.stringify({
        model: aiConfig.model_name,
        messages: [
          { role: 'system', content: '你是一个专业的网文写作词汇助手，擅长提供丰富多样的词汇表达。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: aiConfig.max_tokens || 2048,
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
    
    // 解析 JSON
    const parsed = parseAIResponse(content)
    
    return {
      success: true,
      data: {
        words: parsed.words || [],
        tips: parsed.tips || ''
      }
    }
  } catch (error) {
    console.error('AI 搜索失败:', error)
    throw error
  }
}

// AI 生成专题词典
export async function aiGenerateWords(data) {
  const { topic, count = 20 } = data
  
  // 获取 AI 配置
  const aiConfig = await getActiveAIConfig('dictionary_generate')
  
  if (!aiConfig || !aiConfig.api_base_url || !aiConfig.api_key) {
    throw new Error('请先配置 AI 服务')
  }
  
  const prompt = `你是一个专业的网文写作词汇助手。请为"${topic}"主题生成一个专题词典，包含 ${count} 个相关词汇。

要求：
1. 词汇要丰富多样，覆盖不同场景
2. 适合网文写作使用
3. 包含常用和进阶表达

返回 JSON 格式：
{
  "words": [
    {
      "word": "词汇或短语",
      "category": "${topic}",
      "meaning": "含义解释",
      "examples": "使用示例"
    }
  ]
}

只返回 JSON，不要有其他内容。`

  try {
    const response = await fetch(`${aiConfig.api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.api_key}`
      },
      body: JSON.stringify({
        model: aiConfig.model_name,
        messages: [
          { role: 'system', content: '你是一个专业的网文写作词汇助手，擅长生成丰富的专题词典。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: aiConfig.max_tokens || 4096,
        temperature: aiConfig.temperature || 0.8
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
    
    // 解析 JSON
    const parsed = parseAIResponse(content)
    
    return {
      success: true,
      data: {
        words: parsed.words || []
      }
    }
  } catch (error) {
    console.error('AI 生成失败:', error)
    throw error
  }
}

// 获取词典统计
export async function getDictionaryStats() {
  const totalResult = queryOne('SELECT COUNT(*) as total FROM dictionary_words')
  const categoryResult = query('SELECT category, COUNT(*) as count FROM dictionary_words GROUP BY category')
  
  return {
    success: true,
    data: {
      total: totalResult?.total || 0,
      categories: categoryResult
    }
  }
}

// 解析 AI 返回的内容
function parseAIResponse(content) {
  let jsonStr = content
  
  // 如果被代码块包裹，提取出来
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }
  
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    // 尝试找到 JSON 对象
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(jsonStr.substring(start, end + 1))
      } catch (e2) {
        console.error('JSON 解析失败:', e2)
      }
    }
    
    return { words: [] }
  }
}
