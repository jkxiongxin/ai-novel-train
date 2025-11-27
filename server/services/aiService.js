const { getDatabase } = require('../database/init');
const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = 'novel-trainer-secret-key-2024';

// AI 功能锚点定义
const AI_FEATURES = {
  QUESTION_GENERATE: 'question_generate',    // 题目生成
  EVALUATION: 'evaluation',                  // 作品评审
  PROMPT_TEST: 'prompt_test',                // Prompt 测试
  DICTIONARY_SEARCH: 'dictionary_search',    // 词典查词
  DICTIONARY_GENERATE: 'dictionary_generate', // 词典生成
  CHAPTER_ANALYZE: 'chapter_analyze'         // 章节分析
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
    timeout = 1200000 // 20分钟
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

// 分析章节内容
async function analyzeChapter(content) {
  const config = getConfigForFeature(AI_FEATURES.CHAPTER_ANALYZE);
  
  const systemPrompt = `你是一位专业的小说分析师，擅长分析文本结构和文风特征。
请将给定的小说章节内容拆分成多个片段，并为每个片段标注类型和文风。

片段类型（segment_type）包括：
- dialogue: 人物对白（角色之间的对话内容）
- emotion: 情绪渲染（情感氛围的描写）
- battle: 战斗场景（动作打斗场面）
- psychology: 心理活动（角色内心独白）
- environment: 环境描写（场景环境描写）
- plot: 情节推进（故事情节发展）
- transition: 过渡衔接（段落之间的过渡）
- narrative: 叙事描述（一般性叙述内容）

文风类型（writing_style）包括：
- concise: 简洁明快（用词精炼，节奏快速）
- detailed: 细腻详尽（描写细致，铺陈丰富）
- poetic: 诗意唯美（语言优美，意境深远）
- humorous: 幽默诙谐（轻松有趣，富有笑点）
- tense: 紧张刺激（节奏紧凑，悬念感强）
- lyrical: 抒情感人（情感真挚，打动人心）
- plain: 平实质朴（语言朴素，贴近生活）
- grand: 大气磅礴（气势恢宏，格局宏大）

难度等级（difficulty）：easy, medium, hard

请以JSON格式返回分析结果，格式如下：
{
  "segments": [
    {
      "content": "片段内容",
      "segment_type": "类型",
      "writing_style": "文风",
      "style_tags": ["标签1", "标签2"],
      "difficulty": "难度"
    }
  ]
}

注意：
1. 每个片段应该是相对完整的语义单元，通常在100-500字之间
2. 对话片段应该包含完整的对话上下文
3. style_tags可以包含更细致的风格标签，如"悲伤"、"激烈"、"温馨"等
4. 确保返回的是有效的JSON格式`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请分析以下小说章节内容：\n\n${content}` }
  ];

  const result = await callAI({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    maxTokens: config.maxTokens || 8192,
    temperature: 0.3,
    timeout: config.timeout || 120000
  });

  // 解析返回的JSON
  try {
    // 尝试提取JSON内容
    let jsonContent = result.content;
    
    // 如果内容被包裹在markdown代码块中，提取JSON
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
    
    const analysisResult = JSON.parse(jsonContent.trim());
    
    if (!analysisResult.segments || !Array.isArray(analysisResult.segments)) {
      throw new Error('分析结果格式错误');
    }
    
    return analysisResult;
  } catch (parseError) {
    console.error('解析AI返回结果失败:', parseError);
    console.error('原始内容:', result.content);
    throw new Error('分析结果解析失败，请重试');
  }
}

module.exports = {
  AI_FEATURES,
  callAI,
  callAIWithConfig,
  callAIForFeature,
  getModelList,
  getActiveConfig,
  getConfigForFeature,
  analyzeChapter
};
