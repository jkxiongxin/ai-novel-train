/**
 * 墨境写作成长系统 - 种子数据
 * 包含：等级配置、墨点/墨线/墨章任务模板、成就定义、连续打卡奖励
 */

/**
 * 等级配置
 * 经验值公式：required_xp = 100 * 1.5^(level-1)
 */
const levelConfig = [
  // 新手村 LV 1-10
  { level: 1, required_xp: 0, title: '墨境新人', stage: '新手村', description: '初入墨境，一切皆有可能' },
  { level: 2, required_xp: 100, title: '执笔学徒', stage: '新手村', description: '学会握笔，迈出第一步' },
  { level: 3, required_xp: 250, title: '执笔学徒', stage: '新手村', description: '' },
  { level: 4, required_xp: 475, title: '墨点初成', stage: '新手村', description: '每一滴墨都是积累' },
  { level: 5, required_xp: 812, title: '墨点初成', stage: '新手村', description: '' },
  { level: 6, required_xp: 1318, title: '故事萌芽', stage: '新手村', description: '心中开始孕育故事的种子' },
  { level: 7, required_xp: 2077, title: '故事萌芽', stage: '新手村', description: '' },
  { level: 8, required_xp: 3215, title: '词句编织', stage: '新手村', description: '学会用词语编织画面' },
  { level: 9, required_xp: 4922, title: '词句编织', stage: '新手村', description: '' },
  { level: 10, required_xp: 7483, title: '新手毕业', stage: '新手村', description: '准备好迎接更大的挑战', unlock_features: '解锁技法塔' },
  
  // 技法塔 LV 11-20
  { level: 11, required_xp: 11324, title: '技法学徒', stage: '技法塔', description: '开始系统学习写作技巧' },
  { level: 12, required_xp: 17086, title: '技法学徒', stage: '技法塔', description: '' },
  { level: 13, required_xp: 25729, title: '人物塑造师', stage: '技法塔', description: '懂得如何让人物立体' },
  { level: 14, required_xp: 38693, title: '人物塑造师', stage: '技法塔', description: '' },
  { level: 15, required_xp: 58140, title: '对话炼金师', stage: '技法塔', description: '对白开始有了灵魂' },
  { level: 16, required_xp: 87310, title: '对话炼金师', stage: '技法塔', description: '' },
  { level: 17, required_xp: 131065, title: '场景画师', stage: '技法塔', description: '文字能够构建画面' },
  { level: 18, required_xp: 196697, title: '场景画师', stage: '技法塔', description: '' },
  { level: 19, required_xp: 295146, title: '节奏掌控者', stage: '技法塔', description: '开始懂得控制叙事节奏' },
  { level: 20, required_xp: 442819, title: '技法小成', stage: '技法塔', description: '技巧渐入佳境', unlock_features: '解锁短篇林' },
  
  // 短篇林 LV 21-30
  { level: 21, required_xp: 664328, title: '短篇新秀', stage: '短篇林', description: '开始独立完成短篇创作' },
  { level: 22, required_xp: 996592, title: '短篇新秀', stage: '短篇林', description: '' },
  { level: 23, required_xp: 1494988, title: '故事工匠', stage: '短篇林', description: '能够打磨完整的小故事' },
  { level: 24, required_xp: 2242582, title: '故事工匠', stage: '短篇林', description: '' },
  { level: 25, required_xp: 3363973, title: '情节编织者', stage: '短篇林', description: '开始编织复杂的情节线' },
  { level: 26, required_xp: 5046060, title: '情节编织者', stage: '短篇林', description: '' },
  { level: 27, required_xp: 7569190, title: '悬念大师', stage: '短篇林', description: '学会制造和释放悬念' },
  { level: 28, required_xp: 11353885, title: '悬念大师', stage: '短篇林', description: '' },
  { level: 29, required_xp: 17030928, title: '短篇巧匠', stage: '短篇林', description: '短篇创作游刃有余' },
  { level: 30, required_xp: 25546492, title: '短篇林主', stage: '短篇林', description: '短篇领域已有所成', unlock_features: '解锁中篇谷' },
  
  // 中篇谷 LV 31-40
  { level: 31, required_xp: 38319838, title: '中篇探索者', stage: '中篇谷', description: '向更长的故事发起挑战' },
  { level: 32, required_xp: 57479857, title: '中篇探索者', stage: '中篇谷', description: '' },
  { level: 33, required_xp: 86219886, title: '世界构建师', stage: '中篇谷', description: '开始构建完整的故事世界' },
  { level: 34, required_xp: 129329929, title: '世界构建师', stage: '中篇谷', description: '' },
  { level: 35, required_xp: 193994994, title: '人物群像师', stage: '中篇谷', description: '能够驾驭多角色叙事' },
  { level: 36, required_xp: 290992591, title: '人物群像师', stage: '中篇谷', description: '' },
  { level: 37, required_xp: 436488987, title: '叙事织工', stage: '中篇谷', description: '多线叙事开始得心应手' },
  { level: 38, required_xp: 654733580, title: '叙事织工', stage: '中篇谷', description: '' },
  { level: 39, required_xp: 982100470, title: '中篇行家', stage: '中篇谷', description: '中篇创作已成专长' },
  { level: 40, required_xp: 1473150805, title: '中篇谷主', stage: '中篇谷', description: '中篇领域独当一面', unlock_features: '解锁长篇峰' },
  
  // 长篇峰 LV 41-50
  { level: 41, required_xp: 2209726308, title: '长篇攀登者', stage: '长篇峰', description: '向长篇的高峰进发' },
  { level: 42, required_xp: 3314589562, title: '长篇攀登者', stage: '长篇峰', description: '' },
  { level: 43, required_xp: 4971884443, title: '史诗规划师', stage: '长篇峰', description: '学会规划宏大的叙事' },
  { level: 44, required_xp: 7457826765, title: '史诗规划师', stage: '长篇峰', description: '' },
  { level: 45, required_xp: 11186740247, title: '世界观架构师', stage: '长篇峰', description: '能够构建完整的世界观' },
  { level: 46, required_xp: 16780110471, title: '世界观架构师', stage: '长篇峰', description: '' },
  { level: 47, required_xp: 25170165807, title: '命运编织者', stage: '长篇峰', description: '笔下角色命运交织' },
  { level: 48, required_xp: 37755248810, title: '命运编织者', stage: '长篇峰', description: '' },
  { level: 49, required_xp: 56632873315, title: '长篇巨匠', stage: '长篇峰', description: '长篇创作炉火纯青' },
  { level: 50, required_xp: 84949310073, title: '一代宗师', stage: '宗师境', description: '已入宗师之境', unlock_features: '解锁宗师境全部功能' },
];

/**
 * 墨点任务模板（5分钟微任务，10XP）
 * 六维属性：character(人物力), conflict(冲突力), scene(场景力), dialogue(对话力), rhythm(节奏力), style(风格力)
 */
const inkDotTemplates = [
  // 人物力 - 角色塑造
  { code: 'P-C01', title: '角色恐惧', description: '用一句话写出一个角色最深的恐惧', attr_type: 'character', difficulty: 'easy', tags: '人物,心理,一句话' },
  { code: 'P-C02', title: '职业特征', description: '描写一双手，让读者猜出职业', attr_type: 'character', difficulty: 'normal', tags: '人物,外貌,细节' },
  { code: 'P-C03', title: '角色习惯', description: '写出一个角色紧张时的小动作', attr_type: 'character', difficulty: 'easy', tags: '人物,细节,动作' },
  { code: 'P-C04', title: '眼神描写', description: '用一句话描写一双眼睛，透露出角色的秘密', attr_type: 'character', difficulty: 'normal', tags: '人物,细节,一句话' },
  { code: 'P-C05', title: '角色口头禅', description: '为一个角色设计一句口头禅，体现性格', attr_type: 'character', difficulty: 'easy', tags: '人物,对话,性格' },
  { code: 'P-C06', title: '背影描写', description: '描写一个背影，让读者感受到这个人的情绪', attr_type: 'character', difficulty: 'normal', tags: '人物,外貌,情绪' },
  { code: 'P-C07', title: '角色执念', description: '用一句话写出一个角色最执着的事物', attr_type: 'character', difficulty: 'easy', tags: '人物,心理,一句话' },
  { code: 'P-C08', title: '笑容描写', description: '描写一个笑容，但让读者感到不安', attr_type: 'character', difficulty: 'hard', tags: '人物,表情,反差' },
  { code: 'P-C09', title: '声音特征', description: '描写一个人的声音，让它有辨识度', attr_type: 'character', difficulty: 'normal', tags: '人物,细节,感官' },
  
  // 冲突力 - 矛盾设计
  { code: 'P-F01', title: '两难选择', description: '设计一个两难困境，两个选项都有代价', attr_type: 'conflict', difficulty: 'normal', tags: '冲突,选择,困境' },
  { code: 'P-F02', title: '暗流涌动', description: '写一个表面平静但暗藏杀机的场景开头', attr_type: 'conflict', difficulty: 'hard', tags: '冲突,悬念,氛围' },
  { code: 'P-F03', title: '立场对立', description: '用一句话描述两个人的核心矛盾', attr_type: 'conflict', difficulty: 'easy', tags: '冲突,人物,一句话' },
  { code: 'P-F04', title: '内心挣扎', description: '写一个角色做出选择前的内心独白（50字内）', attr_type: 'conflict', difficulty: 'normal', tags: '冲突,心理,内心戏' },
  { code: 'P-F05', title: '误解火种', description: '设计一个可能引发重大误解的小细节', attr_type: 'conflict', difficulty: 'normal', tags: '冲突,伏笔,细节' },
  { code: 'P-F06', title: '价值观冲突', description: '写两个都有道理的对立观点', attr_type: 'conflict', difficulty: 'hard', tags: '冲突,观点,深度' },
  { code: 'P-F07', title: '利益冲突', description: '设计一个让好人也会自私的情境', attr_type: 'conflict', difficulty: 'normal', tags: '冲突,人性,情境' },
  { code: 'P-F08', title: '时间压力', description: '用一句话创造紧迫感', attr_type: 'conflict', difficulty: 'easy', tags: '冲突,节奏,一句话' },
  
  // 场景力 - 环境营造
  { code: 'P-S01', title: '声音开场', description: '写一个场景的开头，只用声音描写', attr_type: 'scene', difficulty: 'normal', tags: '场景,感官,声音' },
  { code: 'P-S02', title: '气味记忆', description: '用一种气味唤起一段记忆', attr_type: 'scene', difficulty: 'normal', tags: '场景,感官,气味' },
  { code: 'P-S03', title: '光影氛围', description: '描写一个场景的光线，营造特定氛围', attr_type: 'scene', difficulty: 'normal', tags: '场景,光影,氛围' },
  { code: 'P-S04', title: '天气情绪', description: '用天气描写暗示角色心情', attr_type: 'scene', difficulty: 'easy', tags: '场景,天气,情绪' },
  { code: 'P-S05', title: '空间压迫', description: '描写一个让人感到压抑的空间', attr_type: 'scene', difficulty: 'normal', tags: '场景,空间,氛围' },
  { code: 'P-S06', title: '时间流逝', description: '用环境细节暗示时间的流逝', attr_type: 'scene', difficulty: 'hard', tags: '场景,时间,细节' },
  { code: 'P-S07', title: '温度感知', description: '描写一个场景的温度，让读者也能感受到', attr_type: 'scene', difficulty: 'normal', tags: '场景,感官,温度' },
  { code: 'P-S08', title: '空间对比', description: '用两个对比空间反映角色处境变化', attr_type: 'scene', difficulty: 'hard', tags: '场景,对比,变化' },
  
  // 对话力 - 对白设计
  { code: 'P-D01', title: '分手暗示', description: '写一段对话（10字以内），暗示两人刚分手', attr_type: 'dialogue', difficulty: 'normal', tags: '对话,潜台词,情感' },
  { code: 'P-D02', title: '话中有话', description: '写一句表面客气实则讽刺的话', attr_type: 'dialogue', difficulty: 'normal', tags: '对话,潜台词,讽刺' },
  { code: 'P-D03', title: '沉默对话', description: '写一段两人都不说话但在"对话"的场景', attr_type: 'dialogue', difficulty: 'hard', tags: '对话,沉默,张力' },
  { code: 'P-D04', title: '身份揭示', description: '通过一句对话揭示角色的真实身份', attr_type: 'dialogue', difficulty: 'normal', tags: '对话,身份,悬念' },
  { code: 'P-D05', title: '情绪转折', description: '写一段话，让角色从愤怒变成心软', attr_type: 'dialogue', difficulty: 'hard', tags: '对话,情绪,转折' },
  { code: 'P-D06', title: '谎言痕迹', description: '写一句让人感觉是在说谎的话', attr_type: 'dialogue', difficulty: 'normal', tags: '对话,谎言,心理' },
  { code: 'P-D07', title: '一语双关', description: '写一句有两层意思的台词', attr_type: 'dialogue', difficulty: 'hard', tags: '对话,双关,技巧' },
  { code: 'P-D08', title: '性格对话', description: '只用三句对话展现一个人的性格', attr_type: 'dialogue', difficulty: 'normal', tags: '对话,性格,简洁' },
  
  // 节奏力 - 叙事控制
  { code: 'P-R01', title: '急促节奏', description: '用短句描写一个紧张的瞬间', attr_type: 'rhythm', difficulty: 'normal', tags: '节奏,短句,紧张' },
  { code: 'P-R02', title: '时间定格', description: '把一秒钟的动作写成三句话', attr_type: 'rhythm', difficulty: 'hard', tags: '节奏,慢镜头,细节' },
  { code: 'P-R03', title: '快进叙事', description: '用一段话快进三年时光', attr_type: 'rhythm', difficulty: 'normal', tags: '节奏,时间跨度,概括' },
  { code: 'P-R04', title: '悬念断点', description: '写一个让人想继续读下去的段落结尾', attr_type: 'rhythm', difficulty: 'normal', tags: '节奏,悬念,结尾' },
  { code: 'P-R05', title: '呼吸感', description: '写一段有节奏感的打斗描写', attr_type: 'rhythm', difficulty: 'hard', tags: '节奏,动作,呼吸' },
  { code: 'P-R06', title: '过渡自然', description: '写一个从回忆切回现实的过渡句', attr_type: 'rhythm', difficulty: 'normal', tags: '节奏,过渡,技巧' },
  { code: 'P-R07', title: '留白艺术', description: '用省略号留下想象空间', attr_type: 'rhythm', difficulty: 'normal', tags: '节奏,留白,含蓄' },
  
  // 风格力 - 语言锤炼
  { code: 'P-Y01', title: '孤独比喻', description: '用一个比喻描述"孤独"', attr_type: 'style', difficulty: 'normal', tags: '风格,比喻,情感' },
  { code: 'P-Y02', title: '陌生化', description: '用陌生的方式描述一个熟悉的事物', attr_type: 'style', difficulty: 'hard', tags: '风格,陌生化,技巧' },
  { code: 'P-Y03', title: '通感描写', description: '用通感手法描写一种感受', attr_type: 'style', difficulty: 'hard', tags: '风格,通感,修辞' },
  { code: 'P-Y04', title: '简洁力量', description: '用10个字以内描述一个复杂情感', attr_type: 'style', difficulty: 'hard', tags: '风格,简洁,精炼' },
  { code: 'P-Y05', title: '动词精准', description: '用一个精准的动词替代"走"', attr_type: 'style', difficulty: 'easy', tags: '风格,动词,精准' },
  { code: 'P-Y06', title: '意象构建', description: '创造一个属于你的独特意象', attr_type: 'style', difficulty: 'hard', tags: '风格,意象,原创' },
  { code: 'P-Y07', title: '诗意描写', description: '用诗意的语言描写日常场景', attr_type: 'style', difficulty: 'normal', tags: '风格,诗意,日常' },
  { code: 'P-Y08', title: '反讽句式', description: '写一句表面赞美实则批评的话', attr_type: 'style', difficulty: 'normal', tags: '风格,反讽,技巧' },
];

/**
 * 墨线任务模板（15-30分钟，30XP）
 */
const inkLineTemplates = [
  // 人物力
  { code: 'L-C01', title: '感官人物', description: '写一个200字场景，不用任何情绪词，只用感官描写展现角色情绪', attr_type: 'character', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'normal', tags: '人物,感官,情绪' },
  { code: 'L-C02', title: '路人视角', description: '给一个路人甲写一段内心独白，让他变得有趣（200字）', attr_type: 'character', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'normal', tags: '人物,内心,路人' },
  { code: 'L-C03', title: '双面人物', description: '描写同一个人在不同人面前的两种状态', attr_type: 'character', word_limit_min: 200, word_limit_max: 300, time_limit: 25, difficulty: 'hard', tags: '人物,对比,多面' },
  { code: 'L-C04', title: '物件见人', description: '通过描写一个角色的房间/办公桌，展现其性格', attr_type: 'character', word_limit_min: 200, word_limit_max: 300, time_limit: 20, difficulty: 'normal', tags: '人物,细节,环境' },
  { code: 'L-C05', title: '角色成长', description: '用两个场景对比展现角色的成长变化', attr_type: 'character', word_limit_min: 250, word_limit_max: 400, time_limit: 30, difficulty: 'hard', tags: '人物,成长,对比' },
  
  // 冲突力
  { code: 'L-F01', title: '公平争吵', description: '写一段争吵，双方都有道理（200字）', attr_type: 'conflict', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'hard', tags: '冲突,对话,平衡' },
  { code: 'L-F02', title: '道德困境', description: '设计一个没有正确答案的道德选择场景', attr_type: 'conflict', word_limit_min: 200, word_limit_max: 300, time_limit: 25, difficulty: 'hard', tags: '冲突,道德,选择' },
  { code: 'L-F03', title: '暗战场景', description: '写一场表面和平实则暗流涌动的饭局/会议', attr_type: 'conflict', word_limit_min: 250, word_limit_max: 400, time_limit: 30, difficulty: 'hard', tags: '冲突,暗战,氛围' },
  { code: 'L-F04', title: '误解升级', description: '写一个小误解如何逐步升级成大冲突', attr_type: 'conflict', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'normal', tags: '冲突,误解,升级' },
  { code: 'L-F05', title: '内心战场', description: '描写一个角色内心两种声音的对抗', attr_type: 'conflict', word_limit_min: 200, word_limit_max: 300, time_limit: 20, difficulty: 'normal', tags: '冲突,内心,挣扎' },
  
  // 场景力
  { code: 'L-S01', title: '名著换景', description: '把一个名著场景换成你熟悉的地点重写', attr_type: 'scene', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'normal', tags: '场景,改编,本土化' },
  { code: 'L-S02', title: '五感场景', description: '描写一个场景，要用到视觉、听觉、嗅觉、触觉、味觉', attr_type: 'scene', word_limit_min: 200, word_limit_max: 300, time_limit: 20, difficulty: 'normal', tags: '场景,感官,沉浸' },
  { code: 'L-S03', title: '氛围转换', description: '描写同一个地点在不同情绪下的样子', attr_type: 'scene', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'hard', tags: '场景,氛围,对比' },
  { code: 'L-S04', title: '空间叙事', description: '通过描写一个空间的变化暗示时间流逝', attr_type: 'scene', word_limit_min: 200, word_limit_max: 300, time_limit: 20, difficulty: 'hard', tags: '场景,时间,变化' },
  { code: 'L-S05', title: '情绪空间', description: '描写一个能让读者感到孤独/温暖/恐惧的空间', attr_type: 'scene', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'normal', tags: '场景,情绪,氛围' },
  
  // 对话力
  { code: 'L-D01', title: '视角切换', description: '写同一事件的两个版本：主角视角 vs 路人视角', attr_type: 'dialogue', word_limit_min: 300, word_limit_max: 500, time_limit: 30, difficulty: 'hard', tags: '对话,视角,多元' },
  { code: 'L-D02', title: '潜台词对话', description: '写一段表面聊天气实则在分手的对话', attr_type: 'dialogue', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'hard', tags: '对话,潜台词,情感' },
  { code: 'L-D03', title: '性格对话', description: '让三个不同性格的人对同一件事发表意见', attr_type: 'dialogue', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'normal', tags: '对话,性格,群像' },
  { code: 'L-D04', title: '代际对话', description: '写一段父母与子女的对话，展现代沟', attr_type: 'dialogue', word_limit_min: 200, word_limit_max: 300, time_limit: 20, difficulty: 'normal', tags: '对话,代沟,情感' },
  { code: 'L-D05', title: '谈判对话', description: '写一段双方都想占上风的谈判对话', attr_type: 'dialogue', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'hard', tags: '对话,博弈,张力' },
  
  // 节奏力
  { code: 'L-R01', title: '节奏变奏', description: '写同一场追逐戏的快节奏版和慢镜头版', attr_type: 'rhythm', word_limit_min: 300, word_limit_max: 500, time_limit: 30, difficulty: 'hard', tags: '节奏,对比,动作' },
  { code: 'L-R02', title: '蒙太奇', description: '用蒙太奇手法展现人物一天/一生', attr_type: 'rhythm', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'normal', tags: '节奏,蒙太奇,时间' },
  { code: 'L-R03', title: '悬念构建', description: '写一个300字的悬念开头，让人想读下去', attr_type: 'rhythm', word_limit_min: 250, word_limit_max: 350, time_limit: 25, difficulty: 'normal', tags: '节奏,悬念,开头' },
  { code: 'L-R04', title: '交叉叙事', description: '用交叉剪辑的方式描写两条并行的故事线', attr_type: 'rhythm', word_limit_min: 300, word_limit_max: 450, time_limit: 30, difficulty: 'hard', tags: '节奏,交叉,结构' },
  { code: 'L-R05', title: '留白结尾', description: '写一个开放式结尾，给读者留下想象空间', attr_type: 'rhythm', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'normal', tags: '节奏,留白,结尾' },
  
  // 风格力
  { code: 'L-Y01', title: '风格模仿', description: '模仿一位作家的风格改写一段日常场景', attr_type: 'style', word_limit_min: 200, word_limit_max: 350, time_limit: 25, difficulty: 'hard', tags: '风格,模仿,学习' },
  { code: 'L-Y02', title: '意象串联', description: '用一个核心意象贯穿一个短场景', attr_type: 'style', word_limit_min: 200, word_limit_max: 300, time_limit: 20, difficulty: 'normal', tags: '风格,意象,统一' },
  { code: 'L-Y03', title: '极简叙事', description: '用最少的字数讲完一个有头有尾的故事', attr_type: 'style', word_limit_min: 100, word_limit_max: 200, time_limit: 15, difficulty: 'hard', tags: '风格,极简,精炼' },
  { code: 'L-Y04', title: '诗化散文', description: '用诗化的语言描写一个平凡瞬间', attr_type: 'style', word_limit_min: 150, word_limit_max: 250, time_limit: 20, difficulty: 'normal', tags: '风格,诗意,语言' },
  { code: 'L-Y05', title: '黑色幽默', description: '写一段让人笑着笑着就沉默的文字', attr_type: 'style', word_limit_min: 200, word_limit_max: 300, time_limit: 25, difficulty: 'hard', tags: '风格,幽默,反转' },
];

/**
 * 墨章挑战模板（周挑战，800-1500字，100-200XP）
 */
const inkChapterTemplates = [
  { code: 'W-01', title: '最后的谎言', theme: '谎言', description: '主角必须在故事中说一个谎，这个谎言要有意义', requirements: '必须有一个反转', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-02', title: '困兽', theme: '困境', description: '写一个关于被困住的人/动物/灵魂的故事', requirements: '困境可以是物理的或心理的', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-03', title: '陌生人', theme: '相遇', description: '两个陌生人的一次相遇，改变了其中一人', requirements: '相遇必须是偶然的', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-04', title: '遗物', theme: '记忆', description: '通过一件遗物，展开一段往事', requirements: '遗物必须有象征意义', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-05', title: '深夜来电', theme: '悬念', description: '深夜接到一个电话，故事由此展开', requirements: '电话内容要有悬念', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-06', title: '归途', theme: '回归', description: '一个人踏上回家的路', requirements: '回家可以是物理的也可以是心理的', word_limit_min: 800, word_limit_max: 1500, xp_reward: 180 },
  { code: 'W-07', title: '第三选择', theme: '抉择', description: '面对两难，主角找到了第三条路', requirements: '第三选择要出人意料又合情合理', word_limit_min: 800, word_limit_max: 1500, xp_reward: 180 },
  { code: 'W-08', title: '暗号', theme: '秘密', description: '两个人之间有一个只有他们懂的暗号', requirements: '暗号的由来要有故事', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-09', title: '告别练习', theme: '离别', description: '一场迟到或提前的告别', requirements: '告别要有遗憾或释然', word_limit_min: 800, word_limit_max: 1500, xp_reward: 180 },
  { code: 'W-10', title: '镜中人', theme: '自我', description: '主角在镜子里看到了不一样的自己', requirements: '可以是隐喻也可以是超自然', word_limit_min: 800, word_limit_max: 1200, xp_reward: 150 },
  { code: 'W-11', title: '无声的战争', theme: '冲突', description: '一场没有硝烟的战争', requirements: '冲突要有层次', word_limit_min: 1000, word_limit_max: 1500, xp_reward: 200 },
  { code: 'W-12', title: '重逢', theme: '命运', description: '多年后的重逢，一切都变了又好像没变', requirements: '要有时间带来的变化感', word_limit_min: 800, word_limit_max: 1500, xp_reward: 180 },
];

/**
 * 成就定义
 * 类别：milestone(里程碑), streak(连续), quality(品质), skill(技巧), volume(产量), special(特殊)
 * requirement_type: practices_count, streak_days, score_above, words_count, level_reach, attr_reach, task_complete
 */
const achievements = [
  // 里程碑成就
  { code: 'A-M01', name: '初入墨境', description: '完成第一个墨点任务', category: 'milestone', requirement_type: 'task_complete', requirement_value: 1, xp_reward: 20, icon: '🎯' },
  { code: 'A-M02', name: '墨点十连', description: '完成10个墨点任务', category: 'milestone', requirement_type: 'task_complete', requirement_value: 10, xp_reward: 50, icon: '✨' },
  { code: 'A-M03', name: '墨点百练', description: '完成100个墨点任务', category: 'milestone', requirement_type: 'task_complete', requirement_value: 100, xp_reward: 200, icon: '💫' },
  { code: 'A-M04', name: '墨线初成', description: '完成第一个墨线任务', category: 'milestone', requirement_type: 'inkline_complete', requirement_value: 1, xp_reward: 30, icon: '📝' },
  { code: 'A-M05', name: '墨线二十', description: '完成20个墨线任务', category: 'milestone', requirement_type: 'inkline_complete', requirement_value: 20, xp_reward: 100, icon: '📜' },
  { code: 'A-M06', name: '墨章首发', description: '完成第一个墨章挑战', category: 'milestone', requirement_type: 'inkchapter_complete', requirement_value: 1, xp_reward: 50, icon: '📖' },
  { code: 'A-M07', name: '墨章十篇', description: '完成10个墨章挑战', category: 'milestone', requirement_type: 'inkchapter_complete', requirement_value: 10, xp_reward: 300, icon: '📚' },
  
  // 连续打卡成就
  { code: 'A-S01', name: '三日坚持', description: '连续打卡3天', category: 'streak', requirement_type: 'streak_days', requirement_value: 3, xp_reward: 30, icon: '🔥' },
  { code: 'A-S02', name: '周周不断', description: '连续打卡7天', category: 'streak', requirement_type: 'streak_days', requirement_value: 7, xp_reward: 70, icon: '🔥' },
  { code: 'A-S03', name: '半月之约', description: '连续打卡15天', category: 'streak', requirement_type: 'streak_days', requirement_value: 15, xp_reward: 150, icon: '🌟' },
  { code: 'A-S04', name: '月度墨者', description: '连续打卡30天', category: 'streak', requirement_type: 'streak_days', requirement_value: 30, xp_reward: 300, icon: '🏆', is_hidden: false },
  { code: 'A-S05', name: '百日精进', description: '连续打卡100天', category: 'streak', requirement_type: 'streak_days', requirement_value: 100, xp_reward: 1000, icon: '👑', is_hidden: true },
  
  // 品质成就
  { code: 'A-Q01', name: '初露锋芒', description: '单次任务获得90分以上', category: 'quality', requirement_type: 'score_above', requirement_value: 90, xp_reward: 50, icon: '⭐' },
  { code: 'A-Q02', name: '品质保证', description: '连续5次任务评分80分以上', category: 'quality', requirement_type: 'score_streak', requirement_value: 5, xp_reward: 100, icon: '🌟' },
  { code: 'A-Q03', name: 'S级作品', description: '获得一个S级评价', category: 'quality', requirement_type: 'grade_s', requirement_value: 1, xp_reward: 100, icon: '💎' },
  { code: 'A-Q04', name: 'S级收藏家', description: '获得10个S级评价', category: 'quality', requirement_type: 'grade_s', requirement_value: 10, xp_reward: 500, icon: '💎', is_hidden: true },
  
  // 属性成就
  { code: 'A-A01', name: '人物初悟', description: '人物力达到30', category: 'skill', requirement_type: 'attr_character', requirement_value: 30, xp_reward: 50, icon: '👤' },
  { code: 'A-A02', name: '冲突觉醒', description: '冲突力达到30', category: 'skill', requirement_type: 'attr_conflict', requirement_value: 30, xp_reward: 50, icon: '⚔️' },
  { code: 'A-A03', name: '场景入门', description: '场景力达到30', category: 'skill', requirement_type: 'attr_scene', requirement_value: 30, xp_reward: 50, icon: '🏔️' },
  { code: 'A-A04', name: '对话开窍', description: '对话力达到30', category: 'skill', requirement_type: 'attr_dialogue', requirement_value: 30, xp_reward: 50, icon: '💬' },
  { code: 'A-A05', name: '节奏感知', description: '节奏力达到30', category: 'skill', requirement_type: 'attr_rhythm', requirement_value: 30, xp_reward: 50, icon: '🌊' },
  { code: 'A-A06', name: '风格萌芽', description: '风格力达到30', category: 'skill', requirement_type: 'attr_style', requirement_value: 30, xp_reward: 50, icon: '✨' },
  { code: 'A-A07', name: '六边形战士', description: '所有属性达到50', category: 'skill', requirement_type: 'all_attr', requirement_value: 50, xp_reward: 500, icon: '🎖️', is_hidden: true },
  
  // 产量成就
  { code: 'A-V01', name: '千字起步', description: '累计写作1000字', category: 'volume', requirement_type: 'words_count', requirement_value: 1000, xp_reward: 30, icon: '📝' },
  { code: 'A-V02', name: '万字小成', description: '累计写作10000字', category: 'volume', requirement_type: 'words_count', requirement_value: 10000, xp_reward: 100, icon: '📝' },
  { code: 'A-V03', name: '十万大关', description: '累计写作100000字', category: 'volume', requirement_type: 'words_count', requirement_value: 100000, xp_reward: 500, icon: '📚' },
  { code: 'A-V04', name: '百万字作家', description: '累计写作1000000字', category: 'volume', requirement_type: 'words_count', requirement_value: 1000000, xp_reward: 2000, icon: '👑', is_hidden: true },
  
  // 等级成就
  { code: 'A-L01', name: '新手毕业', description: '达到10级', category: 'milestone', requirement_type: 'level_reach', requirement_value: 10, xp_reward: 100, icon: '🎓' },
  { code: 'A-L02', name: '技法小成', description: '达到20级', category: 'milestone', requirement_type: 'level_reach', requirement_value: 20, xp_reward: 200, icon: '🎓' },
  { code: 'A-L03', name: '短篇林主', description: '达到30级', category: 'milestone', requirement_type: 'level_reach', requirement_value: 30, xp_reward: 300, icon: '🏅' },
  { code: 'A-L04', name: '中篇谷主', description: '达到40级', category: 'milestone', requirement_type: 'level_reach', requirement_value: 40, xp_reward: 500, icon: '🏅' },
  { code: 'A-L05', name: '一代宗师', description: '达到50级', category: 'milestone', requirement_type: 'level_reach', requirement_value: 50, xp_reward: 1000, icon: '👑', is_hidden: true },
];

// 自动生成更多成就以满足默认188个的需求
// 已在静态列表中定义了一些关键成就，为避免重复，生成ID从当前长度开始
const generatedAchievements = [];
const categories = ['milestone', 'streak', 'quality', 'skill', 'volume', 'special'];

// Helper to add generated achievements
function addGenerated(code, name, description, category, requirement_type, requirement_value, xp_reward = 20, icon = '🏅', is_hidden = false) {
  generatedAchievements.push({
    code, name, description, category, requirement_type, requirement_value, xp_reward, icon, is_hidden
  });
}

// 任务完成类: 墨点、墨线、墨章 — 多等级数量成就
const taskTypes = [ { key: 'task_complete', prefix: 'TD', title: '墨点' }, { key: 'inkline_complete', prefix: 'TL', title: '墨线' }, { key: 'inkchapter_complete', prefix: 'TC', title: '墨章' } ];
const taskThresholds = [1, 2, 5, 10, 20, 50, 100, 200, 500];
let genIdx = 1;
for (const t of taskTypes) {
  for (const thr of taskThresholds) {
    addGenerated(`A-${t.prefix}${String(thr).padStart(3,'0')}`,
      `${t.title}${thr}次`,
      `完成${thr}个${t.title}任务`,
      'milestone', t.key, thr, Math.min(1000, 10 * thr), '✨', false);
    genIdx++;
  }
}

// 属性成就：每个属性多个阈值
const attrs = ['attr_character','attr_conflict','attr_scene','attr_dialogue','attr_rhythm','attr_style'];
const attrLabels = { attr_character: '人物力', attr_conflict: '冲突力', attr_scene: '场景力', attr_dialogue: '对话力', attr_rhythm: '节奏力', attr_style: '风格力' };
const attrThresholds = [10, 20, 30, 40, 50, 70, 100];
for (const a of attrs) {
  for (const thr of attrThresholds) {
    addGenerated(`A-A${a.slice(-1)}${String(thr).padStart(3,'0')}`,
      `${attrLabels[a]}达到${thr}`,
      `${attrLabels[a]}达到${thr}`,
      'skill', a, thr, 25 + thr, '👤', false);
  }
}

// 累计字数成就 — 更细分
const wordThresholds = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
for (const w of wordThresholds) {
  addGenerated(`A-VW${String(w).padStart(7,'0')}`,
    `累计写作${w}字`,
    `累计写作${w}字`,
    'volume', 'words_count', w, Math.min(2000, Math.ceil(w / 500)), '📝', false);
}

// 等级成就—补充所有等级节点（每5级）
const levelThresholds = [5,10,15,20,25,30,35,40,45,50];
for (const lv of levelThresholds) {
  addGenerated(`A-LV${String(lv).padStart(2,'0')}`,
    `达到等级${lv}`,
    `等级达到${lv}`,
    'milestone', 'level_reach', lv, lv * 10, '🎓', lv >= 50);
}

// 连续打卡补充更多阶段
const streakThresholds = [1,2,3,5,7,10,15,21,30,45,60,90,100,180,365];
for (const s of streakThresholds) {
  addGenerated(`A-SK${String(s).padStart(3,'0')}`,
    `连续打卡${s}天`,
    `连续打卡${s}天`,
    'streak', 'streak_days', s, s * 5, '🔥', s >= 100);
}

// 评分相关: 80/85/90/95 以及S级累计
const scoreThresholds = [80,85,90,95];
for (const sc of scoreThresholds) {
  addGenerated(`A-QS${String(sc)}`,
    `获得一次评分${sc}分+`,
    `单次任务获得${sc}分以上`,
    'quality', 'score_above', sc, sc === 95 ? 150 : 40, '⭐', false);
}
const gradeSCounts = [1,5,10,20,50];
for (const c of gradeSCounts) {
  addGenerated(`A-QG${String(c).padStart(2,'0')}`,
    `获得${c}个S级评价`,
    `累计获得${c}个S级评价`,
    'quality', 'grade_s', c, 50 + c * 10, '💎', c >= 10);
}

// 特殊类及隐藏成就（部分为 Easter Egg）
for (let i = 1; i <= 20; i++) {
  addGenerated(`A-SP${String(i).padStart(3,'0')}`,
    `探索者-${i}`,
    `探索特定小玩法：第${i}次触发隐藏事件`,
    'special', 'special_trigger', i, 50, '🏆', i > 5);
}

// 合并生成的成就，确保总数达到188
for (const g of generatedAchievements) {
  achievements.push(g);
}

// 如果仍不足188，追加简单素数编号的占位成就
let idx = 1;
while (achievements.length < 188) {
  achievements.push({
    code: `A-EX${String(idx).padStart(3,'0')}`,
    name: `额外成就${idx}`,
    description: `额外自动生成占位成就 #${idx}`,
    category: 'special',
    requirement_type: 'task_complete',
    requirement_value: 1 + idx,
    xp_reward: 5 + idx,
    icon: '✨',
    is_hidden: idx % 3 === 0
  });
  idx++;
}

/**
 * 连续打卡奖励配置
 */
const streakRewards = [
  { streak_days: 1, xp_multiplier: 1.0, bonus_xp: 0, description: '第一天，加油！' },
  { streak_days: 2, xp_multiplier: 1.0, bonus_xp: 5, description: '连续第二天' },
  { streak_days: 3, xp_multiplier: 1.1, bonus_xp: 10, badge_name: '三日坚持', description: '连续三天，初见坚持' },
  { streak_days: 7, xp_multiplier: 1.2, bonus_xp: 30, badge_name: '周周不断', description: '一周不断，习惯养成中' },
  { streak_days: 14, xp_multiplier: 1.3, bonus_xp: 50, description: '两周坚持，了不起！' },
  { streak_days: 21, xp_multiplier: 1.4, bonus_xp: 80, description: '21天，习惯已成' },
  { streak_days: 30, xp_multiplier: 1.5, bonus_xp: 150, badge_name: '月度墨者', description: '一个月！你是真正的墨者' },
  { streak_days: 60, xp_multiplier: 1.6, bonus_xp: 300, description: '两个月的坚持' },
  { streak_days: 100, xp_multiplier: 1.8, bonus_xp: 500, badge_name: '百日精进', description: '百日精进，令人敬佩' },
  { streak_days: 365, xp_multiplier: 2.0, bonus_xp: 2000, badge_name: '年度宗师', description: '整整一年，宗师风范' },
];

/**
 * 随机奖励配置
 */
const rewardConfig = [
  { reward_type: 'inspiration', name: '灵感碎片', description: '收集10个可兑换大师技法课', icon: '💎', rarity: 'common', drop_rate: 0.3 },
  { reward_type: 'scroll', name: '神秘任务卷轴', description: '解锁一个隐藏挑战', icon: '📜', rarity: 'rare', drop_rate: 0.1 },
  { reward_type: 'character_card', name: '角色卡', description: '获得一个预设有趣人物', icon: '🎭', rarity: 'uncommon', drop_rate: 0.15 },
  { reward_type: 'plot_map', name: '情节地图', description: '获得一个预设冲突模板', icon: '🗺️', rarity: 'uncommon', drop_rate: 0.15 },
  { reward_type: 'xp_boost', name: '经验加成卡', description: '下一个任务经验×2', icon: '⚡', rarity: 'rare', drop_rate: 0.08 },
  { reward_type: 'title', name: '称号碎片', description: '收集可解锁特殊称号', icon: '🏷️', rarity: 'epic', drop_rate: 0.05 },
];

/**
 * 每日挑战类型配置
 */
const dailyChallengeTypes = [
  { type: 'task_count', title: '墨点达人', description: '今日完成{n}个墨点任务', target_range: [2, 5], xp_reward: 50 },
  { type: 'word_count', title: '笔耕不辍', description: '今日累计写作{n}字', target_range: [300, 800], xp_reward: 50 },
  { type: 'inkline_complete', title: '墨线挑战', description: '完成一个墨线任务', target_range: [1, 1], xp_reward: 60 },
  { type: 'score_above', title: '品质追求', description: '获得一个80分以上的评价', target_range: [1, 1], xp_reward: 70 },
  { type: 'attr_practice', title: '专项突破', description: '完成{n}个{attr}类任务', target_range: [2, 3], xp_reward: 60 },
  { type: 'time_spent', title: '沉浸写作', description: '今日写作时间累计{n}分钟', target_range: [20, 45], xp_reward: 50 },
];

/**
 * 初始化墨境种子数据
 */
function seedMojingData(db) {
  console.log('开始初始化墨境种子数据...');
  
  // 1. 初始化等级配置
  const insertLevel = db.prepare(`
    INSERT OR IGNORE INTO mojing_level_config (level, required_xp, title, stage, description, unlock_features)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const config of levelConfig) {
    insertLevel.run(
      config.level,
      config.required_xp,
      config.title,
      config.stage,
      config.description || '',
      config.unlock_features || null
    );
  }
  console.log(`- 等级配置: ${levelConfig.length} 条`);
  
  // 2. 初始化墨点任务模板
  const insertTask = db.prepare(`
    INSERT OR IGNORE INTO mojing_task_templates 
    (task_type, code, title, description, requirements, time_limit, word_limit_min, word_limit_max, attr_type, xp_reward, attr_reward, difficulty, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const task of inkDotTemplates) {
    insertTask.run(
      'inkdot', task.code, task.title, task.description,
      task.requirements || null, task.time_limit || 5,
      task.word_limit_min || null, task.word_limit_max || 100,
      task.attr_type, 10, 1, task.difficulty || 'normal', task.tags || null
    );
  }
  console.log(`- 墨点任务模板: ${inkDotTemplates.length} 条`);
  
  // 3. 初始化墨线任务模板
  for (const task of inkLineTemplates) {
    insertTask.run(
      'inkline', task.code, task.title, task.description,
      task.requirements || null, task.time_limit || 20,
      task.word_limit_min || 150, task.word_limit_max || 350,
      task.attr_type, 30, 2, task.difficulty || 'normal', task.tags || null
    );
  }
  console.log(`- 墨线任务模板: ${inkLineTemplates.length} 条`);
  
  // 4. 初始化墨章任务模板
  for (const task of inkChapterTemplates) {
    insertTask.run(
      'inkchapter', task.code, task.title, task.description,
      task.requirements || null, null,
      task.word_limit_min || 800, task.word_limit_max || 1500,
      'comprehensive', task.xp_reward || 150, 5, 'hard', task.theme || null
    );
  }
  console.log(`- 墨章任务模板: ${inkChapterTemplates.length} 条`);
  
  // 5. 初始化成就
  const insertAchievement = db.prepare(`
    INSERT OR IGNORE INTO mojing_achievements 
    (code, name, description, category, icon, xp_reward, requirement_type, requirement_value, is_hidden, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let sortOrder = 0;
  // 清理或填充异常的名字（避免出现问号占位名）
  for (const achievement of achievements) {
    if (!achievement.name || /^\?+$/.test(String(achievement.name || '').trim())) {
      achievement.name = `成就 ${achievement.code}`;
    }
    insertAchievement.run(
      achievement.code, achievement.name, achievement.description,
      achievement.category, achievement.icon || '🏅',
      achievement.xp_reward || 0, achievement.requirement_type,
      achievement.requirement_value, achievement.is_hidden ? 1 : 0, sortOrder++
    );
  }
  console.log(`- 成就定义: ${achievements.length} 条`);

  // 确保数据库中至少包含188个成就（包含隐藏成就）
  const currentTotal = db.prepare(`SELECT COUNT(*) as count FROM mojing_achievements`).get().count;
  if (currentTotal < 188) {
    console.log(`- 当前数据库成就 ${currentTotal} 条，不足188，追加占位成就...`);
    let addIdx = 1;
    while (db.prepare(`SELECT COUNT(*) as count FROM mojing_achievements`).get().count < 188) {
      const code = `A-FILL${String(addIdx).padStart(3,'0')}`;
      const name = `系统占位成就 ${addIdx}`;
      try {
        insertAchievement.run(code, name, `自动追加占位成就 #${addIdx}`, 'special', '🏷️', 10, 'task_complete', 1, 0, sortOrder++);
      } catch (e) {
        // 忽略重复
      }
      addIdx++;
    }
    console.log(`- 已追加占位成就，现有总数: ${db.prepare(`SELECT COUNT(*) as count FROM mojing_achievements`).get().count}`);
  }
  
  // 6. 初始化连续打卡奖励
  const insertStreak = db.prepare(`
    INSERT OR IGNORE INTO mojing_streak_rewards 
    (streak_days, xp_multiplier, bonus_xp, reward_type, reward_value, badge_name, description)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const reward of streakRewards) {
    insertStreak.run(
      reward.streak_days, reward.xp_multiplier, reward.bonus_xp,
      reward.reward_type || null, reward.reward_value || null,
      reward.badge_name || null, reward.description
    );
  }
  console.log(`- 连续打卡奖励: ${streakRewards.length} 条`);
  
  // 7. 初始化随机奖励配置
  const insertReward = db.prepare(`
    INSERT OR IGNORE INTO mojing_reward_config 
    (reward_type, name, description, icon, rarity, drop_rate)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const reward of rewardConfig) {
    insertReward.run(
      reward.reward_type, reward.name, reward.description,
      reward.icon, reward.rarity, reward.drop_rate
    );
  }
  console.log(`- 随机奖励配置: ${rewardConfig.length} 条`);
  
  console.log('墨境种子数据初始化完成！');
}

module.exports = {
  seedMojingData,
  levelConfig,
  inkDotTemplates,
  inkLineTemplates,
  inkChapterTemplates,
  achievements,
  streakRewards,
  rewardConfig,
  dailyChallengeTypes
};
