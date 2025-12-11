/**
 * 墨境写作成长系统 API 路由
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { 
  getFullProfile, 
  awardXP, 
  getXPHistory, 
  getTodayXPStats,
  getLevelConfig,
  updateStreakStatus
} = require('../services/xpService');
const {
  getAllAchievements,
  getUnlockedAchievements,
  checkAndUnlockAchievements,
  getAchievementStats,
  getNextAchievements
} = require('../services/achievementService');
const {
  getTodayTasks,
  generateDailyTasksFromTemplates,
  generateAITaskVariants,
  startTask,
  saveTaskDraft,
  submitTask,
  getDailyChallenge,
  updateDailyChallengeProgress,
  getWeeklyChallenge,
  getTaskStats
} = require('../services/inkTaskService');
const {
  manualGenerateTasks,
  getSchedulerStatus
} = require('../services/schedulerService');

// ==================== 用户档案 ====================

/**
 * 获取用户档案（六维属性、等级、经验值等）
 */
router.get('/profile', (req, res) => {
  try {
    const profile = getFullProfile();
    res.json({ success: true, data: profile });
  } catch (error) {
    console.error('获取档案失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 更新用户昵称
 */
router.put('/profile/nickname', (req, res) => {
  try {
    const { nickname } = req.body;
    const db = getDatabase();
    
    db.prepare(`
      UPDATE mojing_profile SET nickname = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM mojing_profile LIMIT 1)
    `).run(nickname);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取等级配置
 */
router.get('/levels', (req, res) => {
  try {
    const levels = getLevelConfig();
    res.json({ success: true, data: levels });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 经验值 ====================

/**
 * 获取XP历史
 */
router.get('/xp/history', (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const history = getXPHistory(parseInt(limit), parseInt(offset));
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取今日XP统计
 */
router.get('/xp/today', (req, res) => {
  try {
    const stats = getTodayXPStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 成就 ====================

/**
 * 获取所有成就
 */
router.get('/achievements', (req, res) => {
  try {
    const achievements = getAllAchievements();
    const stats = getAchievementStats();
    res.json({ success: true, data: { achievements, stats } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取已解锁成就
 */
router.get('/achievements/unlocked', (req, res) => {
  try {
    const achievements = getUnlockedAchievements();
    res.json({ success: true, data: achievements });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取下一个可能解锁的成就
 */
router.get('/achievements/next', (req, res) => {
  try {
    const { limit = 3 } = req.query;
    const next = getNextAchievements(parseInt(limit));
    res.json({ success: true, data: next });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 任务 ====================

/**
 * 获取今日任务列表
 */
router.get('/tasks/today', (req, res) => {
  try {
    const { type = 'all' } = req.query;
    const tasks = getTodayTasks(type);
    const challenge = getDailyChallenge();
    const stats = getTaskStats();
    
    res.json({ 
      success: true, 
      data: { 
        tasks, 
        dailyChallenge: challenge,
        stats: stats.todayStats
      } 
    });
  } catch (error) {
    console.error('获取今日任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取任务详情
 */
router.get('/tasks/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    
    const task = db.prepare(`
      SELECT dt.*, tt.code as template_code
      FROM mojing_daily_tasks dt
      LEFT JOIN mojing_task_templates tt ON dt.template_id = tt.id
      WHERE dt.id = ?
    `).get(id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    // 获取完成记录
    const record = db.prepare(`
      SELECT * FROM mojing_task_records 
      WHERE task_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(id);
    
    res.json({ success: true, data: { task, record } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 开始任务
 */
router.post('/tasks/:id/start', (req, res) => {
  try {
    const { id } = req.params;
    const result = startTask(parseInt(id));
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 保存任务草稿
 */
router.put('/tasks/records/:recordId', (req, res) => {
  try {
    const { recordId } = req.params;
    const { content, timeSpent } = req.body;
    const record = saveTaskDraft(parseInt(recordId), content, timeSpent);
    res.json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 提交任务
 */
router.post('/tasks/records/:recordId/submit', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { content, timeSpent } = req.body;
    
    const result = await submitTask(parseInt(recordId), content, timeSpent);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('提交任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 获取任务统计
 */
router.get('/tasks/stats/overview', (req, res) => {
  try {
    const stats = getTaskStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 每日挑战 ====================

/**
 * 获取每日挑战
 */
router.get('/challenge/daily', (req, res) => {
  try {
    const challenge = getDailyChallenge();
    res.json({ success: true, data: challenge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 周挑战（墨章） ====================

/**
 * 获取本周墨章挑战
 */
router.get('/challenge/weekly', (req, res) => {
  try {
    const challenge = getWeeklyChallenge();
    res.json({ success: true, data: challenge });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 提交墨章作品
 */
router.post('/challenge/weekly/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, timeSpent } = req.body;
    const db = getDatabase();
    
    const challenge = db.prepare(`
      SELECT * FROM mojing_weekly_challenges WHERE id = ?
    `).get(id);
    
    if (!challenge) {
      return res.status(404).json({ success: false, error: '挑战不存在' });
    }
    
    const wordCount = content.replace(/[\s\p{P}]/gu, '').length;
    
    // 检查是否已有提交
    let submission = db.prepare(`
      SELECT * FROM mojing_weekly_submissions WHERE challenge_id = ?
    `).get(id);
    
    if (submission) {
      // 更新现有提交
      db.prepare(`
        UPDATE mojing_weekly_submissions SET
          content = ?,
          word_count = ?,
          time_spent = time_spent + ?,
          status = 'submitted',
          submitted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(content, wordCount, timeSpent || 0, submission.id);
    } else {
      // 创建新提交
      const result = db.prepare(`
        INSERT INTO mojing_weekly_submissions 
        (challenge_id, content, word_count, time_spent, status, submitted_at)
        VALUES (?, ?, ?, ?, 'submitted', CURRENT_TIMESTAMP)
      `).run(id, content, wordCount, timeSpent || 0);
      
      submission = db.prepare(`
        SELECT * FROM mojing_weekly_submissions WHERE id = ?
      `).get(result.lastInsertRowid);
    }
    
    // TODO: AI评审墨章作品
    
    // 发放XP
    const xpResult = awardXP('inkchapter_complete', submission.id, {
      attrType: 'comprehensive',
      attrAmount: 5,
      wordCount,
      timeSpent,
      incrementPractice: true,
      description: `完成墨章挑战: ${challenge.title}`
    });
    
    // 更新连续打卡
    updateStreakStatus();
    
    // 检查成就
    const achievements = checkAndUnlockAchievements('inkchapter_complete', {});
    
    res.json({ 
      success: true, 
      data: { 
        submission, 
        xpResult, 
        newAchievements: achievements 
      } 
    });
  } catch (error) {
    console.error('提交墨章失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 任务模板管理 ====================

/**
 * 获取任务模板列表
 */
router.get('/templates', (req, res) => {
  try {
    const { type, attr } = req.query;
    const db = getDatabase();
    
    let sql = 'SELECT * FROM mojing_task_templates WHERE is_active = 1';
    const params = [];
    
    if (type) {
      sql += ' AND task_type = ?';
      params.push(type);
    }
    
    if (attr) {
      sql += ' AND attr_type = ?';
      params.push(attr);
    }
    
    sql += ' ORDER BY task_type, code';
    
    const templates = db.prepare(sql).all(...params);
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 调度器管理 ====================

/**
 * 获取调度器状态
 */
router.get('/scheduler/status', (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 手动触发任务生成
 */
router.post('/scheduler/generate', async (req, res) => {
  try {
    const { preset = true, ai = false, aiCount = 3 } = req.body;
    const result = await manualGenerateTasks({ preset, ai, aiCount });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 物品背包 ====================

/**
 * 获取物品背包
 */
router.get('/inventory', (req, res) => {
  try {
    const db = getDatabase();
    const items = db.prepare(`
      SELECT * FROM mojing_inventory ORDER BY acquired_at DESC
    `).all();
    
    // 按类型分组统计
    const summary = db.prepare(`
      SELECT item_type, SUM(quantity) as total
      FROM mojing_inventory
      GROUP BY item_type
    `).all();
    
    res.json({ success: true, data: { items, summary } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 首页概览 ====================

/**
 * 获取墨境首页数据
 */
router.get('/home', (req, res) => {
  try {
    const profile = getFullProfile();
    const todayTasks = getTodayTasks('all');
    const dailyChallenge = getDailyChallenge();
    const weeklyChallenge = getWeeklyChallenge();
    const todayXP = getTodayXPStats();
    const nextAchievements = getNextAchievements(3);
    const taskStats = getTaskStats();
    
    // 计算今日完成情况
    const todayCompleted = todayTasks.filter(t => t.isCompleted).length;
    const todayTotal = todayTasks.length;
    
    // 混合展示：取4个墨点 + 2个墨线（或根据实际情况调整）
    const inkdotTasks = todayTasks.filter(t => t.task_type === 'inkdot').slice(0, 4);
    const inklineTasks = todayTasks.filter(t => t.task_type === 'inkline').slice(0, 2);
    const displayTasks = [...inkdotTasks, ...inklineTasks];
    
    res.json({
      success: true,
      data: {
        profile,
        today: {
          tasks: displayTasks,
          completed: todayCompleted,
          total: todayTotal,
          xpEarned: todayXP.totalXP,
          activityCount: todayXP.activityCount
        },
        dailyChallenge,
        weeklyChallenge,
        nextAchievements,
        stats: taskStats.todayStats
      }
    });
  } catch (error) {
    console.error('获取首页数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
