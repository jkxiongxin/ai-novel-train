const express = require('express');
const router = express.Router();
const { getDatabase } = require('../database/init');
const { callAI, getModelList } = require('../services/aiService');
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'novel-trainer-secret-key-2024';

// 加密 API Key
function encryptApiKey(apiKey) {
  if (!apiKey) return null;
  return CryptoJS.AES.encrypt(apiKey, ENCRYPTION_KEY).toString();
}

// 解密 API Key
function decryptApiKey(encryptedKey) {
  if (!encryptedKey) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedKey, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch {
    return null;
  }
}

// 获取当前激活的配置
router.get('/', (req, res) => {
  try {
    const db = getDatabase();
    const config = db.prepare('SELECT * FROM ai_config WHERE is_active = 1').get();
    
    if (config) {
      // 返回解密后的 API Key 原文
      config.has_api_key = !!config.api_key;
      config.api_key = decryptApiKey(config.api_key);
    }
    
    res.json({
      success: true,
      data: config || null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取配置失败',
      error: error.message
    });
  }
});

// 获取所有配置
router.get('/all', (req, res) => {
  try {
    const db = getDatabase();
    const configs = db.prepare('SELECT * FROM ai_config ORDER BY created_at DESC').all();
    
    // 返回解密后的 API Key 原文
    configs.forEach(config => {
      config.has_api_key = !!config.api_key;
      config.api_key = decryptApiKey(config.api_key);
    });
    
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取配置列表失败',
      error: error.message
    });
  }
});

// 获取所有 AI 功能及其配置
router.get('/features', (req, res) => {
  try {
    const db = getDatabase();
    const features = db.prepare(`
      SELECT 
        afc.id,
        afc.feature_key as key,
        afc.feature_name as name,
        afc.feature_description as description,
        afc.config_id,
        ac.config_name,
        ac.model_name
      FROM ai_feature_config afc
      LEFT JOIN ai_config ac ON afc.config_id = ac.id
      ORDER BY afc.id
    `).all();
    
    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取功能配置失败',
      error: error.message
    });
  }
});

// 获取功能配置映射列表
router.get('/feature-configs', (req, res) => {
  try {
    const db = getDatabase();
    const configs = db.prepare(`
      SELECT 
        feature_key,
        config_id,
        1 as is_enabled
      FROM ai_feature_config
    `).all();
    
    res.json({
      success: true,
      data: configs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取功能配置映射失败',
      error: error.message
    });
  }
});

// 保存单个功能配置
router.put('/feature-configs', (req, res) => {
  try {
    const db = getDatabase();
    const { feature_key, config_id, is_enabled } = req.body;
    
    db.prepare(`
      UPDATE ai_feature_config 
      SET config_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE feature_key = ?
    `).run(config_id || null, feature_key);
    
    res.json({
      success: true,
      message: '功能配置已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新功能配置失败',
      error: error.message
    });
  }
});

// 批量保存功能配置
router.put('/feature-configs/batch', (req, res) => {
  try {
    const db = getDatabase();
    const { config_id, feature_keys } = req.body;
    
    const update = db.prepare(`
      UPDATE ai_feature_config 
      SET config_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE feature_key = ?
    `);
    
    const updateMany = db.transaction((keys) => {
      for (const key of keys) {
        update.run(config_id || null, key);
      }
    });
    
    updateMany(feature_keys);
    
    res.json({
      success: true,
      message: '批量更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '批量更新失败',
      error: error.message
    });
  }
});

// 设置功能使用的 AI 配置（旧接口，保留兼容）
router.put('/features/:featureKey', (req, res) => {
  try {
    const db = getDatabase();
    const { featureKey } = req.params;
    const { config_id } = req.body;
    
    db.prepare(`
      UPDATE ai_feature_config 
      SET config_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE feature_key = ?
    `).run(config_id || null, featureKey);
    
    res.json({
      success: true,
      message: '功能配置已更新'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新功能配置失败',
      error: error.message
    });
  }
});

// 保存配置
router.post('/', (req, res) => {
  try {
    const db = getDatabase();
    const {
      id,
      config_name,
      api_base_url,
      api_key,
      model_name,
      max_tokens = 4096,
      temperature = 0.7,
      timeout = 60000,
      is_active = false,
      is_default = false
    } = req.body;

    // 如果设为激活状态，先取消其他配置的激活状态
    if (is_active) {
      db.prepare('UPDATE ai_config SET is_active = 0').run();
    }
    
    // 如果设为默认配置，先取消其他配置的默认状态
    if (is_default) {
      db.prepare('UPDATE ai_config SET is_default = 0').run();
    }

    let result;
    if (id) {
      // 更新现有配置
      let updateQuery = `
        UPDATE ai_config SET
          config_name = ?,
          api_base_url = ?,
          model_name = ?,
          max_tokens = ?,
          temperature = ?,
          timeout = ?,
          is_active = ?,
          is_default = ?,
          updated_at = CURRENT_TIMESTAMP
      `;
      const params = [config_name, api_base_url, model_name, max_tokens, temperature, timeout, is_active ? 1 : 0, is_default ? 1 : 0];
      
      // 只有当提供了新的 API Key 时才更新
      if (api_key && api_key !== '********') {
        updateQuery += ', api_key = ?';
        params.push(encryptApiKey(api_key));
      }
      
      updateQuery += ' WHERE id = ?';
      params.push(id);
      
      db.prepare(updateQuery).run(...params);
      result = { id };
    } else {
      // 创建新配置
      const insertResult = db.prepare(`
        INSERT INTO ai_config (config_name, api_base_url, api_key, model_name, max_tokens, temperature, timeout, is_active, is_default)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        config_name,
        api_base_url,
        encryptApiKey(api_key),
        model_name,
        max_tokens,
        temperature,
        timeout,
        is_active ? 1 : 0,
        is_default ? 1 : 0
      );
      result = { id: insertResult.lastInsertRowid };
    }

    res.json({
      success: true,
      data: result,
      message: '配置保存成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '保存配置失败',
      error: error.message
    });
  }
});

// 删除配置
router.delete('/:id', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    db.prepare('DELETE FROM ai_config WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '配置删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '删除配置失败',
      error: error.message
    });
  }
});

// 设置激活配置
router.put('/:id/activate', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 先取消所有激活状态
    db.prepare('UPDATE ai_config SET is_active = 0').run();
    // 激活指定配置
    db.prepare('UPDATE ai_config SET is_active = 1 WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '配置已激活'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '激活配置失败',
      error: error.message
    });
  }
});

// 设置默认配置
router.put('/:id/default', (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    
    // 先取消所有默认状态
    db.prepare('UPDATE ai_config SET is_default = 0').run();
    // 设置指定配置为默认
    db.prepare('UPDATE ai_config SET is_default = 1, is_active = 1 WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '已设为默认配置'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '设置默认配置失败',
      error: error.message
    });
  }
});

// 测试连接
router.post('/test', async (req, res) => {
  try {
    const { api_base_url, api_key, model_name, timeout = 30000 } = req.body;
    
    const response = await callAI({
      baseUrl: api_base_url,
      apiKey: api_key,
      model: model_name,
      messages: [{ role: 'user', content: '请回复"连接成功"' }],
      maxTokens: 50,
      timeout
    });

    res.json({
      success: true,
      message: '连接测试成功',
      data: { response: response.content }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: '连接测试失败',
      error: error.message
    });
  }
});

// 获取模型列表
router.post('/models', async (req, res) => {
  try {
    const { api_base_url, api_key } = req.body;
    
    if (!api_base_url || !api_key) {
      return res.status(400).json({
        success: false,
        message: '请先填写 API 地址和 API Key'
      });
    }

    const models = await getModelList({
      baseUrl: api_base_url,
      apiKey: api_key
    });

    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取模型列表失败',
      error: error.message
    });
  }
});

module.exports = router;
