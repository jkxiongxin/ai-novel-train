/**
 * 本地 API 服务 - 设置相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取所有设置
export async function getSettings() {
  const rows = query('SELECT key, value FROM settings')
  const settings = {}
  for (const row of rows) {
    settings[row.key] = row.value
  }
  return { success: true, data: settings }
}

// 更新设置
export async function updateSettings(data) {
  const now = new Date().toISOString()
  
  for (const [key, value] of Object.entries(data)) {
    const existing = queryOne('SELECT id FROM settings WHERE key = ?', [key])
    
    if (existing) {
      run(
        'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?',
        [String(value), now, key]
      )
    } else {
      run(
        'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
        [key, String(value), now]
      )
    }
  }
  
  await saveDatabase()
  return { success: true, message: '设置已保存' }
}
