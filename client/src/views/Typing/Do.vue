<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { 
  getTypingPractice, 
  startTypingPractice, 
  saveTypingProgress, 
  completeTypingPractice 
} from '../../api/typing'
import { getSegmentTypes, getWritingStyles } from '../../api/chapters'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const practice = ref(null)
const segmentTypes = ref({})
const writingStyles = ref({})

// 输入相关
const typedText = ref('')
const isStarted = ref(false)
const isPaused = ref(false)
const isCompleted = ref(false)

// 时间统计
const startTime = ref(null)
const elapsedTime = ref(0)
const timerInterval = ref(null)

// 自动保存
const autoSaveInterval = ref(null)

// 结果统计
const result = ref({
  accuracy: 0,
  speed: 0,
  typed_count: 0,
  time_spent: 0
})

// 计算准确率和进度
const stats = computed(() => {
  if (!practice.value) return { correctCount: 0, errorCount: 0, progress: 0 }
  
  const original = practice.value.original_content.replace(/\s/g, '')
  const typed = typedText.value.replace(/\s/g, '')
  
  let correctCount = 0
  let errorCount = 0
  
  for (let i = 0; i < typed.length; i++) {
    if (i < original.length && typed[i] === original[i]) {
      correctCount++
    } else {
      errorCount++
    }
  }
  
  const progress = original.length > 0 ? (typed.length / original.length) * 100 : 0
  
  return {
    correctCount,
    errorCount,
    progress: Math.min(progress, 100),
    accuracy: typed.length > 0 ? (correctCount / typed.length) * 100 : 100
  }
})

// 打字速度（字/分钟）
const speed = computed(() => {
  if (elapsedTime.value === 0) return 0
  const minutes = elapsedTime.value / 60
  const typed = typedText.value.replace(/\s/g, '').length
  return minutes > 0 ? Math.round(typed / minutes) : 0
})

// 渲染对比文本
const renderedText = computed(() => {
  if (!practice.value) return []
  
  const original = practice.value.original_content
  const typed = typedText.value
  const result = []
  
  for (let i = 0; i < original.length; i++) {
    const char = original[i]
    let status = 'pending' // pending, correct, error
    
    if (i < typed.length) {
      // 需要处理空格的对比
      if (typed[i] === char) {
        status = 'correct'
      } else {
        status = 'error'
      }
    }
    
    result.push({
      char,
      status,
      isCurrent: i === typed.length
    })
  }
  
  return result
})

async function loadPractice() {
  loading.value = true
  try {
    const res = await getTypingPractice(route.params.id)
    practice.value = res.data
    
    // 恢复已有的输入
    if (practice.value.typed_content) {
      typedText.value = practice.value.typed_content
    }
    
    // 恢复时间
    if (practice.value.time_spent) {
      elapsedTime.value = practice.value.time_spent
    }
    
    // 检查状态
    if (practice.value.status === 'completed') {
      isCompleted.value = true
      result.value = {
        accuracy: practice.value.accuracy,
        speed: practice.value.speed,
        typed_count: practice.value.typed_count,
        time_spent: practice.value.time_spent
      }
    } else if (practice.value.status === 'in_progress') {
      isStarted.value = true
    }
  } catch (error) {
    console.error('加载练习失败:', error)
    ElMessage.error('练习不存在')
    router.push('/typing')
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  try {
    const [typesRes, stylesRes] = await Promise.all([
      getSegmentTypes(),
      getWritingStyles()
    ])
    segmentTypes.value = typesRes.data
    writingStyles.value = stylesRes.data
  } catch (error) {
    console.error('加载元数据失败:', error)
  }
}

async function handleStart() {
  try {
    await startTypingPractice(practice.value.id)
    isStarted.value = true
    startTime.value = Date.now()
    startTimer()
    startAutoSave()
    
    // 聚焦输入区域
    document.getElementById('typing-input')?.focus()
  } catch (error) {
    console.error('开始练习失败:', error)
  }
}

function startTimer() {
  timerInterval.value = setInterval(() => {
    if (!isPaused.value) {
      elapsedTime.value++
    }
  }, 1000)
}

function startAutoSave() {
  autoSaveInterval.value = setInterval(async () => {
    if (isStarted.value && !isCompleted.value) {
      try {
        await saveTypingProgress(practice.value.id, {
          typed_content: typedText.value,
          time_spent: elapsedTime.value
        })
      } catch (error) {
        console.error('自动保存失败:', error)
      }
    }
  }, 30000) // 每30秒自动保存
}

function togglePause() {
  isPaused.value = !isPaused.value
}

async function handleComplete() {
  if (isCompleted.value) return
  
  try {
    const res = await completeTypingPractice(practice.value.id, {
      typed_content: typedText.value,
      time_spent: elapsedTime.value
    })
    
    isCompleted.value = true
    result.value = res.data
    
    // 停止计时器
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }
    if (autoSaveInterval.value) {
      clearInterval(autoSaveInterval.value)
    }
    
    ElMessage.success('练习完成！')
  } catch (error) {
    console.error('完成练习失败:', error)
  }
}

// 监听输入完成
watch(() => stats.value.progress, (newVal) => {
  if (newVal >= 100 && !isCompleted.value && isStarted.value) {
    handleComplete()
  }
})

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function getSegmentTypeName(type) {
  return segmentTypes.value[type]?.name || type || '-'
}

function getWritingStyleName(style) {
  return writingStyles.value[style]?.name || style || '-'
}

function goBack() {
  router.push('/typing')
}

function handleRestart() {
  router.go(0)
}

onMounted(() => {
  loadPractice()
  loadMeta()
})

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
  if (autoSaveInterval.value) {
    clearInterval(autoSaveInterval.value)
  }
})
</script>

<template>
  <div class="typing-practice" v-loading="loading">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <div class="header-info" v-if="practice">
        <h1>抄书练习</h1>
        <div class="meta">
          <el-tag type="primary" size="small">
            {{ getSegmentTypeName(practice.segment_type) }}
          </el-tag>
          <el-tag type="success" size="small" v-if="practice.writing_style">
            {{ getWritingStyleName(practice.writing_style) }}
          </el-tag>
          <span>{{ practice.word_count }}字</span>
          <span v-if="practice.chapter_title">来自：{{ practice.chapter_title }}</span>
        </div>
      </div>
    </div>

    <div class="practice-container" v-if="practice">
      <!-- 实时统计栏 -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="label">用时</span>
          <span class="value">{{ formatTime(elapsedTime) }}</span>
        </div>
        <div class="stat-item">
          <span class="label">进度</span>
          <span class="value">{{ stats.progress.toFixed(1) }}%</span>
        </div>
        <div class="stat-item">
          <span class="label">准确率</span>
          <span class="value" :class="{ 'text-danger': stats.accuracy < 90 }">
            {{ stats.accuracy.toFixed(1) }}%
          </span>
        </div>
        <div class="stat-item">
          <span class="label">速度</span>
          <span class="value">{{ speed }} 字/分</span>
        </div>
        <div class="stat-item">
          <span class="label">正确/错误</span>
          <span class="value">
            <span class="text-success">{{ stats.correctCount }}</span>
            /
            <span class="text-danger">{{ stats.errorCount }}</span>
          </span>
        </div>
      </div>

      <!-- 原文展示区 -->
      <el-card class="original-card">
        <template #header>
          <div class="card-header">
            <span>原文</span>
            <el-progress 
              :percentage="stats.progress" 
              :stroke-width="8"
              :format="() => `${stats.progress.toFixed(1)}%`"
              style="width: 200px;"
            />
          </div>
        </template>
        <div class="original-text">
          <span
            v-for="(item, index) in renderedText"
            :key="index"
            class="char"
            :class="{
              'correct': item.status === 'correct',
              'error': item.status === 'error',
              'current': item.isCurrent
            }"
          >{{ item.char }}</span>
        </div>
      </el-card>

      <!-- 输入区域 -->
      <el-card class="input-card" v-if="!isCompleted">
        <template #header>
          <div class="card-header">
            <span>输入区域</span>
            <div class="actions" v-if="isStarted">
              <el-button size="small" @click="togglePause">
                {{ isPaused ? '继续' : '暂停' }}
              </el-button>
              <el-button type="primary" size="small" @click="handleComplete">
                完成
              </el-button>
            </div>
          </div>
        </template>
        
        <div v-if="!isStarted" class="start-prompt">
          <el-button type="primary" size="large" @click="handleStart">
            开始练习
          </el-button>
          <p>点击开始后，请在下方输入框中抄写上方原文</p>
        </div>
        
        <div v-else class="typing-area">
          <el-input
            id="typing-input"
            v-model="typedText"
            type="textarea"
            :rows="10"
            placeholder="在此处输入..."
            :disabled="isPaused || isCompleted"
          />
          <div class="typing-hint" v-if="isPaused">
            <el-tag type="warning">已暂停</el-tag>
          </div>
        </div>
      </el-card>

      <!-- 完成结果 -->
      <el-card class="result-card" v-if="isCompleted">
        <template #header>
          <span>🎉 练习完成</span>
        </template>
        <div class="result-content">
          <div class="result-stats">
            <div class="result-item">
              <div class="result-value">{{ result.accuracy?.toFixed(1) || stats.accuracy.toFixed(1) }}%</div>
              <div class="result-label">准确率</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ result.speed?.toFixed(0) || speed }}</div>
              <div class="result-label">打字速度(字/分)</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ result.typed_count || typedText.replace(/\s/g, '').length }}</div>
              <div class="result-label">输入字数</div>
            </div>
            <div class="result-item">
              <div class="result-value">{{ formatTime(result.time_spent || elapsedTime) }}</div>
              <div class="result-label">用时</div>
            </div>
          </div>
          <div class="result-actions">
            <el-button @click="goBack">返回列表</el-button>
            <el-button type="primary" @click="handleRestart">再来一次</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.typing-practice {
  padding: 20px;
  /* 移动端安全区域适配 */
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 20px;
}

.header-info {
  flex: 1;
}

.header-info h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
}

.meta {
  display: flex;
  gap: 12px;
  color: #909399;
  font-size: 14px;
  align-items: center;
}

.practice-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-bar {
  display: flex;
  justify-content: space-around;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
}

.stat-item {
  text-align: center;
}

.stat-item .label {
  display: block;
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.stat-item .value {
  font-size: 20px;
  font-weight: bold;
  color: #303133;
}

.text-success {
  color: #67c23a;
}

.text-danger {
  color: #f56c6c;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.original-text {
  font-size: 18px;
  line-height: 2;
  white-space: pre-wrap;
  word-break: break-all;
}

.char {
  display: inline;
  transition: all 0.1s;
}

.char.correct {
  color: #67c23a;
}

.char.error {
  color: #f56c6c;
  text-decoration: underline;
}

.char.current {
  background: #409eff;
  color: white;
  border-radius: 2px;
  padding: 0 2px;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.start-prompt {
  text-align: center;
  padding: 40px;
}

.start-prompt p {
  margin-top: 16px;
  color: #909399;
}

.typing-area {
  position: relative;
}

.typing-area :deep(.el-textarea__inner) {
  font-size: 18px;
  line-height: 2;
}

.typing-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.result-content {
  text-align: center;
}

.result-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 30px;
}

.result-item {
  text-align: center;
}

.result-value {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
}

.result-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .typing-practice {
    padding: 12px;
    padding-top: calc(12px + env(safe-area-inset-top, 0px));
  }
  
  .page-header {
    flex-direction: column;
    gap: 12px;
  }
  
  .page-header .el-button {
    align-self: flex-start;
  }
  
  .header-info h1 {
    font-size: 18px;
    margin-bottom: 8px;
  }
  
  .meta {
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
  }
  
  .stats-bar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
  }
  
  .stat-item {
    flex: 1;
    min-width: 60px;
  }
  
  .stat-item .value {
    font-size: 16px;
  }
  
  .stat-item .label {
    font-size: 10px;
  }
  
  .original-text {
    font-size: 15px;
    line-height: 1.8;
  }
  
  .card-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .card-header .el-progress {
    width: 100% !important;
  }
  
  .start-prompt {
    padding: 20px;
  }
  
  .typing-area :deep(.el-textarea__inner) {
    font-size: 15px;
    line-height: 1.8;
  }
  
  .result-stats {
    flex-wrap: wrap;
    gap: 16px;
  }
  
  .result-item {
    flex: 1;
    min-width: 80px;
  }
  
  .result-value {
    font-size: 24px;
  }
  
  .result-label {
    font-size: 12px;
  }
  
  .result-actions {
    flex-direction: column;
    gap: 12px;
  }
  
  .result-actions .el-button {
    width: 100%;
  }
}
</style>
