## 启动与部署

---

## 首次安装指南

### 环境要求
- Node.js 18.0 或更高版本
- npm 包管理器

### 安装步骤

1. **克隆项目**
```bash
git clone [项目地址]
cd ai-novel-train
```

2. **安装所有依赖**
```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..

# 安装后端依赖
cd server && npm install && cd ..
```

或者使用一键安装脚本：
```bash
npm install && cd client && npm install && cd ../server && npm install && cd ..
```

### 启动与部署

#### 开发环境（推荐）

在项目根目录下运行，同时启动前后端：
```bash
npm run dev
```

或者分别启动：
```bash
# 启动后端服务（在一个终端中）
npm run dev:server

# 启动前端服务（在另一个终端中）
npm run dev:client
```

访问 `http://localhost:5173` 开始使用系统。

> 💡 **提示**：数据库会在首次启动时自动初始化，无需手动执行初始化命令。数据库支持增量迁移，版本更新后会自动升级表结构。

#### 生产环境
```bash
# 构建前端
npm run build

# 启动服务（前端静态文件由后端服务）
npm run start
```

访问 `http://localhost:3000` 使用生产版本。

#### 桌面版（Electron）
```bash
# 开发模式
npm run dev:desktop

# 构建桌面应用
npm run build:desktop        # 当前平台
npm run build:desktop:win    # Windows
npm run build:desktop:mac    # macOS
npm run build:desktop:all    # 所有平台
```

### 首次使用配置

1. **配置 AI 服务**
   - 进入"设置" → "AI 配置"
   - 添加你的 AI 服务配置（OpenAI、Claude、本地模型等）
   - 测试连接确保配置正确

2. **配置功能映射**
   - 在"功能配置映射"标签页中为不同功能分配 AI 配置
   - 启用你需要的功能模块

3. **开始使用**
   - 进入"练习"模块选择题目类型
   - 开始你的网络小说写作训练之旅

### 常见问题

- **如果遇到端口冲突**：修改 `client/vite.config.js` 和 `server/app.js` 中的端口号
- **如果数据库出现问题**：删除 `server/database/novel_trainer.db` 后重启服务，数据库会自动重新初始化
- **如果 AI 连接失败**：检查 API 密钥和网络连接，确保 API 地址正确
- **如果 better-sqlite3 安装失败**：需要安装 Python 和 C++ 编译工具，或使用预编译版本

请确保系统在 `localhost:3000` 启动后即可完全在本地使用，无需任何外部依赖（AI API 除外）。

---

## 支持本项目

如果这个项目对您有帮助，请考虑支持开发者的工作：

![赞赏支持](./docs/zanshang.jpg)

您的支持将帮助我持续改进和完善这个AI网络小说写作训练系统，为更多写作者提供更好的学习体验。感谢您的支持！