import request from '../utils/request'

// 获取 Prompt 列表
export function getPrompts(params) {
  return request.get('/prompts', { params })
}

// 获取单个 Prompt
export function getPrompt(id) {
  return request.get(`/prompts/${id}`)
}

// 创建 Prompt
export function createPrompt(data) {
  return request.post('/prompts', data)
}

// 更新 Prompt
export function updatePrompt(id, data) {
  return request.put(`/prompts/${id}`, data)
}

// 删除 Prompt
export function deletePrompt(id) {
  return request.delete(`/prompts/${id}`)
}

// 获取历史版本
export function getPromptHistory(id) {
  return request.get(`/prompts/${id}/history`)
}

// 恢复历史版本
export function restorePromptVersion(id, historyId) {
  return request.post(`/prompts/${id}/restore/${historyId}`)
}

// 重置为默认
export function resetPrompt(data) {
  return request.post('/prompts/reset', data)
}

// 测试 Prompt
export function testPrompt(id, variables) {
  return request.post(`/prompts/${id}/test`, { variables })
}
