<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
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

// DOM 引用
const originalTextContainer = ref(null)
const typingTextarea = ref(null)
// resize observer instance
let resizeHandler = null
let resizeObserver = null

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
      // 恢复开始时间，使得计时能继续
      startTime.value = Date.now() - (elapsedTime.value * 1000)
      // 启动计时器和自动保存
      startTimer()
      startAutoSave()
    }
  } catch (error) {
    console.error('加载练习失败:', error)
    ElMessage.error('练习不存在')
    router.push('/typing')
  } finally {
    loading.value = false
    // 确保加载完成后能正确居中当前待抄写位置
    nextTick(() => {
      updateOriginalTextPadding()
      if (isStarted.value && !isCompleted.value) {
        scrollToCurrentPosition()
      }
    })
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
  if (timerInterval.value) return
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

// 更新原文容器顶部/底部的 padding, 使得首字符也能居中显示
function updateOriginalTextPadding() {
  nextTick(() => {
    const container = originalTextContainer.value
    if (!container) return

    const containerHeight = container.clientHeight
    // 计算单字符高度/行高（使用内部元素的 line-height）
    const inner = container.querySelector('.original-text')
    let lineHeight = 36
    if (inner) {
      const cs = getComputedStyle(inner)
      const lh = parseFloat(cs.lineHeight)
      if (!isNaN(lh)) lineHeight = lh
    }
    // padding 设为容器高度的一半减去半个行高，这样首个行会尽量居中
    const padding = Math.max(0, Math.floor(containerHeight / 2 - lineHeight / 2))

    // 将 padding 应用到内部文本容器，以便滚动到 0 时首字符可以居中
    if (inner) {
      inner.style.paddingTop = `${padding}px`
      inner.style.paddingBottom = `${padding}px`
      // 保证当内容不足以滚动时，容器中间仍然显示内容
      if (container.scrollHeight <= container.clientHeight) {
        container.scrollTop = 0
      }
    }
  })
}

function togglePause() {
  isPaused.value = !isPaused.value
  // 当从已暂停恢复时，确保计时器在运行
  if (!isPaused.value && isStarted.value && !isCompleted.value) {
    startTimer()
    startAutoSave()
  }
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
        timerInterval.value = null
      }
      if (autoSaveInterval.value) {
        clearInterval(autoSaveInterval.value)
        autoSaveInterval.value = null
      }
    
    ElMessage.success('练习完成！')
  } catch (error) {
    console.error('完成练习失败:', error)
  }
}

// 自动滚动到当前位置
function scrollToCurrentPosition() {
  nextTick(() => {
    // 滚动原文区域 - 让当前字符显示在中间
    const container = originalTextContainer.value
    if (container) {
      const currentChar = container.querySelector('.char.current')
      if (currentChar) {
        const containerRect = container.getBoundingClientRect()
        const charRect = currentChar.getBoundingClientRect()
        // charTopRelative: distance from container scroll top to char's top
        const charTopRelative = charRect.top - containerRect.top + container.scrollTop
        const containerHeight = container.clientHeight
        const scrollTarget = charTopRelative - containerHeight / 2 + (charRect.height / 2)
        const maxScrollTop = container.scrollHeight - containerHeight
        const safeScrollTarget = Math.max(0, Math.min(maxScrollTop, scrollTarget))
        // 有时 layout 未稳定，先平滑滚动一次，然后确保最终位置
        container.scrollTo({ top: safeScrollTarget, behavior: 'smooth' })
        setTimeout(() => {
          container.scrollTo({ top: safeScrollTarget, behavior: 'instant' })
        }, 120)
      }
    }
    
    // 滚动输入区域 - 让光标位置显示在中间
    const textarea = document.getElementById('typing-input')
    if (textarea) {
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 36
      const textBeforeCursor = typedText.value
      const lines = textBeforeCursor.split('\n').length
      const containerHeight = textarea.clientHeight
      const cursorTop = lines * lineHeight
      const scrollTarget = cursorTop - containerHeight / 2
      textarea.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' })
    }
  })
}

// 监听输入变化，自动滚动
watch(typedText, () => {
  if (isStarted.value && !isCompleted.value) {
    scrollToCurrentPosition()
  }
})

// 当渲染文本变化（加载或输入变化）时，更新 padding 并滚动到当前字符
watch(renderedText, () => {
  if (!originalTextContainer.value) return
  updateOriginalTextPadding()
  if (isStarted.value && !isCompleted.value) {
    scrollToCurrentPosition()
  }
})

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

  // 初始化容器 padding 和监听大小变化
  nextTick(() => {
    updateOriginalTextPadding()
    // ResizeObserver 优先
    try {
      if (window.ResizeObserver && originalTextContainer.value) {
        resizeObserver = new ResizeObserver(() => { updateOriginalTextPadding(); scrollToCurrentPosition() })
        resizeObserver.observe(originalTextContainer.value)
      }
    } catch (e) {
      // 如果不支持 ResizeObserver，使用 window resize 事件
    }
    resizeHandler = () => { updateOriginalTextPadding(); scrollToCurrentPosition() }
    window.addEventListener('resize', resizeHandler)
  })
})

onUnmounted(() => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
  }
  if (autoSaveInterval.value) {
    clearInterval(autoSaveInterval.value)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler)
    resizeHandler = null
  }
  // 清理计时器引用
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
  if (autoSaveInterval.value) {
    clearInterval(autoSaveInterval.value)
    autoSaveInterval.value = null
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

      <!-- 左右布局的主要练习区域 -->
      <div class="main-practice-area" v-if="!isCompleted">
        <!-- 左侧：输入区域 -->
        <el-card class="input-card">
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
            <p>点击开始后，请在输入框中抄写右侧原文</p>
          </div>
          
          <div v-else class="typing-area">
            <el-input
              id="typing-input"
              v-model="typedText"
              type="textarea"
              :rows="20"
              placeholder="在此处输入..."
              :disabled="isPaused || isCompleted"
            />
            <div class="typing-hint" v-if="isPaused">
              <el-tag type="warning">已暂停</el-tag>
            </div>
          </div>
        </el-card>

        <!-- 右侧：原文展示区 -->
        <el-card class="original-card">
          <template #header>
            <div class="card-header">
              <span>待抄写原文</span>
              <el-progress 
                :percentage="stats.progress" 
                :stroke-width="8"
                :format="() => `${stats.progress.toFixed(1)}%`"
                style="width: 150px;"
              />
            </div>
          </template>
          <div class="original-text-container" ref="originalTextContainer">
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
          </div>
        </el-card>
      </div>

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

/* 左右布局的主要练习区域 */
.main-practice-area {
  display: flex;
  gap: 20px;
  min-height: 500px;
}

.main-practice-area .input-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.main-practice-area .input-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.main-practice-area .original-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.main-practice-area .original-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 原文容器 - 固定高度，超出滚动 */
.original-text-container {
  flex: 1;
  max-height: 450px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  padding: 12px;
  background: #fafafa;
}

.original-text-container::-webkit-scrollbar {
  width: 8px;
}

.original-text-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.original-text-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.original-text-container::-webkit-scrollbar-thumb:hover {
  background: #909399;
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
  flex: 1;
  display: flex;
  flex-direction: column;
  max-height: 450px;
}

.typing-area :deep(.el-textarea) {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.typing-area :deep(.el-textarea__inner) {
  font-size: 18px;
  line-height: 2;
  flex: 1;
  height: 450px !important;
  max-height: 450px;
  resize: none;
  overflow-y: auto;
}

/* 输入框滚动条样式 */
.typing-area :deep(.el-textarea__inner)::-webkit-scrollbar {
  width: 8px;
}

.typing-area :deep(.el-textarea__inner)::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.typing-area :deep(.el-textarea__inner)::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.typing-area :deep(.el-textarea__inner)::-webkit-scrollbar-thumb:hover {
  background: #909399;
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
  
  /* 移动端改为上下布局 */
  .main-practice-area {
    flex-direction: column;
    min-height: auto;
  }
  
  .main-practice-area .input-card,
  .main-practice-area .original-card {
    flex: none;
  }
  
  .original-text-container {
    max-height: 250px;
  }
  
  .typing-area {
    max-height: 250px;
  }
  
  .typing-area :deep(.el-textarea__inner) {
    height: 250px !important;
    max-height: 250px;
    font-size: 15px;
    line-height: 1.8;
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
