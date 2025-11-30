/**
 * 词汇趣味练习API接口
 */
import request from '../utils/request'

// ==================== 练习会话 ====================

/**
 * 创建练习会话
 * @param {Object} data - 练习配置
 * @param {Array<string>} data.categories - 选择的分类
 * @param {number} data.wordCount - 词汇数量
 * @param {number} data.displayTime - 每个词汇展示时间（秒）
 * @param {string} data.title - 练习标题
 */
export function createPracticeSession(data) {
  return request.post('/word-practice/sessions', data)
}

/**
 * 获取练习会话详情
 * @param {number} sessionId - 会话ID
 */
export function getPracticeSession(sessionId) {
  return request.get(`/word-practice/sessions/${sessionId}`)
}

/**
 * 更新练习会话状态
 * @param {number} sessionId - 会话ID
 * @param {Object} data - 更新数据
 */
export function updatePracticeSession(sessionId, data) {
  return request.put(`/word-practice/sessions/${sessionId}`, data)
}

/**
 * 获取练习历史列表
 * @param {Object} params - 查询参数
 */
export function getPracticeSessions(params) {
  return request.get('/word-practice/sessions', { params })
}

/**
 * 删除练习会话
 * @param {number} sessionId - 会话ID
 */
export function deletePracticeSession(sessionId) {
  return request.delete(`/word-practice/sessions/${sessionId}`)
}

/**
 * 获取练习总统计
 */
export function getPracticeStats() {
  return request.get('/word-practice/stats')
}

// ==================== 题目相关 ====================

/**
 * 生成练习题目
 * @param {number} sessionId - 会话ID
 */
export function generateQuestions(sessionId) {
  return request.post(`/word-practice/sessions/${sessionId}/generate-questions`)
}

/**
 * 获取练习题目列表
 * @param {number} sessionId - 会话ID
 * @param {Object} params - 查询参数
 */
export function getQuestions(sessionId, params) {
  return request.get(`/word-practice/sessions/${sessionId}/questions`, { params })
}

/**
 * 提交答案
 * @param {number} questionId - 题目ID
 * @param {Object} data - 答案数据
 */
export function submitAnswer(questionId, data) {
  return request.post(`/word-practice/questions/${questionId}/answer`, data)
}

/**
 * AI批改造句题
 * @param {number} sessionId - 会话ID
 */
export function aiReviewSentences(sessionId) {
  return request.post(`/word-practice/sessions/${sessionId}/ai-review`)
}

/**
 * 完成练习
 * @param {number} sessionId - 会话ID
 */
export function completePractice(sessionId) {
  return request.post(`/word-practice/sessions/${sessionId}/complete`)
}

/**
 * 获取练习结果
 * @param {number} sessionId - 会话ID
 */
export function getPracticeResult(sessionId) {
  return request.get(`/word-practice/sessions/${sessionId}/result`)
}

// ==================== 错题集 ====================

/**
 * 获取错题列表
 * @param {Object} params - 查询参数
 */
export function getMistakes(params) {
  return request.get('/word-practice/mistakes', { params })
}

/**
 * 获取错题统计
 */
export function getMistakeStats() {
  return request.get('/word-practice/mistakes/stats')
}

/**
 * 标记错题为已掌握
 * @param {number} mistakeId - 错题ID
 */
export function markMistakeMastered(mistakeId) {
  return request.post(`/word-practice/mistakes/${mistakeId}/master`)
}

/**
 * 批量标记为已掌握
 * @param {Array<number>} ids - 错题ID数组
 */
export function batchMarkMastered(ids) {
  return request.post('/word-practice/mistakes/batch-master', { ids })
}

/**
 * 获取高频错题
 * @param {number} limit - 返回数量
 */
export function getFrequentMistakes(limit = 10) {
  return request.get('/word-practice/mistakes/frequent', { params: { limit } })
}

// ==================== 复习计划 ====================

/**
 * 为指定练习会话的错题创建复习计划
 * @param {number} sessionId - 练习会话ID
 */
export function createReviewPlansForSession(sessionId) {
  return request.post(`/word-practice/sessions/${sessionId}/create-review-plans`)
}

/**
 * 为指定错题创建复习计划
 * @param {Array<number>} mistakeIds - 错题ID数组
 */
export function createReviewPlansForMistakes(mistakeIds) {
  return request.post('/word-practice/mistakes/create-review-plans', { mistakeIds })
}

/**
 * 获取待复习任务
 * @param {Object} params - 查询参数
 */
export function getDueReviews(params) {
  return request.get('/word-practice/reviews/due', { params })
}

/**
 * 获取复习统计
 */
export function getReviewStats() {
  return request.get('/word-practice/reviews/stats')
}

/**
 * 完成复习
 * @param {number} planId - 复习计划ID
 * @param {Object} data - 复习结果
 */
export function completeReview(planId, data) {
  return request.post(`/word-practice/reviews/${planId}/complete`, data)
}

/**
 * 跳过复习
 * @param {number} planId - 复习计划ID
 */
export function skipReview(planId) {
  return request.post(`/word-practice/reviews/${planId}/skip`)
}

/**
 * 获取所有复习计划
 * @param {Object} params - 查询参数
 */
export function getReviewPlans(params) {
  return request.get('/word-practice/reviews', { params })
}

// ==================== 通知 ====================

/**
 * 获取未读通知
 * @param {Object} params - 查询参数
 */
export function getUnreadNotifications(params) {
  return request.get('/word-practice/notifications/unread', { params })
}

/**
 * 获取所有通知
 * @param {Object} params - 查询参数
 */
export function getNotifications(params) {
  return request.get('/word-practice/notifications', { params })
}

/**
 * 标记通知为已读
 * @param {Array<number>} ids - 通知ID数组
 */
export function markNotificationsRead(ids) {
  return request.post('/word-practice/notifications/read', { ids })
}

/**
 * 标记所有通知为已读
 */
export function markAllNotificationsRead() {
  return request.post('/word-practice/notifications/read-all')
}

/**
 * 获取通知统计
 */
export function getNotificationStats() {
  return request.get('/word-practice/notifications/stats')
}

/**
 * 检查并创建复习提醒
 */
export function checkReminders() {
  return request.post('/word-practice/check-reminders')
}
