const { getDatabase } = require('../database/init');
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'novel-trainer-secret-key-2024';

// AI 功能锚点定义
const AI_FEATURES = {
  QUESTION_GENERATE: 'question_generate',    // 题目生成
  EVALUATION: 'evaluation',                  // 作品评审
  PROMPT_TEST: 'prompt_test',                // Prompt 测试
  DICTIONARY_SEARCH: 'dictionary_search',    // 词典查词
  DICTIONARY_GENERATE: 'dictionary_generate' // 词典生成
};

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

// 获取指定功能的 AI 配置
function getConfigForFeature(featureKey) {
  const db = getDatabase();
  
  // 首先查找该功能绑定的配置
  const featureConfig = db.prepare(`
    SELECT ac.* FROM ai_feature_config afc
    JOIN ai_config ac ON afc.config_id = ac.id
    WHERE afc.feature_key = ?
  `).get(featureKey);
  
  if (featureConfig) {
    return {
      id: featureConfig.id,
      name: featureConfig.config_name,
      baseUrl: featureConfig.api_base_url,
      apiKey: decryptApiKey(featureConfig.api_key),
      model: featureConfig.model_name,
      maxTokens: featureConfig.max_tokens,
      temperature: featureConfig.temperature,
      timeout: featureConfig.timeout
    };
  }
  
  // 如果没有绑定配置，使用默认配置
  const defaultConfig = db.prepare('SELECT * FROM ai_config WHERE is_default = 1').get();
  
  if (defaultConfig) {
    return {
      id: defaultConfig.id,
      name: defaultConfig.config_name,
      baseUrl: defaultConfig.api_base_url,
      apiKey: decryptApiKey(defaultConfig.api_key),
      model: defaultConfig.model_name,
      maxTokens: defaultConfig.max_tokens,
      temperature: defaultConfig.temperature,
      timeout: defaultConfig.timeout
    };
  }
  
  // 最后尝试获取激活的配置（兼容旧逻辑）
  const activeConfig = db.prepare('SELECT * FROM ai_config WHERE is_active = 1').get();
  
  if (activeConfig) {
    return {
      id: activeConfig.id,
      name: activeConfig.config_name,
      baseUrl: activeConfig.api_base_url,
      apiKey: decryptApiKey(activeConfig.api_key),
      model: activeConfig.model_name,
      maxTokens: activeConfig.max_tokens,
      temperature: activeConfig.temperature,
      timeout: activeConfig.timeout
    };
  }
  
  throw new Error('请先配置 AI API');
}

// 获取当前激活的 AI 配置（兼容旧接口）
function getActiveConfig() {
  const db = getDatabase();
  
  // 优先获取默认配置
  let config = db.prepare('SELECT * FROM ai_config WHERE is_default = 1').get();
  
  // 如果没有默认配置，获取激活的配置
  if (!config) {
    config = db.prepare('SELECT * FROM ai_config WHERE is_active = 1').get();
  }
  
  if (!config) {
    throw new Error('请先配置 AI API');
  }
  
  return {
    id: config.id,
    name: config.config_name,
    baseUrl: config.api_base_url,
    apiKey: decryptApiKey(config.api_key),
    model: config.model_name,
    maxTokens: config.max_tokens,
    temperature: config.temperature,
    timeout: config.timeout
  };
}

// 通用 AI 调用函数
async function callAI(options) {
  const {
    baseUrl,
    apiKey,
    model,
    messages,
    maxTokens = 4096,
    temperature = 0.7,
    timeout = 60000
  } = options;

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API 请求失败: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('API 返回数据格式错误');
    }

    return {
      content: data.choices[0].message.content,
      usage: data.usage
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('请求超时');
    }
    
    throw error;
  }
}

// 使用当前配置调用 AI（兼容旧接口）
async function callAIWithConfig(messages, options = {}) {
  const config = getActiveConfig();
  
  return callAI({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    maxTokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature || config.temperature,
    timeout: options.timeout || config.timeout
  });
}

// 使用指定功能的配置调用 AI
async function callAIForFeature(featureKey, messages, options = {}) {
  const config = getConfigForFeature(featureKey);
  
  return callAI({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    maxTokens: options.maxTokens || config.maxTokens,
    temperature: options.temperature || config.temperature,
    timeout: options.timeout || config.timeout
  });
}

// 获取模型列表
async function getModelList(options) {
  const { baseUrl, apiKey } = options;
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error('获取模型列表失败');
    }

    const data = await response.json();
    
    return data.data || [];
  } catch (error) {
    console.error('获取模型列表失败:', error);
    return [];
  }
}

module.exports = {
  AI_FEATURES,
  callAI,
  callAIWithConfig,
  callAIForFeature,
  getModelList,
  getActiveConfig,
  getConfigForFeature
};
