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
  },
  // 趣味练习路由
  {
    path: '/word-practice',
    name: 'WordPractice',
    component: () => import('../views/WordPractice/Index.vue'),
    meta: { title: '趣味练习' }
  },
  {
    path: '/word-practice/new',
    name: 'WordPracticeNew',
    component: () => import('../views/WordPractice/New.vue'),
    meta: { title: '开始练习' }
  },
  // 兼容旧路径
  {
    path: '/word-practice/do/:id',
    redirect: to => `/word-practice/session/${to.params.id}`
  },
  {
    path: '/word-practice/result/:id',
    redirect: to => `/word-practice/session/${to.params.id}/result`
  },
  {
    path: '/word-practice/session/:id',
    name: 'WordPracticeSession',
    component: () => import('../views/WordPractice/Do.vue'),
    meta: { title: '练习中' }
  },
  {
    path: '/word-practice/session/:id/result',
    name: 'WordPracticeResult',
    component: () => import('../views/WordPractice/Result.vue'),
    meta: { title: '练习结果' }
  },
  {
    path: '/word-practice/history',
    name: 'WordPracticeHistory',
    component: () => import('../views/WordPractice/History.vue'),
    meta: { title: '练习记录' }
  },
  {
    path: '/word-practice/mistakes',
    name: 'WordPracticeMistakes',
    component: () => import('../views/WordPractice/Mistakes.vue'),
    meta: { title: '错题集' }
  },
  {
    path: '/word-practice/reviews',
    name: 'WordPracticeReviews',
    component: () => import('../views/WordPractice/Reviews.vue'),
    meta: { title: '复习计划' }
  },
  {
    path: '/word-practice/review',
    name: 'WordPracticeReview',
    component: () => import('../views/WordPractice/Review.vue'),
    meta: { title: '复习模式' }
  },
  // 写作技巧学习路由
  {
    path: '/skills',
    name: 'Skills',
    component: () => import('../views/Skills/Index.vue'),
    meta: { title: '技巧学习' }
  },
  {
    path: '/skills/:id',
    name: 'SkillDetail',
    component: () => import('../views/Skills/Detail.vue'),
    meta: { title: '技巧详情' }
  },
  {
    path: '/skills/:id/practice',
    name: 'SkillPractice',
    component: () => import('../views/Skills/Practice.vue'),
    meta: { title: '技巧练习' }
  },
  {
    path: '/skills/practice/:practiceId',
    name: 'SkillEvaluation',
    component: () => import('../views/Skills/Evaluation.vue'),
    meta: { title: '练习评审' }
  },
  // 墨境游戏化模块路由
  {
    path: '/mojing',
    name: 'MoJing',
    component: () => import('../views/MoJing/Index.vue'),
    meta: { title: '墨境' }
  },
  {
    path: '/mojing/tasks',
    name: 'MoJingTasks',
    component: () => import('../views/MoJing/Tasks.vue'),
    meta: { title: '今日任务' }
  },
  {
    path: '/mojing/profile',
    name: 'MoJingProfile',
    component: () => import('../views/MoJing/Profile.vue'),
    meta: { title: '我的墨境' }
  },
  {
    path: '/mojing/task/:id',
    name: 'MoJingTask',
    component: () => import('../views/MoJing/TaskDetail.vue'),
    meta: { title: '墨境任务' }
  },
  {
    path: '/mojing/achievements',
    name: 'MoJingAchievements',
    component: () => import('../views/MoJing/Achievements.vue'),
    meta: { title: '成就墙' }
  },
  {
    path: '/mojing/history',
    name: 'MoJingHistory',
    component: () => import('../views/MoJing/History.vue'),
    meta: { title: '成长记录' }
  },
  {
    path: '/mojing/weekly',
    name: 'MoJingWeekly',
    component: () => import('../views/MoJing/Weekly.vue'),
    meta: { title: '墨章挑战' }
  },
  // 拆书学习模块路由
  {
    path: '/book-analysis',
    name: 'BookAnalysis',
    component: () => import('../views/BookAnalysis/Index.vue'),
    meta: { title: '拆书学习' }
  },
  {
    path: '/book-analysis/select',
    name: 'BookAnalysisSelect',
    component: () => import('../views/BookAnalysis/Select.vue'),
    meta: { title: '选择章节' }
  },
  {
    path: '/book-analysis/result/:chapterId',
    name: 'BookAnalysisResult',
    component: () => import('../views/BookAnalysis/Result.vue'),
    meta: { title: '拆书结果' }
  },
  {
    path: '/book-analysis/manual/:chapterId',
    name: 'BookAnalysisManual',
    component: () => import('../views/BookAnalysis/ManualAnnotation.vue'),
    meta: { title: '手动拆书批注' }
  },
  {
    path: '/book-analysis/mask-select/:chapterId',
    name: 'BookAnalysisMaskSelect',
    component: () => import('../views/BookAnalysis/MaskSelect.vue'),
    meta: { title: '选择遮蔽区域' }
  },
  {
    path: '/book-analysis/practice/:practiceId',
    name: 'BookAnalysisPractice',
    component: () => import('../views/BookAnalysis/Practice.vue'),
    meta: { title: '细纲成文' }
  },
  {
    path: '/book-analysis/mask-practice/:practiceId',
    name: 'BookAnalysisMaskPractice',
    component: () => import('../views/BookAnalysis/MaskPractice.vue'),
    meta: { title: '遮蔽练习' }
  },
  {
    path: '/book-analysis/mask-practice/:practiceId/result',
    name: 'BookAnalysisMaskPracticeResult',
    component: () => import('../views/BookAnalysis/MaskPracticeResult.vue'),
    meta: { title: '遮蔽练习结果' }
  },
  {
    path: '/book-analysis/practice/:practiceId/result',
    name: 'BookAnalysisPracticeResult',
    component: () => import('../views/BookAnalysis/PracticeResult.vue'),
    meta: { title: '练习结果' }
  },
  {
    path: '/book-analysis/history',
    name: 'BookAnalysisHistory',
    component: () => import('../views/BookAnalysis/History.vue'),
    meta: { title: '练习历史' }
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
