import request from '../utils/request'

// 获取随心练习列表
export function getFreewriteList(params) {
  return request.get('/freewrite', { params })
}

// 获取单个随心练习
export function getFreewrite(id) {
  return request.get(`/freewrite/${id}`)
}

// 创建随心练习
export function createFreewrite(data) {
  return request.post('/freewrite', data)
}

// 更新随心练习
export function updateFreewrite(id, data) {
  return request.put(`/freewrite/${id}`, data)
}

// 完成随心练习
export function finishFreewrite(id, data) {
  return request.post(`/freewrite/${id}/finish`, data)
}

// 用户自评
export function submitSelfReview(id, data) {
  return request.post(`/freewrite/${id}/self-review`, data)
}

// AI 评审
export function requestAIReview(id) {
  return request.post(`/freewrite/${id}/ai-review`)
}

// 获取评审详情
export function getReviewDetail(reviewId) {
  return request.get(`/freewrite/review/${reviewId}`)
}

// 删除随心练习
export function deleteFreewrite(id) {
  return request.delete(`/freewrite/${id}`)
}

// 获取随心练习统计
export function getFreewriteStats() {
  return request.get('/freewrite/stats/overview')
}
