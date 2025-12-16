import request from '../utils/request'

/**
 * 获取所有拆书流派列表
 */
export function getBookAnalysisStyles() {
  return request.get('/book-analysis/styles')
}

/**
 * 获取单个拆书流派详情
 */
export function getBookAnalysisStyle(styleKey) {
  return request.get(`/book-analysis/styles/${styleKey}`)
}

/**
 * 更新拆书流派（自定义提示词）
 */
export function updateBookAnalysisStyle(styleKey, data) {
  return request.put(`/book-analysis/styles/${styleKey}`, data)
}

/**
 * 获取按小说分组的列表
 */
export function getBookAnalysisNovels() {
  return request.get('/book-analysis/novels')
}

/**
 * 获取指定小说的章节列表
 */
export function getNovelChapters(novelName) {
  return request.get(`/book-analysis/novels/${encodeURIComponent(novelName)}/chapters`)
}

/**
 * AI 拆书分析
 */
export function analyzeChapterWithStyle(data) {
  return request.post('/book-analysis/analyze', data)
}

/**
 * 获取章节的拆书分析结果
 */
export function getChapterAnalyses(chapterId, styleKey) {
  const params = styleKey ? { style_key: styleKey } : {}
  return request.get(`/book-analysis/analysis/${chapterId}`, { params })
}

/**
 * 获取单个分析详情
 */
export function getAnalysisDetail(analysisId) {
  return request.get(`/book-analysis/analysis/detail/${analysisId}`)
}

/**
 * 删除拆书分析结果
 */
export function deleteAnalysis(analysisId) {
  return request.delete(`/book-analysis/analysis/${analysisId}`)
}

/**
 * 创建细纲成文练习
 */
export function createOutlinePractice(data) {
  return request.post('/book-analysis/practice', data)
}

/**
 * 获取练习详情
 */
export function getOutlinePractice(practiceId) {
  return request.get(`/book-analysis/practice/${practiceId}`)
}

/**
 * 保存练习草稿
 */
export function saveOutlinePracticeDraft(practiceId, data) {
  return request.put(`/book-analysis/practice/${practiceId}/draft`, data)
}

/**
 * 提交练习并获取 AI 评价
 */
export function submitOutlinePractice(practiceId, data) {
  return request.post(`/book-analysis/practice/${practiceId}/submit`, data)
}

/**
 * 获取练习历史列表
 */
export function getOutlinePractices(params) {
  return request.get('/book-analysis/practices', { params })
}

/**
 * 删除练习
 */
export function deleteOutlinePractice(practiceId) {
  return request.delete(`/book-analysis/practice/${practiceId}`)
}

/**
 * 获取拆书学习统计
 */
export function getBookAnalysisStatistics() {
  return request.get('/book-analysis/statistics')
}

// ==================== 手动拆书批注 API ====================

/**
 * 获取章节详情（用于手动批注）
 */
export function getChapterById(chapterId) {
  return request.get(`/book-analysis/chapter/${chapterId}`)
}

/**
 * 保存手动批注
 */
export function saveManualAnnotation(chapterId, data) {
  return request.post(`/book-analysis/manual-annotation/${chapterId}`, data)
}

/**
 * 获取手动批注
 */
export function getManualAnnotation(chapterId) {
  return request.get(`/book-analysis/manual-annotation/${chapterId}`)
}

/**
 * 从手动批注创建细纲成文练习
 */
export function createOutlinePracticeFromManual(data) {
  return request.post('/book-analysis/practice-from-manual', data)
}

// ==================== 遮蔽练习 API ====================

/**
 * 创建遮蔽练习
 */
export function createMaskPractice(data) {
  return request.post('/book-analysis/mask-practice', data)
}

/**
 * 获取遮蔽练习详情
 */
export function getMaskPractice(practiceId) {
  return request.get(`/book-analysis/mask-practice/${practiceId}`)
}

/**
 * 保存遮蔽练习草稿
 */
export function saveMaskPracticeDraft(practiceId, data) {
  return request.put(`/book-analysis/mask-practice/${practiceId}/draft`, data)
}

/**
 * 提交遮蔽练习
 */
export function submitMaskPractice(practiceId, data) {
  return request.post(`/book-analysis/mask-practice/${practiceId}/submit`, data)
}
