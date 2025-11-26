const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');

// 获取概览数据
router.get('/overview', (req, res) => {
  try {
    const db = getDatabase();
    
    // 总练习次数
    const totalPractices = db.prepare('SELECT COUNT(*) as count FROM practices').get().count;
    
    // 已完成评审的练习
    const evaluatedPractices = db.prepare(
      "SELECT COUNT(*) as count FROM practices WHERE status = 'evaluated'"
    ).get().count;
    
    // 平均得分
    const avgScore = db.prepare(
      'SELECT AVG(total_score) as avg FROM evaluations'
    ).get().avg || 0;
    
    // 累计字数
    const totalWords = db.prepare(
      'SELECT SUM(word_count) as total FROM practices'
    ).get().total || 0;
    
    // 累计练习时间（秒）
    const totalTime = db.prepare(
      'SELECT SUM(time_spent) as total FROM practices'
    ).get().total || 0;
    
    // 题库数量
    const totalQuestions = db.prepare('SELECT COUNT(*) as count FROM questions').get().count;
    
    // 收藏题目数量
    const favoriteQuestions = db.prepare(
      'SELECT COUNT(*) as count FROM questions WHERE is_favorite = 1'
    ).get().count;
    
    // 最近7天的练习数
    const recentPractices = db.prepare(`
      SELECT COUNT(*) as count FROM practices 
      WHERE created_at >= datetime('now', '-7 days')
    `).get().count;
    
    res.json({
      success: true,
      data: {
        totalPractices,
        evaluatedPractices,
        avgScore: Math.round(avgScore * 10) / 10,
        totalWords,
        totalTime,
        totalQuestions,
        favoriteQuestions,
        recentPractices
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取概览数据失败',
      error: error.message
    });
  }
});

// 获取趋势数据
router.get('/trends', (req, res) => {
  try {
    const db = getDatabase();
    const { days = 30 } = req.query;
    
    // 每日练习数和平均分
    const dailyStats = db.prepare(`
      SELECT 
        date(p.created_at) as date,
        COUNT(*) as practice_count,
        AVG(e.total_score) as avg_score
      FROM practices p
      LEFT JOIN evaluations e ON p.id = e.practice_id
      WHERE p.created_at >= datetime('now', '-${parseInt(days)} days')
      GROUP BY date(p.created_at)
      ORDER BY date
    `).all();
    
    // 分数趋势（按评审时间）
    const scoreTrend = db.prepare(`
      SELECT 
        date(created_at) as date,
        AVG(total_score) as avg_score,
        MAX(total_score) as max_score,
        MIN(total_score) as min_score
      FROM evaluations
      WHERE created_at >= datetime('now', '-${parseInt(days)} days')
      GROUP BY date(created_at)
      ORDER BY date
    `).all();
    
    res.json({
      success: true,
      data: {
        dailyStats,
        scoreTrend
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取趋势数据失败',
      error: error.message
    });
  }
});

// 获取各维度数据
router.get('/dimensions', (req, res) => {
  try {
    const db = getDatabase();
    
    // 各题型练习分布
    const typeDistribution = db.prepare(`
      SELECT 
        q.type,
        COUNT(*) as count,
        AVG(e.total_score) as avg_score
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      LEFT JOIN evaluations e ON p.id = e.practice_id
      GROUP BY q.type
    `).all();
    
    // 各难度练习分布
    const difficultyDistribution = db.prepare(`
      SELECT 
        q.difficulty,
        COUNT(*) as count,
        AVG(e.total_score) as avg_score
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      LEFT JOIN evaluations e ON p.id = e.practice_id
      GROUP BY q.difficulty
    `).all();
    
    // 最近20次评审的各维度平均分（用于雷达图）
    const recentEvaluations = db.prepare(`
      SELECT dimension_scores FROM evaluations 
      ORDER BY created_at DESC 
      LIMIT 20
    `).all();
    
    // 计算各维度平均分
    const dimensionAverages = {};
    let count = 0;
    
    recentEvaluations.forEach(e => {
      try {
        const dims = JSON.parse(e.dimension_scores);
        Object.entries(dims).forEach(([key, value]) => {
          if (value && typeof value.score === 'number') {
            if (!dimensionAverages[key]) {
              dimensionAverages[key] = { total: 0, count: 0 };
            }
            dimensionAverages[key].total += value.score;
            dimensionAverages[key].count += 1;
          }
        });
        count++;
      } catch {}
    });
    
    const radarData = Object.entries(dimensionAverages).map(([key, val]) => ({
      dimension: key,
      avgScore: Math.round((val.total / val.count) * 10) / 10
    }));
    
    res.json({
      success: true,
      data: {
        typeDistribution,
        difficultyDistribution,
        radarData
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取维度数据失败',
      error: error.message
    });
  }
});

// 获取日历热力图数据
router.get('/heatmap', (req, res) => {
  try {
    const db = getDatabase();
    const { year } = req.query;
    
    const currentYear = year || new Date().getFullYear();
    
    const heatmapData = db.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as count
      FROM practices
      WHERE strftime('%Y', created_at) = ?
      GROUP BY date(created_at)
    `).all(String(currentYear));
    
    res.json({
      success: true,
      data: heatmapData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取热力图数据失败',
      error: error.message
    });
  }
});

// 综合统计接口
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const { range = 'week' } = req.query;
    
    // 计算时间范围
    let days = 7;
    if (range === 'month') days = 30;
    else if (range === 'year') days = 365;
    else if (range === 'all') days = 1000; // 很大的数字表示全部
    
    // 总练习次数
    const totalPractices = db.prepare('SELECT COUNT(*) as count FROM practices').get().count;
    
    // 平均得分
    const avgScore = db.prepare(
      'SELECT AVG(total_score) as avg FROM evaluations'
    ).get().avg || 0;
    
    // 累计字数
    const totalWords = db.prepare(
      'SELECT SUM(word_count) as total FROM practices'
    ).get().total || 0;
    
    // 连续练习天数
    const streak = calculateStreak(db);
    
    // 趋势数据
    const trendData = db.prepare(`
      SELECT 
        date(p.created_at) as date,
        COUNT(*) as count,
        AVG(e.total_score) as avgScore
      FROM practices p
      LEFT JOIN evaluations e ON p.id = e.practice_id
      WHERE p.created_at >= datetime('now', '-${days} days')
      GROUP BY date(p.created_at)
      ORDER BY date
    `).all();
    
    // 类型分布
    const typeDistribution = db.prepare(`
      SELECT 
        q.type,
        COUNT(*) as count
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      GROUP BY q.type
    `).all();
    
    // 分数分布（各维度）
    const scoreDistribution = db.prepare(`
      SELECT 
        q.type,
        e.dimension_scores
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      LEFT JOIN evaluations e ON p.id = e.practice_id
      WHERE e.dimension_scores IS NOT NULL
    `).all();
    
    // 处理分数分布数据
    const processedScoreDistribution = [];
    scoreDistribution.forEach(item => {
      try {
        const dimensions = JSON.parse(item.dimension_scores);
        processedScoreDistribution.push({
          type: item.type,
          logic: dimensions.logic?.score || 0,
          writing: dimensions.writing?.score || 0,
          creativity: dimensions.creativity?.score || 0,
          emotion: dimensions.emotion?.score || 0,
          structure: dimensions.structure?.score || 0
        });
      } catch (e) {
        // 忽略解析错误
      }
    });
    
    // 最近练习记录
    const recentPractices = db.prepare(`
      SELECT 
        p.id,
        p.word_count,
        p.created_at,
        q.title as question_title,
        q.type,
        e.total_score
      FROM practices p
      LEFT JOIN questions q ON p.question_id = q.id
      LEFT JOIN evaluations e ON p.id = e.practice_id
      ORDER BY p.created_at DESC
      LIMIT 10
    `).all();
    
    res.json({
      success: true,
      data: {
        totalPractices,
        avgScore: Math.round(avgScore * 10) / 10,
        totalWords,
        streak,
        trendData,
        typeDistribution,
        scoreDistribution: processedScoreDistribution,
        recentPractices
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取统计数据失败',
      error: error.message
    });
  }
});

// 计算连续练习天数
function calculateStreak(db) {
  try {
    // 获取最近30天的练习日期
    const dates = db.prepare(`
      SELECT DISTINCT date(created_at) as date
      FROM practices
      WHERE created_at >= datetime('now', '-30 days')
      ORDER BY date DESC
    `).all();
    
    if (dates.length === 0) return 0;
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    for (const row of dates) {
      const practiceDate = new Date(row.date);
      
      // 检查是否是连续的日期
      const dayDiff = Math.floor((currentDate - practiceDate) / (1000 * 60 * 60 * 24));
      
      if (dayDiff === streak) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  } catch (error) {
    console.error('计算连续练习天数失败:', error);
    return 0;
  }
}

module.exports = router;
