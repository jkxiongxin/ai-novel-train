import request from '../utils/request'

// 获取概览数据
export function getOverview() {
  return request.get('/statistics/overview')
}

// 获取趋势数据
export function getTrends(days = 30) {
  return request.get('/statistics/trends', { params: { days } })
}

// 获取各维度数据
export function getDimensions() {
  return request.get('/statistics/dimensions')
}

// 获取热力图数据
export function getHeatmap(year) {
  return request.get('/statistics/heatmap', { params: { year } })
}

// 获取统计数据（综合接口）
export function getStatistics(params) {
  return request.get('/statistics', { params })
}
