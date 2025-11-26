import request from '../utils/request'

// 请求评审
export function requestEvaluation(practiceId) {
  return request.post('/evaluations', { practice_id: practiceId })
}

// 获取练习的评审结果
export function getEvaluations(practiceId) {
  return request.get(`/evaluations/${practiceId}`)
}

// 获取评审详情
export function getEvaluationDetail(id) {
  return request.get(`/evaluations/detail/${id}`)
}
