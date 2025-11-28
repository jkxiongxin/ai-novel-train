import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

import App from './App.vue'
import router from './router'

import './style.css'
import './styles/mobile.css'

// 初始化移动端状态栏
async function initMobileStatusBar() {
  if (Capacitor.isNativePlatform()) {
    try {
      // 设置状态栏样式为深色文字（适合浅色背景）
      await StatusBar.setStyle({ style: Style.Light })
      // 设置状态栏背景透明，让内容可以延伸到状态栏下方
      await StatusBar.setBackgroundColor({ color: '#ffffff' })
      // 允许内容延伸到状态栏下
      await StatusBar.setOverlaysWebView({ overlay: true })
    } catch (error) {
      console.warn('StatusBar initialization failed:', error)
    }
  }
}

// 初始化本地数据库（仅移动端）
async function initLocalDatabase() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { initLocalDatabase } = await import('./services/localDatabase')
      await initLocalDatabase()
      console.log('本地数据库初始化成功')
    } catch (error) {
      console.error('本地数据库初始化失败:', error)
    }
  }
}

// 注册 Service Worker（仅 Web 端）
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((error) => {
        console.log('SW registration failed:', error)
      })
  })
}

// 初始化移动端
initMobileStatusBar()
initLocalDatabase()

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })

app.mount('#app')
