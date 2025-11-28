/**
 * 本地数据库服务 - 用于移动端 APP
 * 使用 sql.js（WebAssembly 版 SQLite）实现本地存储
 */

import initSqlJs from 'sql.js'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

let SQL = null
let db = null
let isInitialized = false

// 数据库文件名
const DB_NAME = 'novel_trainer.db'

/**
 * 将 Uint8Array 转为 Base64
 */
function uint8ArrayToBase64(uint8Array) {
  let binary = ''
  const len = uint8Array.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  return btoa(binary)
}

/**
 * 将 Base64 转为 Uint8Array
 */
function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * 保存数据库到文件系统
 */
async function saveDatabase() {
  if (!db || !Capacitor.isNativePlatform()) return
  
  try {
    const data = db.export()
    const base64 = uint8ArrayToBase64(data)
    
    await Filesystem.writeFile({
      path: DB_NAME,
      data: base64,
      directory: Directory.Data
    })
    console.log('数据库已保存')
  } catch (error) {
    console.error('保存数据库失败:', error)
  }
}

/**
 * 从文件系统加载数据库
 */
async function loadDatabase() {
  if (!Capacitor.isNativePlatform()) return null
  
  try {
    const result = await Filesystem.readFile({
      path: DB_NAME,
      directory: Directory.Data
    })
    
    const data = base64ToUint8Array(result.data)
    return data
  } catch (error) {
    // 文件不存在，返回 null
    console.log('数据库文件不存在，将创建新数据库')
    return null
  }
}

/**
 * 初始化数据库
 */
export async function initLocalDatabase() {
  if (isInitialized && db) {
    return db
  }
  
  try {
    // 加载 sql.js
    SQL = await initSqlJs({
      // 使用 CDN 加载 wasm 文件
      locateFile: file => `https://sql.js.org/dist/${file}`
    })
    
    // 尝试加载已有数据库
    const existingData = await loadDatabase()
    
    if (existingData) {
      db = new SQL.Database(existingData)
      console.log('已加载现有数据库')
    } else {
      db = new SQL.Database()
      console.log('创建新数据库')
    }
    
    // 创建表结构
    await createTables()
    
    isInitialized = true
    
    // 定期保存数据库（每30秒）
    if (Capacitor.isNativePlatform()) {
      setInterval(saveDatabase, 30000)
    }
    
    return db
  } catch (error) {
    console.error('初始化本地数据库失败:', error)
    throw error
  }
}

/**
 * 创建数据库表
 */
async function createTables() {
  // AI 配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_name TEXT NOT NULL,
      api_base_url TEXT NOT NULL,
      api_key TEXT,
      model_name TEXT NOT NULL,
      max_tokens INTEGER DEFAULT 4096,
      temperature REAL DEFAULT 0.7,
      timeout INTEGER DEFAULT 60000,
      is_active INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // AI 功能配置表
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_feature_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feature_key TEXT UNIQUE NOT NULL,
      feature_name TEXT NOT NULL,
      feature_description TEXT,
      config_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Prompt 模板表
  db.run(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      content TEXT NOT NULL,
      variables TEXT,
      is_default INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 题目表
  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      generated_by_prompt_id INTEGER,
      is_favorite INTEGER DEFAULT 0,
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 练习表
  db.run(`
    CREATE TABLE IF NOT EXISTS practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      content TEXT,
      word_count INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      submitted_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 评审表
  db.run(`
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 设置表
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 词典表
  db.run(`
    CREATE TABLE IF NOT EXISTS dictionary_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      category TEXT NOT NULL,
      meaning TEXT,
      examples TEXT,
      tags TEXT,
      source TEXT DEFAULT 'user',
      use_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 章节表
  db.run(`
    CREATE TABLE IF NOT EXISTS novel_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      novel_name TEXT,
      author TEXT,
      content TEXT NOT NULL,
      word_count INTEGER DEFAULT 0,
      analysis_status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 章节片段表
  db.run(`
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 抄书练习表
  db.run(`
    CREATE TABLE IF NOT EXISTS typing_practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      segment_id INTEGER,
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
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 随心练习表
  db.run(`
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
      finished_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 随心练习评审表
  db.run(`
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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // 初始化默认设置
  const defaultSettings = [
    { key: 'theme', value: 'light' },
    { key: 'editorFontSize', value: '16' },
    { key: 'editorFontFamily', value: 'system' },
    { key: 'autoSaveInterval', value: '30' },
    { key: 'showWordCount', value: 'true' },
    { key: 'showTimer', value: 'true' },
    { key: 'defaultWritingTime', value: '30' },
    { key: 'notificationSound', value: 'true' }
  ]

  for (const setting of defaultSettings) {
    db.run(
      `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
      [setting.key, setting.value]
    )
  }

  // 初始化 AI 功能配置
  const defaultFeatures = [
    { key: 'question_generate', name: '题目生成', description: '生成写作练习题目' },
    { key: 'evaluation', name: '作品评审', description: '对用户提交的作品进行 AI 评审' },
    { key: 'prompt_test', name: 'Prompt 测试', description: '测试 Prompt 模板效果' },
    { key: 'dictionary_search', name: '词典查词', description: 'AI 搜索相关词汇' },
    { key: 'dictionary_generate', name: '词典生成', description: 'AI 生成专题词典' },
    { key: 'chapter_analyze', name: '章节分析', description: 'AI 分析章节内容，拆分片段并识别文风' },
    { key: 'freewrite_review', name: '随心写评审', description: '对随心写作品进行评审' }
  ]

  for (const feature of defaultFeatures) {
    db.run(
      `INSERT OR IGNORE INTO ai_feature_config (feature_key, feature_name, feature_description) VALUES (?, ?, ?)`,
      [feature.key, feature.name, feature.description]
    )
  }

  // 初始化默认 Prompt 模板
  const defaultPrompts = [
    {
      category: 'question',
      type: 'dialogue',
      name: '对话场景题目',
      description: '生成对话写作练习题目',
      content: '请生成一个对话场景的写作练习题目',
      is_default: 1,
      is_active: 1
    },
    {
      category: 'evaluation',
      type: 'general',
      name: '通用评审',
      description: '对作品进行综合评审',
      content: '请对以下作品进行综合评审',
      is_default: 1,
      is_active: 1
    }
  ]

  for (const prompt of defaultPrompts) {
    const existing = query('SELECT id FROM prompt_templates WHERE category = ? AND type = ? AND is_default = 1', [prompt.category, prompt.type])
    if (existing.length === 0) {
      db.run(
        `INSERT INTO prompt_templates (category, type, name, description, content, is_default, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [prompt.category, prompt.type, prompt.name, prompt.description, prompt.content, prompt.is_default, prompt.is_active]
      )
    }
  }

  // 保存数据库
  await saveDatabase()
}

/**
 * 获取数据库实例
 */
export function getDatabase() {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initLocalDatabase()')
  }
  return db
}

/**
 * 执行查询
 */
export function query(sql, params = []) {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  
  const results = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    results.push(row)
  }
  stmt.free()
  
  return results
}

/**
 * 执行单行查询
 */
export function queryOne(sql, params = []) {
  const results = query(sql, params)
  return results.length > 0 ? results[0] : null
}

/**
 * 执行写入操作
 */
export function run(sql, params = []) {
  db.run(sql, params)
  // 获取最后插入的 ID
  const result = query('SELECT last_insert_rowid() as id')
  return {
    lastInsertRowid: result[0]?.id,
    changes: db.getRowsModified()
  }
}

/**
 * 手动保存数据库
 */
export { saveDatabase }

/**
 * 检查是否已初始化
 */
export function isDatabaseInitialized() {
  return isInitialized
}
