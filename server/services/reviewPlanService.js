/**
 * 复习计划服务模块
 * 基于艾宾浩斯遗忘曲线实现智能复习计划
 * 模块化设计，方便扩展
 */

const { getDatabase } = require('../database/init');

// 艾宾浩斯遗忘曲线复习间隔（分钟）
// 7次复习：20分钟、1小时、9小时、1天、2天、6天、31天
const REVIEW_INTERVALS = [
  20,           // 第1次：20分钟后
  60,           // 第2次：1小时后
  540,          // 第3次：9小时后
  1440,         // 第4次：1天后
  2880,         // 第5次：2天后
  8640,         // 第6次：6天后
  44640         // 第7次：31天后
];

// 复习阶段数量
const TOTAL_REVIEW_STAGES = REVIEW_INTERVALS.length;

/**
 * 计算下次复习时间
 * @param {number} stage - 当前阶段（1-7）
 * @param {Date} fromTime - 起始时间
 * @returns {Date} 下次复习时间
 */
function calculateNextReviewTime(stage, fromTime = new Date()) {
  if (stage < 1 || stage > TOTAL_REVIEW_STAGES) {
    throw new Error(`Invalid review stage: ${stage}`);
  }
  
  const intervalMinutes = REVIEW_INTERVALS[stage - 1];
  const nextTime = new Date(fromTime.getTime() + intervalMinutes * 60 * 1000);
  return nextTime;
}

/**
 * 创建复习计划
 * @param {Object} options - 配置选项
 * @param {number} options.wordId - 词汇ID
 * @param {string} options.word - 词汇
 * @param {string} options.meaning - 释义
 * @param {string} options.category - 分类
 * @param {string} options.examples - 例句
 * @param {string} options.sourceType - 来源类型
 * @param {number} options.sourceId - 来源ID
 * @returns {Object} 创建的复习计划
 */
function createReviewPlan(options) {
  const db = getDatabase();
  const { wordId, word, meaning, category, examples, sourceType = 'practice', sourceId } = options;
  
  // 检查是否已有该词汇的未完成复习计划
  const existingPlan = db.prepare(`
    SELECT * FROM word_review_plans 
    WHERE word_id = ? AND is_completed = 0
  `).get(wordId);
  
  if (existingPlan) {
    // 已有计划，返回现有计划，并标记为已存在
    existingPlan.existing = true;
    return existingPlan;
  }
  
  // 创建新计划
  const nextReviewAt = calculateNextReviewTime(1);
  
  const result = db.prepare(`
    INSERT INTO word_review_plans (
      word_id, word, meaning, category, examples, 
      source_type, source_id, review_stage, next_review_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(wordId, word, meaning, category, examples, sourceType, sourceId, nextReviewAt.toISOString());
  
  return {
    id: result.lastInsertRowid,
    wordId,
    word,
    reviewStage: 1,
    nextReviewAt
  };
}

/**
 * 批量创建复习计划
 * @param {Array<Object>} items - 词汇列表
 * @param {number} sessionId - 来源练习会话ID
 * @returns {Array<Object>} 创建的复习计划列表
 */
function createReviewPlansForMistakes(items, sessionId) {
  const plans = [];
  
  for (const item of items) {
    const plan = createReviewPlan({
      wordId: item.wordId,
      word: item.word,
      meaning: item.meaning,
      category: item.category,
      examples: item.examples,
      sourceType: 'practice',
      sourceId: sessionId
    });
    plans.push(plan);
  }
  
  return plans;
}

/**
 * 获取到期的复习任务
 * @param {Object} options - 查询选项
 * @param {number} options.limit - 返回数量限制
 * @param {boolean} options.includeFuture - 是否包含未来的任务
 * @returns {Array<Object>} 复习任务列表
 */
function getDueReviewTasks(options = {}) {
  const db = getDatabase();
  const { limit = 20, includeFuture = false } = options;
  
  let sql = `
    SELECT 
      rp.*,
      dw.category as dw_category,
      dw.examples as dw_examples
    FROM word_review_plans rp
    LEFT JOIN dictionary_words dw ON rp.word_id = dw.id
    WHERE rp.is_completed = 0
  `;
  
  if (!includeFuture) {
    sql += ` AND rp.next_review_at <= datetime('now')`;
  }
  
  sql += ` ORDER BY rp.next_review_at ASC LIMIT ?`;
  
  return db.prepare(sql).all(limit);
}

/**
 * 完成一次复习
 * @param {Object} options - 复习结果
 * @param {number} options.planId - 复习计划ID
 * @param {boolean} options.isCorrect - 是否答对
 * @param {number} options.timeSpent - 耗时（秒）
 * @param {number} options.quality - 质量评分（1-5）
 * @returns {Object} 更新后的复习计划
 */
function completeReview(options) {
  const db = getDatabase();
  const { planId, isCorrect, timeSpent = 0, quality = 3 } = options;
  
  // 获取当前计划
  const plan = db.prepare('SELECT * FROM word_review_plans WHERE id = ?').get(planId);
  if (!plan) {
    throw new Error('Review plan not found');
  }
  
  // 更新复习计划
  let newStage = plan.review_stage;
  let correctStreak = plan.correct_streak;
  let isCompleted = false;
  let nextReviewAt;
  
  if (isCorrect) {
    correctStreak++;
    newStage++;
    
    if (newStage > TOTAL_REVIEW_STAGES) {
      // 完成所有复习
      isCompleted = true;
      nextReviewAt = null;
    } else {
      nextReviewAt = calculateNextReviewTime(newStage);
    }
  } else {
    // 答错，重置连续正确次数，但不降级太多
    correctStreak = 0;
    // 最多降一级，最低为1
    newStage = Math.max(1, newStage - 1);
    // 较短的间隔后再次复习
    nextReviewAt = calculateNextReviewTime(1);
  }
  
  db.prepare(`
    UPDATE word_review_plans 
    SET review_stage = ?,
        next_review_at = ?,
        last_reviewed_at = CURRENT_TIMESTAMP,
        total_reviews = total_reviews + 1,
        correct_streak = ?,
        is_completed = ?
    WHERE id = ?
  `).run(
    newStage,
    nextReviewAt ? nextReviewAt.toISOString() : null,
    correctStreak,
    isCompleted ? 1 : 0,
    planId
  );
  
  // 如果完成所有复习，更新错题集状态
  if (isCompleted) {
    db.prepare(`
      UPDATE word_mistakes 
      SET is_mastered = 1, last_review_at = CURRENT_TIMESTAMP 
      WHERE word_id = ?
    `).run(plan.word_id);
  }
  
  return {
    ...plan,
    reviewStage: newStage,
    nextReviewAt,
    correctStreak,
    isCompleted
  };
}

/**
 * 获取复习统计
 * @returns {Object} 统计数据
 */
function getReviewStatistics() {
  const db = getDatabase();
  
  // 总体统计
  const total = db.prepare(`
    SELECT 
      COUNT(*) as total_plans,
      SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as completed_plans,
      SUM(CASE WHEN next_review_at <= datetime('now') AND is_completed = 0 THEN 1 ELSE 0 END) as due_count
    FROM word_review_plans
  `).get();
  
  // 今日待复习
  const todayDue = db.prepare(`
    SELECT COUNT(*) as count FROM word_review_plans 
    WHERE is_completed = 0 
    AND date(next_review_at) <= date('now')
  `).get().count;
  
  // 本周待复习
  const weekDue = db.prepare(`
    SELECT COUNT(*) as count FROM word_review_plans 
    WHERE is_completed = 0 
    AND date(next_review_at) <= date('now', '+7 days')
  `).get().count;
  
  // 各阶段分布
  const stageDistribution = db.prepare(`
    SELECT review_stage, COUNT(*) as count 
    FROM word_review_plans 
    WHERE is_completed = 0 
    GROUP BY review_stage
  `).all();
  
  return {
    totalPlans: total.total_plans || 0,
    completedPlans: total.completed_plans || 0,
    dueCount: total.due_count || 0,
    todayDue,
    weekDue,
    stageDistribution
  };
}

/**
 * 跳过复习任务
 * @param {number} planId - 复习计划ID
 */
function skipReview(planId) {
  const db = getDatabase();
  
  // 推迟到明天同一时间
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  db.prepare(`
    UPDATE word_review_plans 
    SET next_review_at = ?
    WHERE id = ?
  `).run(tomorrow.toISOString(), planId);
}

/**
 * 删除复习计划
 * @param {number} planId - 复习计划ID
 */
function deleteReviewPlan(planId) {
  const db = getDatabase();
  db.prepare('DELETE FROM word_review_plans WHERE id = ?').run(planId);
}

/**
 * 获取所有复习计划（分页）
 * @param {Object} options - 查询选项
 * @returns {Object} 复习计划列表和分页信息
 */
function getReviewPlans(options = {}) {
  const db = getDatabase();
  const { page = 1, pageSize = 20, isCompleted } = options;
  
  let whereClauses = ['1=1'];
  const params = [];
  
  if (isCompleted !== undefined) {
    whereClauses.push('is_completed = ?');
    params.push(isCompleted ? 1 : 0);
  }
  
  const whereSQL = whereClauses.join(' AND ');
  
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM word_review_plans WHERE ${whereSQL}
  `).get(...params);
  
  const plans = db.prepare(`
    SELECT * FROM word_review_plans 
    WHERE ${whereSQL}
    ORDER BY next_review_at ASC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  
  return {
    list: plans,
    total: count,
    page,
    pageSize
  };
}

module.exports = {
  REVIEW_INTERVALS,
  TOTAL_REVIEW_STAGES,
  calculateNextReviewTime,
  createReviewPlan,
  createReviewPlansForMistakes,
  getDueReviewTasks,
  completeReview,
  getReviewStatistics,
  skipReview,
  deleteReviewPlan,
  getReviewPlans
};
