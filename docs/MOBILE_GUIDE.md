# 移动端适配指南

本项目已完成移动端适配，采用 **响应式 + PWA** 方案。

## 🎯 适配方案

### 1. 响应式布局
- 通过 `useDevice()` Hook 检测设备类型
- 根据屏幕宽度（< 768px）自动切换移动端/桌面端布局
- 每个页面有独立的移动端和桌面端模板

### 2. PWA 支持
- 可安装到手机桌面
- 离线缓存支持
- 添加到主屏幕后全屏显示

## 📱 已适配页面

| 页面 | 路由 | 移动端特性 |
|------|------|-----------|
| 首页 | `/` | 网格统计卡片、练习类型快捷入口 |
| 练习选择 | `/practice` | 列表式练习类型展示 |
| 写作页面 | `/practice/:id` | 沉浸式写作、底部抽屉查看题目 |
| 随心练习 | `/freewrite/do` | 沉浸式写作、番茄钟支持 |
| 设置 | `/settings` | 移动端菜单入口整合 |

## 🧩 新增组件

### MobileNav.vue
移动端底部导航栏，包含5个主要入口：
- 首页
- 练习
- 随心写
- 历史
- 设置

### MobileHeader.vue
移动端页面顶部标题栏，支持：
- 返回按钮
- 页面标题
- 右侧操作按钮

### device.js 工具
提供设备检测功能：
```javascript
import { useDevice } from '@/utils/device'

const { isMobile, isTablet, isDesktop, isTouchDevice } = useDevice()
```

## 📁 文件结构

```
client/src/
├── utils/
│   └── device.js          # 设备检测工具
├── styles/
│   └── mobile.css         # 移动端全局样式
├── components/
│   ├── MobileNav.vue      # 底部导航
│   └── MobileHeader.vue   # 顶部标题栏
└── public/
    ├── manifest.json      # PWA 配置
    └── sw.js              # Service Worker
```

## 🎨 样式断点

```css
/* 移动端: < 768px */
@media screen and (max-width: 768px) { }

/* 平板: 768px - 1024px */
@media screen and (min-width: 768px) and (max-width: 1024px) { }

/* 桌面端: >= 1024px */
@media screen and (min-width: 1024px) { }
```

## 🚀 开发指南

### 为新页面添加移动端适配

1. 引入设备检测：
```vue
<script setup>
import { useDevice } from '@/utils/device'
import MobileHeader from '@/components/MobileHeader.vue'

const { isMobile } = useDevice()
</script>
```

2. 使用条件渲染：
```vue
<template>
  <!-- 移动端布局 -->
  <div v-if="isMobile" class="page-mobile">
    <MobileHeader title="页面标题" />
    <!-- 移动端内容 -->
  </div>
  
  <!-- 桌面端布局 -->
  <div v-else class="page-desktop">
    <!-- 桌面端内容 -->
  </div>
</template>
```

3. 添加移动端样式：
```vue
<style scoped>
/* 桌面端样式 */
.page-desktop { }

/* 移动端样式 */
.page-mobile { }
</style>
```

## 📲 PWA 安装

### iOS Safari
1. 打开网站
2. 点击分享按钮
3. 选择"添加到主屏幕"

### Android Chrome
1. 打开网站
2. 点击菜单按钮
3. 选择"添加到主屏幕"

## ⚠️ 注意事项

1. **图标资源**：需要在 `public/icons/` 目录下添加不同尺寸的图标
2. **安全区域**：使用 `env(safe-area-inset-*)` 处理刘海屏
3. **触摸优化**：移动端组件使用更大的点击区域（最小44px）
4. **键盘处理**：输入框聚焦时需要考虑虚拟键盘
5. **后端部署**：PWA 需要 HTTPS 环境才能完整工作

## 🔧 待优化项

- [ ] 添加 PWA 图标资源
- [ ] 历史页面移动端适配
- [ ] 评审结果页面移动端适配
- [ ] 统计页面移动端图表适配
- [ ] 深色模式支持
- [ ] 手势操作支持（下拉刷新、左滑删除等）
