<script setup>
/**
 * 移动端底部导航栏组件
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  House,
  Edit,
  Collection,
  DataAnalysis,
  Setting,
  Sunrise
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()

// 移动端精简导航项（5个为佳）
const navItems = [
  { path: '/', icon: House, title: '首页', match: ['/'] },
  { path: '/practice', icon: Edit, title: '练习', match: ['/practice', '/questions'] },
  { path: '/freewrite', icon: Sunrise, title: '随心写', match: ['/freewrite'] },
  { path: '/history', icon: Collection, title: '历史', match: ['/history', '/evaluation'] },
  { path: '/settings', icon: Setting, title: '设置', match: ['/settings', '/prompts', '/dictionary', '/statistics', '/chapters', '/typing'] }
]

const activeIndex = computed(() => {
  const currentPath = route.path
  return navItems.findIndex(item => 
    item.match.some(m => currentPath === m || currentPath.startsWith(m + '/'))
  )
})

function navigate(item) {
  router.push(item.path)
}
</script>

<template>
  <nav class="mobile-nav">
    <div 
      v-for="(item, index) in navItems" 
      :key="item.path"
      class="nav-item"
      :class="{ active: activeIndex === index }"
      @click="navigate(item)"
    >
      <div class="nav-icon">
        <component :is="item.icon" />
      </div>
      <span class="nav-title">{{ item.title }}</span>
    </div>
  </nav>
</template>

<style scoped>
.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: calc(56px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: #fff;
  border-top: 1px solid #ebeef5;
  display: flex;
  justify-content: space-around;
  align-items: flex-start;
  z-index: 1000;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.nav-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  color: #909399;
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.nav-item:active {
  transform: scale(0.95);
}

.nav-item.active {
  color: #409eff;
}

.nav-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
  font-size: 22px;
}

.nav-title {
  font-size: 10px;
  line-height: 1.2;
}
</style>
