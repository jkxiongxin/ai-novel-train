<template>
  <div class="word-practice-history">
    <div class="page-header">
      <h2>练习记录</h2>
      <el-button @click="goBack" :icon="ArrowLeft">返回</el-button>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row" v-if="stats">
      <el-card class="stat-card">
        <div class="stat-value">{{ stats.totalSessions || 0 }}</div>
        <div class="stat-label">总练习次数</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value">{{ stats.totalWords || 0 }}</div>
        <div class="stat-label">练习词汇数</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value">{{ stats.avgAccuracy || 0 }}%</div>
        <div class="stat-label">平均正确率</div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-value">{{ formatDuration(stats.totalTime || 0) }}</div>
        <div class="stat-label">总练习时长</div>
      </el-card>
    </div>

    <!-- 练习记录列表 -->
    <el-card class="history-list">
      <template #header>
        <div class="card-header">
          <span>历史记录</span>
          <el-select v-model="filterStatus" placeholder="状态筛选" style="width: 120px" @change="loadHistory">
            <el-option label="全部" value="" />
            <el-option label="已完成" value="completed" />
            <el-option label="进行中" value="in_progress" />
          </el-select>
        </div>
      </template>

      <el-table :data="historyList" v-loading="loading" stripe>
        <el-table-column label="练习标题" prop="title" min-width="180">
          <template #default="{ row }">
            <span class="session-title">{{ row.title || '词汇练习' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="词汇数" prop="word_count" width="80" align="center" />
        <el-table-column label="正确/总题" width="100" align="center">
          <template #default="{ row }">
            <span :class="getAccuracyClass(row)">
              {{ row.correct_count || 0 }}/{{ row.total_questions || 0 }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="得分" width="80" align="center">
          <template #default="{ row }">
            <span :class="getScoreClass(row.total_score)">
              {{ row.total_score ? row.total_score.toFixed(1) : '-' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="练习时间" width="160" align="center">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="row.status === 'completed'" 
              type="primary" 
              size="small" 
              text
              @click="viewResult(row.id)"
            >
              查看结果
            </el-button>
            <el-button 
              v-if="row.status === 'completed'" 
              type="warning" 
              size="small" 
              text
              :loading="reviewingId === row.id"
              @click="reReview(row.id)"
            >
              重新批改
            </el-button>
            <el-button 
              v-if="row.status === 'completed'" 
              type="success" 
              size="small" 
              text
              :loading="creatingPlanId === row.id"
              @click="createReviewPlan(row.id)"
            >
              <el-icon><Calendar /></el-icon>
              生成复习
            </el-button>
            <el-button 
              v-else-if="row.status === 'in_progress'" 
              type="success" 
              size="small" 
              text
              @click="continuePractice(row.id)"
            >
              继续练习
            </el-button>
            <el-button type="danger" size="small" text @click="deleteSession(row.id)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper" v-if="total > pageSize">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="loadHistory"
        />
      </div>

      <!-- 空状态 -->
      <el-empty v-if="!loading && historyList.length === 0" description="暂无练习记录" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Calendar } from '@element-plus/icons-vue'
import { getPracticeSessions, deletePracticeSession, getPracticeStats, aiReviewSentences, createReviewPlansForSession } from '@/api/wordPractice'

const router = useRouter()

const loading = ref(false)
const historyList = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const filterStatus = ref('')
const stats = ref(null)
const reviewingId = ref(null) // 正在重新批改的会话ID
const creatingPlanId = ref(null) // 正在创建复习计划的会话ID

onMounted(() => {
  loadHistory()
  loadStats()
})

// 加载练习历史
async function loadHistory() {
  loading.value = true
  try {
    const res = await getPracticeSessions({
      page: page.value,
      pageSize: pageSize.value,
      status: filterStatus.value || undefined
    })
    if (res.success) {
      historyList.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (error) {
    console.error('加载练习历史失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载统计数据
async function loadStats() {
  try {
    const res = await getPracticeStats()
    if (res.success) {
      stats.value = res.data
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 查看结果
function viewResult(sessionId) {
  router.push(`/word-practice/session/${sessionId}/result`)
}

// 继续练习
function continuePractice(sessionId) {
  router.push(`/word-practice/session/${sessionId}`)
}

// 删除练习记录
async function deleteSession(sessionId) {
  try {
    await ElMessageBox.confirm('确定要删除这条练习记录吗？', '提示', {
      type: 'warning'
    })
    
    const res = await deletePracticeSession(sessionId)
    if (res.success) {
      ElMessage.success('删除成功')
      loadHistory()
      loadStats()
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

// 重新批改造句题
async function reReview(sessionId) {
  try {
    await ElMessageBox.confirm('确定要重新批改这次练习的造句题吗？AI将重新评分。', '重新批改', {
      type: 'info',
      confirmButtonText: '开始批改',
      cancelButtonText: '取消'
    })
    
    reviewingId.value = sessionId
    ElMessage.info('AI正在重新批改造句题...')
    
    const res = await aiReviewSentences(sessionId)
    if (res.success) {
      if (res.data.reviewedCount > 0) {
        ElMessage.success(`批改完成，共批改 ${res.data.reviewedCount} 道造句题`)
        loadHistory() // 刷新列表以显示新分数
        loadStats()
      } else {
        ElMessage.warning('没有需要批改的造句题')
      }
    } else {
      ElMessage.error(res.message || '批改失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重新批改失败:', error)
      ElMessage.error('批改失败，请重试')
    }
  } finally {
    reviewingId.value = null
  }
}

// 为该练习的错题生成复习计划
async function createReviewPlan(sessionId) {
  try {
    creatingPlanId.value = sessionId
    
    const res = await createReviewPlansForSession(sessionId)
    if (res.success) {
      const { created, skipped, message } = res.data
      if (created > 0) {
        ElMessage.success(message)
      } else {
        ElMessage.info(skipped > 0 ? '所有错题已有复习计划' : '该练习没有错题')
      }
    } else {
      ElMessage.error(res.message || '创建失败')
    }
  } catch (error) {
    console.error('创建复习计划失败:', error)
    ElMessage.error('创建复习计划失败')
  } finally {
    creatingPlanId.value = null
  }
}

// 返回
function goBack() {
  router.push('/word-practice')
}

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 格式化时长
function formatDuration(seconds) {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

// 获取正确率样式
function getAccuracyClass(row) {
  if (!row.total_questions) return ''
  const accuracy = row.correct_count / row.total_questions
  if (accuracy >= 0.8) return 'text-success'
  if (accuracy >= 0.6) return 'text-warning'
  return 'text-danger'
}

// 获取分数样式
function getScoreClass(score) {
  if (!score) return ''
  if (score >= 80) return 'text-success'
  if (score >= 60) return 'text-warning'
  return 'text-danger'
}

// 获取状态类型
function getStatusType(status) {
  const types = {
    'completed': 'success',
    'in_progress': 'warning',
    'preparing': 'info'
  }
  return types[status] || 'info'
}

// 获取状态文本
function getStatusText(status) {
  const texts = {
    'completed': '已完成',
    'in_progress': '进行中',
    'preparing': '准备中'
  }
  return texts[status] || status
}
</script>

<style scoped>
.word-practice-history {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: var(--el-color-primary);
}

.stat-label {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
}

.history-list {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-title {
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

.text-success {
  color: var(--el-color-success);
  font-weight: 500;
}

.text-warning {
  color: var(--el-color-warning);
  font-weight: 500;
}

.text-danger {
  color: var(--el-color-danger);
  font-weight: 500;
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .stat-value {
    font-size: 22px;
  }
}
</style>
