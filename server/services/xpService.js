/**
 * 墨境经验值与等级服务
 * 负责：经验值计算、发放、等级判定、属性增长
 */

const { getDatabase } = require('../database/init');

// 属性类型映射
const ATTR_TYPES = {
  character: 'attr_character',   // 人物力
  conflict: 'attr_conflict',     // 冲突力
  scene: 'attr_scene',           // 场景力
  dialogue: 'attr_dialogue',     // 对话力
  rhythm: 'attr_rhythm',         // 节奏力
  style: 'attr_style',           // 风格力
  comprehensive: null            // 综合（所有属性均涨）
};

// 属性中文名
const ATTR_NAMES = {
  character: '人物力',
  conflict: '冲突力',
  scene: '场景力',
  dialogue: '对话力',
  rhythm: '节奏力',
  style: '风格力'
};

// XP来源类型配置
const XP_SOURCE_CONFIG = {
  inkdot_complete: { base: 10, name: '墨点任务' },
  inkline_complete: { base: 30, name: '墨线任务' },
  inkchapter_complete: { base: 150, name: '墨章挑战' },
  practice_submit: { base: 15, name: '写作练习提交' },
  practice_evaluated: { base: 0, name: '练习评审', scoreMultiplier: 0.25 }, // 根据分数给XP
  skill_practice: { base: 20, name: '技巧练习' },
  freewrite: { base: 0, name: '随心写', wordMultiplier: 0.05 }, // 每字0.05XP
  typing_practice: { base: 5, name: '抄书练习', accuracyBonus: true },
  daily_challenge: { base: 50, name: '每日挑战' },
  streak_bonus: { base: 0, name: '连续打卡奖励' },
  achievement_unlock: { base: 0, name: '成就解锁' }
};

/**
 * 获取或创建用户档案
 */
function getOrCreateProfile() {
  const db = getDatabase();
  
  let profile = db.prepare('SELECT * FROM mojing_profile LIMIT 1').get();
  
  if (!profile) {
    db.prepare(`
      INSERT INTO mojing_profile (nickname, current_title)
      VALUES (?, ?)
    `).run('故事编织者', '墨境新人');
    
    profile = db.prepare('SELECT * FROM mojing_profile LIMIT 1').get();
  }
  
  return profile;
}

/**
 * 获取用户完整档案（含等级信息）
 */
function getFullProfile() {
  const db = getDatabase();
  const profile = getOrCreateProfile();
  
  // 获取当前等级配置
  const currentLevelConfig = db.prepare(`
    SELECT * FROM mojing_level_config WHERE level = ?
  `).get(profile.current_level);
  
  // 获取下一级配置
  const nextLevelConfig = db.prepare(`
    SELECT * FROM mojing_level_config WHERE level = ?
  `).get(profile.current_level + 1);
  
  // 计算当前等级进度
  const currentLevelXp = currentLevelConfig?.required_xp || 0;
  const nextLevelXp = nextLevelConfig?.required_xp || currentLevelXp;
  const xpInCurrentLevel = profile.total_xp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const levelProgress = xpNeededForNextLevel > 0 
    ? Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForNextLevel) * 100))
    : 100;
  
  // 获取六维属性
  const attributes = {
    character: { value: profile.attr_character, name: '人物力', icon: '👤' },
    conflict: { value: profile.attr_conflict, name: '冲突力', icon: '⚔️' },
    scene: { value: profile.attr_scene, name: '场景力', icon: '🏔️' },
    dialogue: { value: profile.attr_dialogue, name: '对话力', icon: '💬' },
    rhythm: { value: profile.attr_rhythm, name: '节奏力', icon: '🌊' },
    style: { value: profile.attr_style, name: '风格力', icon: '✨' }
  };
  
  // 获取已解锁成就数量
  const achievementCount = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_user_achievements
  `).get().count;
  
  const totalAchievements = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_achievements WHERE is_hidden = 0
  `).get().count;
  
  return {
    ...profile,
    levelConfig: currentLevelConfig,
    nextLevelConfig,
    xpInCurrentLevel,
    xpNeededForNextLevel,
    levelProgress,
    attributes,
    achievementCount,
    totalAchievements
  };
}

/**
 * 发放经验值
 * @param {string} sourceType - 来源类型
 * @param {number} sourceId - 来源ID（可选）
 * @param {object} options - 额外选项（分数、字数等）
 * @returns {object} 发放结果
 */
function awardXP(sourceType, sourceId = null, options = {}) {
  const db = getDatabase();
  const profile = getOrCreateProfile();
  const config = XP_SOURCE_CONFIG[sourceType];
  
  if (!config) {
    console.error(`Unknown XP source type: ${sourceType}`);
    return { success: false, error: 'Unknown source type' };
  }
  
  // 计算基础XP
  let xpAmount = config.base;
  
  // 根据分数计算额外XP
  if (config.scoreMultiplier && options.score) {
    xpAmount += Math.floor(options.score * config.scoreMultiplier);
  }
  
  // 根据字数计算XP
  if (config.wordMultiplier && options.wordCount) {
    xpAmount += Math.floor(options.wordCount * config.wordMultiplier);
  }
  
  // 准确率加成
  if (config.accuracyBonus && options.accuracy) {
    xpAmount += Math.floor(options.accuracy * 0.2);
  }
  
  // 直接指定XP量（用于成就、奖励等）
  if (options.xpAmount) {
    xpAmount = options.xpAmount;
  }
  
  // 获取连续打卡倍数
  let xpMultiplier = 1.0;
  if (profile.current_streak > 0) {
    const streakReward = db.prepare(`
      SELECT xp_multiplier FROM mojing_streak_rewards 
      WHERE streak_days <= ? ORDER BY streak_days DESC LIMIT 1
    `).get(profile.current_streak);
    
    if (streakReward) {
      xpMultiplier = streakReward.xp_multiplier;
    }
  }
  
  // 应用XP加成卡（如果有）
  if (options.useBoostCard) {
    xpMultiplier *= 2;
    // TODO: 扣除加成卡
  }
  
  const finalXP = Math.floor(xpAmount * xpMultiplier);
  
  // 计算属性增长
  let attrType = options.attrType || null;
  let attrAmount = options.attrAmount || 0;
  let attrColumn = attrType ? ATTR_TYPES[attrType] : null;
  
  // 如果是综合类型，随机选择一个属性
  if (attrType === 'comprehensive' && attrAmount > 0) {
    const attrKeys = Object.keys(ATTR_TYPES).filter(k => k !== 'comprehensive');
    attrType = attrKeys[Math.floor(Math.random() * attrKeys.length)];
    attrColumn = ATTR_TYPES[attrType];
  }
  
  // 记录XP流水
  db.prepare(`
    INSERT INTO mojing_xp_transactions 
    (source_type, source_id, xp_amount, attr_type, attr_amount, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    sourceType, sourceId, finalXP, attrType, attrAmount,
    options.description || config.name
  );
  
  // 更新用户档案
  const newTotalXp = profile.total_xp + finalXP;
  
  let updateSql = `
    UPDATE mojing_profile SET 
      total_xp = ?,
      total_practices = total_practices + ?,
      total_words = total_words + ?,
      total_time_spent = total_time_spent + ?,
      updated_at = CURRENT_TIMESTAMP
  `;
  const updateParams = [
    newTotalXp,
    options.incrementPractice ? 1 : 0,
    options.wordCount || 0,
    options.timeSpent || 0
  ];
  
  // 更新属性
  if (attrColumn && attrAmount > 0) {
    // 属性上限100
    updateSql = `
      UPDATE mojing_profile SET 
        total_xp = ?,
        total_practices = total_practices + ?,
        total_words = total_words + ?,
        total_time_spent = total_time_spent + ?,
        ${attrColumn} = MIN(100, ${attrColumn} + ?),
        updated_at = CURRENT_TIMESTAMP
    `;
    updateParams.push(attrAmount);
  }
  
  updateSql += ' WHERE id = ?';
  updateParams.push(profile.id);
  
  db.prepare(updateSql).run(...updateParams);
  
  // 检查是否升级
  const levelUpResult = checkAndProcessLevelUp(newTotalXp, profile.current_level);
  
  // 获取更新后的档案
  const updatedProfile = getFullProfile();
  
  return {
    success: true,
    xpAwarded: finalXP,
    xpMultiplier,
    attrType,
    attrAmount,
    attrName: attrType ? ATTR_NAMES[attrType] : null,
    levelUp: levelUpResult.leveledUp,
    newLevel: levelUpResult.newLevel,
    newTitle: levelUpResult.newTitle,
    profile: updatedProfile
  };
}

/**
 * 检查并处理升级
 */
function checkAndProcessLevelUp(totalXp, currentLevel) {
  const db = getDatabase();
  
  // 获取下一级所需XP
  const nextLevelConfig = db.prepare(`
    SELECT * FROM mojing_level_config WHERE level = ?
  `).get(currentLevel + 1);
  
  if (!nextLevelConfig || totalXp < nextLevelConfig.required_xp) {
    return { leveledUp: false, newLevel: currentLevel };
  }
  
  // 可能连升多级
  let newLevel = currentLevel;
  let newTitle = null;
  let newStage = null;
  
  const allLevels = db.prepare(`
    SELECT * FROM mojing_level_config WHERE level > ? ORDER BY level ASC
  `).all(currentLevel);
  
  for (const level of allLevels) {
    if (totalXp >= level.required_xp) {
      newLevel = level.level;
      newTitle = level.title;
      newStage = level.stage;
    } else {
      break;
    }
  }
  
  if (newLevel > currentLevel) {
    // 更新等级和称号
    db.prepare(`
      UPDATE mojing_profile SET 
        current_level = ?,
        current_title = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM mojing_profile LIMIT 1)
    `).run(newLevel, newTitle);
    
    return {
      leveledUp: true,
      newLevel,
      newTitle,
      newStage,
      levelsGained: newLevel - currentLevel
    };
  }
  
  return { leveledUp: false, newLevel: currentLevel };
}

/**
 * 更新连续打卡状态
 */
function updateStreakStatus() {
  const db = getDatabase();
  const profile = getOrCreateProfile();
  
  const today = new Date().toISOString().split('T')[0];
  const lastPractice = profile.last_practice_date;
  
  let newStreak = profile.current_streak;
  let streakBroken = false;
  
  if (!lastPractice) {
    // 首次练习
    newStreak = 1;
  } else if (lastPractice === today) {
    // 今天已经练习过，不更新
    return { updated: false, streak: newStreak };
  } else {
    // 检查是否是连续的
    const lastDate = new Date(lastPractice);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // 连续
      newStreak = profile.current_streak + 1;
    } else if (diffDays > 1) {
      // 断了
      streakBroken = true;
      newStreak = 1;
    }
  }
  
  // 更新档案
  const longestStreak = Math.max(profile.longest_streak, newStreak);
  
  db.prepare(`
    UPDATE mojing_profile SET 
      current_streak = ?,
      longest_streak = ?,
      last_practice_date = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(newStreak, longestStreak, today, profile.id);
  
  // 检查是否有打卡奖励
  let streakReward = null;
  if (!streakBroken) {
    streakReward = db.prepare(`
      SELECT * FROM mojing_streak_rewards WHERE streak_days = ?
    `).get(newStreak);
    
    if (streakReward && streakReward.bonus_xp > 0) {
      // 发放打卡奖励XP
      awardXP('streak_bonus', null, {
        xpAmount: streakReward.bonus_xp,
        description: `连续打卡${newStreak}天奖励`
      });
    }
  }
  
  return {
    updated: true,
    streak: newStreak,
    longestStreak,
    streakBroken,
    streakReward
  };
}

/**
 * 获取XP历史记录
 */
function getXPHistory(limit = 50, offset = 0) {
  const db = getDatabase();
  
  const records = db.prepare(`
    SELECT * FROM mojing_xp_transactions 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `).all(limit, offset);
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_xp_transactions
  `).get().count;
  
  return { records, total };
}

/**
 * 获取今日XP统计
 */
function getTodayXPStats() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  const stats = db.prepare(`
    SELECT 
      SUM(xp_amount) as total_xp,
      COUNT(*) as activity_count
    FROM mojing_xp_transactions 
    WHERE DATE(created_at) = ?
  `).get(today);
  
  const bySource = db.prepare(`
    SELECT 
      source_type,
      SUM(xp_amount) as xp,
      COUNT(*) as count
    FROM mojing_xp_transactions 
    WHERE DATE(created_at) = ?
    GROUP BY source_type
  `).all(today);
  
  return {
    totalXP: stats.total_xp || 0,
    activityCount: stats.activity_count || 0,
    bySource
  };
}

/**
 * 获取等级配置列表
 */
function getLevelConfig() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM mojing_level_config ORDER BY level ASC').all();
}

module.exports = {
  getOrCreateProfile,
  getFullProfile,
  awardXP,
  checkAndProcessLevelUp,
  updateStreakStatus,
  getXPHistory,
  getTodayXPStats,
  getLevelConfig,
  ATTR_TYPES,
  ATTR_NAMES,
  XP_SOURCE_CONFIG
};
