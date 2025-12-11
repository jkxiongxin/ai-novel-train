## [v1.0.5-alpha] - 2025-12-11


### 🎉 本次更新重点
- 新增功能：墨境 · 写作成长系统（游戏化模块）
	- 新的写作成长玩法：六维属性（人物/冲突/场景/对话/节奏/风格）、经验值与升级、称号系统
	- 任务体系：新增墨点（短微任务）、墨线（中时长任务）、墨章（周挑战）模板与每日任务池
	- 成就系统：188+ 成就（包含里程碑、连续、品质、属性、产量及隐藏类成就）与用户成就墙
	- 每日/周挑战：支持 AI 生成任务变体、每日挑战和周挑战（墨章）提交与评审
	- AI 支持：AI 任务生成与 AI 评审锚点（mojing_task_generate / mojing_task_evaluate / mojing_weekly_evaluate）
	- 后端变更：新增 `server` 路由与服务（achievement/xp/inkTask/scheduler），并在 `app.js` 集成调度器（node-cron）
	- 数据库：新增迁移 v6，包含墨境相关表（档案、经验流水、等级配置、任务模板、每日任务、任务记录、成就、每日/周挑战、奖励、背包、连续打卡奖励等），并新增种子数据（`server/database/seeds/mojing.js`）
	- 前端：新增墨境页面与入口（导航、首页卡片、墨境独立视图、任务/详情/成就/历史/档案/周挑战）和客户端 API：`client/src/api/mojing.js`
	- 依赖：后端新增 `node-cron`（调度器）作为可选依赖
	- 兼容性：如果未安装 AI 配置，仍支持预设任务和手动触发任务生成


### 📦 下载

- **macOS (Apple Silicon)**: `AI-Novel-Trainer-1.0.5-alpha-mac-arm64.dmg`
- **macOS (Intel)**: `AI-Novel-Trainer-1.0.5-alpha-mac-x64.dmg`
- **Windows 安装程序**: `AI-Novel-Trainer-1.0.5-alpha-win-x64.exe`
