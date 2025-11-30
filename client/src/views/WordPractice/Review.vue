<script setup>
/**
 * 复习模式页面
 * 用于复习待复习的词汇
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Check, Close } from '@element-plus/icons-vue'
import { getDueReviews, completeReview, skipReview } from '../../api/wordPractice'

const router = useRouter()

// 状态
const loading = ref(false)
const reviews = ref([])
const currentIndex = ref(0)
const showAnswer = ref(false)
const startTime = ref(null)

// 结果统计
const results = ref({
  correct: 0,
  wrong: 0,
  skipped: 0
})

// 当前复习词汇
const currentReview = computed(() => {
  return reviews.value[currentIndex.value] || null
})

// 是否完成
const isFinished = computed(() => {
  return currentIndex.value >= reviews.value.length && reviews.value.length > 0
})

// 进度
const progress = computed(() => {
  if (reviews.value.length === 0) return 0
  return Math.round((currentIndex.value / reviews.value.length) * 100)
})

// 加载待复习词汇
async function loadReviews() {
  loading.value = true
  try {
    const res = await getDueReviews({ limit: 50 })
    reviews.value = res.data || []
    
    if (reviews.value.length === 0) {
      ElMessage.info('暂无待复习的词汇')
      router.push('/word-practice')
    } else {
      startTime.value = Date.now()
    }
  } catch (error) {
    console.error('加载失败:', error)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 显示答案
function revealAnswer() {
  showAnswer.value = true
}

// 标记答对
async function markCorrect() {
  await submitResult(true)
}

// 标记答错
async function markWrong() {
  await submitResult(false)
}

// 提交结果
async function submitResult(isCorrect) {
  const review = currentReview.value
  if (!review) return
  
  const timeSpent = Math.floor((Date.now() - startTime.value) / 1000)
  
  try {
    await completeReview(review.id, {
      isCorrect,
      timeSpent,
      quality: isCorrect ? 4 : 2
    })
    
    if (isCorrect) {
      results.value.correct++
    } else {
      results.value.wrong++
    }
    
    nextWord()
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error('操作失败')
  }
}

// 跳过
async function handleSkip() {
  const review = currentReview.value
  if (!review) return
  
  try {
    await skipReview(review.id)
    results.value.skipped++
    nextWord()
  } catch (error) {
    console.error('跳过失败:', error)
  }
}

// 下一个词汇
function nextWord() {
  showAnswer.value = false
  startTime.value = Date.now()
  currentIndex.value++
}

// 退出复习
async function exitReview() {
  try {
    await ElMessageBox.confirm(
      '确定要退出复习吗？已复习的进度会被保存。',
      '退出复习',
      { type: 'warning' }
    )
    router.push('/word-practice/reviews')
  } catch {
    // 取消退出
  }
}

// 返回
function goBack() {
  router.push('/word-practice')
}

// 再来一轮
function reviewAgain() {
  currentIndex.value = 0
  results.value = { correct: 0, wrong: 0, skipped: 0 }
  loadReviews()
}

onMounted(() => {
  loadReviews()
})
</script>

<template>
  <div class="review-page" v-loading="loading">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <el-button text @click="exitReview">
        <el-icon><ArrowLeft /></el-icon> 退出
      </el-button>
      <div class="toolbar-center">
        复习模式
      </div>
      <div class="toolbar-right">
        <el-progress 
          :percentage="progress" 
          :stroke-width="10"
          style="width: 120px"
        />
        <span class="progress-text">{{ currentIndex }}/{{ reviews.length }}</span>
      </div>
    </div>
    
    <!-- 复习卡片 -->
    <div v-if="!isFinished && currentReview" class="review-content">
      <div class="word-card">
        <!-- 词汇 -->
        <div class="word-display">
          <h1 class="word-text">{{ currentReview.word }}</h1>
          <el-tag>{{ currentReview.category }}</el-tag>
          <div class="stage-info">
            第 {{ currentReview.review_stage }} 轮复习
          </div>
        </div>
        
        <!-- 提示区域 -->
        <div v-if="!showAnswer" class="hint-area">
          <p class="hint-text">尝试回忆这个词汇的意思...</p>
          <el-button type="primary" size="large" @click="revealAnswer">
            显示答案
          </el-button>
        </div>
        
        <!-- 答案区域 -->
        <div v-else class="answer-area">
          <div class="meaning-section">
            <label>释义：</label>
            <p>{{ currentReview.meaning }}</p>
          </div>
          
          <div v-if="currentReview.examples" class="examples-section">
            <label>例句：</label>
            <p>{{ currentReview.examples }}</p>
          </div>
          
          <div class="feedback-buttons">
            <el-button 
              type="danger" 
              size="large"
              @click="markWrong"
            >
              <el-icon><Close /></el-icon>
              没记住
            </el-button>
            <el-button 
              type="success" 
              size="large"
              @click="markCorrect"
            >
              <el-icon><Check /></el-icon>
              记住了
            </el-button>
          </div>
        </div>
        
        <!-- 跳过按钮 -->
        <div class="skip-button">
          <el-button text @click="handleSkip">跳过这个词汇</el-button>
        </div>
      </div>
    </div>
    
    <!-- 完成页面 -->
    <div v-else-if="isFinished" class="finished-content">
      <div class="finished-card">
        <div class="finished-emoji">🎉</div>
        <h2>复习完成！</h2>
        
        <div class="results-summary">
          <div class="result-item correct">
            <span class="result-value">{{ results.correct }}</span>
            <span class="result-label">记住了</span>
          </div>
          <div class="result-item wrong">
            <span class="result-value">{{ results.wrong }}</span>
            <span class="result-label">需加强</span>
          </div>
          <div class="result-item skipped">
            <span class="result-value">{{ results.skipped }}</span>
            <span class="result-label">已跳过</span>
          </div>
        </div>
        
        <div class="accuracy-display">
          <el-progress 
            type="circle" 
            :percentage="results.correct + results.wrong > 0 ? Math.round(results.correct / (results.correct + results.wrong) * 100) : 0"
            :width="120"
            :stroke-width="10"
          />
          <p>正确率</p>
        </div>
        
        <div class="finished-actions">
          <el-button @click="goBack">返回首页</el-button>
          <el-button type="primary" @click="reviewAgain">再来一轮</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.review-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 12px;
  margin-bottom: 20px;
}

.toolbar-center {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-text {
  color: #909399;
  font-size: 14px;
}

.review-content, .finished-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 120px);
}

.word-card, .finished-card {
  background: white;
  border-radius: 24px;
  padding: 48px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 100%;
}

.word-display {
  margin-bottom: 32px;
}

.word-text {
  font-size: 48px;
  color: #303133;
  margin: 0 0 16px 0;
  font-weight: 700;
}

.stage-info {
  margin-top: 12px;
  color: #909399;
  font-size: 14px;
}

.hint-area {
  margin: 32px 0;
}

.hint-text {
  color: #909399;
  margin-bottom: 24px;
  font-size: 16px;
}

.answer-area {
  margin: 32px 0;
}

.meaning-section, .examples-section {
  text-align: left;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 12px;
  margin-bottom: 16px;
}

.meaning-section label, .examples-section label {
  font-weight: 600;
  color: #909399;
  display: block;
  margin-bottom: 8px;
}

.meaning-section p, .examples-section p {
  margin: 0;
  color: #303133;
  font-size: 16px;
  line-height: 1.6;
}

.feedback-buttons {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 32px;
}

.feedback-buttons .el-button {
  min-width: 140px;
  height: 50px;
  font-size: 16px;
}

.skip-button {
  margin-top: 24px;
}

/* 完成页面样式 */
.finished-emoji {
  font-size: 64px;
  margin-bottom: 16px;
}

.finished-card h2 {
  margin: 0 0 32px 0;
  color: #303133;
}

.results-summary {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 32px;
}

.result-item {
  text-align: center;
}

.result-value {
  display: block;
  font-size: 36px;
  font-weight: 600;
}

.result-item.correct .result-value {
  color: #67c23a;
}

.result-item.wrong .result-value {
  color: #f56c6c;
}

.result-item.skipped .result-value {
  color: #909399;
}

.result-label {
  font-size: 14px;
  color: #909399;
}

.accuracy-display {
  margin: 32px 0;
}

.accuracy-display p {
  margin: 12px 0 0 0;
  color: #909399;
}

.finished-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 32px;
}
</style>
