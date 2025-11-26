import request from '../utils/request'

// 获取练习列表
export function getPractices(params) {
  return request.get('/practices', { params })
}

// 获取单个练习
export function getPractice(id) {
  return request.get(`/practices/${id}`)
}

// 创建练习
export function createPractice(questionId) {
  return request.post('/practices', { question_id: questionId })
}

// 更新练习（保存草稿）
export function updatePractice(id, data) {
  return request.put(`/practices/${id}`, data)
}

// 提交练习
export function submitPractice(id, data) {
  return request.post(`/practices/${id}/submit`, data)
}

// 删除练习
export function deletePractice(id) {
  return request.delete(`/practices/${id}`)
}

// 获取草稿历史
export function getPracticeDrafts(id) {
  return request.get(`/practices/${id}/drafts`)
}
