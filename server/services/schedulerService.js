/**
 * 墨境后台调度服务
 * 负责：每日任务生成、AI任务变体生成、定时任务管理
 */

const cron = require('node-cron');
const { 
  generateDailyTasksFromTemplates, 
  generateAITaskVariants,
  getDailyChallenge 
} = require('./inkTaskService');
const { getDatabase } = require('../database/init');

let schedulerStarted = false;
let taskGenerationInterval = null;

/**
 * 启动调度器
 */
function startScheduler() {
  if (schedulerStarted) {
    console.log('调度器已在运行');
    return;
  }
  
  console.log('启动墨境调度器...');
  
  // 每天凌晨0点1分生成今日预设任务
  cron.schedule('1 0 * * *', async () => {
    console.log('[调度] 开始生成每日预设任务...');
    try {
      const result = generateDailyTasksFromTemplates();
      console.log('[调度] 预设任务生成完成:', result);
      
      // 生成每日挑战
      getDailyChallenge();
      console.log('[调度] 每日挑战生成完成');
    } catch (error) {
      console.error('[调度] 任务生成失败:', error);
    }
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  // 每5分钟检查是否需要生成AI任务变体
  taskGenerationInterval = setInterval(async () => {
    await checkAndGenerateAITasks();
  }, 5 * 60 * 1000); // 5分钟
  
  // 每天凌晨0点清理过期数据
  cron.schedule('0 0 * * *', () => {
    console.log('[调度] 开始清理过期数据...');
    cleanupOldData();
  }, {
    timezone: 'Asia/Shanghai'
  });
  
  schedulerStarted = true;
  console.log('墨境调度器启动完成');
  
  // 启动时立即检查今日任务
  setTimeout(() => {
    ensureTodayTasks();
  }, 1000);
}

/**
 * 停止调度器
 */
function stopScheduler() {
  if (taskGenerationInterval) {
    clearInterval(taskGenerationInterval);
    taskGenerationInterval = null;
  }
  schedulerStarted = false;
  console.log('墨境调度器已停止');
}

/**
 * 确保今日任务已生成
 */
function ensureTodayTasks() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  // 检查今日任务数量
  const count = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_daily_tasks WHERE task_date = ?
  `).get(today).count;
  
  if (count === 0) {
    console.log('[调度] 今日任务为空，开始生成...');
    const result = generateDailyTasksFromTemplates();
    console.log('[调度] 预设任务生成完成:', result);
    
    // 确保每日挑战存在
    getDailyChallenge();
  } else {
    console.log(`[调度] 今日已有 ${count} 个任务`);
  }
}

/**
 * 检查并生成AI任务变体
 */
async function checkAndGenerateAITasks() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  // 检查今日AI生成的任务数量
  const aiTaskCount = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_daily_tasks 
    WHERE task_date = ? AND source = 'ai_generated'
  `).get(today).count;
  
  // 每天最多生成10个AI任务
  const maxAITasks = 10;
  
  if (aiTaskCount >= maxAITasks) {
    return;
  }
  
  // 检查是否有AI配置
  const hasAIConfig = db.prepare(`
    SELECT COUNT(*) as count FROM ai_config WHERE is_active = 1 OR is_default = 1
  `).get().count > 0;
  
  if (!hasAIConfig) {
    return;
  }
  
  // 检查AI功能是否配置
  const hasMojingFeature = db.prepare(`
    SELECT COUNT(*) as count FROM ai_feature_config 
    WHERE feature_key = 'mojing_task_generate' AND config_id IS NOT NULL
  `).get().count > 0;
  
  // 如果没有专门配置墨境功能，使用默认配置也可以
  
  console.log('[调度] 开始生成AI任务变体...');
  
  try {
    // 交替生成墨点和墨线任务
    const inkdotCount = db.prepare(`
      SELECT COUNT(*) as count FROM mojing_daily_tasks 
      WHERE task_date = ? AND task_type = 'inkdot' AND source = 'ai_generated'
    `).get(today).count;
    
    const inklineCount = db.prepare(`
      SELECT COUNT(*) as count FROM mojing_daily_tasks 
      WHERE task_date = ? AND task_type = 'inkline' AND source = 'ai_generated'
    `).get(today).count;
    
    // 优先生成数量较少的类型
    if (inkdotCount <= inklineCount && inkdotCount < 6) {
      await generateAITaskVariants('inkdot', 2);
    } else if (inklineCount < 4) {
      await generateAITaskVariants('inkline', 1);
    }
    
  } catch (error) {
    console.error('[调度] AI任务生成失败:', error);
  }
}

/**
 * 清理过期数据
 */
function cleanupOldData() {
  const db = getDatabase();
  
  // 清理30天前的每日任务（保留完成记录）
  const deletedTasks = db.prepare(`
    DELETE FROM mojing_daily_tasks 
    WHERE task_date < date('now', '-30 days')
    AND id NOT IN (SELECT task_id FROM mojing_task_records WHERE status = 'completed')
  `).run();
  
  console.log(`[清理] 删除了 ${deletedTasks.changes} 条过期任务`);
  
  // 清理90天前的XP流水
  const deletedXP = db.prepare(`
    DELETE FROM mojing_xp_transactions 
    WHERE created_at < datetime('now', '-90 days')
  `).run();
  
  console.log(`[清理] 删除了 ${deletedXP.changes} 条过期XP记录`);
}

/**
 * 手动触发任务生成
 */
async function manualGenerateTasks(options = {}) {
  const results = {};
  
  if (options.preset !== false) {
    results.preset = generateDailyTasksFromTemplates();
  }
  
  if (options.ai) {
    results.aiInkdot = await generateAITaskVariants('inkdot', options.aiCount || 3);
    results.aiInkline = await generateAITaskVariants('inkline', options.aiCount || 2);
  }
  
  if (options.challenge !== false) {
    results.challenge = getDailyChallenge();
  }
  
  return results;
}

/**
 * 获取调度器状态
 */
function getSchedulerStatus() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  const todayTaskCount = db.prepare(`
    SELECT 
      source,
      task_type,
      COUNT(*) as count
    FROM mojing_daily_tasks 
    WHERE task_date = ?
    GROUP BY source, task_type
  `).all(today);
  
  const lastAIGeneration = db.prepare(`
    SELECT created_at FROM mojing_daily_tasks 
    WHERE source = 'ai_generated' 
    ORDER BY created_at DESC LIMIT 1
  `).get();
  
  return {
    isRunning: schedulerStarted,
    todayTasks: todayTaskCount,
    lastAIGeneration: lastAIGeneration?.created_at || null
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  ensureTodayTasks,
  checkAndGenerateAITasks,
  manualGenerateTasks,
  getSchedulerStatus,
  cleanupOldData
};
