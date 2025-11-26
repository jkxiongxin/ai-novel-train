# AI 网络小说写作训练系统 - 开发计划

## 项目概述

基于 README.md 的需求，开发一个用于训练网络小说写作能力的 Web 系统。

## 技术栈

### 前端
- Vue 3 + Composition API
- Vite 构建工具
- Element Plus UI 组件库
- Pinia 状态管理
- Vue Router 路由
- marked (Markdown 渲染)
- Monaco Editor (Prompt 编辑器)
- ECharts (数据可视化)

### 后端
- Node.js + Express.js
- better-sqlite3 (SQLite 数据库)
- 原生 SQL (不使用 ORM，保持简单)

---

## 开发阶段计划

### 第一阶段：项目初始化 ✅

#### 1.1 前端项目初始化
- [x] 创建 Vue 3 + Vite 项目
- [x] 安装依赖 (Element Plus, Pinia, Vue Router, etc.)
- [x] 配置项目结构
- [x] 配置路由
- [x] 配置状态管理

#### 1.2 后端项目初始化
- [x] 创建 Express 项目
- [x] 配置数据库连接
- [x] 创建数据库表结构
- [x] 配置 CORS 和中间件

### 第二阶段：核心功能开发 ✅

#### 2.1 AI API 配置模块 ✅
- [x] 后端 API 接口
  - GET /api/ai-config - 获取配置
  - POST /api/ai-config - 保存配置
  - POST /api/ai-config/test - 测试连接
  - GET /api/ai-config/models - 获取模型列表
- [x] 前端配置页面
  - 配置表单
  - 连接测试
  - 配置保存

#### 2.2 Prompt 模板管理模块 ✅
- [x] 后端 API 接口
  - CRUD 操作
  - 版本历史
  - 重置默认
- [x] 前端管理页面
  - Prompt 列表
  - 编辑器
  - 变量预览
  - 测试运行

#### 2.3 训练题目模块 ✅
- [x] 后端 API 接口
  - 题目生成
  - 题目 CRUD
  - 收藏功能
- [x] 前端页面
  - 题目类型选择
  - 题目生成界面
  - 题库管理

#### 2.4 练习与作答模块 ✅
- [x] 后端 API 接口
  - 练习 CRUD
  - 草稿保存
  - 提交作答
- [x] 前端页面
  - 作答界面
  - 富文本编辑器
  - 自动保存
  - 计时器

#### 2.5 AI 评审模块 ✅
- [x] 后端 API 接口
  - 评审请求
  - 结果存储
- [x] 前端页面
  - 评审结果展示
  - 分数雷达图
  - 改进建议

#### 2.6 数据统计模块 ✅
- [x] 后端 API 接口
  - 概览数据
  - 趋势数据
  - 维度数据
- [x] 前端页面
  - 仪表盘
  - 图表展示 (ECharts)

### 第三阶段：系统完善 ✅

#### 3.1 系统设置 ✅
- [x] 主题设置页面
- [x] 编辑器设置
- [x] 练习设置

#### 3.2 用户体验优化 ✅
- [x] 加载状态
- [x] 错误处理
- [x] 页面过渡动画

#### 3.3 测试与部署
- [x] 开发环境配置
- [ ] 生产构建配置
- [ ] 功能测试

### 第四阶段：增强功能 ✅

#### 4.1 AI 词典功能 ✅
- [x] 后端 API 接口
  - GET /api/dictionary - 获取词汇列表
  - POST /api/dictionary - 添加词汇
  - DELETE /api/dictionary/:id - 删除词汇
  - POST /api/dictionary/ai/search - AI 搜索词汇
  - POST /api/dictionary/ai/generate - AI 生成专题词典
- [x] 前端页面
  - 词典浏览页面
  - AI 查词对话框
  - 批量收录功能
  - 分类管理

#### 4.2 多套 AI 配置支持 ✅
- [x] 后端支持
  - 多套 AI 配置管理
  - AI 功能锚点定义
  - 功能配置映射表
  - 按功能获取配置
- [x] 前端支持
  - AI 配置列表管理
  - 功能配置映射界面
  - 批量设置功能

---

## 文件结构

```
ai-novel-trainer1/
├── client/                    # 前端项目
│   ├── src/
│   │   ├── api/              # API 请求封装
│   │   ├── components/       # 通用组件
│   │   ├── views/            # 页面视图
│   │   ├── stores/           # Pinia 状态
│   │   ├── router/           # 路由配置
│   │   ├── utils/            # 工具函数
│   │   ├── App.vue
│   │   └── main.js
│   ├── package.json
│   └── vite.config.js
├── server/                    # 后端项目
│   ├── database/             # 数据库相关
│   │   ├── init.js           # 初始化脚本
│   │   └── seeds/            # 种子数据
│   ├── routes/               # API 路由
│   ├── services/             # 业务逻辑
│   ├── middleware/           # 中间件
│   ├── utils/                # 工具函数
│   ├── app.js                # 应用入口
│   └── package.json
├── README.md
└── DEVELOPMENT_PLAN.md
```

---

## 数据库表结构

### ai_config - AI 配置表
```sql
CREATE TABLE ai_config (
    id INTEGER PRIMARY KEY,
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
);
```

### ai_feature_config - AI 功能配置映射表
```sql
CREATE TABLE ai_feature_config (
    id INTEGER PRIMARY KEY,
    feature_key TEXT UNIQUE NOT NULL,
    feature_name TEXT NOT NULL,
    feature_description TEXT,
    config_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (config_id) REFERENCES ai_config(id) ON DELETE SET NULL
);
```

### prompt_templates - Prompt 模板表
```sql
CREATE TABLE prompt_templates (
    id INTEGER PRIMARY KEY,
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
);
```

### prompt_history - Prompt 历史表
```sql
CREATE TABLE prompt_history (
    id INTEGER PRIMARY KEY,
    template_id INTEGER,
    content TEXT NOT NULL,
    version INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES prompt_templates(id)
);
```

### questions - 题目表
```sql
CREATE TABLE questions (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    generated_by_prompt_id INTEGER,
    is_favorite BOOLEAN DEFAULT 0,
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generated_by_prompt_id) REFERENCES prompt_templates(id)
);
```

### practices - 练习表
```sql
CREATE TABLE practices (
    id INTEGER PRIMARY KEY,
    question_id INTEGER NOT NULL,
    content TEXT,
    word_count INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    submitted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id)
);
```

### evaluations - 评审表
```sql
CREATE TABLE evaluations (
    id INTEGER PRIMARY KEY,
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
);
```

### dictionary_words - 词典词汇表
```sql
CREATE TABLE dictionary_words (
    id INTEGER PRIMARY KEY,
    word TEXT NOT NULL,
    category TEXT NOT NULL,
    meaning TEXT,
    examples TEXT,
    tags TEXT,
    source TEXT DEFAULT 'user',
    use_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### settings - 系统设置表
```sql
CREATE TABLE settings (
    id INTEGER PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## AI 功能锚点

系统中使用 AI 的功能点及对应锚点：

| 功能锚点 | 功能名称 | 使用场景 |
|---------|---------|---------|
| `question_generate` | 题目生成 | 生成写作练习题目 |
| `evaluation` | 作品评审 | 对用户提交的作品进行 AI 评审 |
| `prompt_test` | Prompt 测试 | 测试 Prompt 模板效果 |
| `dictionary_search` | 词典查词 | AI 搜索相关词汇 |
| `dictionary_generate` | 词典生成 | AI 生成专题词典 |

---

## 开发进度记录

### 2025-11-26
- 创建开发计划文档
- 完成项目初始化
- 完成前端 Vue 3 + Vite 项目搭建
- 完成后端 Express.js 项目搭建
- 完成数据库表结构设计和初始化
- 创建默认 Prompt 模板 (13个)
- 完成所有后端 API 接口
- 完成所有前端页面组件
- 配置 Vite 代理和项目启动脚本
- 新增 AI 词典功能
- 新增多套 AI 配置支持，可为不同功能指定不同的 AI 配置

### 项目启动说明

```bash
# 安装依赖
cd ai-novel-trainer1
npm install

# 初始化数据库
npm run init-db
npm run seed

# 启动开发服务器 (前端 + 后端)
npm run dev

# 前端: http://localhost:5173 或 5174
# 后端: http://localhost:3000
```

### 使用说明

1. 首次使用请先配置 AI API (设置 -> AI 配置)
   - 可以添加多套配置（如 GPT-4 配置、本地模型配置等）
   - 在"功能配置映射"中可以为不同功能指定使用不同的 AI 配置
   - 支持批量设置所有功能使用同一配置
2. 选择练习类型开始训练
3. AI 会生成写作题目
4. 完成写作后提交评审
5. 查看 AI 评分和改进建议
6. 使用 AI 词典功能查询和收集动作词汇
