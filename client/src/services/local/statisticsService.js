/**
 * 本地 API 服务 - 统计相关
 */

import { query, queryOne } from '../localDatabase'

// 获取统计概览
export async function getOverview() {
  // 练习统计
  const practiceTotal = queryOne('SELECT COUNT(*) as count FROM practices')
  const practiceSubmitted = queryOne("SELECT COUNT(*) as count FROM practices WHERE status = 'submitted'")
  const practiceWords = queryOne('SELECT SUM(word_count) as total FROM practices')
  const practiceTime = queryOne('SELECT SUM(time_spent) as total FROM practices')
  
  // 随心练习统计
  const freewriteTotal = queryOne('SELECT COUNT(*) as count FROM freewrite_practices')
  const freewriteFinished = queryOne("SELECT COUNT(*) as count FROM freewrite_practices WHERE status = 'finished'")
  const freewriteWords = queryOne('SELECT SUM(word_count) as total FROM freewrite_practices')
  const freewriteTime = queryOne('SELECT SUM(time_spent) as total FROM freewrite_practices')
  
  // 抄书练习统计
  const typingTotal = queryOne('SELECT COUNT(*) as count FROM typing_practices')
  const typingCompleted = queryOne("SELECT COUNT(*) as count FROM typing_practices WHERE status = 'completed'")
  const typingWords = queryOne('SELECT SUM(typed_count) as total FROM typing_practices')
  const typingTime = queryOne('SELECT SUM(time_spent) as total FROM typing_practices')
  
  // 题目统计
  const questionTotal = queryOne('SELECT COUNT(*) as count FROM questions')
  
  return {
    success: true,
    data: {
      practice: {
        total: practiceTotal?.count || 0,
        submitted: practiceSubmitted?.count || 0,
        totalWords: practiceWords?.total || 0,
        totalTime: practiceTime?.total || 0
      },
      freewrite: {
        total: freewriteTotal?.count || 0,
        finished: freewriteFinished?.count || 0,
        totalWords: freewriteWords?.total || 0,
        totalTime: freewriteTime?.total || 0
      },
      typing: {
        total: typingTotal?.count || 0,
        completed: typingCompleted?.count || 0,
        totalWords: typingWords?.total || 0,
        totalTime: typingTime?.total || 0
      },
      questions: {
        total: questionTotal?.count || 0
      },
      // 汇总
      summary: {
        totalPractices: (practiceTotal?.count || 0) + (freewriteTotal?.count || 0) + (typingTotal?.count || 0),
        totalWords: (practiceWords?.total || 0) + (freewriteWords?.total || 0) + (typingWords?.total || 0),
        totalTime: (practiceTime?.total || 0) + (freewriteTime?.total || 0) + (typingTime?.total || 0)
      }
    }
  }
}

// 获取每日统计
export async function getDailyStats(days = 30) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const startDateStr = startDate.toISOString().split('T')[0]
  
  // 练习每日统计
  const practiceDaily = query(`
    SELECT DATE(created_at) as date, COUNT(*) as count, SUM(word_count) as words
    FROM practices
    WHERE DATE(created_at) >= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [startDateStr])
  
  // 随心练习每日统计
  const freewriteDaily = query(`
    SELECT DATE(created_at) as date, COUNT(*) as count, SUM(word_count) as words
    FROM freewrite_practices
    WHERE DATE(created_at) >= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [startDateStr])
  
  // 抄书练习每日统计
  const typingDaily = query(`
    SELECT DATE(created_at) as date, COUNT(*) as count, SUM(typed_count) as words
    FROM typing_practices
    WHERE DATE(created_at) >= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [startDateStr])
  
  // 合并统计
  const dailyMap = {}
  
  for (const item of practiceDaily) {
    if (!dailyMap[item.date]) {
      dailyMap[item.date] = { date: item.date, practices: 0, words: 0 }
    }
    dailyMap[item.date].practices += item.count
    dailyMap[item.date].words += item.words || 0
  }
  
  for (const item of freewriteDaily) {
    if (!dailyMap[item.date]) {
      dailyMap[item.date] = { date: item.date, practices: 0, words: 0 }
    }
    dailyMap[item.date].practices += item.count
    dailyMap[item.date].words += item.words || 0
  }
  
  for (const item of typingDaily) {
    if (!dailyMap[item.date]) {
      dailyMap[item.date] = { date: item.date, practices: 0, words: 0 }
    }
    dailyMap[item.date].practices += item.count
    dailyMap[item.date].words += item.words || 0
  }
  
  const dailyStats = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
  
  return {
    success: true,
    data: dailyStats
  }
}

// 获取评分统计
export async function getScoreStats() {
  const evaluations = query(`
    SELECT total_score FROM evaluations WHERE total_score IS NOT NULL
  `)
  
  if (evaluations.length === 0) {
    return {
      success: true,
      data: {
        average: 0,
        count: 0,
        distribution: []
      }
    }
  }
  
  const scores = evaluations.map(e => e.total_score)
  const average = scores.reduce((a, b) => a + b, 0) / scores.length
  
  // 分数分布
  const distribution = [
    { range: '0-60', count: scores.filter(s => s < 60).length },
    { range: '60-70', count: scores.filter(s => s >= 60 && s < 70).length },
    { range: '70-80', count: scores.filter(s => s >= 70 && s < 80).length },
    { range: '80-90', count: scores.filter(s => s >= 80 && s < 90).length },
    { range: '90-100', count: scores.filter(s => s >= 90).length }
  ]
  
  return {
    success: true,
    data: {
      average: Math.round(average * 10) / 10,
      count: scores.length,
      distribution
    }
  }
}
