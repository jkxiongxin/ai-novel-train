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
  CHAPTER_ANALYZE: 'chapter_analyze',        // 章节分析
  WORD_PRACTICE_GRADE: 'word_practice_grade', // 趣味练习评分
  CHAPTER_REGEX_GENERATE: 'chapter_regex_generate' // 章节标题正则生成
};

// 统一清洗 AI 返回内容：移除 <think>...</think>
function stripThinkTags(text) {
  if (text == null) return '';
  const raw = String(text);
  return raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<\/?think>/gi, '')
    .trim();
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
      timeout: featureConfig.timeout,
      providerType: featureConfig.provider_type || 'openai'
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
      timeout: defaultConfig.timeout,
      providerType: defaultConfig.provider_type || 'openai'
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
      timeout: activeConfig.timeout,
      providerType: activeConfig.provider_type || 'openai'
    };
  }
  
  throw new Error('请先配置 AI API');
}

// 说明：系统默认支持多种 AI 提供商（可在前端下拉选择）：
// - openai
// - azure
// - anthropic
// - modelscope (魔搭)
// - cerebras
// - openrouter

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
    timeout: config.timeout,
    providerType: config.provider_type || 'openai'
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
    timeout = 1200000, // 20分钟
    providerType = 'openai'
  } = options;

  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // 构建请求体
    const requestBody = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature
    };

    // Qwen 兼容性处理：仅当模型为 qwen 系列时添加 enable_thinking
    // 说明：部分 Qwen 兼容端点会在非流式调用中校验该参数（enable_thinking / parameters.enable_thinking / parameter.enable_thinking）
    // 为避免对非 Qwen 模型发送额外字段，这里只在模型名以 qwen 开头时携带。
    const lowerProvider = String(providerType || '').toLowerCase();
    const lowerModel = String(model || '').toLowerCase();
    const lowerBaseUrl = String(baseUrl || '').toLowerCase();
    const isQwenModel = lowerModel.includes('qwen3') && baseUrl.contains('modelscope');

    if (isQwenModel) {
      requestBody.enable_thinking = false;
      requestBody.parameters = Object.assign({}, requestBody.parameters, { enable_thinking: false });
      requestBody.parameter = Object.assign({}, requestBody.parameter, { enable_thinking: false });
    }

    // 发送请求（若返回 422 且包含 enable_thinking/parameters 的不支持错误，则重试一次去掉这些字段）
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 只读取一次响应体，防止重复读取导致 "Body has already been read" 错误
      let bodyText = await response.text();

      // 如果是 422 且提示关于 enable_thinking/parameters 的不支持错误，尝试重试一次（移除兼容字段）
      if (response.status === 422 && /enable_thinking|parameters|parameter/.test(bodyText)) {
        try {
          const retryBody = Object.assign({}, requestBody);
          delete retryBody.parameters;
          delete retryBody.parameter;

          // 记录一个简短的调试日志（不包含 messages）
          console.warn('AI 请求遭遇 422，正在尝试移除兼容字段并重试（已屏蔽 messages）');

          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(retryBody),
            signal: controller.signal
          });

          // 重新读取新的响应体（注意：这是新的 response）
          bodyText = await response.text();
        } catch (retryErr) {
          // 忽略重试错误，下面逻辑会抛出最终错误
        }
      }

      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} - ${bodyText}`);
      }
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0]) {
      throw new Error('API 返回数据格式错误');
    }

    return {
      content: stripThinkTags(data.choices?.[0]?.message?.content),
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
    timeout: options.timeout || config.timeout,
    providerType: config.providerType
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
    timeout: options.timeout || config.timeout,
    providerType: config.providerType
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
      throw new Error(`获取模型列表失败，请求地址为${url}`);
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
  
  // 将章节正文按单个换行符分段并在每段前插入段落序号标记 [P1]、[P2] ...（用于提供给 AI）
  const rawParagraphs = String(content || '')
    .split(/\r?\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const numberedParagraphs = rawParagraphs.map((p, idx) => `[P${idx + 1}] ${p}`);
  const numberedContent = numberedParagraphs.join('\n');
  
  const systemPrompt = `你是一位专业的小说分析师，擅长分析文本结构和文风特征。
请将给定的小说章节内容拆分成多个片段，并为每个片段标注类型和文风。

【重要说明 - 段落标记】
正文已按换行符分段，每段前有标记 [P1], [P2], ... 共 ${rawParagraphs.length} 段。

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
      "paragraph_start": 1,
      "paragraph_end": 3,
      "segment_type": "类型",
      "writing_style": "文风",
      "style_tags": ["标签1", "标签2"],
      "difficulty": "难度"
    }
  ]
}

注意：
1. **返回值中不要包含段落的完整内容**，只需返回段落序号范围（paragraph_start 和 paragraph_end）以节省 token
2. 每个片段应该是相对完整的语义单元，通常在100-500字之间
3. 对话片段应该包含完整的对话上下文
4. style_tags可以包含更细致的风格标签，如"悲伤"、"激烈"、"温馨"等
5. 确保返回的是有效的JSON格式
6. paragraph_start 和 paragraph_end 用数字表示段落范围，如片段包含P1到P3，则 paragraph_start=1, paragraph_end=3`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请分析以下小说章节内容（已编号）：\n\n${numberedContent}` }
  ];

  const result = await callAI({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    maxTokens: config.maxTokens || 8192,
    temperature: 0.3,
    timeout: config.timeout || 120000,
    providerType: config.providerType
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

    // 根据段落序号重建片段内容
    for (const seg of analysisResult.segments) {
      // 确保 paragraph_start 和 paragraph_end 有效
      const start = Math.max(1, Math.min(rawParagraphs.length, parseInt(seg.paragraph_start) || 1));
      const end = Math.max(start, Math.min(rawParagraphs.length, parseInt(seg.paragraph_end) || start));
      
      seg.paragraph_start = start;
      seg.paragraph_end = end;
      
      // 根据段落序号重建内容（用原始段落按顺序拼接，段落间保留空行）
      const parts = [];
      for (let i = start; i <= end; i++) {
        if (rawParagraphs[i - 1]) {
          parts.push(rawParagraphs[i - 1]);
        }
      }
      seg.content = parts.join('\n\n');

      // 确保其他字段存在
      seg.style_tags = Array.isArray(seg.style_tags) ? seg.style_tags : (seg.style_tags ? [seg.style_tags] : []);
      seg.difficulty = seg.difficulty || 'medium';
      seg.segment_type = seg.segment_type || seg.type || 'narrative';
      seg.writing_style = seg.writing_style || 'plain';

      // 计算单个片段的字数（用于后续入库）
      seg.word_count = String(seg.content || '').replace(/\s/g, '').length;
    }

    return analysisResult;
  } catch (parseError) {
    console.error('解析AI返回结果失败:', parseError);
    console.error('原始内容:', result.content);
    throw new Error('分析结果解析失败，请重试');
  }
}

// 生成章节标题正则表达式
async function generateChapterRegex(sampleText) {
  const config = getConfigForFeature(AI_FEATURES.CHAPTER_REGEX_GENERATE);
  
  const systemPrompt = `你是一位专业的文本分析专家，擅长分析小说章节结构。
  请根据提供的小说文本样本，分析出章节标题的格式规律，并生成一个精确的JavaScript正则表达式来匹配章节标题。

  重要说明：样本文本可能由两段拼接而成（例如“开头节选 + 中段节选”），不同位置的章节标题格式/编号位数可能存在差异。
  请综合全部样本，生成能兼容所有样本章节标题行的正则表达式；如存在多种格式，可使用可选分支兼容，但不要过于宽泛以免误匹配正文。

常见的章节标题格式包括：
1. "第X章 标题" 格式（如：第一章 初见、第1章 开始）
2. "第X回 标题" 格式（如：第一回 风起云涌）
3. "Chapter X" 格式
4. "卷X 章X" 格式
5. 纯数字章节（如：1、2、3 或 001、002）
6. 其他特殊格式

请仔细分析文本中的章节标题模式，生成能准确匹配的正则表达式。

  返回JSON格式：
{
  "regex": "正则表达式字符串（不要包含斜杠和标志）",
  "description": "对正则表达式的简要说明",
  "examples": ["匹配的示例标题1", "匹配的示例标题2", "匹配的示例标题3"]
}

  注意：
 1. 正则表达式应该能匹配完整的章节标题行
 2. 不要过于宽泛，以免匹配到正文内容
 3. 对于章节编号部分，优先使用不限位数的数字匹配（例如使用 '\\d+' 而非 '\\d{1,2}' 或 '\\d{1,3}'），以保证能匹配 100 章及以上的章节标题
 4. 同时请返回一个更宽松的备用正则（如果适用），字段名为 'fallback_regex'，用于在用户的小说包含三位数或更多位数章节编号时使用
 5. 使用JavaScript正则表达式语法
 6. 返回的regex字段只包含正则表达式本身，不需要斜杠包裹`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请分析以下小说文本样本，生成章节标题的正则表达式：\n\n${sampleText}` }
  ];

  const result = await callAI({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    messages,
    maxTokens: config.maxTokens || 2048,
    temperature: 0.3,
    timeout: config.timeout || 60000,
    providerType: config.providerType
  });

  // 解析返回的JSON
  try {
    let jsonContent = result.content;
    
    // 如果内容被包裹在markdown代码块中，提取JSON
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }
    
    const regexResult = JSON.parse(jsonContent.trim());
    
    if (!regexResult.regex) {
      throw new Error('未能生成正则表达式');
    }
    
    // 验证正则表达式是否有效
    try {
      new RegExp(regexResult.regex);
    } catch (e) {
      throw new Error('生成的正则表达式无效: ' + e.message);
    }

    // 如果生成的正则中包含限定位数的数字匹配（如 \d{1,2}），生成一个更宽松的备用正则（使用 \d+）以避免只匹配到 99 章的问题
    try {
      const original = String(regexResult.regex || '');
      const generalized = original.replace(/\\d\{\d+(?:,\d+)?\}/g, '\\d+');
      if (generalized !== original) {
        // 验证备用正则
        try {
          new RegExp(generalized);
          regexResult.fallback_regex = generalized;
          // 在描述中追加说明
          regexResult.description = (regexResult.description || '') + '（注意：已提供备用正则以支持更多位数章节编号）';
        } catch (e) {
          // 忽略备用正则无效的情况
        }
      }
    } catch (e) {
      // 忽略处理中出现的任何错误
    }
    
    return regexResult;
  } catch (parseError) {
    console.error('解析AI返回结果失败:', parseError);
    console.error('原始内容:', result.content);
    throw new Error('正则表达式生成失败，请重试');
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
  analyzeChapter,
  generateChapterRegex
};
