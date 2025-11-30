/**
 * 通知服务模块
 * 模块化设计，支持多种通知类型
 * 可扩展到邮件、推送等通知方式
 */

const { getDatabase } = require('../database/init');

// 通知类型枚举
const NOTIFICATION_TYPES = {
  REVIEW_REMINDER: 'review_reminder',       // 复习提醒
  PRACTICE_COMPLETE: 'practice_complete',   // 练习完成
  ACHIEVEMENT: 'achievement',               // 成就解锁
  DAILY_SUMMARY: 'daily_summary',           // 每日总结
  STREAK_WARNING: 'streak_warning',         // 连续学习警告
  WORD_MASTERED: 'word_mastered'           // 词汇掌握
};

/**
 * 创建通知
 * @param {Object} options - 通知选项
 * @param {string} options.type - 通知类型
 * @param {string} options.title - 标题
 * @param {string} options.content - 内容
 * @param {string} options.relatedType - 关联类型
 * @param {number} options.relatedId - 关联ID
 * @param {Date} options.scheduledAt - 计划发送时间
 * @returns {Object} 创建的通知
 */
function createNotification(options) {
  const db = getDatabase();
  const { type, title, content, relatedType, relatedId, scheduledAt = null } = options;
  
  const result = db.prepare(`
    INSERT INTO notifications (type, title, content, related_type, related_id, scheduled_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    type,
    title,
    content,
    relatedType || null,
    relatedId || null,
    scheduledAt ? new Date(scheduledAt).toISOString() : null
  );
  
  return {
    id: result.lastInsertRowid,
    type,
    title,
    content,
    scheduledAt
  };
}

/**
 * 创建复习提醒通知
 * @param {number} wordCount - 待复习词汇数量
 * @param {Array} words - 待复习词汇列表（可选，只取前几个展示）
 * @returns {Object} 创建的通知
 */
function createReviewReminder(wordCount, words = []) {
  const previewWords = words.slice(0, 3).map(w => w.word).join('、');
  const moreText = words.length > 3 ? `等${wordCount}个词汇` : '';
  
  return createNotification({
    type: NOTIFICATION_TYPES.REVIEW_REMINDER,
    title: '📚 复习提醒',
    content: `您有 ${wordCount} 个词汇需要复习：${previewWords}${moreText}`,
    relatedType: 'review',
    relatedId: null
  });
}

/**
 * 创建练习完成通知
 * @param {Object} result - 练习结果
 * @returns {Object} 创建的通知
 */
function createPracticeCompleteNotification(result) {
  const { sessionId, totalQuestions, correctCount, avgScore } = result;
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  
  let emoji = '🌟';
  let message = '表现不错！';
  
  if (accuracy >= 90) {
    emoji = '🏆';
    message = '太棒了！几乎全对！';
  } else if (accuracy >= 70) {
    emoji = '👍';
    message = '继续加油！';
  } else if (accuracy < 50) {
    emoji = '💪';
    message = '需要多加练习哦！';
  }
  
  return createNotification({
    type: NOTIFICATION_TYPES.PRACTICE_COMPLETE,
    title: `${emoji} 练习完成`,
    content: `${message} 正确率: ${accuracy}%，得分: ${Math.round(avgScore)}分`,
    relatedType: 'session',
    relatedId: sessionId
  });
}

/**
 * 创建成就通知
 * @param {string} achievementType - 成就类型
 * @param {Object} details - 成就详情
 * @returns {Object} 创建的通知
 */
function createAchievementNotification(achievementType, details) {
  const achievements = {
    first_practice: { emoji: '🎉', title: '首次练习', message: '恭喜完成第一次词汇练习！' },
    perfect_score: { emoji: '💯', title: '满分达成', message: '这次练习全部答对！' },
    words_mastered_10: { emoji: '📖', title: '词汇达人', message: '已掌握10个词汇！' },
    words_mastered_50: { emoji: '📚', title: '词汇专家', message: '已掌握50个词汇！' },
    words_mastered_100: { emoji: '🎓', title: '词汇大师', message: '已掌握100个词汇！' },
    streak_7: { emoji: '🔥', title: '连续学习', message: '连续学习7天！' },
    streak_30: { emoji: '⚡', title: '学习达人', message: '连续学习30天！' }
  };
  
  const achievement = achievements[achievementType] || {
    emoji: '🏅',
    title: '成就解锁',
    message: '获得新成就！'
  };
  
  return createNotification({
    type: NOTIFICATION_TYPES.ACHIEVEMENT,
    title: `${achievement.emoji} ${achievement.title}`,
    content: achievement.message,
    relatedType: 'achievement',
    relatedId: null
  });
}

/**
 * 获取未读通知
 * @param {Object} options - 查询选项
 * @param {string} options.type - 通知类型筛选
 * @param {number} options.limit - 返回数量限制
 * @returns {Array<Object>} 通知列表
 */
function getUnreadNotifications(options = {}) {
  const db = getDatabase();
  const { type, limit = 20 } = options;
  
  let sql = `
    SELECT * FROM notifications 
    WHERE is_read = 0
    AND (scheduled_at IS NULL OR scheduled_at <= datetime('now'))
  `;
  const params = [];
  
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  
  return db.prepare(sql).all(...params);
}

/**
 * 获取所有通知（分页）
 * @param {Object} options - 查询选项
 * @returns {Object} 通知列表和分页信息
 */
function getAllNotifications(options = {}) {
  const db = getDatabase();
  const { page = 1, pageSize = 20, type, includeRead = true } = options;
  
  let whereClauses = ['1=1'];
  const params = [];
  
  if (!includeRead) {
    whereClauses.push('is_read = 0');
  }
  
  if (type) {
    whereClauses.push('type = ?');
    params.push(type);
  }
  
  const whereSQL = whereClauses.join(' AND ');
  
  // 获取总数
  const { count } = db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE ${whereSQL}
  `).get(...params);
  
  // 获取列表
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE ${whereSQL}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  
  return {
    list: notifications,
    total: count,
    page,
    pageSize
  };
}

/**
 * 标记通知为已读
 * @param {number|Array<number>} notificationIds - 通知ID或ID数组
 */
function markAsRead(notificationIds) {
  const db = getDatabase();
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
  
  if (ids.length === 0) return;
  
  db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE id IN (${ids.join(',')})
  `).run();
}

/**
 * 标记所有通知为已读
 */
function markAllAsRead() {
  const db = getDatabase();
  db.prepare(`
    UPDATE notifications 
    SET is_read = 1 
    WHERE is_read = 0
  `).run();
}

/**
 * 删除通知
 * @param {number} notificationId - 通知ID
 */
function deleteNotification(notificationId) {
  const db = getDatabase();
  db.prepare('DELETE FROM notifications WHERE id = ?').run(notificationId);
}

/**
 * 删除过期通知
 * @param {number} days - 保留天数
 */
function cleanupOldNotifications(days = 30) {
  const db = getDatabase();
  db.prepare(`
    DELETE FROM notifications 
    WHERE created_at < datetime('now', '-' || ? || ' days')
    AND is_read = 1
  `).run(days);
}

/**
 * 获取通知统计
 * @returns {Object} 统计数据
 */
function getNotificationStats() {
  const db = getDatabase();
  
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread,
      SUM(CASE WHEN type = 'review_reminder' AND is_read = 0 THEN 1 ELSE 0 END) as pending_reviews
    FROM notifications
  `).get();
  
  return stats;
}

/**
 * 检查并创建复习提醒
 * 这个函数应该被定时任务调用
 */
function checkAndCreateReviewReminders() {
  const db = getDatabase();
  
  // 获取到期的复习任务
  const dueTasks = db.prepare(`
    SELECT 
      rp.word_id,
      rp.word
    FROM word_review_plans rp
    WHERE rp.is_completed = 0 
    AND rp.next_review_at <= datetime('now')
  `).all();
  
  if (dueTasks.length > 0) {
    // 检查是否已有未读的复习提醒
    const existingReminder = db.prepare(`
      SELECT id FROM notifications 
      WHERE type = ? AND is_read = 0
      AND created_at > datetime('now', '-1 hour')
    `).get(NOTIFICATION_TYPES.REVIEW_REMINDER);
    
    if (!existingReminder) {
      createReviewReminder(dueTasks.length, dueTasks);
    }
  }
  
  return dueTasks.length;
}

module.exports = {
  NOTIFICATION_TYPES,
  createNotification,
  createReviewReminder,
  createPracticeCompleteNotification,
  createAchievementNotification,
  getUnreadNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  cleanupOldNotifications,
  getNotificationStats,
  checkAndCreateReviewReminders
};
