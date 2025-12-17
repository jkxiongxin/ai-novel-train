# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 网络小说写作训练系统 - 一个帮助作者提升写作能力的本地应用。通过 AI 生成练习题目、评审反馈，结合游戏化机制激励持续学习。

## 常用命令

### 开发环境
```bash
# 安装所有依赖（根目录 + client + server）
npm install && cd client && npm install && cd ../server && npm install && cd ..

# 同时启动前后端开发服务
npm run dev

# 单独启动
npm run dev:server    # 后端 http://localhost:3000
npm run dev:client    # 前端 http://localhost:5173
```

### 生产构建
```bash
npm run build         # 构建前端到 client/dist
npm run start         # 启动生产服务（后端服务前端静态文件）
```

### 桌面版 (Electron)
```bash
npm run dev:desktop          # 开发模式
npm run build:desktop        # 当前平台
npm run build:desktop:mac    # macOS
npm run build:desktop:win    # Windows
```

### 数据库
```bash
npm run init-db       # 初始化数据库（通常自动执行）
npm run seed          # 重置默认 Prompt 模板
```

## 架构概览

```
ai-novel-trainer/
├── client/           # Vue 3 前端 (Vite)
│   ├── src/
│   │   ├── api/      # API 调用封装
│   │   ├── views/    # 页面组件
│   │   ├── components/
│   │   ├── router/   # 路由配置
│   │   └── services/ # 前端服务逻辑
├── server/           # Express 后端
│   ├── app.js        # 应用入口
│   ├── routes/       # API 路由
│   ├── services/     # 业务逻辑层
│   └── database/
│       ├── init.js   # 数据库初始化和表结构
│       ├── migrations/  # 增量迁移脚本
│       └── seeds/    # 种子数据
├── desktop/          # Electron 桌面版
│   ├── main.js       # Electron 主进程
│   └── preload.js    # 预加载脚本
```

## 技术栈

**前端**: Vue 3 + Composition API, Vite, Element Plus, Pinia, Vue Router, ECharts, Marked
**后端**: Express 5, better-sqlite3, node-cron
**桌面**: Electron + electron-builder

## 核心模块

### 1. 写作练习系统 (`/practice`)
- AI 生成不同类型的写作题目（对白、情绪、战斗、心理等）
- 用户作答后提交 AI 评审
- 多维度打分和改进建议

### 2. 墨境游戏化系统 (`/mojing`)
- 六维属性成长：人物力、冲突力、场景力、对话力、节奏力、风格力
- 每日任务：墨点（5分钟）、墨线（20分钟）、墨章（周挑战）
- XP 经验和等级系统
- 成就徽章

### 3. 拆书学习 (`/book-analysis`)
- 上传小说章节进行 AI 分析
- 自动拆分片段并识别文风
- 细纲成文和遮蔽练习模式

### 4. 抄书练习 (`/typing`)
- 基于章节片段的打字练习
- 准确率和速度统计

### 5. AI 词典 (`/dictionary`)
- AI 搜索相关词汇
- 生成专题词典
- 趣味词汇练习

## 数据库设计要点

- 使用 SQLite + better-sqlite3（同步 API）
- WAL 模式提升并发性能
- 支持增量迁移（`server/database/migrations/`）
- 桌面版通过 `DB_PATH` 环境变量自定义数据库路径

**核心表结构**:
- `ai_config` / `ai_feature_config`: AI 服务配置和功能映射
- `prompt_templates`: Prompt 模板管理
- `questions` / `practices` / `evaluations`: 练习流程
- `novel_chapters` / `chapter_segments`: 章节分析
- `mojing_*`: 墨境游戏化相关表

## AI 服务集成

支持 OpenAI 兼容接口，可配置多套 AI 服务：
- API 配置在 `ai_config` 表存储
- 功能锚点在 `ai_feature_config` 表映射不同 AI 配置
- AI 调用逻辑在 `server/services/aiService.js`

**功能锚点**:
- `question_generate`: 题目生成
- `evaluation`: 作品评审
- `dictionary_search` / `dictionary_generate`: 词典功能
- `chapter_analyze`: 章节分析
- `word_practice_grade`: 造句评分

## 开发注意事项

1. **数据库迁移**: 新增表结构需在 `server/database/migrations/` 添加迁移脚本
2. **Prompt 模板**: 默认模板在 `server/database/seeds/prompts.js`
3. **路由模式**: Web 使用 history 模式，Electron 使用 hash 模式
4. **API 响应格式**: 统一返回 `{ success: boolean, data?: any, message?: string }`
5. **墨境调度器**: `schedulerService.js` 使用 node-cron 处理每日任务生成

## 端口配置

- 前端开发: 5173
- 后端服务: 3000
- 生产环境: 后端服务前端静态文件，统一使用 3000 端口
