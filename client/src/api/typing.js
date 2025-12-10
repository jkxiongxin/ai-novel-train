import request from '../utils/request'

// 获取抄书练习列表
export function getTypingPractices(params) {
  return request.get('/typing', { params })
}

// 获取单个抄书练习
export function getTypingPractice(id) {
  return request.get(`/typing/${id}`)
}

// 从片段创建抄书练习
export function createFromSegment(segmentId) {
  return request.post(`/typing/from-segment/${segmentId}`)
}

// 从章节创建整章抄书练习
export function createFromChapter(chapterId) {
  return request.post(`/typing/from-chapter/${chapterId}`)
}

// 创建自定义抄书练习
export function createCustomTyping(data) {
  return request.post('/typing/custom', data)
}

// 开始抄书练习
export function startTypingPractice(id) {
  return request.post(`/typing/${id}/start`)
}

// 保存抄书进度
export function saveTypingProgress(id, data) {
  return request.put(`/typing/${id}/progress`, data)
}

// 完成抄书练习
export function completeTypingPractice(id, data) {
  return request.post(`/typing/${id}/complete`, data)
}

// 删除抄书练习
export function deleteTypingPractice(id) {
  return request.delete(`/typing/${id}`)
}

// 获取抄书统计
export function getTypingStats(params) {
  return request.get('/typing/stats/overview', { params })
}

// 随机获取片段
export function getRandomSegment(params) {
  return request.get('/typing/random/segment', { params })
}
