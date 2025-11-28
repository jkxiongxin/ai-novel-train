/**
 * 本地 API 服务 - 随心练习相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取随心练习列表
export async function getFreewriteList(params = {}) {
  const { status, page = 1, pageSize = 20 } = params
  const offset = (page - 1) * pageSize
  
  let sql = 'SELECT * FROM freewrite_practices'
  const sqlParams = []
  
  if (status) {
    sql += ' WHERE status = ?'
    sqlParams.push(status)
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  sqlParams.push(pageSize, offset)
  
  const rows = query(sql, sqlParams)
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM freewrite_practices'
  if (status) {
    countSql += ' WHERE status = ?'
  }
  const countResult = queryOne(countSql, status ? [status] : [])
  
  return {
    success: true,
    data: {
      list: rows,
      total: countResult?.total || 0,
      page,
      pageSize
    }
  }
}

// 获取单个随心练习
export async function getFreewrite(id) {
  const practice = queryOne('SELECT * FROM freewrite_practices WHERE id = ?', [id])
  
  if (!practice) {
    throw new Error('练习不存在')
  }
  
  // 获取评审
  const reviews = query(
    'SELECT * FROM freewrite_reviews WHERE practice_id = ? ORDER BY created_at DESC',
    [id]
  )
  
  return {
    success: true,
    data: {
      ...practice,
      reviews
    }
  }
}

// 创建随心练习
export async function createFreewrite(data) {
  const now = new Date().toISOString()
  const { title = '随心练习', pomodoro_duration, parent_id } = data
  
  const result = run(
    `INSERT INTO freewrite_practices (title, content, pomodoro_duration, parent_id, status, created_at, updated_at)
     VALUES (?, '', ?, ?, 'writing', ?, ?)`,
    [title, pomodoro_duration || null, parent_id || null, now, now]
  )
  
  await saveDatabase()
  
  const practice = queryOne('SELECT * FROM freewrite_practices WHERE id = ?', [result.lastInsertRowid])
  
  return {
    success: true,
    data: practice
  }
}

// 更新随心练习
export async function updateFreewrite(id, data) {
  const now = new Date().toISOString()
  const { title, content, time_spent } = data
  
  // 计算字数
  const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0
  
  run(
    `UPDATE freewrite_practices 
     SET title = ?, content = ?, word_count = ?, time_spent = ?, updated_at = ?
     WHERE id = ?`,
    [title, content, wordCount, time_spent || 0, now, id]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已保存'
  }
}

// 完成随心练习
export async function finishFreewrite(id, data) {
  const now = new Date().toISOString()
  const { content, time_spent, finish_type = 'manual' } = data
  
  const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0
  
  run(
    `UPDATE freewrite_practices 
     SET content = ?, word_count = ?, time_spent = ?, status = 'finished', 
         finish_type = ?, finished_at = ?, updated_at = ?
     WHERE id = ?`,
    [content, wordCount, time_spent || 0, finish_type, now, now, id]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    message: '练习已完成'
  }
}

// 提交用户自评
export async function submitSelfReview(id, data) {
  const now = new Date().toISOString()
  const { score, comment, tags } = data
  
  run(
    `INSERT INTO freewrite_reviews (practice_id, review_type, score, comment, tags, created_at)
     VALUES (?, 'self', ?, ?, ?, ?)`,
    [id, score, comment, JSON.stringify(tags || []), now]
  )
  
  // 更新练习状态
  run(
    `UPDATE freewrite_practices SET status = 'reviewed', updated_at = ? WHERE id = ?`,
    [now, id]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    message: '自评已提交'
  }
}

// 删除随心练习
export async function deleteFreewrite(id) {
  run('DELETE FROM freewrite_reviews WHERE practice_id = ?', [id])
  run('DELETE FROM freewrite_practices WHERE id = ?', [id])
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已删除'
  }
}

// 获取统计数据
export async function getFreewriteStats() {
  const total = queryOne('SELECT COUNT(*) as count FROM freewrite_practices')
  const finished = queryOne("SELECT COUNT(*) as count FROM freewrite_practices WHERE status = 'finished'")
  const totalWords = queryOne('SELECT SUM(word_count) as total FROM freewrite_practices')
  const totalTime = queryOne('SELECT SUM(time_spent) as total FROM freewrite_practices')
  
  return {
    success: true,
    data: {
      totalPractices: total?.count || 0,
      finishedPractices: finished?.count || 0,
      totalWords: totalWords?.total || 0,
      totalTime: totalTime?.total || 0
    }
  }
}
