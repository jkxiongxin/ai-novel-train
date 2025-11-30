/**
 * 数据库迁移管理器
 * 用于处理增量数据库更新，确保已发布客户端能够平滑升级
 */

/**
 * 迁移定义列表
 * 每个迁移包含版本号和升级函数
 * 版本号必须递增，一旦发布不可修改
 */
const migrations = [
  {
    version: 1,
    name: '初始版本',
    description: '基础表结构（已在 init.js 中通过 CREATE IF NOT EXISTS 创建）',
    up: (db) => {
      // 版本1是基础版本，表已通过 CREATE TABLE IF NOT EXISTS 创建
      // 这里不需要做任何事情，仅作为版本记录起点
      console.log('迁移 v1: 基础版本，无需额外操作');
    }
  },
  {
    version: 2,
    name: '趣味练习功能',
    description: '添加词汇趣味练习相关表：练习会话、题目、答案、结果、错题集、复习计划、通知',
    up: (db) => {
      console.log('迁移 v2: 创建趣味练习相关表...');
      
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

      // 创建索引
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

      // 添加 AI 功能锚点（如果不存在）
      const existingFeature = db.prepare(
        "SELECT * FROM ai_feature_config WHERE feature_key = 'word_practice_grade'"
      ).get();
      
      if (!existingFeature) {
        db.prepare(`
          INSERT INTO ai_feature_config (feature_key, feature_name, feature_description)
          VALUES (?, ?, ?)
        `).run('word_practice_grade', '趣味练习评分', 'AI 评分造句题答案并提供反馈');
      }

      console.log('迁移 v2: 趣味练习表创建完成');
    }
  }
  // 后续版本在此添加新的迁移
  // {
  //   version: 3,
  //   name: '下一个功能',
  //   description: '...',
  //   up: (db) => { ... }
  // }
];

/**
 * 获取当前数据库版本
 */
function getCurrentVersion(db) {
  try {
    // 检查版本表是否存在
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='db_migrations'
    `).get();

    if (!tableExists) {
      return 0;
    }

    const result = db.prepare('SELECT MAX(version) as version FROM db_migrations').get();
    return result?.version || 0;
  } catch (error) {
    console.error('获取数据库版本失败:', error);
    return 0;
  }
}

/**
 * 确保迁移表存在
 */
function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS db_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * 记录迁移完成
 */
function recordMigration(db, migration) {
  db.prepare(`
    INSERT OR IGNORE INTO db_migrations (version, name, description)
    VALUES (?, ?, ?)
  `).run(migration.version, migration.name, migration.description);
}

/**
 * 执行数据库迁移
 * @param {Database} db - 数据库实例
 * @returns {Object} 迁移结果
 */
function runMigrations(db) {
  console.log('开始检查数据库迁移...');
  
  // 确保迁移表存在
  ensureMigrationTable(db);
  
  const currentVersion = getCurrentVersion(db);
  const targetVersion = migrations.length > 0 ? migrations[migrations.length - 1].version : 0;
  
  console.log(`当前数据库版本: ${currentVersion}, 目标版本: ${targetVersion}`);
  
  if (currentVersion >= targetVersion) {
    console.log('数据库已是最新版本，无需迁移');
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: currentVersion,
      migrationsApplied: 0
    };
  }
  
  // 筛选需要执行的迁移
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);
  
  console.log(`需要执行 ${pendingMigrations.length} 个迁移`);
  
  // 在事务中执行所有迁移
  const migrate = db.transaction(() => {
    for (const migration of pendingMigrations) {
      console.log(`执行迁移 v${migration.version}: ${migration.name}`);
      try {
        migration.up(db);
        recordMigration(db, migration);
        console.log(`迁移 v${migration.version} 完成`);
      } catch (error) {
        console.error(`迁移 v${migration.version} 失败:`, error);
        throw error;
      }
    }
  });
  
  try {
    migrate();
    console.log('所有迁移执行完成');
    return {
      success: true,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      migrationsApplied: pendingMigrations.length
    };
  } catch (error) {
    console.error('迁移失败，已回滚:', error);
    return {
      success: false,
      fromVersion: currentVersion,
      toVersion: currentVersion,
      error: error.message
    };
  }
}

/**
 * 获取迁移状态
 */
function getMigrationStatus(db) {
  ensureMigrationTable(db);
  
  const applied = db.prepare('SELECT * FROM db_migrations ORDER BY version ASC').all();
  const currentVersion = getCurrentVersion(db);
  const latestVersion = migrations.length > 0 ? migrations[migrations.length - 1].version : 0;
  
  return {
    currentVersion,
    latestVersion,
    isUpToDate: currentVersion >= latestVersion,
    appliedMigrations: applied,
    pendingMigrations: migrations.filter(m => m.version > currentVersion).map(m => ({
      version: m.version,
      name: m.name,
      description: m.description
    }))
  };
}

module.exports = {
  runMigrations,
  getMigrationStatus,
  getCurrentVersion,
  migrations
};
