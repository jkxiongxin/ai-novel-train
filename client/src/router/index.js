import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'

// 检测是否在 Electron 环境中运行
const isElectron = typeof window !== 'undefined' && window.electronAPI

const routes = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/Home.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/practice',
    name: 'Practice',
    component: () => import('../views/Practice/Index.vue'),
    meta: { title: '写作练习' }
  },
  {
    path: '/practice/new/:type',
    name: 'NewPractice',
    component: () => import('../views/Practice/New.vue'),
    meta: { title: '生成题目' }
  },
  {
    path: '/practice/:id',
    name: 'DoPractice',
    component: () => import('../views/Practice/Do.vue'),
    meta: { title: '作答' }
  },
  {
    path: '/evaluation/:id',
    name: 'Evaluation',
    component: () => import('../views/Evaluation.vue'),
    meta: { title: '评审结果' }
  },
  {
    path: '/history',
    name: 'History',
    component: () => import('../views/History.vue'),
    meta: { title: '练习历史' }
  },
  {
    path: '/questions',
    name: 'Questions',
    component: () => import('../views/Questions.vue'),
    meta: { title: '题库管理' }
  },
  {
    path: '/prompts',
    name: 'Prompts',
    component: () => import('../views/Prompts.vue'),
    meta: { title: 'Prompt 管理' }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/Statistics.vue'),
    meta: { title: '数据统计' }
  },
  {
    path: '/dictionary',
    name: 'Dictionary',
    component: () => import('../views/Dictionary.vue'),
    meta: { title: 'AI 词典' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/Settings/Index.vue'),
    meta: { title: '系统设置' }
  },  {
    path: '/settings/ai',
    name: 'AISettings',
    component: () => import('../views/Settings/AI.vue'),
    meta: { title: 'AI 配置' }
  },
  {
    path: '/chapters',
    name: 'Chapters',
    component: () => import('../views/Chapters/Index.vue'),
    meta: { title: '章节管理' }
  },
  {
    path: '/chapters/:id',
    name: 'ChapterDetail',
    component: () => import('../views/Chapters/Detail.vue'),
    meta: { title: '章节详情' }
  },
  {
    path: '/typing',
    name: 'Typing',
    component: () => import('../views/Typing/Index.vue'),
    meta: { title: '抄书练习' }
  },
  {
    path: '/typing/:id',
    name: 'DoTyping',
    component: () => import('../views/Typing/Do.vue'),
    meta: { title: '抄书' }
  },
  {
    path: '/freewrite',
    name: 'Freewrite',
    component: () => import('../views/Freewrite/Index.vue'),
    meta: { title: '随心练习' }
  },
  {
    path: '/freewrite/do',
    name: 'FreewriteDo',
    component: () => import('../views/Freewrite/Do.vue'),
    meta: { title: '随心写作' }
  },
  {
    path: '/freewrite/do/:id',
    name: 'FreewriteContinue',
    component: () => import('../views/Freewrite/Do.vue'),
    meta: { title: '继续写作' }
  },
  {
    path: '/freewrite/:id',
    name: 'FreewriteDetail',
    component: () => import('../views/Freewrite/Detail.vue'),
    meta: { title: '练习详情' }
  }
]

const router = createRouter({
  // Electron 环境使用 hash 模式，Web 环境使用 history 模式
  history: isElectron ? createWebHashHistory() : createWebHistory(),
  routes
})

// 路由守卫：设置页面标题
router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '页面'} - AI 小说写作训练`
  next()
})

export default router
