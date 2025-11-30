/**
 * 词汇趣味练习路由
 * 包含练习配置、练习过程、题目生成、AI批改等功能
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAIForFeature, AI_FEATURES } = require('../services/aiService');
const mistakeService = require('../services/mistakeService');
const reviewPlanService = require('../services/reviewPlanService');
const notificationService = require('../services/notificationService');

// ==================== 练习会话管理 ====================

/**
 * 创建新的练习会话
 * POST /api/word-practice/sessions
 */
router.post('/sessions', (req, res) => {
  try {
    const db = getDatabase();
    const { categories, wordCount, displayTime, title } = req.body;
    
    if (!wordCount || wordCount < 1) {
      return res.status(400).json({ success: false, message: '请设置练习词汇数量' });
    }
    
    // 从词库中随机选取词汇
    let sql = 'SELECT id FROM dictionary_words WHERE 1=1';
    const params = [];
    
    if (categories && categories.length > 0) {
      sql += ` AND category IN (${categories.map(() => '?').join(',')})`;
      params.push(...categories);
    }
    
    sql += ' ORDER BY RANDOM() LIMIT ?';
    params.push(parseInt(wordCount));
    
    const words = db.prepare(sql).all(...params);
    
    if (words.length === 0) {
      return res.status(400).json({ success: false, message: '没有符合条件的词汇' });
    }
    
    // 创建练习会话
    const result = db.prepare(`
      INSERT INTO word_practice_sessions (
        title, categories, word_count, display_time, total_words, 
        current_phase, current_word_index, status, start_time
      ) VALUES (?, ?, ?, ?, ?, 'memorize', 0, 'in_progress', CURRENT_TIMESTAMP)
    `).run(
      title || '词汇练习',
      JSON.stringify(categories || []),
      words.length,
      displayTime || 5,
      JSON.stringify(words.map(w => w.id))
    );
    
    res.json({
      success: true,
      data: {
        sessionId: result.lastInsertRowid,
        wordCount: words.length,
        displayTime: displayTime || 5,
        wordIds: words.map(w => w.id)
      }
    });
  } catch (error) {
    console.error('创建练习会话失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取练习会话详情
 * GET /api/word-practice/sessions/:id
 */
router.get('/sessions/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const session = db.prepare(`
      SELECT * FROM word_practice_sessions WHERE id = ?
    `).get(id);
    
    if (!session) {
      return res.status(404).json({ success: false, message: '练习会话不存在' });
    }
    
    // 解析JSON字段
    session.categories = JSON.parse(session.categories || '[]');
    session.total_words = JSON.parse(session.total_words || '[]');
    
    // 获取词汇详情
    if (session.total_words.length > 0) {
      const words = db.prepare(`
        SELECT * FROM dictionary_words 
        WHERE id IN (${session.total_words.join(',')})
      `).all();
      
      // 按原始顺序排序
      session.words = session.total_words.map(id => 
        words.find(w => w.id === id)
      ).filter(Boolean);
    } else {
      session.words = [];
    }
    
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 更新练习会话状态
 * PUT /api/word-practice/sessions/:id
 */
router.put('/sessions/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { currentPhase, currentWordIndex, status } = req.body;
    
    const updates = [];
    const params = [];
    
    if (currentPhase) {
      updates.push('current_phase = ?');
      params.push(currentPhase);
    }
    
    if (currentWordIndex !== undefined) {
      updates.push('current_word_index = ?');
      params.push(currentWordIndex);
    }
    
    if (status) {
      updates.push('status = ?');
      params.push(status);
      
      if (status === 'completed') {
        updates.push('end_time = CURRENT_TIMESTAMP');
      }
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    db.prepare(`
      UPDATE word_practice_sessions 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `).run(...params);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取练习历史列表
 * GET /api/word-practice/sessions
 */
router.get('/sessions', (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, pageSize = 20, status } = req.query;
    
    let whereClauses = ['1=1'];
    const params = [];
    
    if (status) {
      whereClauses.push('status = ?');
      params.push(status);
    }
    
    const whereSQL = whereClauses.join(' AND ');
    
    // 获取总数
    const { count } = db.prepare(`
      SELECT COUNT(*) as count FROM word_practice_sessions WHERE ${whereSQL}
    `).get(...params);
    
    // 获取列表，包含从 word_practice_results 获取的平均分，时间转换为东八区
    const sessions = db.prepare(`
      SELECT 
        wps.id,
        wps.title,
        wps.categories,
        wps.word_count,
        wps.display_time,
        wps.total_words,
        wps.current_phase,
        wps.current_word_index,
        wps.total_questions,
        wps.correct_count,
        wps.wrong_count,
        wps.total_score,
        wps.status,
        datetime(wps.start_time, '+8 hours') as start_time,
        datetime(wps.end_time, '+8 hours') as end_time,
        datetime(wps.created_at, '+8 hours') as created_at,
        datetime(wps.updated_at, '+8 hours') as updated_at,
        CAST((julianday(wps.end_time) - julianday(wps.start_time)) * 86400 AS INTEGER) as time_spent,
        (SELECT COUNT(*) FROM word_practice_questions WHERE session_id = wps.id) as question_count,
        wpr.avg_score as result_avg_score
      FROM word_practice_sessions wps
      LEFT JOIN word_practice_results wpr ON wps.id = wpr.session_id
      WHERE ${whereSQL}
      ORDER BY wps.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    // 解析JSON字段并计算显示分数
    sessions.forEach(s => {
      s.categories = JSON.parse(s.categories || '[]');
      // 使用结果表中的平均分（百分制）
      s.total_score = s.result_avg_score || 0;
      // 防止异常的时间值
      if (s.time_spent < 0 || s.time_spent > 86400) {
        s.time_spent = 0;
      }
    });
    
    res.json({
      success: true,
      data: {
        list: sessions,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 删除练习会话
 * DELETE /api/word-practice/sessions/:id
 */
router.delete('/sessions/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 删除会话（关联的题目和答案会通过 ON DELETE CASCADE 自动删除）
    db.prepare('DELETE FROM word_practice_sessions WHERE id = ?').run(id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取练习统计
 * GET /api/word-practice/stats
 */
router.get('/stats', (req, res) => {
  try {
    const db = getDatabase();
    
    // 获取统计数据
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as totalSessions,
        SUM(word_count) as totalWords,
        ROUND(AVG(CASE WHEN total_questions > 0 THEN correct_count * 100.0 / total_questions ELSE 0 END), 1) as avgAccuracy,
        SUM(
          CASE 
            WHEN start_time IS NOT NULL AND end_time IS NOT NULL 
            THEN CAST((julianday(end_time) - julianday(start_time)) * 86400 AS INTEGER)
            ELSE 0 
          END
        ) as totalTime
      FROM word_practice_sessions 
      WHERE status = 'completed'
    `).get();
    
    res.json({
      success: true,
      data: {
        totalSessions: stats.totalSessions || 0,
        totalWords: stats.totalWords || 0,
        avgAccuracy: stats.avgAccuracy || 0,
        totalTime: stats.totalTime || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 题目生成 ====================

/**
 * 本地生成练习题目（不需要AI）
 * POST /api/word-practice/sessions/:id/generate-questions
 */
router.post('/sessions/:id/generate-questions', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 检查是否已经生成过题目
    const existingQuestions = db.prepare(
      'SELECT COUNT(*) as count FROM word_practice_questions WHERE session_id = ?'
    ).get(id);
    
    if (existingQuestions.count > 0) {
      return res.json({
        success: true,
        data: {
          questionCount: existingQuestions.count,
          message: '题目已存在'
        }
      });
    }
    
    // 获取会话信息
    const session = db.prepare('SELECT * FROM word_practice_sessions WHERE id = ?').get(id);
    if (!session) {
      return res.status(404).json({ success: false, message: '练习会话不存在' });
    }
    
    const wordIds = JSON.parse(session.total_words || '[]');
    if (wordIds.length === 0) {
      return res.status(400).json({ success: false, message: '没有练习词汇' });
    }
    
    // 获取练习词汇详情
    const words = db.prepare(`
      SELECT * FROM dictionary_words WHERE id IN (${wordIds.join(',')})
    `).all();
    
    // 获取同类别的其他词汇作为干扰项
    const categories = [...new Set(words.map(w => w.category))];
    const otherWords = db.prepare(`
      SELECT word, meaning, category FROM dictionary_words 
      WHERE category IN (${categories.map(() => '?').join(',')})
      AND id NOT IN (${wordIds.join(',')})
    `).all(...categories);
    
    // 本地生成题目
    const questions = [];
    
    for (const word of words) {
      // 1. 生成选择题：根据释义选词
      const choiceQuestion = generateChoiceQuestion(word, words, otherWords);
      questions.push(choiceQuestion);
      
      // 2. 生成填空题：根据例句填空
      const fillQuestion = generateFillQuestion(word);
      questions.push(fillQuestion);
      
      // 3. 生成造句题
      const sentenceQuestion = generateSentenceQuestion(word);
      questions.push(sentenceQuestion);
    }
    
    // 保存题目到数据库
    const insertQuestion = db.prepare(`
      INSERT INTO word_practice_questions (
        session_id, word_id, question_type, difficulty, 
        question_content, options, correct_answer
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((questions) => {
      const insertedIds = [];
      for (const q of questions) {
        const result = insertQuestion.run(
          id,
          q.wordId,
          q.type,
          q.difficulty,
          q.content,
          q.options ? JSON.stringify(q.options) : null,
          q.answer
        );
        insertedIds.push(result.lastInsertRowid);
      }
      return insertedIds;
    });
    
    const questionIds = insertMany(questions);
    
    // 更新会话状态
    db.prepare(`
      UPDATE word_practice_sessions 
      SET current_phase = 'quiz', total_questions = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(questions.length, id);
    
    res.json({
      success: true,
      data: {
        questionCount: questions.length,
        questionIds
      }
    });
  } catch (error) {
    console.error('生成题目失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 生成选择题：根据释义选择正确的词语
 */
function generateChoiceQuestion(targetWord, practiceWords, otherWords) {
  // 准备干扰项：优先从同类别词汇中选择
  const distractors = [];
  
  // 从其他练习词汇中选择干扰项
  const otherPracticeWords = practiceWords.filter(w => w.id !== targetWord.id);
  for (const w of shuffleArray(otherPracticeWords).slice(0, 2)) {
    distractors.push(w.word);
  }
  
  // 从词库其他词汇中补充干扰项
  const sameCategoryWords = otherWords.filter(w => w.category === targetWord.category);
  const otherCategoryWords = otherWords.filter(w => w.category !== targetWord.category);
  
  for (const w of shuffleArray(sameCategoryWords)) {
    if (distractors.length >= 3) break;
    if (!distractors.includes(w.word) && w.word !== targetWord.word) {
      distractors.push(w.word);
    }
  }
  
  for (const w of shuffleArray(otherCategoryWords)) {
    if (distractors.length >= 3) break;
    if (!distractors.includes(w.word) && w.word !== targetWord.word) {
      distractors.push(w.word);
    }
  }
  
  // 如果干扰项不够，用默认词汇填充
  const defaultDistractors = ['徘徊', '踌躇', '彷徨', '沉吟', '斟酌'];
  for (const d of defaultDistractors) {
    if (distractors.length >= 3) break;
    if (!distractors.includes(d) && d !== targetWord.word) {
      distractors.push(d);
    }
  }
  
  // 组合选项并打乱顺序
  const options = shuffleArray([targetWord.word, ...distractors.slice(0, 3)]);
  
  return {
    wordId: targetWord.id,
    type: 'choice',
    difficulty: 1,
    content: `下列哪个词语的意思是"${targetWord.meaning}"？`,
    options: options,
    answer: targetWord.word
  };
}

/**
 * 生成填空题：根据例句填空
 */
function generateFillQuestion(word) {
  let content;
  
  if (word.examples && word.examples.trim()) {
    // 从例句中挖空词语
    const example = word.examples.split(/[。；;]/)[0].trim(); // 取第一个例句
    if (example.includes(word.word)) {
      content = example.replace(word.word, '______');
    } else {
      // 例句中没有该词，构造一个通用填空题
      content = `请在下列句子中填入合适的词语：______的意思是"${word.meaning}"。`;
    }
  } else {
    // 没有例句，构造一个通用填空题
    content = `请填写一个表示"${word.meaning}"意思的词语：______`;
  }
  
  return {
    wordId: word.id,
    type: 'fill',
    difficulty: 2,
    content: content,
    options: null,
    answer: word.word
  };
}

/**
 * 生成造句题
 */
function generateSentenceQuestion(word) {
  const templates = [
    `请用"${word.word}"造一个完整的句子。`,
    `请用"${word.word}"写一个句子，体现该词的含义。`,
    `请运用"${word.word}"这个词语，写一个通顺的句子。`
  ];
  
  const content = templates[Math.floor(Math.random() * templates.length)];
  
  return {
    wordId: word.id,
    type: 'sentence',
    difficulty: 3,
    content: content,
    options: null,
    answer: null // 造句题需要AI批改
  };
}

/**
 * 数组随机打乱（Fisher-Yates 洗牌算法）
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 获取练习题目列表
 * GET /api/word-practice/sessions/:id/questions
 */
router.get('/sessions/:id/questions', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { type } = req.query;
    
    let sql = `
      SELECT wpq.*, dw.word, dw.meaning, dw.examples
      FROM word_practice_questions wpq
      JOIN dictionary_words dw ON wpq.word_id = dw.id
      WHERE wpq.session_id = ?
    `;
    const params = [id];
    
    if (type) {
      sql += ' AND wpq.question_type = ?';
      params.push(type);
    }
    
    sql += ' ORDER BY wpq.difficulty ASC, wpq.id ASC';
    
    const questions = db.prepare(sql).all(...params);
    
    // 解析options字段
    questions.forEach(q => {
      q.options = q.options ? JSON.parse(q.options) : null;
    });
    
    res.json({ success: true, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 答题和批改 ====================

/**
 * 提交答案
 * POST /api/word-practice/questions/:id/answer
 */
router.post('/questions/:id/answer', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const { answer, timeSpent } = req.body;
    
    // 获取题目信息
    const question = db.prepare(`
      SELECT wpq.*, dw.word, dw.meaning
      FROM word_practice_questions wpq
      JOIN dictionary_words dw ON wpq.word_id = dw.id
      WHERE wpq.id = ?
    `).get(id);
    
    if (!question) {
      return res.status(404).json({ success: false, message: '题目不存在' });
    }
    
    // 检查是否已经回答过
    const existingAnswer = db.prepare(`
      SELECT * FROM word_practice_answers WHERE question_id = ?
    `).get(id);
    
    if (existingAnswer) {
      return res.json({
        success: true,
        data: {
          isCorrect: existingAnswer.is_correct,
          score: existingAnswer.score,
          correctAnswer: question.correct_answer,
          needsAIReview: question.question_type === 'sentence' && existingAnswer.is_correct === null
        }
      });
    }
    
    // 判断是否正确（选择题和填空题可以自动判断）
    let isCorrect = null;
    let score = 0;
    
    if (question.question_type === 'choice') {
      isCorrect = answer === question.correct_answer ? 1 : 0;
      score = isCorrect ? 100 : 0;
    } else if (question.question_type === 'fill') {
      // 填空题：检查答案是否包含关键词
      const normalizedAnswer = answer.trim().toLowerCase();
      const normalizedCorrect = question.correct_answer.trim().toLowerCase();
      isCorrect = normalizedAnswer === normalizedCorrect ? 1 : 0;
      score = isCorrect ? 100 : 0;
    }
    // 造句题需要AI批改，isCorrect暂时为null
    
    // 插入答案到 word_practice_answers 表
    const result = db.prepare(`
      INSERT INTO word_practice_answers (session_id, question_id, user_answer, is_correct, score, time_spent)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(question.session_id, id, answer, isCorrect, score, timeSpent || 0);
    
    // 更新会话统计（不更新 total_questions，因为已在生成题目时设置）
    if (isCorrect !== null) {
      db.prepare(`
        UPDATE word_practice_sessions 
        SET correct_count = correct_count + ?,
            wrong_count = wrong_count + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(isCorrect ? 1 : 0, isCorrect ? 0 : 1, question.session_id);
    }
    
    // 如果答错，记录到错题集
    if (isCorrect === 0) {
      mistakeService.addMistakeRecord({
        wordId: question.word_id,
        word: question.word,
        meaning: question.meaning,
        sessionId: question.session_id,
        questionType: question.question_type,
        correctAnswer: question.correct_answer,
        userAnswer: answer
      });
    }
    
    res.json({
      success: true,
      data: {
        answerId: result.lastInsertRowid,
        isCorrect,
        score,
        correctAnswer: question.correct_answer,
        needsAIReview: question.question_type === 'sentence'
      }
    });
  } catch (error) {
    console.error('提交答案失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * AI批改造句题
 * POST /api/word-practice/sessions/:id/ai-review
 */
router.post('/sessions/:id/ai-review', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 获取所有已作答的造句题（联合查询 answers 表获取用户答案）
    const sentenceQuestions = db.prepare(`
      SELECT 
        wpq.id,
        wpq.session_id,
        wpq.word_id,
        wpq.question_type,
        wpq.question_content,
        wpq.correct_answer,
        wpa.user_answer,
        wpa.id as answer_id,
        dw.word, 
        dw.meaning, 
        dw.examples
      FROM word_practice_questions wpq
      JOIN word_practice_answers wpa ON wpq.id = wpa.question_id
      JOIN dictionary_words dw ON wpq.word_id = dw.id
      WHERE wpq.session_id = ? 
        AND wpq.question_type = 'sentence' 
        AND wpa.user_answer IS NOT NULL 
        AND wpa.user_answer != ''
    `).all(id);
    
    if (sentenceQuestions.length === 0) {
      return res.json({ success: true, data: { reviewedCount: 0 } });
    }
    
    // 构建批改prompt
    const reviewList = sentenceQuestions.map(q => ({
      questionId: q.id,
      word: q.word,
      meaning: q.meaning,
      requirement: q.question_content,
      userSentence: q.user_answer
    }));
    
    const prompt = `你是一位专业的中文写作老师。请批改以下造句练习，检查学生的用词是否准确、句子是否通顺、是否正确使用了指定词汇。

待批改内容：
${JSON.stringify(reviewList, null, 2)}

请按以下JSON格式返回批改结果：
{
  "reviews": [
    {
      "questionId": 题目ID,
      "score": 0-100的分数,
      "isCorrect": true或false,
      "feedback": "详细点评，包括优点和需要改进的地方",
      "correction": "如果有错误，给出修改建议；如果正确则为null",
      "highlights": ["亮点1", "亮点2"],
      "issues": ["问题1", "问题2"]
    }
  ],
  "overallComment": "整体评价"
}

评分标准：
- 90-100分：用词准确，句子流畅自然，有一定文采
- 70-89分：用词基本准确，句子通顺
- 50-69分：有小错误，但能理解意思
- 0-49分：用词错误或句子不通顺

只返回JSON，不要其他说明。`;

    const result = await callAIForFeature(AI_FEATURES.EVALUATION, [
      { role: 'user', content: prompt }
    ]);
    
    // 解析AI响应
    let reviews;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reviews = parsed.reviews;
        
        // 验证 reviews 是有效数组
        if (!reviews || !Array.isArray(reviews)) {
          throw new Error('reviews 不是有效数组');
        }
      } else {
        throw new Error('无法解析AI响应');
      }
    } catch (parseError) {
      console.error('解析批改结果失败:', parseError);
      return res.status(500).json({ 
        success: false, 
        message: '批改失败，请重试',
        rawResponse: result.content 
      });
    }
    
    // 更新答案表中的批改结果
    const updateAnswer = db.prepare(`
      UPDATE word_practice_answers 
      SET is_correct = ?, score = ?, ai_feedback = ?
      WHERE question_id = ? AND session_id = ?
    `);
    
    const updateMany = db.transaction((reviews) => {
      for (const r of reviews) {
        const question = sentenceQuestions.find(q => q.id === r.questionId);
        if (question) {
          updateAnswer.run(
            r.isCorrect ? 1 : 0,
            r.score,
            JSON.stringify({
              feedback: r.feedback,
              correction: r.correction,
              highlights: r.highlights,
              issues: r.issues
            }),
            r.questionId,
            id
          );
          
          // 更新会话统计（只更新正确/错误数，不累加分数）
          db.prepare(`
            UPDATE word_practice_sessions 
            SET correct_count = correct_count + ?,
                wrong_count = wrong_count + ?
            WHERE id = ?
          `).run(r.isCorrect ? 1 : 0, r.isCorrect ? 0 : 1, id);
          
          // 如果答错，记录到错题集
          if (!r.isCorrect) {
            mistakeService.addMistakeRecord({
              wordId: question.word_id,
              word: question.word,
              meaning: question.meaning,
              sessionId: id,
              questionType: 'sentence',
              correctAnswer: r.correction || '造句需符合词义',
              userAnswer: question.user_answer
            });
          }
        }
      }
    });
    
    updateMany(reviews);
    
    res.json({
      success: true,
      data: {
        reviewedCount: reviews.length,
        reviews
      }
    });
  } catch (error) {
    console.error('AI批改失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 完成练习，生成结果
 * POST /api/word-practice/sessions/:id/complete
 */
router.post('/sessions/:id/complete', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 获取所有题目和对应的答案
    const questionsWithAnswers = db.prepare(`
      SELECT 
        wpq.id,
        wpq.question_type,
        wpq.word_id,
        wpa.is_correct,
        wpa.score
      FROM word_practice_questions wpq
      LEFT JOIN word_practice_answers wpa ON wpq.id = wpa.question_id
      WHERE wpq.session_id = ?
    `).all(id);
    
    // 统计结果
    const stats = {
      total: questionsWithAnswers.length,
      correct: 0,
      wrong: 0,
      choice: { correct: 0, total: 0 },
      fill: { correct: 0, total: 0 },
      sentence: { correct: 0, total: 0 },
      totalScore: 0
    };
    
    for (const q of questionsWithAnswers) {
      const type = q.question_type;
      stats[type].total++;
      
      // 已作答且正确
      if (q.is_correct === 1) {
        stats.correct++;
        stats[type].correct++;
        stats.totalScore += q.score || 0;
      } else {
        // 未作答或回答错误都算作错误
        stats.wrong++;
      }
    }
    
    // 计算得分百分比（得分/总题数*100，每题满分100分）
    // 总分 = 题目数 * 100，实际得分 = totalScore
    const avgScore = stats.total > 0 ? (stats.totalScore / stats.total) : 0;
    
    // 使用SQL计算耗时（结束时间 - 开始时间，单位秒）
    const timeResult = db.prepare(`
      SELECT 
        CAST((julianday('now') - julianday(start_time)) * 86400 AS INTEGER) as time_spent
      FROM word_practice_sessions 
      WHERE id = ? AND start_time IS NOT NULL
    `).get(id);
    let timeSpent = timeResult?.time_spent || 0;
    // 防止异常值
    if (timeSpent < 0 || timeSpent > 86400) {
      timeSpent = 0;
    }
    
    // 生成AI总结
    let aiSummary = null;
    try {
      const wrongQuestions = questionsWithAnswers.filter(q => q.is_correct === 0);
      if (wrongQuestions.length > 0) {
        const words = db.prepare(`
          SELECT DISTINCT dw.word, dw.meaning 
          FROM dictionary_words dw
          JOIN word_practice_questions wpq ON dw.id = wpq.word_id
          WHERE wpq.id IN (${wrongQuestions.map(q => q.id).join(',')})
        `).all();
        
        const summaryPrompt = `学生完成了一次词汇练习，共${stats.total}题，正确${stats.correct}题，错误${stats.wrong}题，平均分${Math.round(avgScore)}分。
错误的词汇有：${words.map(w => w.word).join('、')}

请给出简短的学习建议（100字以内）：`;

        const result = await callAIForFeature(AI_FEATURES.EVALUATION, [
          { role: 'user', content: summaryPrompt }
        ]);
        aiSummary = result.content;
      }
    } catch (e) {
      console.error('生成AI总结失败:', e);
    }
    
    // 保存练习结果
    db.prepare(`
      INSERT OR REPLACE INTO word_practice_results (
        session_id, total_questions, correct_count, wrong_count,
        choice_correct, choice_total, fill_correct, fill_total,
        sentence_correct, sentence_total, avg_score, time_spent, ai_summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, stats.total, stats.correct, stats.wrong,
      stats.choice.correct, stats.choice.total,
      stats.fill.correct, stats.fill.total,
      stats.sentence.correct, stats.sentence.total,
      avgScore, timeSpent, aiSummary
    );
    
    // 更新会话状态
    db.prepare(`
      UPDATE word_practice_sessions 
      SET status = 'completed', current_phase = 'review', 
          end_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    // 为错题创建复习计划
    try {
      const wrongQuestionIds = questionsWithAnswers
        .filter(q => q.is_correct !== 1)
        .map(q => q.id);
      
      if (wrongQuestionIds.length > 0) {
        // 获取错题对应的词汇信息
        const wrongWords = db.prepare(`
          SELECT 
            wpq.word_id as wordId,
            dw.word,
            dw.meaning,
            dw.category,
            dw.examples
          FROM word_practice_questions wpq
          JOIN dictionary_words dw ON wpq.word_id = dw.id
          WHERE wpq.id IN (${wrongQuestionIds.join(',')})
        `).all();
        
        // 批量创建复习计划
        reviewPlanService.createReviewPlansForMistakes(wrongWords, id);
      }
    } catch (e) {
      console.error('创建复习计划失败:', e);
      // 不影响主流程
    }
    
    // 创建完成通知
    notificationService.createPracticeCompleteNotification({
      sessionId: id,
      totalQuestions: stats.total,
      correctCount: stats.correct,
      avgScore
    });
    
    res.json({
      success: true,
      data: {
        totalQuestions: stats.total,
        correctCount: stats.correct,
        wrongCount: stats.wrong,
        avgScore: Math.round(avgScore),
        timeSpent,
        choiceStats: stats.choice,
        fillStats: stats.fill,
        sentenceStats: stats.sentence,
        aiSummary
      }
    });
  } catch (error) {
    console.error('完成练习失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取练习结果
 * GET /api/word-practice/sessions/:id/result
 */
router.get('/sessions/:id/result', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    const result = db.prepare(`
      SELECT 
        wpr.*, 
        wps.title, 
        wps.word_count, 
        wps.display_time, 
        wps.categories,
        datetime(wps.start_time, '+8 hours') as start_time_cst,
        datetime(wps.end_time, '+8 hours') as end_time_cst,
        CAST((julianday(wps.end_time) - julianday(wps.start_time)) * 86400 AS INTEGER) as calculated_time_spent
      FROM word_practice_results wpr
      JOIN word_practice_sessions wps ON wpr.session_id = wps.id
      WHERE wpr.session_id = ?
    `).get(id);
    
    if (!result) {
      return res.status(404).json({ success: false, message: '练习结果不存在' });
    }
    
    result.categories = JSON.parse(result.categories || '[]');
    // 使用SQL计算的时间
    if (result.calculated_time_spent > 0 && result.calculated_time_spent < 86400) {
      result.time_spent = result.calculated_time_spent;
    }
    
    // 获取所有题目，并JOIN答案表获取用户作答记录（取最新一条）
    const questions = db.prepare(`
      SELECT 
        wpq.id,
        wpq.session_id,
        wpq.word_id,
        wpq.question_type,
        wpq.difficulty,
        wpq.question_content,
        wpq.options,
        wpq.correct_answer,
        dw.word,
        dw.meaning,
        dw.examples,
        wpa.user_answer,
        wpa.is_correct,
        wpa.score,
        wpa.time_spent AS answer_time_spent,
        wpa.ai_feedback,
        wpa.submitted_at
      FROM word_practice_questions wpq
      JOIN dictionary_words dw ON wpq.word_id = dw.id
      LEFT JOIN (
        SELECT a1.*
        FROM word_practice_answers a1
        INNER JOIN (
          SELECT question_id, MAX(id) as max_id
          FROM word_practice_answers
          WHERE session_id = ?
          GROUP BY question_id
        ) a2 ON a1.question_id = a2.question_id AND a1.id = a2.max_id
      ) wpa ON wpq.id = wpa.question_id
      WHERE wpq.session_id = ?
      ORDER BY wpq.difficulty ASC, wpq.id ASC
    `).all(id, id);
    
    questions.forEach(q => {
      q.options = q.options ? JSON.parse(q.options) : null;
      q.ai_feedback = q.ai_feedback ? JSON.parse(q.ai_feedback) : null;
      // 确保未作答时有默认值
      q.is_correct = q.is_correct ?? 0;
      q.score = q.score ?? 0;
    });
    
    result.questions = questions;
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 错题集 ====================

/**
 * 获取错题列表
 * GET /api/word-practice/mistakes
 */
router.get('/mistakes', (req, res) => {
  try {
    const { page = 1, pageSize = 20, category, isMastered } = req.query;
    
    const result = mistakeService.getMistakeRecords({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      category,
      isMastered: isMastered !== undefined ? isMastered === 'true' : undefined
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取错题统计
 * GET /api/word-practice/mistakes/stats
 */
router.get('/mistakes/stats', (req, res) => {
  try {
    const stats = mistakeService.getMistakeStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 标记错题为已掌握
 * POST /api/word-practice/mistakes/:id/master
 */
router.post('/mistakes/:id/master', (req, res) => {
  try {
    const { id } = req.params;
    mistakeService.markAsMastered(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 批量标记为已掌握
 * POST /api/word-practice/mistakes/batch-master
 */
router.post('/mistakes/batch-master', (req, res) => {
  try {
    const { ids } = req.body;
    mistakeService.batchMarkAsMastered(ids);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取高频错题
 * GET /api/word-practice/mistakes/frequent
 */
router.get('/mistakes/frequent', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const mistakes = mistakeService.getFrequentMistakes(parseInt(limit));
    res.json({ success: true, data: mistakes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 复习计划 ====================

/**
 * 为指定练习会话的错题创建复习计划
 * POST /api/word-practice/sessions/:id/create-review-plans
 */
router.post('/sessions/:id/create-review-plans', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 获取该会话的错题词汇
    const wrongWords = db.prepare(`
      SELECT DISTINCT
        wpq.word_id as wordId,
        dw.word,
        dw.meaning,
        dw.category,
        dw.examples
      FROM word_practice_questions wpq
      JOIN dictionary_words dw ON wpq.word_id = dw.id
      LEFT JOIN word_practice_answers wpa ON wpq.id = wpa.question_id
      WHERE wpq.session_id = ? AND (wpa.is_correct = 0 OR wpa.is_correct IS NULL)
    `).all(id);
    
    if (wrongWords.length === 0) {
      return res.json({ success: true, data: { created: 0, skipped: 0, message: '没有错题需要复习' } });
    }
    
    // 创建复习计划（重复的会被跳过）
    const plans = reviewPlanService.createReviewPlansForMistakes(wrongWords, parseInt(id));
    
    // 统计创建和跳过的数量
    const created = plans.filter(p => p.id && !p.existing).length;
    const skipped = wrongWords.length - created;
    
    res.json({ 
      success: true, 
      data: { 
        created, 
        skipped,
        message: created > 0 ? `已创建 ${created} 个复习计划` : '所有词汇已有复习计划'
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 为指定错题创建复习计划
 * POST /api/word-practice/mistakes/create-review-plans
 */
router.post('/mistakes/create-review-plans', (req, res) => {
  try {
    const db = getDatabase();
    const { mistakeIds } = req.body;
    
    if (!mistakeIds || mistakeIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择错题' });
    }
    
    // 获取错题词汇信息
    const mistakes = db.prepare(`
      SELECT 
        wm.word_id as wordId,
        wm.word,
        wm.meaning,
        wm.category,
        dw.examples
      FROM word_mistakes wm
      LEFT JOIN dictionary_words dw ON wm.word_id = dw.id
      WHERE wm.id IN (${mistakeIds.map(() => '?').join(',')})
    `).all(...mistakeIds);
    
    if (mistakes.length === 0) {
      return res.json({ success: true, data: { created: 0, skipped: 0, message: '未找到错题' } });
    }
    
    // 创建复习计划
    let created = 0;
    for (const m of mistakes) {
      const plan = reviewPlanService.createReviewPlan({
        wordId: m.wordId,
        word: m.word,
        meaning: m.meaning,
        category: m.category,
        examples: m.examples,
        sourceType: 'mistake'
      });
      if (plan.id && !plan.existing) {
        created++;
      }
    }
    
    const skipped = mistakes.length - created;
    
    res.json({ 
      success: true, 
      data: { 
        created, 
        skipped,
        message: created > 0 ? `已创建 ${created} 个复习计划` : '所有词汇已有复习计划'
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取待复习任务
 * GET /api/word-practice/reviews/due
 */
router.get('/reviews/due', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const tasks = reviewPlanService.getDueReviewTasks({ limit: parseInt(limit) });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取复习统计
 * GET /api/word-practice/reviews/stats
 */
router.get('/reviews/stats', (req, res) => {
  try {
    const stats = reviewPlanService.getReviewStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 完成复习
 * POST /api/word-practice/reviews/:id/complete
 */
router.post('/reviews/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const { isCorrect, timeSpent, quality } = req.body;
    
    const result = reviewPlanService.completeReview({
      planId: parseInt(id),
      isCorrect,
      timeSpent,
      quality
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 跳过复习
 * POST /api/word-practice/reviews/:id/skip
 */
router.post('/reviews/:id/skip', (req, res) => {
  try {
    const { id } = req.params;
    reviewPlanService.skipReview(parseInt(id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取所有复习计划
 * GET /api/word-practice/reviews
 */
router.get('/reviews', (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, pageSize = 20, status } = req.query;
    
    let whereClauses = ['1=1'];
    const params = [];
    
    if (status) {
      whereClauses.push('rp.status = ?');
      params.push(status);
    }
    
    const whereSQL = whereClauses.join(' AND ');
    
    const { count } = db.prepare(`
      SELECT COUNT(*) as count 
      FROM word_review_plans rp
      WHERE ${whereSQL}
    `).get(...params);
    
    const plans = db.prepare(`
      SELECT rp.*, dw.word, dw.category, dw.meaning
      FROM word_review_plans rp
      JOIN dictionary_words dw ON rp.word_id = dw.id
      WHERE ${whereSQL}
      ORDER BY rp.next_review_at ASC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
    
    res.json({
      success: true,
      data: {
        list: plans,
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== 通知 ====================

/**
 * 获取未读通知
 * GET /api/word-practice/notifications/unread
 */
router.get('/notifications/unread', (req, res) => {
  try {
    const { type, limit = 20 } = req.query;
    const notifications = notificationService.getUnreadNotifications({ type, limit: parseInt(limit) });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取所有通知
 * GET /api/word-practice/notifications
 */
router.get('/notifications', (req, res) => {
  try {
    const { page = 1, pageSize = 20, type, includeRead = true } = req.query;
    const result = notificationService.getAllNotifications({
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      type,
      includeRead: includeRead === 'true'
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 标记通知为已读
 * POST /api/word-practice/notifications/read
 */
router.post('/notifications/read', (req, res) => {
  try {
    const { ids } = req.body;
    notificationService.markAsRead(ids);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 标记所有通知为已读
 * POST /api/word-practice/notifications/read-all
 */
router.post('/notifications/read-all', (req, res) => {
  try {
    notificationService.markAllAsRead();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 获取通知统计
 * GET /api/word-practice/notifications/stats
 */
router.get('/notifications/stats', (req, res) => {
  try {
    const stats = notificationService.getNotificationStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * 检查并创建复习提醒（定时任务调用）
 * POST /api/word-practice/check-reminders
 */
router.post('/check-reminders', (req, res) => {
  try {
    const count = notificationService.checkAndCreateReviewReminders();
    res.json({ success: true, data: { dueCount: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
