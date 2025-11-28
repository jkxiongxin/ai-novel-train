<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getFreewriteList, deleteFreewrite, getFreewriteStats } from '../../api/freewrite'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const loading = ref(true)
const practices = ref([])
const stats = ref({
  totalPractices: 0,
  totalWords: 0,
  totalTime: 0,
  avgScore: 0,
  reviewedPractices: 0
})
const pagination = ref({
  page: 1,
  pageSize: 10,
  total: 0
})
const filterStatus = ref('')

// 番茄钟预设时长
const pomodoroOptions = [
  { label: '15分钟', value: 15 },
  { label: '25分钟', value: 25 },
  { label: '45分钟', value: 45 },
  { label: '60分钟', value: 60 },
  { label: '不限时', value: null }
]

// 开始写作对话框
const dialogVisible = ref(false)
const newPractice = ref({
  title: '',
  pomodoro_duration: 25
})

function formatTime(seconds) {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getStatusTag(status) {
  const map = {
    writing: { type: 'primary', label: '写作中' },
    finished: { type: 'success', label: '已完成' },
    reviewed: { type: 'info', label: '已评审' }
  }
  return map[status] || { type: 'info', label: status }
}

async function loadPractices() {
  try {
    loading.value = true
    const res = await getFreewriteList({
      status: filterStatus.value || undefined,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    practices.value = res.data.list
    pagination.value.total = res.data.total
  } catch (error) {
    console.error('加载失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await getFreewriteStats()
    stats.value = res.data
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

function openNewDialog() {
  newPractice.value = {
    title: '',
    pomodoro_duration: 25
  }
  dialogVisible.value = true
}

function startWriting() {
  dialogVisible.value = false
  router.push({
    path: '/freewrite/do',
    query: {
      title: newPractice.value.title || '随心练习',
      duration: newPractice.value.pomodoro_duration
    }
  })
}

function continuePractice(practice) {
  router.push({
    path: '/freewrite/do',
    query: {
      parentId: practice.id,
      title: `续写：${practice.title}`,
      duration: null
    }
  })
}

function viewPractice(practice) {
  router.push(`/freewrite/${practice.id}`)
}

async function handleDelete(practice) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个练习吗？删除后无法恢复。',
      '确认删除',
      { type: 'warning' }
    )
    await deleteFreewrite(practice.id)
    ElMessage.success('删除成功')
    loadPractices()
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

function handlePageChange(page) {
  pagination.value.page = page
  loadPractices()
}

onMounted(() => {
  loadPractices()
  loadStats()
})
</script>

<template>
  <div class="freewrite-index">
    <!-- 页面标题 -->
    <div class="page-header">
      <div class="header-left">
        <h1>✍️ 随心练习</h1>
        <p class="subtitle">自由写作，释放表达欲，培养输出习惯</p>
      </div>
      <el-button type="primary" size="large" @click="openNewDialog">
        <el-icon><EditPen /></el-icon>
        开始写作
      </el-button>
    </div>

    <!-- 统计概览 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #409eff">📝</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalPractices }}</div>
          <div class="stat-label">练习次数</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #67c23a">📄</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.totalWords?.toLocaleString() }}</div>
          <div class="stat-label">累计字数</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #e6a23c">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatTime(stats.totalTime) }}</div>
          <div class="stat-label">累计时间</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #f56c6c">⭐</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.avgScore || '-' }}</div>
          <div class="stat-label">平均得分</div>
        </div>
      </el-card>
    </div>

    <!-- 理念介绍 -->
    <el-card class="intro-card">
      <div class="intro-content">
        <div class="intro-item">
          <span class="intro-icon">🍅</span>
          <div>
            <h4>番茄时间法</h4>
            <p>设定专注时长，沉浸式写作，到时自动结束</p>
          </div>
        </div>
        <div class="intro-item">
          <span class="intro-icon">💭</span>
          <div>
            <h4>自由表达</h4>
            <p>无固定题目限制，想写什么写什么</p>
          </div>
        </div>
        <div class="intro-item">
          <span class="intro-icon">📖</span>
          <div>
            <h4>续写支持</h4>
            <p>可基于之前的作品继续创作</p>
          </div>
        </div>
        <div class="intro-item">
          <span class="intro-icon">✨</span>
          <div>
            <h4>灵活评审</h4>
            <p>AI评审或自评，也可选择不评审</p>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 练习列表 -->
    <el-card class="practice-list-card">
      <template #header>
        <div class="card-header">
          <span>📚 练习记录</span>
          <el-select
            v-model="filterStatus"
            placeholder="筛选状态"
            clearable
            style="width: 120px"
            @change="loadPractices"
          >
            <el-option label="写作中" value="writing" />
            <el-option label="已完成" value="finished" />
            <el-option label="已评审" value="reviewed" />
          </el-select>
        </div>
      </template>

      <div v-loading="loading">
        <el-empty v-if="!loading && practices.length === 0" description="还没有练习记录，开始你的第一次随心写作吧！" />
        
        <div v-else class="practice-list">
          <div
            v-for="practice in practices"
            :key="practice.id"
            class="practice-item"
            @click="viewPractice(practice)"
          >
            <div class="practice-main">
              <div class="practice-title">
                {{ practice.title }}
                <el-tag 
                  size="small" 
                  :type="getStatusTag(practice.status).type"
                  style="margin-left: 8px"
                >
                  {{ getStatusTag(practice.status).label }}
                </el-tag>
              </div>
              <div class="practice-preview">
                {{ practice.content?.slice(0, 100) }}{{ practice.content?.length > 100 ? '...' : '' }}
              </div>
              <div class="practice-meta">
                <span><el-icon><Document /></el-icon> {{ practice.word_count || 0 }} 字</span>
                <span><el-icon><Timer /></el-icon> {{ formatTime(practice.time_spent) }}</span>
                <span v-if="practice.pomodoro_duration">
                  <el-icon><AlarmClock /></el-icon> 番茄钟 {{ practice.pomodoro_duration }}分钟
                </span>
                <span><el-icon><Calendar /></el-icon> {{ formatDate(practice.updated_at) }}</span>
              </div>
            </div>
            <div class="practice-actions" @click.stop>
              <el-button
                v-if="practice.status !== 'writing'"
                type="primary"
                text
                @click="continuePractice(practice)"
              >
                续写
              </el-button>
              <el-button
                v-if="practice.status === 'writing'"
                type="primary"
                text
                @click="viewPractice(practice)"
              >
                继续
              </el-button>
              <el-button type="danger" text @click="handleDelete(practice)">
                删除
              </el-button>
            </div>
          </div>
        </div>

        <div class="pagination-wrapper" v-if="pagination.total > pagination.pageSize">
          <el-pagination
            :current-page="pagination.page"
            :page-size="pagination.pageSize"
            :total="pagination.total"
            layout="prev, pager, next"
            @current-change="handlePageChange"
          />
        </div>
      </div>
    </el-card>

    <!-- 开始写作对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="开始随心写作"
      width="480px"
    >
      <el-form :model="newPractice" label-position="top">
        <el-form-item label="标题（可选）">
          <el-input
            v-model="newPractice.title"
            placeholder="给这次写作起个名字..."
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <el-form-item label="番茄钟时长">
          <div class="pomodoro-options">
            <div
              v-for="option in pomodoroOptions"
              :key="option.value"
              class="pomodoro-option"
              :class="{ active: newPractice.pomodoro_duration === option.value }"
              @click="newPractice.pomodoro_duration = option.value"
            >
              <span class="option-icon">{{ option.value ? '🍅' : '∞' }}</span>
              <span class="option-label">{{ option.label }}</span>
            </div>
          </div>
          <p class="pomodoro-tip">
            {{ newPractice.pomodoro_duration 
              ? `写作 ${newPractice.pomodoro_duration} 分钟后自动结束，期间请专注写作` 
              : '不限制时间，随时可以结束' 
            }}
          </p>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="startWriting">
          <el-icon><EditPen /></el-icon>
          开始写作
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.freewrite-index {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0;
  font-size: 28px;
}

.subtitle {
  margin: 8px 0 0;
  color: #909399;
  font-size: 14px;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  padding: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.intro-card {
  margin-bottom: 20px;
}

.intro-content {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.intro-item {
  display: flex;
  gap: 12px;
}

.intro-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.intro-item h4 {
  margin: 0 0 4px;
  font-size: 15px;
  color: #303133;
}

.intro-item p {
  margin: 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

.practice-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.practice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.practice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.practice-item:hover {
  background: #f0f2f5;
  transform: translateX(4px);
}

.practice-main {
  flex: 1;
  min-width: 0;
}

.practice-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 8px;
}

.practice-preview {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.practice-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
}

.practice-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.practice-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.pomodoro-options {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.pomodoro-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 20px;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}

.pomodoro-option:hover {
  border-color: #409eff;
}

.pomodoro-option.active {
  border-color: #409eff;
  background: #ecf5ff;
}

.option-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.option-label {
  font-size: 14px;
  color: #606266;
}

.pomodoro-tip {
  margin: 12px 0 0;
  font-size: 13px;
  color: #909399;
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .intro-content {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
