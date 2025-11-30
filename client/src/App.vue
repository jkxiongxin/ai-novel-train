<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import MobileNav from './components/MobileNav.vue'
import {
  House,
  Edit,
  Document,
  Collection,
  DataAnalysis,
  Setting,
  Reading,
  Menu as MenuIcon,
  Notebook,
  EditPen,
  Sunrise
} from '@element-plus/icons-vue'

const route = useRoute()
const isCollapse = ref(false)

// 检测是否在 Electron 环境中运行
const isElectron = ref(false)
const isMacOS = ref(false)
const isWindowMaximized = ref(false)

onMounted(async () => {
  isElectron.value = !!(window.electronAPI)
  isMacOS.value = window.electronAPI?.platform === 'darwin'
  
  // Windows: 获取初始最大化状态并监听变化
  if (isElectron.value && !isMacOS.value) {
    isWindowMaximized.value = await window.electronAPI?.isMaximized?.() || false
    window.electronAPI?.onMaximizeChange?.((maximized) => {
      isWindowMaximized.value = maximized
    })
  }
})

// Windows 窗口控制
const minimizeWindow = () => window.electronAPI?.minimizeWindow?.()
const maximizeWindow = () => window.electronAPI?.maximizeWindow?.()
const closeWindow = () => window.electronAPI?.closeWindow?.()

// 需要隐藏底部导航的页面（沉浸式页面）
const hideNavRoutes = ['/practice/', '/freewrite/do', '/typing/']
const showMobileNav = computed(() => {
  return !hideNavRoutes.some(r => route.path.includes(r))
})

const menuItems = [
  { path: '/', icon: House, title: '首页' },
  { path: '/practice', icon: Edit, title: '写作练习' },
  { path: '/freewrite', icon: Sunrise, title: '随心练习' },
  { path: '/typing', icon: EditPen, title: '抄书练习' },
  { path: '/chapters', icon: Notebook, title: '章节管理' },
  { path: '/questions', icon: Document, title: '题库管理' },
  { path: '/history', icon: Collection, title: '练习历史' },
  { path: '/dictionary', icon: Reading, title: 'AI 词典' },
  { path: '/prompts', icon: Document, title: 'Prompt 管理' },
  { path: '/statistics', icon: DataAnalysis, title: '数据统计' },
  { path: '/settings', icon: Setting, title: '系统设置' }
]

const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/practice')) return '/practice'
  if (path.startsWith('/freewrite')) return '/freewrite'
  if (path.startsWith('/typing')) return '/typing'
  if (path.startsWith('/chapters')) return '/chapters'
  if (path.startsWith('/settings')) return '/settings'
  if (path.startsWith('/evaluation')) return '/history'
  if (path.startsWith('/dictionary')) return '/dictionary'
  return path
})
</script>

<template>
  <!-- Electron 桌面端顶部拖动栏 - 仅 macOS 显示 -->
  <div v-if="isElectron && isMacOS" class="electron-titlebar is-macos">
    <div class="titlebar-drag-region"></div>
    <span class="titlebar-title">AI 网文训练师</span>
  </div>
  
  <!-- 桌面端布局 - 通过 CSS 媒体查询控制显示 -->
  <el-container class="app-container desktop-only" :class="{ 'has-titlebar': isElectron && isMacOS }">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="app-aside">
      <!-- Windows 拖动区域 -->
      <div v-if="isElectron && !isMacOS" class="windows-drag-region"></div>
      <div class="logo" :class="{ 'windows-draggable': isElectron && !isMacOS }">
        <span v-if="!isCollapse">📚 小说写作训练</span>
        <span v-else>📚</span>
      </div>
      
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        router
        class="app-menu"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
      
      <div class="collapse-btn" @click="isCollapse = !isCollapse">
        <el-icon><MenuIcon /></el-icon>
      </div>
    </el-aside>
    
    <!-- 主内容区 -->
    <el-main class="app-main">
      <!-- Windows 窗口控制按钮 -->
      <div v-if="isElectron && !isMacOS" class="windows-controls">
        <div class="windows-drag-area"></div>
        <button class="win-btn" @click="minimizeWindow" title="最小化">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 5h10v1H0z" fill="currentColor"/>
          </svg>
        </button>
        <button class="win-btn" @click="maximizeWindow" title="最大化">
          <svg v-if="!isWindowMaximized" width="10" height="10" viewBox="0 0 10 10">
            <path d="M0 0v10h10V0H0zm1 1h8v8H1V1z" fill="currentColor"/>
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 0v2H0v8h8V8h2V0H2zm6 8H1V3h7v5zm1-6H3V1h6v1z" fill="currentColor"/>
          </svg>
        </button>
        <button class="win-btn win-close" @click="closeWindow" title="关闭">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 0L0 1l4 4-4 4 1 1 4-4 4 4 1-1-4-4 4-4-1-1-4 4-4-4z" fill="currentColor"/>
          </svg>
        </button>
      </div>
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
  
  <!-- 移动端布局 - 通过 CSS 媒体查询控制显示 -->
  <div class="app-mobile mobile-only">
    <main class="mobile-main" :class="{ 'has-nav': showMobileNav }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <MobileNav v-show="showMobileNav" />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* ===== Electron 顶部拖动栏样式 ===== */
.electron-titlebar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 38px;
  background: linear-gradient(to bottom, #3a4a5e 0%, #304156 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  user-select: none;
}

.electron-titlebar.is-macos {
  /* macOS 上为红绿灯按钮留出空间 */
  padding-left: 80px;
}

.titlebar-drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  -webkit-app-region: drag;
  app-region: drag;
}

.titlebar-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  pointer-events: none;
}

/* Windows 拖动区域 */
.windows-drag-region {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 32px;
  -webkit-app-region: drag;
  z-index: 100;
}

.logo.windows-draggable {
  -webkit-app-region: drag;
  cursor: default;
}

/* Windows 窗口控制按钮 */
.windows-controls {
  position: fixed;
  top: 0;
  right: 0;
  height: 32px;
  display: flex;
  align-items: stretch;
  z-index: 9999;
}

.windows-controls .windows-drag-area {
  position: fixed;
  top: 0;
  left: 200px;
  right: 138px;
  height: 32px;
  -webkit-app-region: drag;
}

.windows-controls .win-btn {
  width: 46px;
  height: 32px;
  border: none;
  background: transparent;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.15s;
  -webkit-app-region: no-drag;
}

.windows-controls .win-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.windows-controls .win-btn.win-close:hover {
  background: #e81123;
  color: white;
}

/* 有标题栏时的容器调整 */
.app-container.has-titlebar {
  padding-top: 38px;
  height: calc(100vh);
}

.app-container.has-titlebar .app-aside {
  padding-top: 0;
  height: calc(100vh - 38px);
}

.app-container.has-titlebar .app-main {
  height: calc(100vh - 38px);
}

/* ===== 响应式显示控制 ===== */
.desktop-only {
  display: flex;
}

.mobile-only {
  display: none;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }
  
  .mobile-only {
    display: block !important;
  }
}

/* ===== 桌面端样式 ===== */
.app-container {
  height: 100vh;
}

.app-aside {
  background: #304156;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
  position: relative;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.2);
}

.app-menu {
  flex: 1;
  border-right: none;
  background: transparent;
}

.app-menu .el-menu-item {
  color: #bfcbd9;
}

.app-menu .el-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.app-menu .el-menu-item.is-active {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.collapse-btn {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #bfcbd9;
  cursor: pointer;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.app-main {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}

/* ===== 移动端样式 ===== */
.app-mobile {
  min-height: 100vh;
  background: #f5f7fa;
  /* 适配状态栏安全区域 */
  padding-top: env(safe-area-inset-top, 0px);
}

.mobile-main {
  min-height: calc(100vh - env(safe-area-inset-top, 0px));
  padding: 16px;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.mobile-main.has-nav {
  padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
}

/* ===== 过渡动画 ===== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ===== 移动端安全区域 CSS 变量 ===== */
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sar: env(safe-area-inset-right, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
}
</style>
