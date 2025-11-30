/**
 * 错题集服务模块
 * 管理用户的错题记录
 * 模块化设计，方便扩展
 */

const { getDatabase } = require('../database/init');

/**
 * 添加错题记录
 * @param {Object} options - 错题信息
 * @returns {Object} 创建的错题记录
 */
function addMistakeRecord(options) {
  const db = getDatabase();
  const {
    wordId,
    word,
    meaning,
    sessionId,
    questionType,
    correctAnswer,
    userAnswer
  } = options;
  
  // 检查是否已有该词汇的错题记录
  const existing = db.prepare(`
    SELECT * FROM word_mistakes 
    WHERE word_id = ? AND is_mastered = 0
    ORDER BY created_at DESC LIMIT 1
  `).get(wordId);
  
  if (existing) {
    // 更新错误次数
    db.prepare(`
      UPDATE word_mistakes 
      SET mistake_count = mistake_count + 1,
          last_mistake_at = CURRENT_TIMESTAMP,
          user_answer = ?,
          correct_answer = ?
      WHERE id = ?
    `).run(userAnswer, correctAnswer, existing.id);
    
    return { ...existing, mistake_count: existing.mistake_count + 1 };
  }
  
  // 创建新的错题记录
  const result = db.prepare(`
    INSERT INTO word_mistakes (
      word_id, word, meaning, session_id, question_type, 
      correct_answer, user_answer
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(wordId, word, meaning, sessionId, questionType, correctAnswer, userAnswer);
  
  return {
    id: result.lastInsertRowid,
    wordId,
    word,
    sessionId,
    questionType,
    mistakeCount: 1
  };
}

/**
 * 获取错题列表
 * @param {Object} options - 查询选项
 * @returns {Object} 错题列表和分页信息
 */
function getMistakeRecords(options = {}) {
  const db = getDatabase();
  const {
    page = 1,
    pageSize = 20,
    category,
    isMastered,
    sortBy = 'last_mistake_at',
    sortOrder = 'DESC'
  } = options;
  
  let whereClauses = ['1=1'];
  const params = [];
  
  if (category) {
    whereClauses.push('dw.category = ?');
    params.push(category);
  }
  
  if (isMastered !== undefined) {
    whereClauses.push('m.is_mastered = ?');
    params.push(isMastered ? 1 : 0);
  }
  
  const whereSQL = whereClauses.join(' AND ');
  
  // 获取总数
  const { count } = db.prepare(`
    SELECT COUNT(*) as count 
    FROM word_mistakes m
    LEFT JOIN dictionary_words dw ON m.word_id = dw.id
    WHERE ${whereSQL}
  `).get(...params);
  
  // 获取列表
  const allowedSorts = ['last_mistake_at', 'mistake_count', 'created_at'];
  const orderColumn = allowedSorts.includes(sortBy) ? sortBy : 'last_mistake_at';
  const orderDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  const records = db.prepare(`
    SELECT 
      m.*,
      dw.category,
      dw.examples
    FROM word_mistakes m
    LEFT JOIN dictionary_words dw ON m.word_id = dw.id
    WHERE ${whereSQL}
    ORDER BY m.${orderColumn} ${orderDir}
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  
  return {
    list: records,
    total: count,
    page,
    pageSize
  };
}

/**
 * 获取错题统计
 * @returns {Object} 统计数据
 */
function getMistakeStatistics() {
  const db = getDatabase();
  
  // 总体统计
  const total = db.prepare(`
    SELECT 
      COUNT(*) as total_mistakes,
      SUM(CASE WHEN is_mastered = 1 THEN 1 ELSE 0 END) as mastered_count,
      SUM(CASE WHEN is_mastered = 0 THEN 1 ELSE 0 END) as unmastered_count,
      SUM(mistake_count) as total_mistake_times
    FROM word_mistakes
  `).get();
  
  // 按分类统计
  const byCategory = db.prepare(`
    SELECT 
      dw.category,
      COUNT(*) as count,
      SUM(CASE WHEN m.is_mastered = 0 THEN 1 ELSE 0 END) as unmastered
    FROM word_mistakes m
    LEFT JOIN dictionary_words dw ON m.word_id = dw.id
    WHERE dw.category IS NOT NULL
    GROUP BY dw.category
    ORDER BY count DESC
  `).all();
  
  // 按题型统计
  const byQuestionType = db.prepare(`
    SELECT 
      question_type,
      COUNT(*) as count
    FROM word_mistakes
    WHERE question_type IS NOT NULL
    GROUP BY question_type
  `).all();
  
  // 错误次数分布
  const mistakeDistribution = db.prepare(`
    SELECT 
      CASE 
        WHEN mistake_count = 1 THEN '1次'
        WHEN mistake_count = 2 THEN '2次'
        WHEN mistake_count = 3 THEN '3次'
        ELSE '4次以上'
      END as range,
      COUNT(*) as count
    FROM word_mistakes
    WHERE is_mastered = 0
    GROUP BY range
  `).all();
  
  // 最近7天错题趋势
  const recentTrend = db.prepare(`
    SELECT 
      date(last_mistake_at) as date,
      COUNT(*) as count
    FROM word_mistakes
    WHERE last_mistake_at >= datetime('now', '-7 days')
    GROUP BY date(last_mistake_at)
    ORDER BY date
  `).all();
  
  return {
    ...total,
    byCategory,
    byQuestionType,
    mistakeDistribution,
    recentTrend
  };
}

/**
 * 标记错题为已掌握
 * @param {number} mistakeId - 错题记录ID
 */
function markAsMastered(mistakeId) {
  const db = getDatabase();
  
  // 获取错题记录
  const mistake = db.prepare('SELECT word_id FROM word_mistakes WHERE id = ?').get(mistakeId);
  
  if (mistake) {
    // 更新错题状态
    db.prepare(`
      UPDATE word_mistakes 
      SET is_mastered = 1, last_review_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(mistakeId);
    
    // 同时完成复习计划
    db.prepare(`
      UPDATE word_review_plans 
      SET is_completed = 1
      WHERE word_id = ? AND is_completed = 0
    `).run(mistake.word_id);
  }
}

/**
 * 批量标记为已掌握
 * @param {Array<number>} mistakeIds - 错题记录ID数组
 */
function batchMarkAsMastered(mistakeIds) {
  const db = getDatabase();
  
  const updateMistake = db.prepare(`
    UPDATE word_mistakes 
    SET is_mastered = 1, last_review_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const getWordId = db.prepare('SELECT word_id FROM word_mistakes WHERE id = ?');
  
  const updatePlan = db.prepare(`
    UPDATE word_review_plans 
    SET is_completed = 1
    WHERE word_id = ? AND is_completed = 0
  `);
  
  const transaction = db.transaction((ids) => {
    for (const id of ids) {
      const mistake = getWordId.get(id);
      if (mistake) {
        updateMistake.run(id);
        updatePlan.run(mistake.word_id);
      }
    }
  });
  
  transaction(mistakeIds);
}

/**
 * 删除错题记录
 * @param {number} mistakeId - 错题记录ID
 */
function deleteMistakeRecord(mistakeId) {
  const db = getDatabase();
  db.prepare('DELETE FROM word_mistakes WHERE id = ?').run(mistakeId);
}

/**
 * 获取高频错题（用于重点复习）
 * @param {number} limit - 返回数量
 * @returns {Array<Object>} 高频错题列表
 */
function getFrequentMistakes(limit = 10) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT 
      m.*,
      dw.category,
      dw.examples
    FROM word_mistakes m
    LEFT JOIN dictionary_words dw ON m.word_id = dw.id
    WHERE m.is_mastered = 0
    ORDER BY m.mistake_count DESC, m.last_mistake_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * 获取某个词汇的错误历史
 * @param {number} wordId - 词汇ID
 * @returns {Object|null} 错误记录
 */
function getWordMistakeHistory(wordId) {
  const db = getDatabase();
  
  return db.prepare(`
    SELECT m.*, wps.title as session_title
    FROM word_mistakes m
    LEFT JOIN word_practice_sessions wps ON m.session_id = wps.id
    WHERE m.word_id = ?
    ORDER BY m.created_at DESC
  `).all(wordId);
}

module.exports = {
  addMistakeRecord,
  getMistakeRecords,
  getMistakeStatistics,
  markAsMastered,
  batchMarkAsMastered,
  deleteMistakeRecord,
  getFrequentMistakes,
  getWordMistakeHistory
};
