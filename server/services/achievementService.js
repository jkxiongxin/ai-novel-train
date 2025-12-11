/**
 * 墨境成就服务
 * 负责：成就检测、解锁、奖励发放
 */

const { getDatabase } = require('../database/init');
const { awardXP, getOrCreateProfile } = require('./xpService');

/**
 * 获取所有成就（含解锁状态）
 */
function getAllAchievements() {
  const db = getDatabase();
  
  const achievements = db.prepare(`
    SELECT 
      a.*,
      ua.unlocked_at,
      CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END as is_unlocked
    FROM mojing_achievements a
    LEFT JOIN mojing_user_achievements ua ON a.id = ua.achievement_id
    ORDER BY a.sort_order ASC
  `).all();
  
  // 确保每个成就都有有效名字（避免显示占位符 ?）
  return achievements.map(a => {
    const rawName = a.name || '';
    const safeName = rawName.trim() && !/^\?+$/.test(rawName.trim()) ? rawName : `未命名成就 ${a.code || a.id || ''}`;
    return {
      ...a,
      name: safeName
    };
  });
}

/**
 * 获取已解锁成就
 */
function getUnlockedAchievements() {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT a.*, ua.unlocked_at
    FROM mojing_achievements a
    INNER JOIN mojing_user_achievements ua ON a.id = ua.achievement_id
    ORDER BY ua.unlocked_at DESC
  `).all();
}

/**
 * 检查并解锁成就
 * @param {string} triggerType - 触发类型
 * @param {object} data - 相关数据
 * @returns {array} 新解锁的成就列表
 */
function checkAndUnlockAchievements(triggerType, data = {}) {
  const db = getDatabase();
  const profile = getOrCreateProfile();
  const newlyUnlocked = [];
  
  // 获取所有未解锁的成就
  const lockedAchievements = db.prepare(`
    SELECT a.* FROM mojing_achievements a
    LEFT JOIN mojing_user_achievements ua ON a.id = ua.achievement_id
    WHERE ua.id IS NULL
  `).all();
  
  for (const achievement of lockedAchievements) {
    let shouldUnlock = false;
    
    switch (achievement.requirement_type) {
      // 任务完成数量
      case 'task_complete':
        if (triggerType === 'task_complete') {
          const count = db.prepare(`
            SELECT COUNT(*) as count FROM mojing_task_records WHERE status = 'completed'
          `).get().count;
          shouldUnlock = count >= achievement.requirement_value;
        }
        break;
        
      // 墨线任务完成
      case 'inkline_complete':
        if (triggerType === 'inkline_complete' || triggerType === 'task_complete') {
          const count = db.prepare(`
            SELECT COUNT(*) as count FROM mojing_task_records 
            WHERE task_type = 'inkline' AND status = 'completed'
          `).get().count;
          shouldUnlock = count >= achievement.requirement_value;
        }
        break;
        
      // 墨章任务完成
      case 'inkchapter_complete':
        if (triggerType === 'inkchapter_complete') {
          const count = db.prepare(`
            SELECT COUNT(*) as count FROM mojing_weekly_submissions WHERE status = 'completed'
          `).get().count;
          shouldUnlock = count >= achievement.requirement_value;
        }
        break;
        
      // 连续打卡天数
      case 'streak_days':
        if (triggerType === 'streak_update') {
          shouldUnlock = profile.current_streak >= achievement.requirement_value;
        }
        break;
        
      // 单次分数
      case 'score_above':
        if (triggerType === 'score_received' && data.score) {
          shouldUnlock = data.score >= achievement.requirement_value;
        }
        break;
        
      // 连续高分
      case 'score_streak':
        if (triggerType === 'score_received') {
          // 检查最近N次评分是否都>=80
          const recentScores = db.prepare(`
            SELECT score FROM mojing_task_records 
            WHERE score IS NOT NULL 
            ORDER BY created_at DESC 
            LIMIT ?
          `).all(achievement.requirement_value);
          
          shouldUnlock = recentScores.length >= achievement.requirement_value &&
            recentScores.every(r => r.score >= 80);
        }
        break;
        
      // S级评价
      case 'grade_s':
        if (triggerType === 'score_received' && data.score >= 95) {
          const count = db.prepare(`
            SELECT COUNT(*) as count FROM mojing_task_records WHERE score >= 95
          `).get().count;
          shouldUnlock = count >= achievement.requirement_value;
        }
        break;
        
      // 属性达到值
      case 'attr_character':
      case 'attr_conflict':
      case 'attr_scene':
      case 'attr_dialogue':
      case 'attr_rhythm':
      case 'attr_style':
        if (triggerType === 'attr_update') {
          const attrColumn = achievement.requirement_type;
          shouldUnlock = profile[attrColumn] >= achievement.requirement_value;
        }
        break;
        
      // 所有属性达到值
      case 'all_attr':
        if (triggerType === 'attr_update') {
          shouldUnlock = 
            profile.attr_character >= achievement.requirement_value &&
            profile.attr_conflict >= achievement.requirement_value &&
            profile.attr_scene >= achievement.requirement_value &&
            profile.attr_dialogue >= achievement.requirement_value &&
            profile.attr_rhythm >= achievement.requirement_value &&
            profile.attr_style >= achievement.requirement_value;
        }
        break;
        
      // 累计字数
      case 'words_count':
        if (triggerType === 'words_update' || triggerType === 'task_complete') {
          shouldUnlock = profile.total_words >= achievement.requirement_value;
        }
        break;
        
      // 达到等级
      case 'level_reach':
        if (triggerType === 'level_up') {
          shouldUnlock = profile.current_level >= achievement.requirement_value;
        }
        break;
    }
    
    if (shouldUnlock) {
      // 解锁成就
      try {
        db.prepare(`
          INSERT INTO mojing_user_achievements (achievement_id) VALUES (?)
        `).run(achievement.id);
        
        // 发放成就奖励XP
        if (achievement.xp_reward > 0) {
          awardXP('achievement_unlock', achievement.id, {
            xpAmount: achievement.xp_reward,
            description: `解锁成就: ${achievement.name}`
          });
        }
        
        newlyUnlocked.push({
          ...achievement,
          unlocked_at: new Date().toISOString()
        });
        
        console.log(`成就解锁: ${achievement.name}`);
      } catch (e) {
        // 可能已经解锁（并发情况）
        console.log(`成就已解锁或解锁失败: ${achievement.name}`, e.message);
      }
    }
  }
  
  return newlyUnlocked;
}

/**
 * 获取成就统计
 */
function getAchievementStats() {
  const db = getDatabase();
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_achievements
  `).get().count;
  
  const unlocked = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_user_achievements
  `).get().count;
  
  const byCategory = db.prepare(`
    SELECT 
      a.category,
      COUNT(*) as total,
      SUM(CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END) as unlocked
    FROM mojing_achievements a
    LEFT JOIN mojing_user_achievements ua ON a.id = ua.achievement_id
    GROUP BY a.category
  `).all();
  
  const recentUnlocked = db.prepare(`
    SELECT a.*, ua.unlocked_at
    FROM mojing_achievements a
    INNER JOIN mojing_user_achievements ua ON a.id = ua.achievement_id
    ORDER BY ua.unlocked_at DESC
    LIMIT 5
  `).all();
  
  return {
    total,
    unlocked,
    progress: total > 0 ? Math.floor((unlocked / total) * 100) : 0,
    byCategory,
    recentUnlocked
  };
}

/**
 * 获取下一个可能解锁的成就
 */
function getNextAchievements(limit = 3) {
  const db = getDatabase();
  const profile = getOrCreateProfile();
  
  const locked = db.prepare(`
    SELECT a.* FROM mojing_achievements a
    LEFT JOIN mojing_user_achievements ua ON a.id = ua.achievement_id
    WHERE ua.id IS NULL AND a.is_hidden = 0
    ORDER BY a.sort_order ASC
  `).all();
  
  // 计算每个成就的完成进度
  const withProgress = locked.map(a => {
    let current = 0;
    let target = a.requirement_value;
    
    switch (a.requirement_type) {
      case 'task_complete':
        current = db.prepare(`
          SELECT COUNT(*) as count FROM mojing_task_records WHERE status = 'completed'
        `).get().count;
        break;
      case 'inkline_complete':
        current = db.prepare(`
          SELECT COUNT(*) as count FROM mojing_task_records 
          WHERE task_type = 'inkline' AND status = 'completed'
        `).get().count;
        break;
      case 'inkchapter_complete':
        current = db.prepare(`
          SELECT COUNT(*) as count FROM mojing_weekly_submissions WHERE status = 'completed'
        `).get().count;
        break;
      case 'streak_days':
        current = profile.current_streak;
        break;
      case 'words_count':
        current = profile.total_words;
        break;
      case 'level_reach':
        current = profile.current_level;
        break;
      case 'attr_character':
      case 'attr_conflict':
      case 'attr_scene':
      case 'attr_dialogue':
      case 'attr_rhythm':
      case 'attr_style':
        current = profile[a.requirement_type];
        break;
    }
    
    const progress = Math.min(100, Math.floor((current / target) * 100));
    
    return { ...a, current, target, progress };
  });
  
  // 按进度排序，返回最接近完成的几个
  return withProgress
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit);
}

module.exports = {
  getAllAchievements,
  getUnlockedAchievements,
  checkAndUnlockAchievements,
  getAchievementStats,
  getNextAchievements
};
