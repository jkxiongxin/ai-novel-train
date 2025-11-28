/**
 * 设备检测工具
 * 用于检测当前设备类型并提供响应式支持
 */
import { ref, computed, watchEffect } from 'vue'

// 断点配置
export const BREAKPOINTS = {
  mobile: 768,    // < 768px 为移动端
  tablet: 1024,   // 768-1024px 为平板
  desktop: 1024   // >= 1024px 为桌面端
}

// 全局响应式状态
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)

// 设备状态 - 使用普通 ref，值会随 windowWidth 自动更新
const isMobileRef = ref(windowWidth.value < BREAKPOINTS.mobile)
const isTabletRef = ref(windowWidth.value >= BREAKPOINTS.mobile && windowWidth.value < BREAKPOINTS.tablet)
const isDesktopRef = ref(windowWidth.value >= BREAKPOINTS.desktop)

// 更新窗口宽度和设备状态
function updateWidth() {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    isMobileRef.value = windowWidth.value < BREAKPOINTS.mobile
    isTabletRef.value = windowWidth.value >= BREAKPOINTS.mobile && windowWidth.value < BREAKPOINTS.tablet
    isDesktopRef.value = windowWidth.value >= BREAKPOINTS.desktop
  }
}

// 初始化监听 - 在模块加载时立即执行
if (typeof window !== 'undefined') {
  // 确保初始值正确
  updateWidth()
  // 监听窗口大小变化
  window.addEventListener('resize', updateWidth)
}

// 触摸设备检测
const isTouchDeviceRef = ref(
  typeof window !== 'undefined' && 
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)
)

// iOS 检测
const isIOSRef = ref(
  typeof navigator !== 'undefined' && 
  /iPad|iPhone|iPod/.test(navigator.userAgent)
)

// Android 检测
const isAndroidRef = ref(
  typeof navigator !== 'undefined' && 
  /Android/.test(navigator.userAgent)
)

// 独立 PWA 模式检测
const isStandaloneRef = ref(
  typeof window !== 'undefined' && 
  (window.matchMedia('(display-mode: standalone)').matches || 
   window.navigator.standalone === true)
)

/**
 * 响应式 Hook
 * 返回响应式的设备状态
 */
export function useDevice() {
  return {
    windowWidth,
    isMobile: isMobileRef,
    isTablet: isTabletRef,
    isDesktop: isDesktopRef,
    isTouchDevice: isTouchDeviceRef,
    isIOS: isIOSRef,
    isAndroid: isAndroidRef,
    isStandalone: isStandaloneRef
  }
}

// 导出单独的 ref 供直接使用
export const isMobile = isMobileRef
export const isTablet = isTabletRef
export const isDesktop = isDesktopRef

/**
 * 安全区域高度（用于处理 iPhone 刘海屏）
 */
export function getSafeAreaInsets() {
  const computedStyle = getComputedStyle(document.documentElement)
  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0'),
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0'),
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0'),
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0')
  }
}
