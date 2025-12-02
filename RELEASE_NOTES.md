## [1.0.3-alpha] - 2025-12-02

### 🐛 问题修复

- **修复桌面版更新下载功能**：点击更新下载按钮时，现在会正确显示下载进度
  - 添加下载开始提示对话框
  - 任务栏显示下载进度条
  - 下载失败时提供手动下载选项（跳转到 GitHub Release 页面）
  - 更新提示对话框增加"前往下载页面"按钮
  - 允许预发布版本（alpha/beta）的自动更新检测

### 🔧 技术改进

- 优化 electron-updater 配置，支持预发布版本更新
- 修复文件名中文字符导致 GitHub 上传失败的问题
- 添加 NSIS differentialPackage 支持增量更新

### 🎉 新增功能
- 新增知识点学习模块

### 📦 下载

- **macOS (Apple Silicon)**: `AI-Novel-Trainer-1.0.3-alpha-mac-arm64.dmg`
- **macOS (Intel)**: `AI-Novel-Trainer-1.0.3-alpha-mac-x64.dmg`
- **Windows 安装程序**: `AI-Novel-Trainer-1.0.3-alpha-win-x64.exe`
