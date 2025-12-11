/**
 * 墨境写作成长系统 API 客户端
 */

import request from '@/utils/request';

// ==================== 用户档案 ====================

/**
 * 获取用户完整档案
 */
export function getProfile() {
  return request.get('/mojing/profile');
}

/**
 * 更新用户昵称
 */
export function updateNickname(nickname) {
  return request.put('/mojing/profile/nickname', { nickname });
}

/**
 * 获取等级配置列表
 */
export function getLevelConfig() {
  return request.get('/mojing/levels');
}

// ==================== 经验值 ====================

/**
 * 获取XP历史记录
 */
export function getXPHistory(params = {}) {
  return request.get('/mojing/xp/history', { params });
}

/**
 * 获取今日XP统计
 */
export function getTodayXPStats() {
  return request.get('/mojing/xp/today');
}

// ==================== 成就 ====================

/**
 * 获取所有成就（含统计）
 */
export function getAchievements() {
  return request.get('/mojing/achievements');
}

/**
 * 获取已解锁成就
 */
export function getUnlockedAchievements() {
  return request.get('/mojing/achievements/unlocked');
}

/**
 * 获取下一个可能解锁的成就
 */
export function getNextAchievements(limit = 3) {
  return request.get('/mojing/achievements/next', { params: { limit } });
}

// ==================== 任务 ====================

/**
 * 获取今日任务列表
 */
export function getTodayTasks(type = 'all') {
  return request.get('/mojing/tasks/today', { params: { type } });
}

/**
 * 获取任务详情
 */
export function getTaskDetail(taskId) {
  return request.get(`/mojing/tasks/${taskId}`);
}

/**
 * 开始任务
 */
export function startTask(taskId) {
  return request.post(`/mojing/tasks/${taskId}/start`);
}

/**
 * 保存任务草稿
 */
export function saveTaskDraft(recordId, data) {
  return request.put(`/mojing/tasks/records/${recordId}`, data);
}

/**
 * 提交任务
 */
export function submitTask(recordId, data) {
  return request.post(`/mojing/tasks/records/${recordId}/submit`, data);
}

/**
 * 获取任务统计
 */
export function getTaskStats() {
  return request.get('/mojing/tasks/stats/overview');
}

// ==================== 每日挑战 ====================

/**
 * 获取每日挑战
 */
export function getDailyChallenge() {
  return request.get('/mojing/challenge/daily');
}

// ==================== 周挑战（墨章） ====================

/**
 * 获取本周墨章挑战
 */
export function getWeeklyChallenge() {
  return request.get('/mojing/challenge/weekly');
}

/**
 * 提交墨章作品
 */
export function submitWeeklyChallenge(challengeId, data) {
  return request.post(`/mojing/challenge/weekly/${challengeId}/submit`, data);
}

// ==================== 任务模板 ====================

/**
 * 获取任务模板列表
 */
export function getTaskTemplates(params = {}) {
  return request.get('/mojing/templates', { params });
}

// ==================== 物品背包 ====================

/**
 * 获取物品背包
 */
export function getInventory() {
  return request.get('/mojing/inventory');
}

// ==================== 首页 ====================

/**
 * 获取墨境首页数据
 */
export function getHomeData() {
  return request.get('/mojing/home');
}

// ==================== 调度器（管理） ====================

/**
 * 获取调度器状态
 */
export function getSchedulerStatus() {
  return request.get('/mojing/scheduler/status');
}

/**
 * 手动触发任务生成
 */
export function triggerTaskGeneration(options = {}) {
  return request.post('/mojing/scheduler/generate', options);
}

// ==================== 辅助函数 ====================

/**
 * 属性类型映射
 */
export const ATTR_MAP = {
  character: { name: '人物力', icon: '👤', color: '#e74c3c' },
  conflict: { name: '冲突力', icon: '⚔️', color: '#9b59b6' },
  scene: { name: '场景力', icon: '🏔️', color: '#3498db' },
  dialogue: { name: '对话力', icon: '💬', color: '#2ecc71' },
  rhythm: { name: '节奏力', icon: '🌊', color: '#1abc9c' },
  style: { name: '风格力', icon: '✨', color: '#f39c12' }
};

/**
 * 任务类型映射
 */
export const TASK_TYPE_MAP = {
  inkdot: { name: '墨点', icon: '🔵', time: '5分钟', xp: 10 },
  inkline: { name: '墨线', icon: '📝', time: '20分钟', xp: 30 },
  inkchapter: { name: '墨章', icon: '📖', time: '1-2小时', xp: 150 }
};

/**
 * 难度映射
 */
export const DIFFICULTY_MAP = {
  easy: { name: '简单', color: '#27ae60' },
  normal: { name: '普通', color: '#3498db' },
  hard: { name: '困难', color: '#e74c3c' }
};

/**
 * 获取评级
 */
export function getGrade(score) {
  if (score >= 95) return { grade: 'S', color: '#ffd700' };
  if (score >= 85) return { grade: 'A', color: '#27ae60' };
  if (score >= 75) return { grade: 'B', color: '#3498db' };
  if (score >= 60) return { grade: 'C', color: '#f39c12' };
  return { grade: 'D', color: '#e74c3c' };
}

/**
 * 格式化XP数字
 */
export function formatXP(xp) {
  if (xp >= 1000000) {
    return (xp / 1000000).toFixed(1) + 'M';
  }
  if (xp >= 1000) {
    return (xp / 1000).toFixed(1) + 'K';
  }
  return xp.toString();
}
