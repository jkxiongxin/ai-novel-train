# 发布 v1.0.4-alpha - 剩余文件手动上传指南

## 已完成的工作

1. ✅ 版本号已更新到 1.0.4-alpha
2. ✅ CHANGELOG.md 已更新
3. ✅ 代码已提交并创建标签 v1.0.4-alpha
4. ✅ 所有平台安装包已打包完成
5. ✅ GitHub Release 已创建
6. ✅ 更新元数据文件已上传（latest.yml 和 latest-mac.yml）

## 需要手动上传的文件

由于文件较大，GitHub CLI 上传超时，请手动上传以下文件到 Release 页面：
https://github.com/jkxiongxin/ai-novel-train/releases/tag/v1.0.4-alpha

### 必须上传的文件（自动更新功能必需）

1. `desktop/dist/AI网文训练师-1.0.4-alpha-arm64-mac.zip` (110MB) - ARM64 Mac 更新包
2. `desktop/dist/AI网文训练师-1.0.4-alpha-mac.zip` (114MB) - Intel Mac 更新包

### 用户下载的安装包

3. `desktop/dist/AI网文训练师-1.0.4-alpha-arm64.dmg` (113MB) - ARM64 Mac 安装包
4. `desktop/dist/AI网文训练师-1.0.4-alpha.dmg` (118MB) - Intel Mac 安装包
5. `desktop/dist/AI网文训练师 Setup 1.0.4-alpha.exe` (180MB) - Windows 安装程序

## 手动上传步骤

1. 访问 Release 页面：https://github.com/jkxiongxin/ai-novel-train/releases/tag/v1.0.4-alpha
2. 点击 "Attach binaries by dropping them here or selecting them" 区域
3. 选择上述 5 个文件进行上传
4. 等待所有文件上传完成

## 验证自动更新功能

上传完成后，请验证：
- [ ] latest-mac.yml 文件中的 URL 指向正确的 ZIP 文件
- [ ] latest.yml 文件中的 URL 指向正确的 EXE 文件
- [ ] 所有文件名与 yml 文件中的引用完全匹配

## 发布完成确认清单

- [ ] 所有 5 个文件已上传
- [ ] 文件名与 latest-mac.yml 和 latest.yml 中的引用匹配
- [ ] Release 页面显示所有文件
- [ ] 桌面版应用能够检测到更新
- [ ] 下载和安装功能正常