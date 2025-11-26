import request from '../utils/request'

// 获取设置
export function getSettings() {
  return request.get('/settings')
}

// 更新设置
export function updateSettings(data) {
  return request.put('/settings', data)
}

// 导出数据
export function exportData() {
  return request.post('/settings/data/export')
}

// 导入数据
export function importData(data) {
  return request.post('/settings/data/import', { data })
}

// 备份数据
export function backupData() {
  return request.post('/settings/data/backup')
}

// 重置数据
export function resetData(confirmText) {
  return request.post('/settings/data/reset', { confirmText })
}
