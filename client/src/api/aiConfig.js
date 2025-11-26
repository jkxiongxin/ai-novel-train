import request from '../utils/request'

// 获取当前激活的配置
export function getAIConfig() {
  return request.get('/ai-config')
}

// 获取所有配置
export function getAIConfigs() {
  return request.get('/ai-config/all')
}

// 保存配置
export function saveAIConfig(data) {
  return request.post('/ai-config', data)
}

// 删除配置
export function deleteAIConfig(id) {
  return request.delete(`/ai-config/${id}`)
}

// 激活配置
export function activateAIConfig(id) {
  return request.put(`/ai-config/${id}/activate`)
}

// 测试连接
export function testAIConnection(data) {
  return request.post('/ai-config/test', data)
}

// 获取模型列表
export function getAIModels(data) {
  return request.post('/ai-config/models', data)
}

// 获取所有 AI 功能列表
export function getAIFeatures() {
  return request.get('/ai-config/features')
}

// 获取功能配置映射
export function getFeatureConfigs() {
  return request.get('/ai-config/feature-configs')
}

// 保存单个功能配置
export function saveFeatureConfigs(data) {
  return request.put('/ai-config/feature-configs', data)
}

// 批量保存功能配置
export function saveFeatureConfigsBatch(data) {
  return request.put('/ai-config/feature-configs/batch', data)
}
