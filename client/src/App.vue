<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
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
  <el-container class="app-container">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '200px'" class="app-aside">
      <div class="logo">
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
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </el-main>
  </el-container>
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

.app-container {
  height: 100vh;
}

.app-aside {
  background: #304156;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
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

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
