# AI 网络小说写作训练系统 - iFlow 上下文文档

## 项目概述

**AI 网络小说写作训练系统**（AI Novel Trainer）是一个利用 AI 技术帮助网络小说作者提升写作能力的全功能训练平台。系统通过生成针对性练习题目、提供即时 AI 评审反馈，以及游戏化的成长体系，让写作训练变得系统化、可视化和趣味化。

### 核心特色

- 🎯 **AI 驱动的智能训练**：基于多种 AI 模型生成练习题目和评审反馈
- 🎮 **游戏化成长系统**（墨境）：六维属性培养、每日任务、成就系统
- 📚 **拆书学习**：AI 拆书分析 + 手动批注 + 细纲成文练习
- 📖 **多样化练习模式**：写作练习、抄书练习、随心写作、趣味练习
- 📊 **数据可视化统计**：成长轨迹、能力雷达图、练习趋势分析
- 🔧 **灵活的 AI 配置**：支持多套 AI 配置，不同功能可使用不同模型

### 技术架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端层 (Vue 3)                      │
│  Element Plus UI + Pinia + Vue Router + ECharts         │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP/REST API
┌────────────────────┴────────────────────────────────────┐
│                   后端层 (Express.js)                    │
│  路由层 → 服务层 → 数据层                                │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────┴────────────────────────────────────┐
│              数据库层 (SQLite + better-sqlite3)          │
│  用户数据 + 练习记录 + AI 配置 + 游戏化数据              │
└─────────────────────────────────────────────────────────┘
```

### 部署形态

1. **Web 应用**：前后端分离，适合开发和服务器部署
2. **桌面应用**（Electron）：跨平台桌面版（Windows/macOS/Linux）
3. **移动应用**（Capacitor）：支持 Android 移动端

---

## 技术栈详情

### 前端 (`/client`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | 3.5.24 | 核心框架（Composition API） |
| Vite | 7.2.4 | 构建工具 |
| Element Plus | 2.11.8 | UI 组件库 |
| Pinia | 3.0.4 | 状态管理 |
| Vue Router | 4.6.3 | 路由管理 |
| ECharts | 6.0.0 | 数据可视化 |
| Marked | 17.0.1 | Markdown 渲染 |
| Axios | 1.13.2 | HTTP 请求 |
| @vueuse/core | 14.0.0 | Vue 组合式工具库 |

### 后端 (`/server`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Express.js | 5.1.0 | Web 框架 |
| better-sqlite3 | 12.4.6 | SQLite 数据库驱动 |
| cors | 2.8.5 | 跨域支持 |
| multer | 1.4.5-lts.1 | 文件上传 |
| node-cron | 3.0.3 | 定时任务调度 |
| crypto-js | 4.2.0 | 加密工具 |
| dotenv | 17.2.3 | 环境变量管理 |

### 桌面端 (`/desktop`)

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 33.0.0 | 桌面应用框架 |
| electron-builder | 25.1.8 | 打包构建 |
| electron-updater | 6.3.9 | 自动更新 |
| electron-store | 8.1.0 | 本地存储 |

---

## 项目结构

```
ai-novel-trainer1/
├── client/                          # 前端项目（Vue 3）
│   ├── src/
│   │   ├── api/                     # API 请求封装（15个模块）
│   │   │   ├── aiConfig.js          # AI 配置管理
│   │   │   ├── bookAnalysis.js      # 拆书学习
│   │   │   ├── chapters.js          # 章节管理
│   │   │   ├── dictionary.js        # AI 词典
│   │   │   ├── evaluations.js       # 评审管理
│   │   │   ├── freewrite.js         # 随心写作
│   │   │   ├── mojing.js            # 墨境游戏化
│   │   │   ├── practices.js         # 练习管理
│   │   │   ├── prompts.js           # Prompt 模板
│   │   │   ├── questions.js         # 题目管理
│   │   │   ├── settings.js          # 系统设置
│   │   │   ├── skills.js            # 技巧学习
│   │   │   ├── statistics.js        # 数据统计
│   │   │   ├── typing.js            # 抄书练习
│   │   │   └── wordPractice.js      # 趣味练习
│   │   ├── components/              # 通用组件
│   │   ├── views/                   # 页面视图（20+ 页面）
│   │   │   ├── BookAnalysis/        # 拆书学习模块
│   │   │   ├── Chapters/            # 章节管理
│   │   │   ├── Freewrite/           # 随心写作
│   │   │   ├── MoJing/              # 墨境游戏化
│   │   │   ├── Practice/            # 写作练习
│   │   │   ├── Settings/            # 系统设置
│   │   │   ├── Skills/              # 技巧学习
│   │   │   ├── Typing/              # 抄书练习
│   │   │   ├── WordPractice/        # 趣味练习
│   │   │   └── ...                  # 其他页面
│   │   ├── router/                  # 路由配置
│   │   ├── services/                # 本地服务
│   │   │   ├── localApi.js          # 移动端本地 API
│   │   │   └── localDatabase.js     # 移动端本地数据库
│   │   ├── styles/                  # 样式文件
│   │   └── utils/                   # 工具函数
│   ├── android/                     # Android 项目（Capacitor）
│   └── public/                      # 静态资源
│
├── server/                          # 后端项目（Express.js）
│   ├── routes/                      # API 路由（15个模块）
│   │   ├── aiConfig.js              # AI 配置 API
│   │   ├── bookAnalysis.js          # 拆书学习 API
│   │   ├── chapters.js              # 章节管理 API
│   │   ├── dictionary.js            # 词典 API
│   │   ├── evaluations.js           # 评审 API
│   │   ├── freewrite.js             # 随心写作 API
│   │   ├── mojing.js                # 墨境 API
│   │   ├── practices.js             # 练习 API
│   │   ├── prompts.js               # Prompt API
│   │   ├── questions.js             # 题目 API
│   │   ├── settings.js              # 设置 API
│   │   ├── skills.js                # 技巧 API
│   │   ├── statistics.js            # 统计 API
│   │   ├── typing.js                # 抄书 API
│   │   └── wordPractice.js          # 趣味练习 API
│   ├── services/                    # 业务逻辑层
│   │   ├── aiService.js             # AI 调用服务
│   │   ├── achievementService.js    # 成就系统
│   │   ├── inkTaskService.js        # 墨境任务服务
│   │   ├── mistakeService.js        # 错题管理
│   │   ├── notificationService.js   # 通知服务
│   │   ├── reviewPlanService.js     # 复习计划
│   │   ├── schedulerService.js      # 定时调度
│   │   └── xpService.js             # 经验值系统
│   ├── database/                    # 数据库相关
│   │   ├── init.js                  # 数据库初始化
│   │   ├── migrations.js            # 数据库迁移
│   │   └── seeds/                   # 种子数据
│   ├── uploads/                     # 上传文件目录
│   └── app.js                       # 应用入口
│
├── desktop/                         # 桌面应用（Electron）
│   ├── main.js                      # 主进程
│   ├── preload.js                   # 预加载脚本
│   ├── updater.js                   # 自动更新
│   ├── build/                       # 构建资源
│   ├── client-dist/                 # 前端构建产物
│   ├── server/                      # 内嵌后端服务
│   └── scripts/                     # 构建脚本
│
├── docs/                            # 文档目录
├── scripts/                         # 工具脚本
├── RELEASES/                        # 发布文件
└── [配置文件]                       # 各种配置文件
```

---

## 核心功能模块

### 1. AI 配置管理 (`/settings/ai`)

**功能**：
- 支持配置多套 AI 服务（OpenAI、Claude、本地模型等）
- 为不同功能锚点分配不同的 AI 配置
- 测试 AI 连接和模型列表获取
- 支持批量设置功能配置

**AI 功能锚点**：
- `question_generate` - 题目生成
- `evaluation` - 作品评审
- `prompt_test` - Prompt 测试
- `dictionary_search` - 词典查词
- `dictionary_generate` - 词典生成
- `chapter_analysis` - 章节分析
- `book_analysis` - 拆书分析
- `typing_check` - 抄书检查
- `freewrite_evaluation` - 随心写作评审
- `word_practice_generate` - 趣味练习生成
- `skill_evaluation` - 技巧练习评审
- `mojing_evaluation` - 墨境任务评审

### 2. Prompt 模板管理 (`/prompts`)

**功能**：
- 管理系统所有 AI 交互的 Prompt 模板
- 支持版本历史和回滚
- 变量预览和测试运行
- 重置为默认模板

**模板分类**：
- 题目生成类（动作描写、对话描写、场景描写等）
- 评审类（通用评审、专项评审）
- 词典类（查词、生成专题词典）
- 拆书类（章节分析、技巧提取）

### 3. 写作练习 (`/practice`)

**功能**：
- AI 生成多种类型的写作题目
- 富文本编辑器，支持自动保存
- 实时字数统计和计时
- 提交后获得 AI 评审反馈

**题目类型**：
- 动作描写
- 对话描写
- 场景描写
- 情绪描写
- 冲突设计
- 人物塑造
- 节奏控制
- 开头结尾

### 4. 墨境游戏化系统 (`/mojing`)

**核心设计理念**：将延迟反馈、高认知负荷的写作技能学习，改造成即时反馈、令人上瘾的游戏体验。

**六维属性系统**：
```
👤 人物力：塑造角色的能力
🎭 冲突力：设计矛盾对抗的能力
🏔️ 场景力：营造时空氛围的能力
💬 对话力：写活对白的能力
🌊 节奏力：控制叙事快慢的能力
✨ 风格力：形成辨识度的能力
```

**每日任务系统**：
- 🔹 **墨点任务**（5分钟，10经验）：微剂量写作，降低启动门槛
- 🔸 **墨线任务**（20分钟，30经验）：专项技能训练
- 🔶 **墨章任务**（1-2小时，100经验）：完整短篇挑战

**成长机制**：
- 经验值（XP）系统和等级提升
- 连续打卡奖励
- 成就徽章系统
- 能力雷达图可视化
- 练习历史和再次练习功能

**任务特色**：
- 每日自动刷新任务
- 支持再次练习历史任务
- 查看每个任务的所有练习记录
- 按属性筛选和针对性训练

### 5. 拆书学习 (`/book-analysis`)

**功能**：
- **AI 拆书**：上传章节，AI 自动分析写作技巧
- **手动批注**：自己标注和分析章节技巧
- **细纲成文**：基于拆书结果进行细纲填充练习
- **遮蔽练习**：遮蔽原文部分内容，尝试复现
- **练习评审**：AI 对比原文和练习内容，给出评分

**支持的拆书技巧**：
- 人物塑造
- 对话技巧
- 场景描写
- 冲突设计
- 节奏控制
- 情绪渲染
- 伏笔铺垫
- 开头结尾

### 6. 章节管理 (`/chapters`)

**功能**：
- 上传和管理小说章节
- 支持 TXT 文件导入（自动检测编码）
- 章节分析（情节、人物、冲突、节奏等）
- 支持长章节分析（超过 3 万字）
- 章节标签和分类

### 7. 抄书练习 (`/typing`)

**功能**：
- 选择名著段落进行抄写练习
- 实时检查抄写准确性
- 统计正确率、速度、耗时
- 培养语感和文笔

### 8. 随心写作 (`/freewrite`)

**功能**：
- 自由主题写作，不受题目限制
- 支持草稿保存和继续写作
- 完成后可选择 AI 评审
- 适合日常写作练习

### 9. 趣味练习 (`/word-practice`)

**功能**：
- 词汇填空游戏化练习
- 错题集和复习计划
- 艾宾浩斯记忆曲线复习
- 成就系统和连续打卡

### 10. 技巧学习 (`/skills`)

**功能**：
- 学习各种写作技巧理论
- 针对技巧的专项练习
- AI 评审技巧掌握程度
- 技巧练习历史记录

### 11. AI 词典 (`/dictionary`)

**功能**：
- AI 智能查词（动作词、情绪词等）
- 生成专题词典
- 词汇收藏和分类管理
- 使用次数统计

### 12. 数据统计 (`/statistics`)

**功能**：
- 练习概览（总练习数、总字数、平均分等）
- 练习趋势图（ECharts）
- 能力维度雷达图
- 题目类型分布
- 练习时间分布

### 13. 题库管理 (`/questions`)

**功能**：
- 查看所有生成的题目
- 收藏/取消收藏题目
- 删除题目
- 查看题目使用次数

### 14. 系统设置 (`/settings`)

**功能**：
- AI 配置管理
- 主题设置（亮色/暗色）
- 编辑器设置
- 练习设置

---

## 数据库设计

系统使用 SQLite 数据库，主要表结构：

### 核心表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `ai_config` | AI 配置 | config_name, api_base_url, api_key, model_name |
| `ai_feature_config` | 功能配置映射 | feature_key, config_id |
| `prompt_templates` | Prompt 模板 | category, type, content, variables |
| `prompt_history` | Prompt 历史 | template_id, content, version |
| `questions` | 题目库 | type, difficulty, title, content |
| `practices` | 练习记录 | question_id, content, word_count, status |
| `evaluations` | 评审结果 | practice_id, total_score, dimension_scores |
| `dictionary_words` | 词典词汇 | word, category, meaning, examples |
| `settings` | 系统设置 | key, value |

### 章节相关表

| 表名 | 说明 |
|------|------|
| `chapters` | 章节管理 |
| `chapter_analyses` | 章节分析结果 |
| `typing_practices` | 抄书练习记录 |

### 拆书学习表

| 表名 | 说明 |
|------|------|
| `book_analysis_results` | 拆书分析结果 |
| `book_analysis_practices` | 细纲成文练习 |
| `book_analysis_mask_practices` | 遮蔽练习 |

### 游戏化相关表

| 表名 | 说明 |
|------|------|
| `ink_tasks` | 墨境任务库 |
| `ink_task_completions` | 任务完成记录 |
| `ink_task_practices` | 任务练习记录 |
| `user_xp` | 用户经验值 |
| `user_attributes` | 用户属性值 |
| `achievements` | 成就定义 |
| `user_achievements` | 用户成就 |

### 趣味练习表

| 表名 | 说明 |
|------|------|
| `word_practice_sessions` | 练习会话 |
| `word_practice_items` | 练习题目 |
| `word_practice_mistakes` | 错题记录 |
| `word_practice_reviews` | 复习计划 |

### 技巧学习表

| 表名 | 说明 |
|------|------|
| `writing_skills` | 写作技巧 |
| `skill_practices` | 技巧练习 |
| `skill_evaluations` | 技巧评审 |

---

## 开发与构建

### 环境要求

- Node.js 18.0 或更高版本
- npm 包管理器
- Python 和 C++ 编译工具（用于 better-sqlite3）

### 首次安装

```bash
# 克隆项目
git clone git@github.com:jkxiongxin/ai-novel-train.git
cd ai-novel-trainer1

# 安装根目录依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..

# 安装后端依赖
cd server && npm install && cd ..

# 安装桌面端依赖（可选）
cd desktop && npm install && cd ..
```

### 开发模式

```bash
# 在项目根目录，同时启动前后端
npm run dev

# 或者分别启动
npm run dev:server    # 后端：http://localhost:3000
npm run dev:client    # 前端：http://localhost:5173

# 桌面应用开发模式
npm run dev:desktop
```

### 生产构建

```bash
# 构建前端
npm run build

# 启动生产服务（前端静态文件由后端服务）
npm run start
# 访问 http://localhost:3000

# 构建桌面应用
npm run build:desktop        # 当前平台
npm run build:desktop:win    # Windows
npm run build:desktop:mac    # macOS
npm run build:desktop:all    # 所有平台
```

### 数据库管理

```bash
# 初始化数据库（首次启动自动执行）
npm run init-db

# 导入种子数据
npm run seed
```

数据库文件位置：
- 开发环境：`server/database/novel_trainer.db`
- 桌面应用：用户数据目录（由 electron-store 管理）

---

## API 接口规范

### 基础信息

- **Base URL**：`http://localhost:3000/api`
- **响应格式**：JSON
- **统一响应结构**：
  ```json
  {
    "success": true,
    "data": {},
    "message": "操作成功"
  }
  ```

### 主要 API 端点

| 模块 | 端点 | 说明 |
|------|------|------|
| AI 配置 | `/api/ai-config` | AI 配置 CRUD、测试连接 |
| 功能配置 | `/api/ai-config/features` | 功能配置映射管理 |
| Prompt | `/api/prompts` | Prompt 模板 CRUD、测试 |
| 题目 | `/api/questions` | 题目生成、CRUD、收藏 |
| 练习 | `/api/practices` | 练习 CRUD、提交作答 |
| 评审 | `/api/evaluations` | 评审请求、结果查询 |
| 统计 | `/api/statistics` | 各类统计数据 |
| 词典 | `/api/dictionary` | 词汇 CRUD、AI 查词 |
| 章节 | `/api/chapters` | 章节 CRUD、分析 |
| 抄书 | `/api/typing` | 抄书练习 CRUD |
| 随心写作 | `/api/freewrite` | 随心写作 CRUD |
| 趣味练习 | `/api/word-practice` | 趣味练习会话管理 |
| 技巧学习 | `/api/skills` | 技巧 CRUD、练习评审 |
| 墨境 | `/api/mojing` | 任务管理、完成记录、XP |
| 拆书学习 | `/api/book-analysis` | 拆书分析、练习管理 |

详细 API 文档请参考各路由文件中的注释。

---

## 配置文件说明

### 前端配置

**`client/vite.config.js`**：
- 开发服务器端口：5173
- API 代理配置：`/api` → `http://localhost:3000`
- 构建输出目录：`dist`

**`client/vite.config.electron.js`**：
- Electron 专用构建配置
- 输出目录：`../desktop/client-dist`

**`client/capacitor.config.json`**：
- Capacitor 移动端配置
- Android 项目配置

### 后端配置

**`server/.env.example`**：
```env
PORT=3000
NODE_ENV=development
```

**`server/app.js`**：
- 端口配置：3000
- CORS 启用
- 请求体大小限制：100mb
- 静态文件服务（生产模式）

### 桌面端配置

**`desktop/package.json` - build 字段**：
- appId：`com.ai-novel-trainer.desktop`
- 构建输出：`dist/`
- 支持平台：Windows、macOS、Linux
- 自动更新：GitHub Releases

---

## 常见问题与解决方案

### 1. better-sqlite3 安装失败

**问题**：编译 better-sqlite3 时失败

**解决方案**：
- 安装 Python 3.x
- 安装 C++ 编译工具
  - Windows：Visual Studio Build Tools
  - macOS：Xcode Command Line Tools
  - Linux：build-essential

或使用预编译版本：
```bash
npm install better-sqlite3 --build-from-source=false
```

### 2. 端口冲突

**问题**：3000 或 5173 端口被占用

**解决方案**：
- 修改 `server/app.js` 中的 `PORT`
- 修改 `client/vite.config.js` 中的 `server.port`
- 同时更新 `client/vite.config.js` 中的代理配置

### 3. 数据库初始化失败

**问题**：数据库文件损坏或初始化错误

**解决方案**：
```bash
# 删除数据库文件
rm server/database/novel_trainer.db

# 重启服务，自动重新初始化
npm run dev:server
```

### 4. AI 连接失败

**问题**：无法连接到 AI 服务

**解决方案**：
- 检查 API 密钥是否正确
- 检查 API 地址是否正确
- 检查网络连接和代理设置
- 查看浏览器控制台和服务器日志

### 5. 桌面应用打包失败

**问题**：electron-builder 打包报错

**解决方案**：
```bash
# 清理缓存
rm -rf desktop/dist desktop/node_modules/.cache

# 重新构建
cd desktop && npm run prebuild && npm run build
```

### 6. 移动端构建问题

**问题**：Android 构建失败

**解决方案**：
- 确保安装 Android Studio 和 SDK
- 检查 `client/android/local.properties` 中的 SDK 路径
- 同步 Capacitor 配置：`npx cap sync android`

---

## 项目约定与最佳实践

### 代码规范

1. **前端**：
   - 使用 Vue 3 Composition API
   - 组件命名：PascalCase
   - 文件命名：kebab-case
   - 使用 Pinia 管理全局状态
   - API 调用封装在 `src/api/` 目录

2. **后端**：
   - 路由层只处理请求响应
   - 业务逻辑放在 `services/` 目录
   - 使用原生 SQL（不使用 ORM）
   - 统一错误处理中间件

3. **数据库**：
   - 表名使用下划线命名法
   - 所有表包含 `created_at` 时间戳
   - 使用外键约束保证数据完整性
   - 增量迁移（`database/migrations.js`）

### Git 工作流

- 主分支：`main`
- 功能分支：`feature/xxx`
- 修复分支：`fix/xxx`
- 发布标签：`v1.0.x-alpha`

### 版本管理

当前版本：**v1.0.7-alpha**

版本号规则：`主版本.次版本.修订版-预发布标识`

更新版本：
```bash
# 使用脚本更新所有 package.json
./update_version.sh 1.0.8-alpha
```

---

## 墨境设计理念

墨境（MoJing）是本系统的游戏化核心，设计理念基于认知科学和游戏上瘾机制：

### 问题诊断

写作难以坚持的原因：
- ❌ 反馈延迟：写完可能要几天/周才有读者反应
- ❌ 目标模糊："写好小说"太抽象
- ❌ 认知负荷过重：同时处理人物、情节、文笔、节奏
- ❌ 进步不可见：看不到自己在变强
- ❌ 失败成本高：写了一万字发现写砸了

### 解决方案

游戏上瘾的底层机制：
```
清晰目标 → 即时反馈 → 渐进挑战 → 随机奖励 → 社交认可
     ↑___________________________________|
                  (循环)
```

### 核心机制

1. **微剂量任务**：墨点任务只需 5 分钟，降低启动门槛
2. **即时反馈**：完成任务立即获得 XP、属性点、评分
3. **可视化成长**：六维属性雷达图、等级进度条
4. **渐进挑战**：墨点 → 墨线 → 墨章，难度递增
5. **连续打卡**：每日任务刷新，培养习惯
6. **再次练习**：历史任务可重复练习，看到进步
7. **成就系统**：完成特定目标获得徽章

---

## 扩展开发指南

### 添加新的练习类型

1. **数据库**：在 `questions` 表添加新的 `type`
2. **Prompt**：在 `prompt_templates` 表添加对应模板
3. **前端**：在 `Practice/New.vue` 添加类型选项
4. **后端**：在 `routes/questions.js` 添加生成逻辑

### 添加新的 AI 功能锚点

1. **数据库**：在 `ai_feature_config` 表添加新锚点
2. **后端**：在需要调用 AI 的地方使用 `aiService.callAI(featureKey, ...)`
3. **前端**：在 AI 配置页面会自动显示新锚点

### 添加新的墨境任务

1. **数据库**：在 `ink_tasks` 表添加任务
2. **分类**：设置 `task_type`（ink_dot/ink_line）和 `primary_attribute`
3. **调度**：任务会自动被 `schedulerService` 调度

### 自定义 Prompt 模板

1. 进入 `/prompts` 页面
2. 找到要修改的模板
3. 编辑内容，使用 `{{variable}}` 定义变量
4. 测试运行验证效果
5. 保存（会自动创建历史版本）

---

## 性能优化建议

### 前端优化

- 使用路由懒加载（已实现）
- 大列表使用虚拟滚动
- 图片懒加载
- 防抖/节流处理高频事件

### 后端优化

- 数据库查询使用索引
- 长文本分析使用流式处理
- AI 调用添加超时和重试机制
- 使用缓存减少重复计算

### 数据库优化

- 定期清理旧数据
- 使用 `VACUUM` 整理数据库
- 为常用查询字段添加索引

---

## 安全注意事项

1. **API 密钥保护**：
   - 不要将 API 密钥提交到 Git
   - 使用环境变量或加密存储

2. **输入验证**：
   - 后端对所有输入进行验证
   - 防止 SQL 注入（使用参数化查询）
   - 防止 XSS 攻击（前端转义输出）

3. **文件上传**：
   - 限制文件大小和类型
   - 文件名随机化
   - 存储在非 Web 可访问目录

4. **CORS 配置**：
   - 生产环境限制允许的来源
   - 不要使用 `*` 通配符

---

## 部署指南

### Web 应用部署

1. **构建前端**：
   ```bash
   cd client && npm run build
   ```

2. **配置后端**：
   ```bash
   cd server
   cp .env.example .env
   # 编辑 .env 设置生产环境变量
   ```

3. **启动服务**：
   ```bash
   cd server
   NODE_ENV=production npm start
   ```

4. **使用 PM2 守护进程**（推荐）：
   ```bash
   npm install -g pm2
   pm2 start server/app.js --name ai-novel-trainer
   pm2 save
   pm2 startup
   ```

### 桌面应用发布

1. **配置 GitHub Releases**：
   - 在 `desktop/package.json` 的 `build.publish` 中配置
   - 需要 GitHub Personal Access Token

2. **构建并发布**：
   ```bash
   cd desktop
   npm run publish:all
   ```

3. **用户端自动更新**：
   - 应用启动时自动检查更新
   - 下载并安装新版本

---

## 贡献指南

欢迎贡献代码、报告问题或提出建议！

### 报告问题

- 使用 GitHub Issues
- 提供详细的复现步骤
- 附上错误日志和截图

### 提交代码

1. Fork 项目
2. 创建功能分支
3. 提交代码（遵循代码规范）
4. 推送到分支
5. 创建 Pull Request

---

## 许可证

MIT License

---

## 联系方式

- GitHub：https://github.com/jkxiongxin/ai-novel-train
- Issues：https://github.com/jkxiongxin/ai-novel-train/issues

---

## 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md) 和 [RELEASE_NOTES.md](./RELEASE_NOTES.md)

### v1.0.7-alpha (2025-12-16)

**新增功能**：
- 拆书学习：AI 拆书、手动拆书、细纲成文练习
- 支持多种拆书技巧
- 支持细纲成文练习

**优化功能**：
- 优化章节分析功能，支持长章节分析（超过 3 万字）
- 对魔搭的 qwen3 系列模型做出适配优化

---

**文档生成时间**：2025-12-17  
**文档版本**：1.0  
**系统版本**：v1.0.7-alpha
