const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { seedDefaultPrompts } = require('./seeds/prompts');
const { runMigrations, getMigrationStatus } = require('./migrations');

// 支持通过环境变量自定义数据库路径（用于 Electron 桌面版）
const getDbPath = () => {
  if (process.env.DB_PATH) {
    // 确保目录存在
    const dbDir = path.dirname(process.env.DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    return process.env.DB_PATH;
  }
  return path.join(__dirname, 'novel_trainer.db');
};

const DB_PATH = getDbPath();

let db = null;

function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

async function initDatabase() {
  const db = getDatabase();

  // 创建 AI 配置表（支持多套配置）
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_name TEXT NOT NULL,
      api_base_url TEXT NOT NULL,
      api_key TEXT,
      model_name TEXT NOT NULL,
      max_tokens INTEGER DEFAULT 4096,
      temperature REAL DEFAULT 0.7,
      timeout INTEGER DEFAULT 60000,
      is_active BOOLEAN DEFAULT 0,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 AI 功能配置映射表
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_feature_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_key TEXT UNIQUE NOT NULL,
      feature_name TEXT NOT NULL,
      feature_description TEXT,
      config_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (config_id) REFERENCES ai_config(id) ON DELETE SET NULL
    )
  `);
  // 初始化 AI 功能锚点
  const defaultFeatures = [
    { key: 'question_generate', name: '题目生成', description: '生成写作练习题目' },
    { key: 'evaluation', name: '作品评审', description: '对用户提交的作品进行 AI 评审' },
    { key: 'prompt_test', name: 'Prompt 测试', description: '测试 Prompt 模板效果' },
    { key: 'dictionary_search', name: '词典查词', description: 'AI 搜索相关词汇' },
    { key: 'dictionary_generate', name: '词典生成', description: 'AI 生成专题词典' },
    { key: 'chapter_analyze', name: '章节分析', description: 'AI 分析章节内容，拆分片段并识别文风' },
    { key: 'word_practice_grade', name: '趣味练习评分', description: 'AI 评分造句题答案并提供反馈' }
  ];

  const insertFeature = db.prepare(`
    INSERT OR IGNORE INTO ai_feature_config (feature_key, feature_name, feature_description)
    VALUES (?, ?, ?)
  `);

  for (const feature of defaultFeatures) {
    insertFeature.run(feature.key, feature.name, feature.description);
  }

  // 创建 Prompt 模板表
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      variables TEXT,
      is_default BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建 Prompt 历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER,
      content TEXT NOT NULL,
      version INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES prompt_templates(id) ON DELETE CASCADE
    )
  `);

  // 创建题目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      generated_by_prompt_id INTEGER,
      is_favorite BOOLEAN DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (generated_by_prompt_id) REFERENCES prompt_templates(id)
    )
  `);

  // 创建题目标签表
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER,
      tag TEXT NOT NULL,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    )
  `);

  // 创建练习表
  db.exec(`
    CREATE TABLE IF NOT EXISTS practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      content TEXT,
      word_count INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      submitted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )
  `);

  // 创建练习草稿表
  db.exec(`
    CREATE TABLE IF NOT EXISTS practice_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id INTEGER,
      content TEXT,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (practice_id) REFERENCES practices(id) ON DELETE CASCADE
    )
  `);

  // 创建评审表
  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id INTEGER NOT NULL,
      prompt_id INTEGER,
      total_score REAL,
      dimension_scores TEXT,
      highlights TEXT,
      improvements TEXT,
      overall_comment TEXT,
      rewrite_suggestion TEXT,
      raw_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (practice_id) REFERENCES practices(id),
      FOREIGN KEY (prompt_id) REFERENCES prompt_templates(id)
    )
  `);

  // 创建系统设置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建词典词汇表
  db.exec(`
    CREATE TABLE IF NOT EXISTS dictionary_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      category TEXT NOT NULL,
      meaning TEXT,
      examples TEXT,
      tags TEXT,
      source TEXT DEFAULT 'user',
      use_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建词典词汇索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_dictionary_word ON dictionary_words(word);
    CREATE INDEX IF NOT EXISTS idx_dictionary_category ON dictionary_words(category);
  `);

  // 创建小说章节表（用于章节分析）
  db.exec(`
    CREATE TABLE IF NOT EXISTS novel_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      novel_name TEXT,
      author TEXT,
      content TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      analysis_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建章节片段表（拆分后的片段）
  db.exec(`
    CREATE TABLE IF NOT EXISTS chapter_segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      segment_order INTEGER NOT NULL,
      content TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      segment_type TEXT NOT NULL,
      writing_style TEXT,
      style_tags TEXT,
      difficulty TEXT DEFAULT 'medium',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chapter_id) REFERENCES novel_chapters(id) ON DELETE CASCADE
    )
  `);

  // 创建抄书练习表
  db.exec(`
    CREATE TABLE IF NOT EXISTS typing_practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      segment_id INTEGER,
      chapter_id INTEGER,
      custom_content TEXT,
      original_content TEXT NOT NULL,
      typed_content TEXT,
      segment_type TEXT,
      writing_style TEXT,
      word_count INTEGER DEFAULT 0,
      typed_count INTEGER DEFAULT 0,
      accuracy REAL DEFAULT 0,
      speed REAL DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (segment_id) REFERENCES chapter_segments(id) ON DELETE SET NULL,
      FOREIGN KEY (chapter_id) REFERENCES novel_chapters(id) ON DELETE SET NULL
    )
  `);

  // 创建抄书统计表
  db.exec(`
    CREATE TABLE IF NOT EXISTS typing_statistics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_date DATE NOT NULL,
      segment_type TEXT,
      writing_style TEXT,
      total_practices INTEGER DEFAULT 0,
      total_words INTEGER DEFAULT 0,
      total_time INTEGER DEFAULT 0,
      avg_accuracy REAL DEFAULT 0,
      avg_speed REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(practice_date, segment_type, writing_style)
    )
  `);

  // 创建随心练习表
  db.exec(`
    CREATE TABLE IF NOT EXISTS freewrite_practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT '随心练习',
      content TEXT,
      word_count INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      pomodoro_duration INTEGER,
      status TEXT DEFAULT 'writing',
      finish_type TEXT,
      parent_id INTEGER,
      finished_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES freewrite_practices(id) ON DELETE SET NULL
    )
  `);

  // 创建随心练习评审表
  db.exec(`
    CREATE TABLE IF NOT EXISTS freewrite_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id INTEGER NOT NULL,
      review_type TEXT NOT NULL,
      score REAL,
      comment TEXT,
      tags TEXT,
      dimension_scores TEXT,
      highlights TEXT,
      improvements TEXT,
      raw_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (practice_id) REFERENCES freewrite_practices(id) ON DELETE CASCADE
    )
  `);

  // 创建随心练习索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_freewrite_status ON freewrite_practices(status);
    CREATE INDEX IF NOT EXISTS idx_freewrite_parent ON freewrite_practices(parent_id);
    CREATE INDEX IF NOT EXISTS idx_freewrite_review_practice ON freewrite_reviews(practice_id);
  `);

  // 创建趣味练习会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_practice_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT '词汇练习',
      categories TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      display_time INTEGER DEFAULT 10,
      total_words TEXT,
      current_phase TEXT DEFAULT 'memorize',
      current_word_index INTEGER DEFAULT 0,
      total_questions INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      total_score REAL DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'preparing',
      start_time DATETIME,
      end_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建练习题目表
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_practice_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      question_type TEXT NOT NULL,
      difficulty INTEGER DEFAULT 1,
      question_content TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES word_practice_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES dictionary_words(id)
    )
  `);

  // 创建答题记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_practice_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      user_answer TEXT,
      is_correct BOOLEAN DEFAULT 0,
      score REAL DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      ai_feedback TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES word_practice_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES word_practice_questions(id) ON DELETE CASCADE
    )
  `);

  // 创建练习结果表
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_practice_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL UNIQUE,
      total_questions INTEGER DEFAULT 0,
      correct_count INTEGER DEFAULT 0,
      wrong_count INTEGER DEFAULT 0,
      choice_correct INTEGER DEFAULT 0,
      choice_total INTEGER DEFAULT 0,
      fill_correct INTEGER DEFAULT 0,
      fill_total INTEGER DEFAULT 0,
      sentence_correct INTEGER DEFAULT 0,
      sentence_total INTEGER DEFAULT 0,
      avg_score REAL DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      ai_summary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES word_practice_sessions(id) ON DELETE CASCADE
    )
  `);

  // 创建错题集表
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_mistakes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      meaning TEXT,
      session_id INTEGER,
      question_type TEXT,
      user_answer TEXT,
      correct_answer TEXT,
      mistake_count INTEGER DEFAULT 1,
      review_count INTEGER DEFAULT 0,
      is_mastered BOOLEAN DEFAULT 0,
      last_mistake_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_review_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_id) REFERENCES dictionary_words(id),
      FOREIGN KEY (session_id) REFERENCES word_practice_sessions(id) ON DELETE SET NULL
    )
  `);

  // 创建复习计划表（基于艾宾浩斯遗忘曲线）
  db.exec(`
    CREATE TABLE IF NOT EXISTS word_review_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      meaning TEXT,
      category TEXT,
      examples TEXT,
      source_type TEXT DEFAULT 'practice',
      source_id INTEGER,
      review_stage INTEGER DEFAULT 1,
      next_review_at DATETIME NOT NULL,
      last_reviewed_at DATETIME,
      correct_streak INTEGER DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      is_completed BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (word_id) REFERENCES dictionary_words(id)
    )
  `);

  // 创建通知表
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      related_type TEXT,
      related_id INTEGER,
      is_read BOOLEAN DEFAULT 0,
      scheduled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 创建趣味练习相关索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_practice_session_status ON word_practice_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_practice_question_session ON word_practice_questions(session_id);
    CREATE INDEX IF NOT EXISTS idx_practice_answer_session ON word_practice_answers(session_id);
    CREATE INDEX IF NOT EXISTS idx_mistakes_word ON word_mistakes(word_id);
    CREATE INDEX IF NOT EXISTS idx_mistakes_mastered ON word_mistakes(is_mastered);
    CREATE INDEX IF NOT EXISTS idx_review_next ON word_review_plans(next_review_at);
    CREATE INDEX IF NOT EXISTS idx_review_completed ON word_review_plans(is_completed);
    CREATE INDEX IF NOT EXISTS idx_notification_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notification_type ON notifications(type);
  `);

  // 创建章节片段索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_segment_chapter ON chapter_segments(chapter_id);
    CREATE INDEX IF NOT EXISTS idx_segment_type ON chapter_segments(segment_type);
    CREATE INDEX IF NOT EXISTS idx_segment_style ON chapter_segments(writing_style);
  `);

  // 初始化默认设置
  const defaultSettings = [
    { key: 'theme', value: 'light' },
    { key: 'editorFontSize', value: '16' },
    { key: 'autoSaveInterval', value: '30' },
    { key: 'showTimer', value: 'true' }
  ];

  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);

  for (const setting of defaultSettings) {
    insertSetting.run(setting.key, setting.value);
  }

  // 插入默认 Prompt 模板
  await seedDefaultPrompts(db);

  // 运行数据库迁移（处理增量更新）
  const migrationResult = runMigrations(db);
  if (!migrationResult.success) {
    console.error('数据库迁移失败:', migrationResult.error);
    throw new Error('数据库迁移失败: ' + migrationResult.error);
  }
  
  if (migrationResult.migrationsApplied > 0) {
    console.log(`成功应用 ${migrationResult.migrationsApplied} 个迁移，数据库版本: ${migrationResult.fromVersion} -> ${migrationResult.toVersion}`);
  }

  console.log('数据库初始化完成');
  return db;
}

module.exports = {
  getDatabase,
  initDatabase,
  getMigrationStatus
};
