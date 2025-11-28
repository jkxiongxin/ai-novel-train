/**
 * 本地 API 服务 - AI 配置相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取当前激活的配置
export async function getAIConfig() {
  const config = queryOne('SELECT * FROM ai_config WHERE is_active = 1')
  return {
    success: true,
    data: config || null
  }
}

// 获取所有配置
export async function getAIConfigs() {
  const configs = query('SELECT * FROM ai_config ORDER BY created_at DESC')
  return {
    success: true,
    data: configs
  }
}

// 保存配置
export async function saveAIConfig(data) {
  const now = new Date().toISOString()
  const {
    id,
    config_name,
    api_base_url,
    api_key,
    model_name,
    max_tokens = 4096,
    temperature = 0.7,
    timeout = 60000,
    is_default = 0
  } = data

  if (id) {
    // 更新
    run(
      `UPDATE ai_config SET 
        config_name = ?, api_base_url = ?, api_key = ?, model_name = ?,
        max_tokens = ?, temperature = ?, timeout = ?, is_default = ?, updated_at = ?
       WHERE id = ?`,
      [config_name, api_base_url, api_key, model_name, max_tokens, temperature, timeout, is_default ? 1 : 0, now, id]
    )
    await saveDatabase()
    return { success: true, data: { id } }
  } else {
    // 新增
    const result = run(
      `INSERT INTO ai_config (config_name, api_base_url, api_key, model_name, max_tokens, temperature, timeout, is_default, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [config_name, api_base_url, api_key, model_name, max_tokens, temperature, timeout, is_default ? 1 : 0, now, now]
    )
    await saveDatabase()
    return { success: true, data: { id: result.lastInsertRowid } }
  }
}

// 删除配置
export async function deleteAIConfig(id) {
  run('DELETE FROM ai_config WHERE id = ?', [id])
  await saveDatabase()
  return { success: true, message: '已删除' }
}

// 激活配置
export async function activateAIConfig(id) {
  const now = new Date().toISOString()
  // 先取消所有激活
  run('UPDATE ai_config SET is_active = 0, updated_at = ?', [now])
  // 激活指定配置
  run('UPDATE ai_config SET is_active = 1, updated_at = ? WHERE id = ?', [now, id])
  await saveDatabase()
  return { success: true, message: '已激活' }
}

// 测试连接（移动端直接测试）
export async function testAIConnection(data) {
  const { api_base_url, api_key, model_name } = data
  
  try {
    const response = await fetch(`${api_base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`
      },
      body: JSON.stringify({
        model: model_name,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      })
    })
    
    if (response.ok) {
      return { success: true, message: '连接成功' }
    } else {
      const error = await response.text()
      return { success: false, message: `连接失败: ${error}` }
    }
  } catch (error) {
    return { success: false, message: `连接失败: ${error.message}` }
  }
}

// 获取模型列表
export async function getAIModels(data) {
  const { api_base_url, api_key } = data
  
  try {
    const response = await fetch(`${api_base_url}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${api_key}`
      }
    })
    
    if (response.ok) {
      const result = await response.json()
      const models = result.data?.map(m => m.id) || []
      return { success: true, data: models }
    } else {
      return { success: true, data: [] }
    }
  } catch (error) {
    return { success: true, data: [] }
  }
}

// 获取所有 AI 功能列表
export async function getAIFeatures() {
  const features = query('SELECT * FROM ai_feature_config ORDER BY id')
  // 转换字段名以匹配前端期望的格式
  const mappedFeatures = features.map(f => ({
    key: f.feature_key,
    name: f.feature_name,
    description: f.feature_description,
    config_id: f.config_id
  }))
  return {
    success: true,
    data: mappedFeatures
  }
}

// 获取功能配置映射
export async function getFeatureConfigs() {
  const features = query(`
    SELECT f.*, c.config_name
    FROM ai_feature_config f
    LEFT JOIN ai_config c ON f.config_id = c.id
    ORDER BY f.id
  `)
  // 转换字段名
  const mappedFeatures = features.map(f => ({
    feature_key: f.feature_key,
    config_id: f.config_id,
    is_enabled: 1, // 默认启用
    config_name: f.config_name
  }))
  return {
    success: true,
    data: mappedFeatures
  }
}

// 保存单个功能配置
export async function saveFeatureConfig(data) {
  const now = new Date().toISOString()
  const { feature_key, config_id } = data
  
  run(
    'UPDATE ai_feature_config SET config_id = ?, updated_at = ? WHERE feature_key = ?',
    [config_id, now, feature_key]
  )
  await saveDatabase()
  return { success: true, message: '已保存' }
}

// 批量保存功能配置
// 支持两种格式：
// 1. { config_id, feature_keys: [] } - 前端调用格式
// 2. [{ config_id, feature_key }] - 数组格式
export async function saveFeatureConfigsBatch(data) {
  const now = new Date().toISOString()
  
  if (data.config_id && data.feature_keys) {
    // 格式 1: { config_id, feature_keys: [] }
    for (const featureKey of data.feature_keys) {
      run(
        'UPDATE ai_feature_config SET config_id = ?, updated_at = ? WHERE feature_key = ?',
        [data.config_id, now, featureKey]
      )
    }
  } else if (Array.isArray(data)) {
    // 格式 2: 数组
    for (const item of data) {
      run(
        'UPDATE ai_feature_config SET config_id = ?, updated_at = ? WHERE feature_key = ?',
        [item.config_id, now, item.feature_key]
      )
    }
  }
  
  await saveDatabase()
  return { success: true, message: '已保存' }
}
