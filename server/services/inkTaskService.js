/**
 * 墨境任务服务
 * 负责：任务池管理、每日任务生成、任务提交与评审
 */

const { getDatabase } = require('../database/init');
const { callAIForFeature } = require('./aiService');
const { awardXP, updateStreakStatus, getOrCreateProfile } = require('./xpService');
const { checkAndUnlockAchievements } = require('./achievementService');
const crypto = require('crypto');

// 墨境AI功能锚点
const MOJING_FEATURES = {
  TASK_GENERATE: 'mojing_task_generate',
  TASK_EVALUATE: 'mojing_task_evaluate',
  WEEKLY_EVALUATE: 'mojing_weekly_evaluate'
};

/**
 * 生成内容hash，用于去重
 */
function generateContentHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
}

/**
 * 获取今日任务池
 * @param {string} taskType - 任务类型 (inkdot/inkline/all)
 */
function getTodayTasks(taskType = 'all') {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  let sql = `
    SELECT dt.*, tt.code as template_code
    FROM mojing_daily_tasks dt
    LEFT JOIN mojing_task_templates tt ON dt.template_id = tt.id
    WHERE dt.task_date = ?
  `;
  
  if (taskType !== 'all') {
    sql += ` AND dt.task_type = ?`;
  }
  
  sql += ` ORDER BY dt.sort_order ASC, dt.id ASC`;
  
  const tasks = taskType === 'all' 
    ? db.prepare(sql).all(today)
    : db.prepare(sql).all(today, taskType);
  
  // 获取每个任务的完成记录
  return tasks.map(task => {
    const record = db.prepare(`
      SELECT * FROM mojing_task_records 
      WHERE task_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(task.id);
    
    return {
      ...task,
      record,
      hasStarted: !!record,
      isCompleted: record?.status === 'completed'
    };
  });
}

/**
 * 从模板生成今日任务
 */
function generateDailyTasksFromTemplates() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  // 检查今天是否已生成
  const existingCount = db.prepare(`
    SELECT COUNT(*) as count FROM mojing_daily_tasks WHERE task_date = ?
  `).get(today).count;
  
  if (existingCount > 0) {
    console.log(`今日(${today})任务已存在 ${existingCount} 条，跳过预设任务生成`);
    return { generated: 0, total: existingCount };
  }
  
  // 获取活跃的模板，随机选择
  const inkdotTemplates = db.prepare(`
    SELECT * FROM mojing_task_templates 
    WHERE task_type = 'inkdot' AND is_active = 1
    ORDER BY RANDOM() LIMIT 10
  `).all();
  
  const inklineTemplates = db.prepare(`
    SELECT * FROM mojing_task_templates 
    WHERE task_type = 'inkline' AND is_active = 1
    ORDER BY RANDOM() LIMIT 5
  `).all();
  
  const insertTask = db.prepare(`
    INSERT INTO mojing_daily_tasks 
    (task_date, template_id, task_type, title, description, requirements, 
     time_limit, word_limit_min, word_limit_max, attr_type, xp_reward, 
     attr_reward, difficulty, source, content_hash, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let sortOrder = 0;
  
  // 生成墨点任务
  for (const template of inkdotTemplates) {
    const hash = generateContentHash(template.description);
    insertTask.run(
      today, template.id, 'inkdot', template.title, template.description,
      template.requirements, template.time_limit, template.word_limit_min,
      template.word_limit_max, template.attr_type, template.xp_reward,
      template.attr_reward, template.difficulty, 'preset', hash, sortOrder++
    );
  }
  
  // 生成墨线任务
  for (const template of inklineTemplates) {
    const hash = generateContentHash(template.description);
    insertTask.run(
      today, template.id, 'inkline', template.title, template.description,
      template.requirements, template.time_limit, template.word_limit_min,
      template.word_limit_max, template.attr_type, template.xp_reward,
      template.attr_reward, template.difficulty, 'preset', hash, sortOrder++
    );
  }
  
  // 更新模板使用次数
  const updateUseCount = db.prepare(`
    UPDATE mojing_task_templates SET use_count = use_count + 1 WHERE id = ?
  `);
  
  for (const t of [...inkdotTemplates, ...inklineTemplates]) {
    updateUseCount.run(t.id);
  }
  
  console.log(`生成今日任务: ${inkdotTemplates.length} 墨点 + ${inklineTemplates.length} 墨线`);
  
  return {
    generated: inkdotTemplates.length + inklineTemplates.length,
    inkdot: inkdotTemplates.length,
    inkline: inklineTemplates.length
  };
}

/**
 * AI生成任务变体
 * @param {string} taskType - inkdot 或 inkline
 * @param {number} count - 生成数量
 */
async function generateAITaskVariants(taskType = 'inkdot', count = 3) {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  // 获取最近的任务hash用于去重
  const recentHashes = db.prepare(`
    SELECT content_hash FROM mojing_daily_tasks 
    WHERE task_date >= date('now', '-7 days')
  `).all().map(r => r.content_hash);
  
  // 获取一些模板作为参考
  const sampleTemplates = db.prepare(`
    SELECT title, description, attr_type FROM mojing_task_templates 
    WHERE task_type = ? AND is_active = 1
    ORDER BY RANDOM() LIMIT 5
  `).all(taskType);
  
  const taskTypeName = taskType === 'inkdot' ? '墨点' : '墨线';
  const wordLimit = taskType === 'inkdot' ? '50-100字' : '200-400字';
  const timeLimit = taskType === 'inkdot' ? '5分钟' : '20分钟';
  
  const prompt = `你是一位写作训练专家，请为写作学习者生成${count}个新的"${taskTypeName}任务"。

${taskTypeName}任务特点：
- 时间限制：${timeLimit}
- 字数要求：${wordLimit}
- 目标：锻炼特定写作能力

参考样例：
${sampleTemplates.map((t, i) => `${i + 1}. 【${t.title}】${t.description} (锻炼: ${t.attr_type})`).join('\n')}

六维属性说明：
- character: 人物力（角色塑造、外貌、心理、细节）
- conflict: 冲突力（矛盾设计、困境、张力）
- scene: 场景力（环境描写、氛围、感官）
- dialogue: 对话力（台词、潜台词、性格体现）
- rhythm: 节奏力（叙事节奏、快慢控制、留白）
- style: 风格力（语言风格、修辞、意象）

请生成${count}个不同的任务，要求：
1. 题目要具体、可执行
2. 与参考样例不重复
3. 覆盖不同的属性类型
4. 有创意，能激发写作兴趣

请以JSON数组格式返回，每个任务包含：title, description, attr_type, difficulty(easy/normal/hard)`;

  try {
    const response = await callAIForFeature(MOJING_FEATURES.TASK_GENERATE, [
      { role: 'user', content: prompt }
    ], { temperature: 0.8 });
    
    // 解析JSON
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('AI返回格式错误');
    }
    
    const tasks = JSON.parse(jsonMatch[0]);
    
    // 插入任务
    const insertTask = db.prepare(`
      INSERT INTO mojing_daily_tasks 
      (task_date, task_type, title, description, attr_type, xp_reward, 
       attr_reward, difficulty, source, content_hash, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const currentMaxOrder = db.prepare(`
      SELECT MAX(sort_order) as max_order FROM mojing_daily_tasks WHERE task_date = ?
    `).get(today)?.max_order || 0;
    
    let generated = 0;
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const hash = generateContentHash(task.description);
      
      // 检查去重
      if (recentHashes.includes(hash)) {
        console.log(`任务内容重复，跳过: ${task.title}`);
        continue;
      }
      
      const xpReward = taskType === 'inkdot' ? 10 : 30;
      const attrReward = taskType === 'inkdot' ? 1 : 2;
      
      insertTask.run(
        today, taskType, task.title, task.description,
        task.attr_type || 'character', xpReward, attrReward,
        task.difficulty || 'normal', 'ai_generated', hash,
        currentMaxOrder + i + 1
      );
      
      generated++;
    }
    
    console.log(`AI生成${taskTypeName}任务: ${generated}/${count}`);
    return { success: true, generated };
    
  } catch (error) {
    console.error('AI生成任务失败:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 开始任务
 */
function startTask(taskId) {
  const db = getDatabase();
  
  const task = db.prepare(`SELECT * FROM mojing_daily_tasks WHERE id = ?`).get(taskId);
  if (!task) {
    throw new Error('任务不存在');
  }
  
  // 检查是否已有记录
  const existingRecord = db.prepare(`
    SELECT * FROM mojing_task_records WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(taskId);
  
  if (existingRecord && existingRecord.status !== 'completed') {
    // 返回已有的草稿记录
    return { record: existingRecord, task, isResume: true };
  }
  
  // 创建新记录
  const result = db.prepare(`
    INSERT INTO mojing_task_records (task_id, task_type, status)
    VALUES (?, ?, 'draft')
  `).run(taskId, task.task_type);
  
  const record = db.prepare(`SELECT * FROM mojing_task_records WHERE id = ?`).get(result.lastInsertRowid);
  
  // 标记任务已领取
  db.prepare(`UPDATE mojing_daily_tasks SET is_claimed = 1 WHERE id = ?`).run(taskId);
  
  return { record, task, isResume: false };
}

/**
 * 保存任务草稿
 */
function saveTaskDraft(recordId, content, timeSpent = 0) {
  const db = getDatabase();
  
  const wordCount = content.replace(/[\s\p{P}]/gu, '').length;
  
  db.prepare(`
    UPDATE mojing_task_records SET
      content = ?,
      word_count = ?,
      time_spent = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(content, wordCount, timeSpent, recordId);
  
  return db.prepare(`SELECT * FROM mojing_task_records WHERE id = ?`).get(recordId);
}

/**
 * 提交任务并评审
 */
async function submitTask(recordId, content, timeSpent = 0) {
  const db = getDatabase();
  
  // 获取记录和任务信息
  const record = db.prepare(`SELECT * FROM mojing_task_records WHERE id = ?`).get(recordId);
  if (!record) {
    throw new Error('任务记录不存在');
  }
  
  const task = db.prepare(`SELECT * FROM mojing_daily_tasks WHERE id = ?`).get(record.task_id);
  if (!task) {
    throw new Error('任务不存在');
  }
  
  const wordCount = content.replace(/[\s\p{P}]/gu, '').length;
  
  // 更新记录为已提交
  db.prepare(`
    UPDATE mojing_task_records SET
      content = ?,
      word_count = ?,
      time_spent = ?,
      status = 'submitted',
      submitted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(content, wordCount, timeSpent, recordId);
  
  // 调用AI评审
  let score = null;
  let aiFeedback = null;
  
  try {
    const evaluationResult = await evaluateTaskSubmission(task, content);
    score = evaluationResult.score;
    aiFeedback = JSON.stringify(evaluationResult);
    
    // 更新评审结果
    db.prepare(`
      UPDATE mojing_task_records SET
        score = ?,
        ai_feedback = ?,
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(score, aiFeedback, recordId);
  } catch (e) {
    console.error('AI评审失败:', e);
    // 评审失败也标记为完成，分数为基础分
    score = 70;
    db.prepare(`
      UPDATE mojing_task_records SET
        score = ?,
        status = 'completed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(score, recordId);
  }
  
  // 标记任务完成
  db.prepare(`
    UPDATE mojing_daily_tasks SET is_completed = 1 WHERE id = ?
  `).run(task.id);
  
  // 发放XP和属性
  const xpResult = awardXP(`${task.task_type}_complete`, recordId, {
    attrType: task.attr_type,
    attrAmount: task.attr_reward,
    wordCount,
    timeSpent,
    score,
    incrementPractice: true,
    description: `完成${task.task_type === 'inkdot' ? '墨点' : '墨线'}任务: ${task.title}`
  });
  
  // 更新XP到记录
  db.prepare(`
    UPDATE mojing_task_records SET
      xp_earned = ?,
      attr_earned = ?,
      attr_type = ?
    WHERE id = ?
  `).run(xpResult.xpAwarded, task.attr_reward, task.attr_type, recordId);
  
  // 更新连续打卡
  const streakResult = updateStreakStatus();
  
  // 检查成就
  const achievements = checkAndUnlockAchievements('task_complete', { 
    score,
    taskType: task.task_type 
  });
  
  if (score >= 80) {
    achievements.push(...checkAndUnlockAchievements('score_received', { score }));
  }
  
  // 检查属性相关成就
  checkAndUnlockAchievements('attr_update', {});
  checkAndUnlockAchievements('words_update', {});
  
  // 获取更新后的记录
  const updatedRecord = db.prepare(`SELECT * FROM mojing_task_records WHERE id = ?`).get(recordId);
  
  return {
    record: updatedRecord,
    task,
    xpResult,
    streakResult,
    newAchievements: achievements,
    feedback: aiFeedback ? JSON.parse(aiFeedback) : null
  };
}

/**
 * AI评审任务提交
 */
async function evaluateTaskSubmission(task, content) {
  const taskTypeName = task.task_type === 'inkdot' ? '墨点' : '墨线';
  
  const prompt = `你是一位写作导师，请评审学生的${taskTypeName}任务作品。

任务要求：
标题：${task.title}
描述：${task.description}
${task.requirements ? `特殊要求：${task.requirements}` : ''}
锻炼属性：${task.attr_type}

学生作品：
${content}

请从以下维度评审（每项10分，共100分）：
1. 任务完成度（是否完成任务要求）
2. 技巧运用（目标属性的技巧使用）
3. 创意表现（独特性和吸引力）
4. 语言表达（文字流畅度和表现力）
5. 细节处理（细节的精准和生动）

请以JSON格式返回：
{
  "score": 总分(0-100),
  "dimensions": {
    "completion": {"score": 分数, "comment": "点评"},
    "technique": {"score": 分数, "comment": "点评"},
    "creativity": {"score": 分数, "comment": "点评"},
    "expression": {"score": 分数, "comment": "点评"},
    "detail": {"score": 分数, "comment": "点评"}
  },
  "highlights": ["亮点1", "亮点2"],
  "improvements": ["改进建议1", "改进建议2"],
  "overall": "总体评价（2-3句话）"
}`;

  const response = await callAIForFeature(MOJING_FEATURES.TASK_EVALUATE, [
    { role: 'user', content: prompt }
  ], { temperature: 0.3 });
  
  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI返回格式错误');
  }
  
  return JSON.parse(jsonMatch[0]);
}

/**
 * 获取每日挑战
 */
function getDailyChallenge() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  let challenge = db.prepare(`
    SELECT * FROM mojing_daily_challenges WHERE challenge_date = ?
  `).get(today);
  
  if (!challenge) {
    // 生成今日挑战
    challenge = generateDailyChallenge();
  }
  
  return challenge;
}

/**
 * 生成每日挑战
 */
function generateDailyChallenge() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  const profile = getOrCreateProfile();
  
  // 根据用户等级选择挑战类型
  const challengeTypes = [
    { type: 'task_count', title: '墨点达人', description: '今日完成{n}个墨点任务', target: 3, xp: 50 },
    { type: 'word_count', title: '笔耕不辍', description: '今日累计写作{n}字', target: 500, xp: 50 },
    { type: 'inkline_complete', title: '墨线挑战', description: '完成一个墨线任务', target: 1, xp: 60 },
    { type: 'score_above', title: '品质追求', description: '获得一个80分以上的评价', target: 1, xp: 70 },
  ];
  
  // 随机选择一个
  const selected = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
  
  // 根据等级调整目标值
  const levelMultiplier = 1 + (profile.current_level - 1) * 0.1;
  const adjustedTarget = Math.ceil(selected.target * levelMultiplier);
  
  const description = selected.description.replace('{n}', adjustedTarget);
  
  db.prepare(`
    INSERT INTO mojing_daily_challenges 
    (challenge_date, challenge_type, title, description, target_value, xp_reward)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(today, selected.type, selected.title, description, adjustedTarget, selected.xp);
  
  return db.prepare(`
    SELECT * FROM mojing_daily_challenges WHERE challenge_date = ?
  `).get(today);
}

/**
 * 更新每日挑战进度
 */
function updateDailyChallengeProgress(eventType, value = 1) {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  const challenge = db.prepare(`
    SELECT * FROM mojing_daily_challenges 
    WHERE challenge_date = ? AND is_completed = 0
  `).get(today);
  
  if (!challenge) return null;
  
  // 检查事件类型是否匹配
  const typeMapping = {
    'task_complete': 'task_count',
    'inkdot_complete': 'task_count',
    'inkline_complete': 'inkline_complete',
    'word_added': 'word_count',
    'score_received': 'score_above'
  };
  
  if (typeMapping[eventType] !== challenge.challenge_type) {
    return null;
  }
  
  let newValue = challenge.current_value;
  
  if (challenge.challenge_type === 'word_count') {
    newValue += value;
  } else if (challenge.challenge_type === 'score_above') {
    if (value >= 80) newValue = 1;
  } else {
    newValue += 1;
  }
  
  const isCompleted = newValue >= challenge.target_value;
  
  db.prepare(`
    UPDATE mojing_daily_challenges SET
      current_value = ?,
      is_completed = ?,
      completed_at = ?
    WHERE id = ?
  `).run(
    newValue, 
    isCompleted ? 1 : 0, 
    isCompleted ? new Date().toISOString() : null,
    challenge.id
  );
  
  // 如果完成了，发放奖励
  if (isCompleted) {
    awardXP('daily_challenge', challenge.id, {
      xpAmount: challenge.xp_reward,
      description: `完成每日挑战: ${challenge.title}`
    });
    
    // 检查成就
    checkAndUnlockAchievements('daily_challenge_complete', {});
  }
  
  return db.prepare(`SELECT * FROM mojing_daily_challenges WHERE id = ?`).get(challenge.id);
}

/**
 * 获取本周墨章挑战
 */
function getWeeklyChallenge() {
  const db = getDatabase();
  
  // 计算本周的开始和结束日期（周一到周日）
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; // 将周日的0转为7
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek + 1);
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  
  let challenge = db.prepare(`
    SELECT * FROM mojing_weekly_challenges 
    WHERE week_start = ? AND is_active = 1
  `).get(weekStartStr);
  
  if (!challenge) {
    // 从模板生成本周挑战
    const template = db.prepare(`
      SELECT * FROM mojing_task_templates 
      WHERE task_type = 'inkchapter' AND is_active = 1
      ORDER BY RANDOM() LIMIT 1
    `).get();
    
    if (template) {
      db.prepare(`
        INSERT INTO mojing_weekly_challenges 
        (week_start, week_end, title, theme, description, requirements, 
         word_limit_min, word_limit_max, xp_reward)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        weekStartStr, weekEndStr, template.title, template.tags || '综合',
        template.description, template.requirements,
        template.word_limit_min, template.word_limit_max, template.xp_reward
      );
      
      challenge = db.prepare(`
        SELECT * FROM mojing_weekly_challenges WHERE week_start = ?
      `).get(weekStartStr);
    }
  }
  
  // 获取用户的提交记录
  if (challenge) {
    const submission = db.prepare(`
      SELECT * FROM mojing_weekly_submissions 
      WHERE challenge_id = ? 
      ORDER BY created_at DESC LIMIT 1
    `).get(challenge.id);
    
    challenge.submission = submission;
    challenge.hasSubmission = !!submission;
    challenge.isCompleted = submission?.status === 'completed';
  }
  
  return challenge;
}

/**
 * 获取任务完成统计
 */
function getTaskStats() {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];
  
  // 今日统计
  const todayStats = db.prepare(`
    SELECT 
      task_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(word_count) as total_words,
      AVG(score) as avg_score
    FROM mojing_task_records
    WHERE DATE(created_at) = ?
    GROUP BY task_type
  `).all(today);
  
  // 总体统计
  const totalStats = db.prepare(`
    SELECT 
      task_type,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(word_count) as total_words,
      AVG(score) as avg_score,
      SUM(xp_earned) as total_xp
    FROM mojing_task_records
    GROUP BY task_type
  `).all();
  
  // 按属性统计
  const attrStats = db.prepare(`
    SELECT 
      attr_type,
      COUNT(*) as count,
      AVG(score) as avg_score
    FROM mojing_task_records
    WHERE status = 'completed' AND attr_type IS NOT NULL
    GROUP BY attr_type
  `).all();
  
  return { todayStats, totalStats, attrStats };
}

module.exports = {
  getTodayTasks,
  generateDailyTasksFromTemplates,
  generateAITaskVariants,
  startTask,
  saveTaskDraft,
  submitTask,
  getDailyChallenge,
  updateDailyChallengeProgress,
  getWeeklyChallenge,
  getTaskStats,
  MOJING_FEATURES
};
