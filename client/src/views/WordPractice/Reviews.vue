<script setup>
/**
 * 复习计划页面
 * 展示基于艾宾浩斯遗忘曲线的复习计划
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Clock, Check, Close, Refresh } from '@element-plus/icons-vue'
import { 
  getReviewPlans, 
  getReviewStats,
  getDueReviews,
  completeReview,
  skipReview
} from '../../api/wordPractice'

const router = useRouter()

// 状态
const loading = ref(false)
const plans = ref([])
const stats = ref(null)
const dueReviews = ref([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 筛选
const statusFilter = ref('')

// 复习阶段说明
const stageDescriptions = [
  { stage: 1, interval: '20分钟', desc: '第一次复习' },
  { stage: 2, interval: '1小时', desc: '第二次复习' },
  { stage: 3, interval: '9小时', desc: '第三次复习' },
  { stage: 4, interval: '1天', desc: '第四次复习' },
  { stage: 5, interval: '2天', desc: '第五次复习' },
  { stage: 6, interval: '6天', desc: '第六次复习' },
  { stage: 7, interval: '31天', desc: '最终复习' }
]

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [plansRes, statsRes, dueRes] = await Promise.all([
      getReviewPlans({
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        status: statusFilter.value
      }),
      getReviewStats(),
      getDueReviews({ limit: 50 })
    ])
    
    plans.value = plansRes.data?.list || []
    pagination.value.total = plansRes.data?.total || 0
    stats.value = statsRes.data
    dueReviews.value = dueRes.data || []
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 筛选
function handleFilter() {
  pagination.value.page = 1
  loadData()
}

// 分页
function handlePageChange(page) {
  pagination.value.page = page
  loadData()
}

// 开始复习
function startReview() {
  if (dueReviews.value.length === 0) {
    ElMessage.info('暂无待复习的词汇')
    return
  }
  router.push('/word-practice/review')
}

// 跳过复习
async function handleSkip(plan) {
  try {
    await skipReview(plan.id)
    ElMessage.success('已推迟到明天')
    loadData()
  } catch (error) {
    console.error('跳过失败:', error)
    ElMessage.error('操作失败')
  }
}

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diff = date - now
  
  // 已过期
  if (diff < 0) {
    const hours = Math.abs(Math.floor(diff / 3600000))
    if (hours < 1) return '刚刚到期'
    if (hours < 24) return `${hours}小时前到期`
    return `${Math.floor(hours / 24)}天前到期`
  }
  
  // 未来
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return `${Math.floor(diff / 60000)}分钟后`
  if (hours < 24) return `${hours}小时后`
  return `${Math.floor(hours / 24)}天后`
}

// 获取状态标签
function getStatusTag(status, nextReviewAt) {
  const now = new Date()
  const reviewTime = new Date(nextReviewAt)
  
  if (status === 'completed') {
    return { text: '已完成', type: 'success' }
  }
  if (reviewTime <= now) {
    return { text: '待复习', type: 'danger' }
  }
  return { text: '计划中', type: 'info' }
}

// 获取阶段进度
function getStageProgress(stage) {
  return Math.round((stage / 7) * 100)
}

// 返回
function goBack() {
  router.push('/word-practice')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="reviews-page" v-loading="loading">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <h1>📅 复习计划</h1>
    </div>
    
    <!-- 复习说明卡片 -->
    <el-card class="intro-card">
      <div class="intro-content">
        <div class="intro-icon">📚</div>
        <div class="intro-text">
          <h3>艾宾浩斯遗忘曲线复习法</h3>
          <p>系统会根据科学的记忆规律，在最佳时间点提醒您复习，帮助您高效记忆词汇。</p>
        </div>
        <el-button type="primary" @click="startReview" :disabled="dueReviews.length === 0">
          开始复习 ({{ dueReviews.length }})
        </el-button>
      </div>
    </el-card>
    
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row" v-if="stats">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.totalPlans || 0 }}</div>
          <div class="stat-label">总计划数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card danger">
          <div class="stat-value">{{ stats.todayDue || 0 }}</div>
          <div class="stat-label">今日待复习</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card warning">
          <div class="stat-value">{{ stats.weekDue || 0 }}</div>
          <div class="stat-label">本周待复习</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card success">
          <div class="stat-value">{{ stats.completedPlans || 0 }}</div>
          <div class="stat-label">已完成</div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 复习阶段说明 -->
    <el-card class="stages-card">
      <template #header>🔄 复习阶段</template>
      <div class="stages-list">
        <div v-for="s in stageDescriptions" :key="s.stage" class="stage-item">
          <div class="stage-number">{{ s.stage }}</div>
          <div class="stage-info">
            <span class="stage-interval">{{ s.interval }}</span>
            <span class="stage-desc">{{ s.desc }}</span>
          </div>
        </div>
      </div>
    </el-card>
    
    <!-- 计划列表 -->
    <el-card class="list-card">
      <template #header>
        <div class="list-header">
          <span>📋 复习计划列表</span>
          <div class="header-actions">
            <el-select 
              v-model="statusFilter" 
              placeholder="状态筛选" 
              clearable
              @change="handleFilter"
              style="width: 120px"
            >
              <el-option label="待复习" value="due" />
              <el-option label="计划中" value="pending" />
              <el-option label="已完成" value="completed" />
            </el-select>
            <el-button size="small" @click="loadData">
              <el-icon><Refresh /></el-icon>
            </el-button>
          </div>
        </div>
      </template>
      
      <el-table :data="plans" style="width: 100%">
        <el-table-column label="词汇" width="150">
          <template #default="{ row }">
            <span class="word-text">{{ row.word }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前阶段" width="150">
          <template #default="{ row }">
            <div class="stage-progress">
              <span>第 {{ row.review_stage }} 阶段</span>
              <el-progress 
                :percentage="getStageProgress(row.review_stage)" 
                :stroke-width="6"
                :show-text="false"
              />
            </div>
          </template>
        </el-table-column>
        <el-table-column label="下次复习" width="150">
          <template #default="{ row }">
            <span v-if="row.is_completed">-</span>
            <span v-else :class="{ 'due-text': new Date(row.next_review_at) <= new Date() }">
              {{ formatTime(row.next_review_at) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag 
              :type="getStatusTag(row.status, row.next_review_at).type"
              size="small"
            >
              {{ getStatusTag(row.status, row.next_review_at).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="review_count" label="已复习" width="80" />
        <el-table-column prop="correct_streak" label="连续正确" width="100" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="!row.is_completed && new Date(row.next_review_at) <= new Date()"
              size="small" 
              text
              type="warning"
              @click="handleSkip(row)"
            >
              推迟
            </el-button>
            <span v-else-if="row.is_completed" class="completed-text">✓</span>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-if="pagination.total > pagination.pageSize"
        class="pagination"
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
      
      <el-empty v-if="plans.length === 0 && !loading" description="暂无复习计划">
        <p class="empty-tip">完成练习后，系统会自动为错题生成复习计划</p>
      </el-empty>
    </el-card>
    
    <!-- 最近复习记录 -->
    <el-card v-if="stats?.recentRecords?.length > 0" class="records-card">
      <template #header>📈 最近7天复习记录</template>
      <div class="records-chart">
        <div v-for="record in stats.recentRecords" :key="record.review_date" class="record-bar">
          <span class="record-date">{{ record.review_date.slice(5) }}</span>
          <div class="record-progress">
            <el-progress 
              :percentage="record.total > 0 ? Math.round(record.correct / record.total * 100) : 0"
              :stroke-width="20"
              :text-inside="true"
            />
          </div>
          <span class="record-count">{{ record.correct }}/{{ record.total }}</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.reviews-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 16px 0 0 0;
}

.intro-card {
  margin-bottom: 24px;
  background: linear-gradient(135deg, #409eff20 0%, #67c23a20 100%);
}

.intro-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.intro-icon {
  font-size: 48px;
}

.intro-text {
  flex: 1;
}

.intro-text h3 {
  margin: 0 0 8px 0;
  color: #303133;
}

.intro-text p {
  margin: 0;
  color: #606266;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  padding: 16px;
}

.stat-card.danger .stat-value {
  color: #f56c6c;
}

.stat-card.warning .stat-value {
  color: #e6a23c;
}

.stat-card.success .stat-value {
  color: #67c23a;
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

.stages-card {
  margin-bottom: 24px;
}

.stages-list {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 10px 0;
}

.stage-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 12px;
  min-width: 140px;
}

.stage-number {
  width: 32px;
  height: 32px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.stage-info {
  display: flex;
  flex-direction: column;
}

.stage-interval {
  font-weight: 500;
  color: #303133;
}

.stage-desc {
  font-size: 12px;
  color: #909399;
}

.list-card {
  margin-bottom: 24px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.word-text {
  font-weight: 500;
  color: #303133;
}

.stage-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stage-progress span {
  font-size: 13px;
  color: #606266;
}

.due-text {
  color: #f56c6c;
  font-weight: 500;
}

.completed-text {
  color: #67c23a;
}

.pagination {
  margin-top: 20px;
  justify-content: center;
}

.empty-tip {
  color: #909399;
  font-size: 13px;
  margin-top: 8px;
}

.records-card {
  margin-bottom: 24px;
}

.records-chart {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.record-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.record-date {
  width: 60px;
  color: #606266;
}

.record-progress {
  flex: 1;
}

.record-count {
  width: 60px;
  text-align: right;
  color: #909399;
  font-size: 13px;
}
</style>
