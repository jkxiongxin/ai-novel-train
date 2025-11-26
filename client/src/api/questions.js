import request from '../utils/request'

// 获取题目列表
export function getQuestions(params) {
  return request.get('/questions', { params })
}

// 获取单个题目
export function getQuestion(id) {
  return request.get(`/questions/${id}`)
}

// 生成新题目
export function generateQuestion(data) {
  return request.post('/questions/generate', data)
}

// 删除题目
export function deleteQuestion(id) {
  return request.delete(`/questions/${id}`)
}

// 收藏/取消收藏
export function toggleFavorite(id, isFavorite) {
  return request.put(`/questions/${id}/favorite`, { is_favorite: isFavorite })
}

// 导出题目
export function exportQuestions(params) {
  return request.get('/questions/export/json', { params })
}

// 导入题目
export function importQuestions(data) {
  return request.post('/questions/import/json', data)
}
