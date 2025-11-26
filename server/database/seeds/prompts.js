// 默认 Prompt 模板种子数据

const defaultPrompts = [
  // ========== 题目生成类 Prompt ==========
  {
    category: 'generator',
    type: 'dialogue',
    name: '人物对白训练题生成器',
    description: '生成人物对白写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道人物对白写作训练题。

难度级别：{{difficulty}}
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

根据难度调整：
- 简单：2个角色，日常对话场景，情绪单一
- 中等：2-3个角色，有一定冲突的场景，需要展现潜台词
- 困难：3-4个角色，复杂的多方对话，需要展现多层次情感

请生成一个网络小说常见的对话场景训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "dialogue",
  "difficulty": "{{difficulty}}",
  "background": "场景背景（80-150字，需要交代时间、地点、前因）",
  "characters": [
    {
      "name": "角色名",
      "identity": "身份背景",
      "personality": "性格特点（3-5个关键词）",
      "currentEmotion": "当前情绪状态",
      "speakingStyle": "说话风格特点"
    }
  ],
  "objective": "这段对话需要达成的目的",
  "constraints": ["约束条件1", "约束条件2"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点1", "评审重点2", "评审重点3"],
  "hints": ["可选写作提示"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'emotion',
    name: '情绪渲染训练题生成器',
    description: '生成情绪渲染写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道情绪渲染写作训练题。

难度级别：{{difficulty}}
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

情绪类型可以包括但不限于：悲伤、愤怒、恐惧、喜悦、绝望、释然、紧张、温馨、悲壮等。

请生成训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "emotion",
  "difficulty": "{{difficulty}}",
  "targetEmotion": "目标情绪",
  "emotionIntensity": "情绪强度（轻微/中等/强烈/极致）",
  "background": "情境背景（包含触发这种情绪的事件）",
  "character": {
    "name": "角色名",
    "identity": "身份",
    "personality": "性格特点",
    "emotionalTrigger": "引发情绪的具体原因"
  },
  "requirements": [
    "需要运用的写作技巧，如环境烘托、内心独白、动作细节等"
  ],
  "forbiddenWords": ["禁止直接使用的情绪词汇"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"],
  "exampleSentence": "一句示例性的情绪渲染句子"
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'battle',
    name: '战斗场景训练题生成器',
    description: '生成战斗场景写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道战斗场景写作训练题。

难度级别：{{difficulty}}
小说类型偏好：{{genre}}（默认为玄幻）
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

根据难度调整：
- 简单：1v1 单挑，招式简单直接
- 中等：小规模战斗，需要战术配合
- 困难：大场面或高手对决，需要节奏把控和视角切换

请生成训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "battle",
  "difficulty": "{{difficulty}}",
  "genre": "小说类型",
  "battleType": "战斗类型（单挑/群战/追逐/攻防等）",
  "background": "战斗背景（为什么而战）",
  "environment": "战斗环境描述",
  "participants": [
    {
      "name": "参与者名称",
      "side": "阵营",
      "strength": "实力描述",
      "skills": ["特殊技能/招式"],
      "weapon": "武器/法宝",
      "currentState": "当前状态（体力、伤势等）"
    }
  ],
  "battleObjective": "战斗目标（不一定是打死对方）",
  "turningPoint": "建议的战斗转折点",
  "requirements": ["写作要求，如节奏感、招式描写等"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'genre', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'psychology',
    name: '心理活动训练题生成器',
    description: '生成心理活动写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道心理活动写作训练题。

难度级别：{{difficulty}}
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

请生成训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "psychology",
  "difficulty": "{{difficulty}}",
  "background": "情境背景描述",
  "character": {
    "name": "角色名",
    "identity": "身份背景",
    "personality": "性格特点",
    "currentSituation": "当前处境"
  },
  "mentalState": "需要描写的心理状态",
  "innerConflict": "内心矛盾/挣扎点",
  "triggerEvent": "触发心理活动的事件",
  "requirements": ["写作要求"],
  "techniques": ["建议使用的心理描写技巧"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'environment',
    name: '环境描写训练题生成器',
    description: '生成环境描写写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道环境描写写作训练题。

难度级别：{{difficulty}}
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

请生成训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "environment",
  "difficulty": "{{difficulty}}",
  "location": "地点名称",
  "locationType": "地点类型（城市/山林/海洋/宫殿等）",
  "timeOfDay": "时间段",
  "weather": "天气状况",
  "season": "季节",
  "atmosphere": "需要营造的氛围（紧张/神秘/温馨等）",
  "plotContext": "这个环境描写服务的剧情背景",
  "keyElements": ["必须包含的环境元素"],
  "sensoryRequirements": {
    "visual": "视觉描写要求",
    "auditory": "听觉描写要求",
    "olfactory": "嗅觉描写要求",
    "tactile": "触觉描写要求"
  },
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'plot',
    name: '情节转折训练题生成器',
    description: '生成情节转折写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道情节转折写作训练题。

难度级别：{{difficulty}}
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

请生成训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "plot",
  "difficulty": "{{difficulty}}",
  "genre": "小说类型",
  "initialSituation": "初始情况描述",
  "expectedDirection": "读者预期的发展方向",
  "actualTwist": "需要写的转折点",
  "twistType": "转折类型（反转/揭秘/突变/逆袭等）",
  "characters": [
    {
      "name": "角色名",
      "role": "在转折中的作用",
      "beforeTwist": "转折前的状态",
      "afterTwist": "转折后的状态"
    }
  ],
  "foreshadowing": ["可以铺垫的伏笔提示"],
  "requirements": ["写作要求"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'chapter',
    name: '章节细纲生成器',
    description: '根据用户输入生成详细的章节细纲',
    content: `你是一个专业的网络小说大纲设计师。请根据用户提供的信息，生成一个详细的章节细纲。

用户输入信息：
- 小说类型：{{genre}}
- 主角信息：{{protagonist}}
- 当前剧情背景：{{currentPlot}}
- 本章目标：{{chapterGoal}}
- 目标字数：{{targetWordCount}}
{{#keywords}}
- 用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
- 用户想法：{{userIdea}}
{{/userIdea}}

请生成详细的章节细纲，输出 JSON 格式：
{
  "title": "章节训练题",
  "type": "chapter",
  "difficulty": "困难",
  "chapterTitle": "章节标题",
  "synopsis": "本章概要（150字以内）",
  "openingHook": "开篇钩子建议",
  "scenes": [
    {
      "sceneNumber": 1,
      "sceneName": "场景名称",
      "location": "地点",
      "time": "时间",
      "characters": ["出场角色"],
      "content": "场景内容详细描述",
      "purpose": "这个场景的叙事目的",
      "emotionalArc": "情绪变化曲线",
      "keyActions": ["关键动作/事件"],
      "dialogueNotes": "对话要点提示",
      "wordCountSuggestion": 建议字数
    }
  ],
  "plotPoints": [
    {"point": "剧情点", "importance": "主线/支线/伏笔"}
  ],
  "foreshadowing": ["可以埋设的伏笔"],
  "chapterEndHook": "章节结尾悬念",
  "writingNotes": ["写作注意事项"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['genre', 'protagonist', 'currentPlot', 'chapterGoal', 'targetWordCount', 'keywords', 'userIdea']),
    is_default: 1
  },
  {
    category: 'generator',
    type: 'comprehensive',
    name: '综合场景训练题生成器',
    description: '生成融合多种元素的综合写作训练题目',
    content: `你是一个专业的网络小说写作训练题目设计师。请设计一道综合场景写作训练题。

难度级别：{{difficulty}}
{{#keywords}}
用户关键词：{{keywords}}
{{/keywords}}
{{#userIdea}}
用户想法：{{userIdea}}
{{/userIdea}}

综合训练需要融合以下元素中的至少3种：
- 人物对白
- 情绪渲染
- 动作/战斗描写
- 心理活动
- 环境描写
- 情节推进

请生成训练题，输出 JSON 格式：
{
  "title": "题目标题",
  "type": "comprehensive",
  "difficulty": "{{difficulty}}",
  "genre": "小说类型",
  "includedElements": ["包含的写作元素"],
  "background": "详细的场景背景",
  "characters": [
    {
      "name": "角色名",
      "identity": "身份",
      "personality": "性格",
      "role": "在场景中的作用"
    }
  ],
  "sceneGoal": "场景需要达成的目标",
  "emotionalJourney": "情绪变化曲线",
  "keyMoments": ["关键时刻/节点"],
  "requirements": ["写作要求"],
  "wordCountRange": {"min": 数字, "max": 数字},
  "evaluationFocus": ["评审重点"]
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['difficulty', 'keywords', 'userIdea']),
    is_default: 1
  },

  // ========== 评审类 Prompt ==========
  {
    category: 'evaluator',
    type: 'general',
    name: '通用写作评审',
    description: '适用于所有类型的通用评审 Prompt',
    content: `你是一位资深的网络小说编辑，拥有丰富的审稿经验。请对以下写作练习进行专业、细致、有建设性的评审。

## 练习题目
类型：{{questionType}}
难度：{{difficulty}}
题目内容：
{{questionContent}}

## 用户作品
{{userAnswer}}

请从以下维度进行全面评价，每个维度0-20分：

1. **完成度** (0-20分)
   - 是否完成了题目的所有要求
   - 字数是否达标
   - 核心目标是否实现

2. **文笔表现** (0-20分)
   - 语言是否流畅
   - 用词是否准确生动
   - 是否有画面感和感染力

3. **技巧运用** (0-20分)
   - 是否恰当运用了相关写作技巧
   - 细节描写是否到位
   - 叙述节奏是否得当

4. **创意表现** (0-20分)
   - 是否有独特的构思
   - 是否有令人印象深刻的亮点
   - 是否避免了俗套

5. **整体效果** (0-20分)
   - 作品的整体完整性
   - 阅读体验
   - 是否达到了预期的情感/氛围效果

请按以下 JSON 格式输出评审结果：
{
  "totalScore": 总分（满分100）,
  "grade": "评级（S/A/B/C/D）",
  "dimensions": {
    "completion": {
      "score": 分数,
      "comment": "详细评价（50-100字）"
    },
    "writing": {
      "score": 分数,
      "comment": "详细评价"
    },
    "technique": {
      "score": 分数,
      "comment": "详细评价"
    },
    "creativity": {
      "score": 分数,
      "comment": "详细评价"
    },
    "overall": {
      "score": 分数,
      "comment": "详细评价"
    }
  },
  "highlights": [
    "亮点1：具体指出文中精彩之处",
    "亮点2"
  ],
  "improvements": [
    {
      "issue": "问题描述",
      "suggestion": "改进建议",
      "example": "可选的修改示例"
    }
  ],
  "quotableLines": ["文中值得保留的好句子"],
  "overallComment": "总体评价（150-250字，像一位善意的编辑给作者的反馈）",
  "nextStepSuggestion": "针对这次练习，下一步的训练建议"
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['questionType', 'difficulty', 'questionContent', 'userAnswer']),
    is_default: 1
  },
  {
    category: 'evaluator',
    type: 'dialogue',
    name: '对白专项评审',
    description: '专门针对人物对白的评审 Prompt',
    content: `你是一位资深的网络小说编辑，专精于人物对白写作。请对以下对白练习进行专业评审。

## 题目信息
{{questionContent}}

## 用户作品
{{userAnswer}}

请从对白写作的专业角度进行评价，每个维度0-20分：

1. **对白自然度** (0-20分)：对话是否像真人在说话
2. **角色区分度** (0-20分)：不同角色的说话方式是否有区别
3. **潜台词运用** (0-20分)：是否有言外之意，是否避免了过于直白
4. **情感传达** (0-20分)：通过对白传达情感是否到位
5. **叙事推进** (0-20分)：对白是否推动了情节发展

请按以下 JSON 格式输出：
{
  "totalScore": 总分,
  "grade": "评级（S/A/B/C/D）",
  "dimensions": {
    "naturalness": {"score": 分数, "comment": "评价"},
    "characterization": {"score": 分数, "comment": "评价"},
    "subtext": {"score": 分数, "comment": "评价"},
    "emotion": {"score": 分数, "comment": "评价"},
    "narrative": {"score": 分数, "comment": "评价"}
  },
  "highlights": ["亮点"],
  "improvements": [{"issue": "问题", "suggestion": "建议", "example": "示例"}],
  "bestDialogues": ["文中最精彩的对白"],
  "overallComment": "总体评价",
  "nextStepSuggestion": "下一步训练建议"
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['questionContent', 'userAnswer']),
    is_default: 1
  },
  {
    category: 'evaluator',
    type: 'emotion',
    name: '情绪渲染评审',
    description: '专门针对情绪渲染的评审 Prompt',
    content: `你是一位资深的网络小说编辑，专精于情绪渲染写作。请对以下情绪渲染练习进行专业评审。

## 题目信息
{{questionContent}}

## 用户作品
{{userAnswer}}

请从情绪渲染的专业角度进行评价，每个维度0-20分：

1. **情绪准确度** (0-20分)：是否准确传达了目标情绪
2. **渲染技巧** (0-20分)：是否有效运用了烘托、暗示等技巧
3. **感染力** (0-20分)：是否能引起读者共鸣
4. **层次感** (0-20分)：情绪表达是否有递进和变化
5. **克制与表达** (0-20分)：是否避免了过度煽情或表达不足

请按以下 JSON 格式输出：
{
  "totalScore": 总分,
  "grade": "评级（S/A/B/C/D）",
  "dimensions": {
    "accuracy": {"score": 分数, "comment": "评价"},
    "technique": {"score": 分数, "comment": "评价"},
    "impact": {"score": 分数, "comment": "评价"},
    "layers": {"score": 分数, "comment": "评价"},
    "balance": {"score": 分数, "comment": "评价"}
  },
  "highlights": ["亮点"],
  "improvements": [{"issue": "问题", "suggestion": "建议", "example": "示例"}],
  "emotionalPeaks": ["文中情绪最饱满的句子"],
  "overallComment": "总体评价",
  "nextStepSuggestion": "下一步训练建议"
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['questionContent', 'userAnswer']),
    is_default: 1
  },
  {
    category: 'evaluator',
    type: 'battle',
    name: '战斗场景评审',
    description: '专门针对战斗场景的评审 Prompt',
    content: `你是一位资深的网络小说编辑，专精于战斗场景写作。请对以下战斗场景练习进行专业评审。

## 题目信息
{{questionContent}}

## 用户作品
{{userAnswer}}

请从战斗场景写作的专业角度进行评价，每个维度0-20分：

1. **动作描写** (0-20分)：招式、动作是否清晰有力
2. **节奏把控** (0-20分)：快慢节奏是否得当，张弛有度
3. **画面感** (0-20分)：读者能否在脑海中形成画面
4. **紧张感** (0-20分)：是否营造出战斗的紧张氛围
5. **战斗逻辑** (0-20分)：战斗过程是否合理，有来有回

请按以下 JSON 格式输出：
{
  "totalScore": 总分,
  "grade": "评级（S/A/B/C/D）",
  "dimensions": {
    "action": {"score": 分数, "comment": "评价"},
    "pacing": {"score": 分数, "comment": "评价"},
    "visualization": {"score": 分数, "comment": "评价"},
    "tension": {"score": 分数, "comment": "评价"},
    "logic": {"score": 分数, "comment": "评价"}
  },
  "highlights": ["亮点"],
  "improvements": [{"issue": "问题", "suggestion": "建议", "example": "示例"}],
  "bestMoments": ["文中最精彩的战斗片段"],
  "overallComment": "总体评价",
  "nextStepSuggestion": "下一步训练建议"
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['questionContent', 'userAnswer']),
    is_default: 1
  },
  {
    category: 'evaluator',
    type: 'chapter',
    name: '章节创作评审',
    description: '专门针对章节创作的评审 Prompt',
    content: `你是一位资深的网络小说编辑，请对以下章节创作进行专业评审。

## 章节细纲
{{questionContent}}

## 用户作品
{{userAnswer}}

请从章节创作的专业角度进行评价，每个维度0-20分：

1. **细纲执行度** (0-20分)：是否按照细纲完成了各个场景
2. **情节流畅度** (0-20分)：场景衔接是否自然
3. **节奏控制** (0-20分)：详略是否得当
4. **高潮设计** (0-20分)：是否有吸引人的高潮点
5. **开篇与结尾** (0-20分)：开头是否吸引人，结尾是否有悬念

请按以下 JSON 格式输出：
{
  "totalScore": 总分,
  "grade": "评级（S/A/B/C/D）",
  "dimensions": {
    "execution": {"score": 分数, "comment": "评价"},
    "flow": {"score": 分数, "comment": "评价"},
    "pacing": {"score": 分数, "comment": "评价"},
    "climax": {"score": 分数, "comment": "评价"},
    "structure": {"score": 分数, "comment": "评价"}
  },
  "highlights": ["亮点"],
  "improvements": [{"issue": "问题", "suggestion": "建议", "example": "示例"}],
  "sceneAnalysis": [
    {"scene": "场景名", "score": 分数, "comment": "评价"}
  ],
  "overallComment": "总体评价",
  "nextStepSuggestion": "下一步训练建议"
}

只输出JSON，不要有其他内容。`,
    variables: JSON.stringify(['questionContent', 'userAnswer']),
    is_default: 1
  }
];

async function seedDefaultPrompts(db) {
  const count = db.prepare('SELECT COUNT(*) as count FROM prompt_templates WHERE is_default = 1').get();
  
  if (count.count > 0) {
    console.log('默认 Prompt 模板已存在，跳过初始化');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO prompt_templates (category, type, name, description, content, variables, is_default, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertMany = db.transaction((prompts) => {
    for (const prompt of prompts) {
      insert.run(
        prompt.category,
        prompt.type,
        prompt.name,
        prompt.description,
        prompt.content,
        prompt.variables,
        prompt.is_default
      );
    }
  });

  insertMany(defaultPrompts);
  console.log(`已插入 ${defaultPrompts.length} 个默认 Prompt 模板`);
}

module.exports = {
  seedDefaultPrompts,
  defaultPrompts
};
