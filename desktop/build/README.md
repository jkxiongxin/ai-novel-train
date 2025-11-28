# Electron 打包资源目录

此目录存放 Electron 打包所需的资源文件。

## 所需图标文件

打包 Mac 和 Windows 应用需要以下图标文件：

### macOS
- `icon.icns` - macOS 应用图标（推荐 1024x1024）

### Windows
- `icon.ico` - Windows 应用图标（推荐包含多种尺寸：16x16, 32x32, 48x48, 256x256）

### Linux（可选）
- `icons/` 目录 - 包含多种尺寸的 PNG 图标

## 生成图标

可以使用在线工具或命令行工具将 PNG 图片转换为所需格式：

```bash
# 使用 iconutil (macOS)
iconutil -c icns icon.iconset

# 使用 png2ico (Windows)
png2ico icon.ico icon-256.png icon-48.png icon-32.png icon-16.png
```

或者使用 [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder):

```bash
npm install -g electron-icon-builder
electron-icon-builder --input=./icon.png --output=./
```
