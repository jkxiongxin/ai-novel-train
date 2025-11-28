<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getFreewrite, submitSelfReview, requestAIReview, deleteFreewrite } from '../../api/freewrite'
import { ElMessage, ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()

const practiceId = computed(() => route.params.id)
const loading = ref(true)
const reviewLoading = ref(false)
const practice = ref(null)
const reviews = ref([])

// 自评对话框
const selfReviewVisible = ref(false)
const selfReviewForm = ref({
  score: 70,
  comment: '',
  tags: []
})

const tagOptions = [
  '思路清晰', '情感真挚', '用词优美', '想象丰富',
  '节奏流畅', '描写细腻', '有创意', '值得继续'
]

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

function getFinishTypeLabel(type) {
  const map = {
    manual: '手动结束',
    pomodoro: '番茄钟结束'
  }
  return map[type] || type
}

async function loadPractice() {
  try {
    loading.value = true
    const res = await getFreewrite(practiceId.value)
    practice.value = res.data
    reviews.value = res.data.reviews || []
    
    // 解析评审数据
    reviews.value.forEach(review => {
      try {
        if (review.dimension_scores) {
          review.dimensions = JSON.parse(review.dimension_scores)
        }
        if (review.highlights) {
          review.highlights = JSON.parse(review.highlights)
        }
        if (review.improvements) {
          review.improvements = JSON.parse(review.improvements)
        }
        if (review.tags) {
          review.tags = JSON.parse(review.tags)
        }
      } catch {}
    })
  } catch (error) {
    console.error('加载失败:', error)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 继续写作
function continuePractice() {
  if (practice.value.status === 'writing') {
    router.push(`/freewrite/do/${practice.value.id}`)
  } else {
    router.push({
      path: '/freewrite/do',
      query: {
        parentId: practice.value.id,
        title: `续写：${practice.value.title}`,
        duration: null
      }
    })
  }
}

// 打开自评对话框
function openSelfReview() {
  selfReviewForm.value = {
    score: 70,
    comment: '',
    tags: []
  }
  selfReviewVisible.value = true
}

// 提交自评
async function handleSelfReview() {
  if (!selfReviewForm.value.comment.trim()) {
    ElMessage.warning('请输入评价内容')
    return
  }
  
  try {
    reviewLoading.value = true
    await submitSelfReview(practiceId.value, selfReviewForm.value)
    ElMessage.success('自评保存成功')
    selfReviewVisible.value = false
    loadPractice()
  } catch (error) {
    console.error('自评失败:', error)
  } finally {
    reviewLoading.value = false
  }
}

// AI 评审
async function handleAIReview() {
  try {
    await ElMessageBox.confirm(
      '确定要请求 AI 评审吗？',
      'AI 评审',
      { type: 'info' }
    )
  } catch {
    return
  }
  
  try {
    reviewLoading.value = true
    await requestAIReview(practiceId.value)
    ElMessage.success('AI 评审完成')
    loadPractice()
  } catch (error) {
    console.error('AI 评审失败:', error)
  } finally {
    reviewLoading.value = false
  }
}

// 删除练习
async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个练习吗？删除后无法恢复。',
      '确认删除',
      { type: 'warning' }
    )
    await deleteFreewrite(practiceId.value)
    ElMessage.success('删除成功')
    router.push('/freewrite')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

// 获取分数颜色
function getScoreColor(score) {
  if (score >= 85) return '#67c23a'
  if (score >= 70) return '#409eff'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
}

onMounted(() => {
  loadPractice()
})
</script>

<template>
  <div class="freewrite-detail" v-loading="loading">
    <!-- 顶部操作栏 -->
    <div class="page-header">
      <div class="header-left">
        <el-button @click="$router.push('/freewrite')">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <h1>{{ practice?.title }}</h1>
        <el-tag :type="getStatusTag(practice?.status).type">
          {{ getStatusTag(practice?.status).label }}
        </el-tag>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="continuePractice">
          <el-icon><EditPen /></el-icon>
          {{ practice?.status === 'writing' ? '继续写作' : '续写' }}
        </el-button>
        <el-button type="danger" @click="handleDelete">
          删除
        </el-button>
      </div>
    </div>

    <!-- 练习信息 -->
    <div class="content-wrapper" v-if="practice">
      <div class="main-content">
        <!-- 作品内容 -->
        <el-card class="content-card">
          <template #header>
            <span>📝 作品内容</span>
          </template>
          <div class="practice-content">
            <div v-if="practice.content" class="content-text">
              {{ practice.content }}
            </div>
            <el-empty v-else description="暂无内容" />
          </div>
        </el-card>

        <!-- 评审记录 -->
        <el-card class="reviews-card">
          <template #header>
            <div class="card-header">
              <span>📋 评审记录</span>
              <div class="review-actions" v-if="practice.status !== 'writing'">
                <el-button @click="openSelfReview" :loading="reviewLoading">
                  自我评审
                </el-button>
                <el-button type="primary" @click="handleAIReview" :loading="reviewLoading">
                  AI 评审
                </el-button>
              </div>
            </div>
          </template>

          <div v-if="reviews.length === 0" class="no-reviews">
            <el-empty description="暂无评审记录">
              <template #default v-if="practice.status !== 'writing'">
                <p class="empty-tip">选择自我评审或 AI 评审来获取反馈</p>
              </template>
            </el-empty>
          </div>

          <div v-else class="review-list">
            <div
              v-for="review in reviews"
              :key="review.id"
              class="review-item"
              :class="review.review_type"
            >
              <div class="review-header">
                <div class="review-type">
                  <el-tag :type="review.review_type === 'ai' ? 'primary' : 'success'" size="small">
                    {{ review.review_type === 'ai' ? 'AI 评审' : '自我评审' }}
                  </el-tag>
                  <span class="review-time">{{ formatDate(review.created_at) }}</span>
                </div>
                <div class="review-score" v-if="review.score" :style="{ color: getScoreColor(review.score) }">
                  {{ review.score }} 分
                </div>
              </div>

              <!-- AI 评审详情 -->
              <template v-if="review.review_type === 'ai'">
                <div v-if="review.dimensions?.length" class="dimensions">
                  <div
                    v-for="dim in review.dimensions"
                    :key="dim.name"
                    class="dimension-item"
                  >
                    <div class="dim-header">
                      <span class="dim-name">{{ dim.name }}</span>
                      <span class="dim-score" :style="{ color: getScoreColor(dim.score) }">
                        {{ dim.score }}分
                      </span>
                    </div>
                    <el-progress
                      :percentage="dim.score"
                      :stroke-width="8"
                      :color="getScoreColor(dim.score)"
                      :show-text="false"
                    />
                    <p class="dim-comment">{{ dim.comment }}</p>
                  </div>
                </div>

                <div v-if="review.highlights?.length" class="section">
                  <h4>✨ 亮点</h4>
                  <ul>
                    <li v-for="(h, i) in review.highlights" :key="i">{{ h }}</li>
                  </ul>
                </div>

                <div v-if="review.improvements?.length" class="section">
                  <h4>💡 改进建议</h4>
                  <ul>
                    <li v-for="(imp, i) in review.improvements" :key="i">{{ imp }}</li>
                  </ul>
                </div>
              </template>

              <!-- 自评内容 -->
              <div v-if="review.comment" class="review-comment">
                {{ review.comment }}
              </div>

              <!-- 自评标签 -->
              <div v-if="review.tags?.length" class="review-tags">
                <el-tag
                  v-for="tag in review.tags"
                  :key="tag"
                  size="small"
                  type="info"
                >
                  {{ tag }}
                </el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 侧边信息 -->
      <div class="side-info">
        <el-card class="info-card">
          <template #header>
            <span>📊 练习信息</span>
          </template>
          <div class="info-list">
            <div class="info-item">
              <span class="info-label">字数</span>
              <span class="info-value">{{ practice.word_count || 0 }} 字</span>
            </div>
            <div class="info-item">
              <span class="info-label">用时</span>
              <span class="info-value">{{ formatTime(practice.time_spent) }}</span>
            </div>
            <div class="info-item" v-if="practice.pomodoro_duration">
              <span class="info-label">番茄钟</span>
              <span class="info-value">{{ practice.pomodoro_duration }} 分钟</span>
            </div>
            <div class="info-item" v-if="practice.finish_type">
              <span class="info-label">结束方式</span>
              <span class="info-value">{{ getFinishTypeLabel(practice.finish_type) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">创建时间</span>
              <span class="info-value">{{ formatDate(practice.created_at) }}</span>
            </div>
            <div class="info-item" v-if="practice.finished_at">
              <span class="info-label">完成时间</span>
              <span class="info-value">{{ formatDate(practice.finished_at) }}</span>
            </div>
          </div>
        </el-card>

        <!-- 写作速度 -->
        <el-card class="info-card" v-if="practice.word_count && practice.time_spent">
          <template #header>
            <span>⚡ 写作速度</span>
          </template>
          <div class="speed-stat">
            <div class="speed-value">
              {{ Math.round(practice.word_count / (practice.time_spent / 60)) }}
            </div>
            <div class="speed-label">字/分钟</div>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 自评对话框 -->
    <el-dialog v-model="selfReviewVisible" title="自我评审" width="500px">
      <el-form :model="selfReviewForm" label-position="top">
        <el-form-item label="给自己打分">
          <el-slider
            v-model="selfReviewForm.score"
            :min="0"
            :max="100"
            :step="5"
            show-input
          />
        </el-form-item>
        
        <el-form-item label="选择标签">
          <div class="tag-selector">
            <el-check-tag
              v-for="tag in tagOptions"
              :key="tag"
              :checked="selfReviewForm.tags.includes(tag)"
              @change="checked => {
                if (checked) {
                  selfReviewForm.tags.push(tag)
                } else {
                  selfReviewForm.tags = selfReviewForm.tags.filter(t => t !== tag)
                }
              }"
            >
              {{ tag }}
            </el-check-tag>
          </div>
        </el-form-item>
        
        <el-form-item label="评价内容">
          <el-input
            v-model="selfReviewForm.comment"
            type="textarea"
            :rows="4"
            placeholder="写下你对这次写作的感受和评价..."
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="selfReviewVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSelfReview" :loading="reviewLoading">
          保存评审
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.freewrite-detail {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  margin: 0;
  font-size: 24px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.content-wrapper {
  display: flex;
  gap: 24px;
}

.main-content {
  flex: 1;
  min-width: 0;
}

.side-info {
  width: 300px;
  flex-shrink: 0;
}

.content-card,
.reviews-card,
.info-card {
  margin-bottom: 20px;
}

.practice-content {
  line-height: 2;
}

.content-text {
  white-space: pre-wrap;
  font-size: 16px;
  color: #303133;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.review-actions {
  display: flex;
  gap: 8px;
}

.no-reviews {
  padding: 20px 0;
}

.empty-tip {
  color: #909399;
  font-size: 14px;
  margin-top: 8px;
}

.review-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.review-item {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border-left: 4px solid #409eff;
}

.review-item.self {
  border-left-color: #67c23a;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.review-type {
  display: flex;
  align-items: center;
  gap: 12px;
}

.review-time {
  font-size: 13px;
  color: #909399;
}

.review-score {
  font-size: 24px;
  font-weight: bold;
}

.dimensions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.dimension-item {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.dim-name {
  font-weight: 500;
  color: #303133;
}

.dim-score {
  font-weight: bold;
}

.dim-comment {
  margin: 8px 0 0;
  font-size: 13px;
  color: #606266;
}

.section {
  margin-top: 16px;
}

.section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #303133;
}

.section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
}

.review-comment {
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
  margin-bottom: 12px;
}

.review-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.info-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.info-label {
  color: #909399;
  font-size: 14px;
}

.info-value {
  color: #303133;
  font-weight: 500;
}

.speed-stat {
  text-align: center;
  padding: 20px 0;
}

.speed-value {
  font-size: 48px;
  font-weight: bold;
  color: #409eff;
}

.speed-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.tag-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-selector .el-check-tag {
  cursor: pointer;
}

@media (max-width: 768px) {
  .content-wrapper {
    flex-direction: column;
  }
  
  .side-info {
    width: 100%;
  }
  
  .dimensions {
    grid-template-columns: 1fr;
  }
}
</style>
