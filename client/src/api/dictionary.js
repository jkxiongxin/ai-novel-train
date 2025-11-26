import request from '../utils/request'

// 获取词典分类
export function getCategories() {
  return request.get('/dictionary/categories')
}

// 获取词汇列表
export function getWords(params) {
  return request.get('/dictionary/words', { params })
}

// 添加词汇
export function addWord(data) {
  return request.post('/dictionary/words', data)
}

// 批量添加词汇
export function addWordsBatch(words) {
  return request.post('/dictionary/words/batch', { words })
}

// 更新词汇
export function updateWord(id, data) {
  return request.put(`/dictionary/words/${id}`, data)
}

// 删除词汇
export function deleteWord(id) {
  return request.delete(`/dictionary/words/${id}`)
}

// 增加使用次数
export function useWord(id) {
  return request.post(`/dictionary/words/${id}/use`)
}

// AI 搜索相关词汇
export function aiSearchWords(query, context) {
  return request.post('/dictionary/ai/search', { query, context })
}

// AI 生成专题词典
export function aiGenerateWords(topic, count) {
  return request.post('/dictionary/ai/generate', { topic, count })
}

// 获取词典统计
export function getDictionaryStats() {
  return request.get('/dictionary/stats')
}
