/**
 * 本地 API 服务 - 练习相关
 */

import { query, queryOne, run, saveDatabase } from '../localDatabase'

// 获取练习列表
export async function getPracticeList(params = {}) {
  const { status, page = 1, pageSize = 20 } = params
  const offset = (page - 1) * pageSize
  
  let sql = `
    SELECT p.*, q.title as question_title, q.type as question_type, q.difficulty
    FROM practices p
    LEFT JOIN questions q ON p.question_id = q.id
  `
  const sqlParams = []
  
  if (status) {
    sql += ' WHERE p.status = ?'
    sqlParams.push(status)
  }
  
  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?'
  sqlParams.push(pageSize, offset)
  
  const rows = query(sql, sqlParams)
  
  // 解析题目内容
  const list = rows.map(row => {
    const q = queryOne('SELECT content FROM questions WHERE id = ?', [row.question_id])
    return {
      ...row,
      question_content: q?.content ? JSON.parse(q.content) : null
    }
  })
  
  // 获取总数
  let countSql = 'SELECT COUNT(*) as total FROM practices'
  if (status) {
    countSql += ' WHERE status = ?'
  }
  const countResult = queryOne(countSql, status ? [status] : [])
  
  return {
    success: true,
    data: {
      list,
      total: countResult?.total || 0,
      page,
      pageSize
    }
  }
}

// 获取单个练习
export async function getPractice(id) {
  const practice = queryOne(`
    SELECT p.*, q.title as question_title, q.type as question_type, q.difficulty, q.content as question_content
    FROM practices p
    LEFT JOIN questions q ON p.question_id = q.id
    WHERE p.id = ?
  `, [id])
  
  if (!practice) {
    throw new Error('练习不存在')
  }
  
  // 解析题目内容
  if (practice.question_content) {
    practice.question_content = JSON.parse(practice.question_content)
  }
  
  // 获取评审
  const evaluations = query(
    'SELECT * FROM evaluations WHERE practice_id = ? ORDER BY created_at DESC',
    [id]
  )
  
  return {
    success: true,
    data: {
      ...practice,
      evaluations
    }
  }
}

// 创建练习
export async function createPractice(data) {
  const now = new Date().toISOString()
  const { question_id } = data
  
  // 更新题目使用次数
  run('UPDATE questions SET use_count = use_count + 1 WHERE id = ?', [question_id])
  
  const result = run(
    `INSERT INTO practices (question_id, content, status, created_at, updated_at)
     VALUES (?, '', 'draft', ?, ?)`,
    [question_id, now, now]
  )
  
  await saveDatabase()
  
  // 获取完整的练习信息
  const practice = await getPractice(result.lastInsertRowid)
  
  return {
    success: true,
    data: practice.data
  }
}

// 更新练习
export async function updatePractice(id, data) {
  const now = new Date().toISOString()
  const { content, time_spent } = data
  
  // 计算字数
  const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0
  
  run(
    `UPDATE practices 
     SET content = ?, word_count = ?, time_spent = ?, updated_at = ?
     WHERE id = ?`,
    [content, wordCount, time_spent || 0, now, id]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已保存'
  }
}

// 提交练习
export async function submitPractice(id, data) {
  const now = new Date().toISOString()
  const { content, time_spent } = data
  
  const wordCount = content ? content.replace(/[\s\p{P}]/gu, '').length : 0
  
  run(
    `UPDATE practices 
     SET content = ?, word_count = ?, time_spent = ?, status = 'submitted', submitted_at = ?, updated_at = ?
     WHERE id = ?`,
    [content, wordCount, time_spent || 0, now, now, id]
  )
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已提交'
  }
}

// 删除练习
export async function deletePractice(id) {
  run('DELETE FROM evaluations WHERE practice_id = ?', [id])
  run('DELETE FROM practices WHERE id = ?', [id])
  
  await saveDatabase()
  
  return {
    success: true,
    message: '已删除'
  }
}
