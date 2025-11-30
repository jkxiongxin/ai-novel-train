<script setup>
/**
 * 词汇趣味练习 - 主入口页面
 * 展示练习入口、历史记录、错题集、复习计划等
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  Reading, 
  Clock, 
  Trophy,
  Warning,
  Bell,
  ArrowRight
} from '@element-plus/icons-vue'
import {
  getPracticeSessions,
  getMistakeStats,
  getReviewStats,
  getUnreadNotifications,
  getDueReviews,
  checkReminders
} from '../../api/wordPractice'
import { getCategories, getDictionaryStats } from '../../api/dictionary'

const router = useRouter()

// 状态
const loading = ref(false)
const dictionaryStats = ref(null)
const categories = ref([])
const recentSessions = ref([])
const mistakeStats = ref(null)
const reviewStats = ref(null)
const dueReviews = ref([])
const notifications = ref([])

// 加载数据
async function loadData() {
  loading.value = true
  try {
    // 并行加载数据
    const [
      dictStatsRes,
      categoriesRes,
      sessionsRes,
      mistakeStatsRes,
      reviewStatsRes,
      dueReviewsRes,
      notificationsRes
    ] = await Promise.all([
      getDictionaryStats(),
      getCategories(),
      getPracticeSessions({ page: 1, pageSize: 5 }),
      getMistakeStats(),
      getReviewStats(),
      getDueReviews({ limit: 5 }),
      getUnreadNotifications({ limit: 5 })
    ])
    
    dictionaryStats.value = dictStatsRes.data
    categories.value = categoriesRes.data || []
    recentSessions.value = sessionsRes.data?.list || []
    mistakeStats.value = mistakeStatsRes.data
    reviewStats.value = reviewStatsRes.data
    dueReviews.value = dueReviewsRes.data || []
    notifications.value = notificationsRes.data || []
    
    // 检查复习提醒
    await checkReminders()
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

// 开始新练习
function startNewPractice() {
  router.push('/word-practice/new')
}

// 查看练习历史
function viewHistory() {
  router.push('/word-practice/history')
}

// 查看错题集
function viewMistakes() {
  router.push('/word-practice/mistakes')
}

// 查看复习计划
function viewReviewPlans() {
  router.push('/word-practice/reviews')
}

// 开始复习
function startReview() {
  if (dueReviews.value.length > 0) {
    router.push('/word-practice/review')
  } else {
    ElMessage.info('暂无待复习的词汇')
  }
}

// 继续练习
function continuePractice(sessionId) {
  router.push(`/word-practice/session/${sessionId}`)
}

// 查看练习结果
function viewResult(sessionId) {
  router.push(`/word-practice/session/${sessionId}/result`)
}

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  
  return date.toLocaleDateString()
}

// 获取状态标签
function getStatusTag(status) {
  const map = {
    'in_progress': { text: '进行中', type: 'warning' },
    'completed': { text: '已完成', type: 'success' },
    'abandoned': { text: '已放弃', type: 'info' }
  }
  return map[status] || { text: status, type: 'info' }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="word-practice-page" v-loading="loading">
    <div class="page-header">
      <h1>🎯 词汇趣味练习</h1>
      <p class="subtitle">通过游戏化的方式记忆词汇，让学习更有趣！</p>
    </div>
    
    <!-- 快捷操作区 -->
    <div class="quick-actions">
      <el-card class="action-card primary" @click="startNewPractice">
        <div class="action-content">
          <el-icon class="action-icon" :size="40"><Reading /></el-icon>
          <div class="action-text">
            <h3>开始练习</h3>
            <p>选择分类，开始新的词汇记忆</p>
          </div>
        </div>
      </el-card>
      
      <el-card class="action-card" :class="{ 'has-due': dueReviews.length > 0 }" @click="startReview">
        <div class="action-content">
          <el-icon class="action-icon" :size="40"><Clock /></el-icon>
          <div class="action-text">
            <h3>开始复习</h3>
            <p v-if="dueReviews.length > 0">{{ dueReviews.length }} 个词汇待复习</p>
            <p v-else>暂无待复习词汇</p>
          </div>
          <el-badge v-if="dueReviews.length > 0" :value="dueReviews.length" class="due-badge" />
        </div>
      </el-card>
      
      <el-card class="action-card" @click="viewMistakes">
        <div class="action-content">
          <el-icon class="action-icon" :size="40"><Warning /></el-icon>
          <div class="action-text">
            <h3>错题集</h3>
            <p v-if="mistakeStats">{{ mistakeStats.unmastered_count || 0 }} 个待攻克</p>
            <p v-else>查看错题记录</p>
          </div>
        </div>
      </el-card>
      
      <el-card class="action-card" @click="viewHistory">
        <div class="action-content">
          <el-icon class="action-icon" :size="40"><Trophy /></el-icon>
          <div class="action-text">
            <h3>练习记录</h3>
            <p>查看历史成绩</p>
          </div>
        </div>
      </el-card>
    </div>
    
    <!-- 统计概览 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ dictionaryStats?.totalWords || 0 }}</div>
          <div class="stat-label">词库总量</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ reviewStats?.completedPlans || 0 }}</div>
          <div class="stat-label">已掌握</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ reviewStats?.todayDue || 0 }}</div>
          <div class="stat-label">今日待复习</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ mistakeStats?.total_mistakes || 0 }}</div>
          <div class="stat-label">错题总数</div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 内容区域 -->
    <el-row :gutter="20" class="content-row">
      <!-- 最近练习 -->
      <el-col :span="12">
        <el-card class="content-card">
          <template #header>
            <div class="card-header">
              <span>📝 最近练习</span>
              <el-button text type="primary" @click="viewHistory">
                查看全部 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>
          
          <div v-if="recentSessions.length > 0" class="session-list">
            <div 
              v-for="session in recentSessions" 
              :key="session.id" 
              class="session-item"
              @click="session.status === 'completed' ? viewResult(session.id) : continuePractice(session.id)"
            >
              <div class="session-info">
                <span class="session-title">{{ session.title || '词汇练习' }}</span>
                <span class="session-meta">
                  {{ session.word_count }} 个词汇 · {{ formatTime(session.created_at) }}
                </span>
              </div>
              <div class="session-status">
                <el-tag :type="getStatusTag(session.status).type" size="small">
                  {{ getStatusTag(session.status).text }}
                </el-tag>
                <span v-if="session.avg_score" class="session-score">
                  {{ Math.round(session.avg_score) }}分
                </span>
              </div>
            </div>
          </div>
          <el-empty v-else description="还没有练习记录" :image-size="80">
            <el-button type="primary" @click="startNewPractice">开始第一次练习</el-button>
          </el-empty>
        </el-card>
      </el-col>
      
      <!-- 待复习词汇 -->
      <el-col :span="12">
        <el-card class="content-card">
          <template #header>
            <div class="card-header">
              <span>⏰ 待复习词汇</span>
              <el-button text type="primary" @click="viewReviewPlans">
                查看全部 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </template>
          
          <div v-if="dueReviews.length > 0" class="review-list">
            <div v-for="review in dueReviews" :key="review.id" class="review-item">
              <div class="review-word">
                <span class="word-text">{{ review.word }}</span>
                <el-tag size="small" type="info">{{ review.category }}</el-tag>
              </div>
              <div class="review-info">
                <span class="review-stage">第 {{ review.review_stage }} 轮</span>
              </div>
            </div>
            <el-button type="primary" class="start-review-btn" @click="startReview">
              开始复习 ({{ dueReviews.length }})
            </el-button>
          </div>
          <el-empty v-else description="暂无待复习词汇" :image-size="80">
            <p class="empty-tip">完成练习后，系统会自动生成复习计划</p>
          </el-empty>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 通知提醒 -->
    <el-card v-if="notifications.length > 0" class="notifications-card">
      <template #header>
        <div class="card-header">
          <span><el-icon><Bell /></el-icon> 消息通知</span>
        </div>
      </template>
      <div class="notification-list">
        <div v-for="notification in notifications" :key="notification.id" class="notification-item">
          <span class="notification-title">{{ notification.title }}</span>
          <span class="notification-content">{{ notification.content }}</span>
          <span class="notification-time">{{ formatTime(notification.created_at) }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.word-practice-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  text-align: center;
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 28px;
  color: #303133;
  margin: 0 0 10px 0;
}

.page-header .subtitle {
  color: #909399;
  margin: 0;
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.action-card {
  cursor: pointer;
  transition: all 0.3s;
  border: 2px solid transparent;
}

.action-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.action-card.primary {
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  color: white;
}

.action-card.primary .action-icon {
  color: white;
}

.action-card.has-due {
  border-color: #e6a23c;
  background: linear-gradient(135deg, #fdf6ec 0%, #fef0db 100%);
}

.action-content {
  display: flex;
  align-items: center;
  gap: 16px;
  position: relative;
}

.action-icon {
  color: #409eff;
}

.action-text h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
}

.action-text p {
  margin: 0;
  font-size: 13px;
  opacity: 0.8;
}

.due-badge {
  position: absolute;
  top: -10px;
  right: -10px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  padding: 10px 0;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.content-row {
  margin-bottom: 20px;
}

.content-card {
  min-height: 300px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-list, .review-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.session-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.3s;
}

.session-item:hover {
  background: #ebeef5;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.session-title {
  font-weight: 500;
  color: #303133;
}

.session-meta {
  font-size: 12px;
  color: #909399;
}

.session-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-score {
  font-weight: 600;
  color: #67c23a;
}

.review-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
}

.review-word {
  display: flex;
  align-items: center;
  gap: 8px;
}

.word-text {
  font-weight: 500;
  color: #303133;
}

.review-stage {
  font-size: 12px;
  color: #909399;
}

.start-review-btn {
  margin-top: 16px;
  width: 100%;
}

.empty-tip {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

.notifications-card {
  margin-top: 20px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notification-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 8px;
}

.notification-title {
  font-weight: 500;
  color: #303133;
}

.notification-content {
  flex: 1;
  color: #606266;
  font-size: 13px;
}

.notification-time {
  font-size: 12px;
  color: #909399;
}

@media (max-width: 768px) {
  .quick-actions {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .content-row .el-col {
    margin-bottom: 20px;
  }
}
</style>
