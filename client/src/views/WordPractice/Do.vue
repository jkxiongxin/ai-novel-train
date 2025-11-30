<script setup>
/**
 * 词汇练习 - 练习进行页面
 * 包含记忆阶段和答题阶段
 */
import { ref, onMounted, computed, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, ArrowRight, Check, Close } from '@element-plus/icons-vue'
import { 
  getPracticeSession, 
  updatePracticeSession,
  generateQuestions,
  getQuestions,
  submitAnswer,
  aiReviewSentences,
  completePractice
} from '../../api/wordPractice'

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)
const session = ref(null)
const words = ref([])
const questions = ref([])

// 练习阶段
const phase = ref('memorize') // memorize | quiz | reviewing | completed
const currentWordIndex = ref(0)
const currentQuestionIndex = ref(0)

// 记忆阶段
const timeRemaining = ref(0)
const timer = ref(null)
const isPaused = ref(false)

// 答题阶段
const userAnswers = ref({})
const answeredQuestions = ref(new Set())
const submitting = ref(false)
const isGeneratingQuestions = ref(false) // 防止重复生成题目

// 获取当前词汇
const currentWord = computed(() => {
  return words.value[currentWordIndex.value] || null
})

// 获取当前题目
const currentQuestion = computed(() => {
  return questions.value[currentQuestionIndex.value] || null
})

// 记忆进度
const memorizeProgress = computed(() => {
  if (words.value.length === 0) return 0
  return Math.round(((currentWordIndex.value + 1) / words.value.length) * 100)
})

// 答题进度
const quizProgress = computed(() => {
  if (questions.value.length === 0) return 0
  return Math.round((answeredQuestions.value.size / questions.value.length) * 100)
})

// 题目分类
const questionsByType = computed(() => {
  const choice = questions.value.filter(q => q.question_type === 'choice')
  const fill = questions.value.filter(q => q.question_type === 'fill')
  const sentence = questions.value.filter(q => q.question_type === 'sentence')
  return { choice, fill, sentence }
})

// 加载会话数据
async function loadSession() {
  loading.value = true
  try {
    const res = await getPracticeSession(route.params.id)
    if (!res.success) {
      ElMessage.error(res.message || '加载失败')
      return
    }
    
    session.value = res.data
    words.value = res.data.words || []
    phase.value = res.data.current_phase || 'memorize'
    currentWordIndex.value = res.data.current_word_index || 0
    
    // 如果已经在答题阶段，加载题目
    if (phase.value === 'quiz' || phase.value === 'reviewing') {
      await loadQuestions()
    } else if (phase.value === 'memorize') {
      startMemorizeTimer()
    }
  } catch (error) {
    console.error('加载会话失败:', error)
    ElMessage.error('加载练习失败')
  } finally {
    loading.value = false
  }
}

// 开始记忆计时器
function startMemorizeTimer() {
  timeRemaining.value = session.value?.display_time || 5
  
  clearInterval(timer.value)
  timer.value = setInterval(() => {
    if (isPaused.value) return
    
    timeRemaining.value--
    if (timeRemaining.value <= 0) {
      // 计时器结束时只自动跳到下一个词汇，不触发结束记忆阶段
      // 如果是最后一个词汇，停留在当前词汇，用户需要手动点击"开始答题"
      if (currentWordIndex.value < words.value.length - 1) {
        currentWordIndex.value++
        startMemorizeTimer()
        // 保存进度
        updatePracticeSession(route.params.id, {
          currentWordIndex: currentWordIndex.value
        })
      } else {
        // 最后一个词汇，停止计时器，等待用户手动开始答题
        clearInterval(timer.value)
        timer.value = null
        timeRemaining.value = 0
      }
    }
  }, 1000)
}

// 下一个词汇
async function nextWord() {
  // 如果已经在生成题目，不做任何操作
  if (isGeneratingQuestions.value) {
    return
  }
  
  if (currentWordIndex.value < words.value.length - 1) {
    currentWordIndex.value++
    startMemorizeTimer()
    
    // 保存进度
    await updatePracticeSession(route.params.id, {
      currentWordIndex: currentWordIndex.value
    })
  } else {
    // 记忆完成，先立即清除定时器，然后进入答题阶段
    clearInterval(timer.value)
    timer.value = null
    await endMemorizePhase()
  }
}

// 上一个词汇
function prevWord() {
  if (currentWordIndex.value > 0) {
    currentWordIndex.value--
    startMemorizeTimer()
  }
}

// 暂停/继续
function togglePause() {
  isPaused.value = !isPaused.value
}

// 跳过当前词汇
function skipWord() {
  nextWord()
}

// 结束记忆阶段
async function endMemorizePhase() {
  // 首先立即清除定时器，防止计时器触发
  if (timer.value) {
    clearInterval(timer.value)
    timer.value = null
  }
  
  // 防止重复触发
  if (isGeneratingQuestions.value) {
    return
  }
  isGeneratingQuestions.value = true
  
  ElMessage.success('记忆阶段完成！准备开始答题...')
  
  loading.value = true
  try {
    // 生成题目
    const res = await generateQuestions(route.params.id)
    if (res.success) {
      await loadQuestions()
      phase.value = 'quiz'
      
      // 更新会话状态
      await updatePracticeSession(route.params.id, {
        currentPhase: 'quiz'
      })
    } else {
      ElMessage.error(res.message || '生成题目失败')
      isGeneratingQuestions.value = false // 失败时重置标志，允许重试
    }
  } catch (error) {
    console.error('生成题目失败:', error)
    ElMessage.error('生成题目失败，请重试')
    isGeneratingQuestions.value = false // 失败时重置标志，允许重试
  } finally {
    loading.value = false
  }
}

// 加载题目
async function loadQuestions() {
  try {
    const res = await getQuestions(route.params.id)
    if (res.success) {
      questions.value = res.data || []
      // 按难度排序：选择题 -> 填空题 -> 造句题
      questions.value.sort((a, b) => a.difficulty - b.difficulty)
    }
  } catch (error) {
    console.error('加载题目失败:', error)
  }
}

// 提交答案
async function handleSubmitAnswer() {
  const question = currentQuestion.value
  if (!question) return
  
  const answer = userAnswers.value[question.id]
  if (!answer && question.question_type !== 'sentence') {
    ElMessage.warning('请先作答')
    return
  }
  
  submitting.value = true
  try {
    const res = await submitAnswer(question.id, { answer: answer || '' })
    if (res.success) {
      answeredQuestions.value.add(question.id)
      
      // 更新题目状态
      const q = questions.value.find(q => q.id === question.id)
      if (q) {
        q.user_answer = answer
        q.is_correct = res.data.isCorrect
        q.score = res.data.score
      }
      
      // 显示反馈
      if (question.question_type !== 'sentence') {
        if (res.data.isCorrect) {
          ElMessage.success('回答正确！')
        } else {
          ElMessage.error(`回答错误，正确答案：${res.data.correctAnswer}`)
        }
      }
      
      // 下一题
      if (currentQuestionIndex.value < questions.value.length - 1) {
        currentQuestionIndex.value++
      } else {
        // 所有题目作答完成
        handleQuizComplete()
      }
    }
  } catch (error) {
    console.error('提交答案失败:', error)
    ElMessage.error('提交失败')
  } finally {
    submitting.value = false
  }
}

// 跳过当前题目
function skipQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
  } else {
    handleQuizComplete()
  }
}

// 答题完成
async function handleQuizComplete() {
  phase.value = 'reviewing'
  
  // 检查是否有造句题需要AI批改
  const sentenceQuestions = questions.value.filter(
    q => q.question_type === 'sentence' && q.user_answer
  )
  
  if (sentenceQuestions.length > 0) {
    ElMessage.info('正在进行AI批改...')
    loading.value = true
    
    try {
      await aiReviewSentences(route.params.id)
      // 重新加载题目获取批改结果
      await loadQuestions()
    } catch (error) {
      console.error('AI批改失败:', error)
    } finally {
      loading.value = false
    }
  }
  
  // 完成练习
  await finishPractice()
}

// 完成练习
async function finishPractice() {
  try {
    const res = await completePractice(route.params.id)
    if (res.success) {
      phase.value = 'completed'
      ElMessage.success('练习完成！')
      
      // 跳转到结果页
      router.push(`/word-practice/session/${route.params.id}/result`)
    }
  } catch (error) {
    console.error('完成练习失败:', error)
  }
}

// 退出练习
async function exitPractice() {
  try {
    await ElMessageBox.confirm(
      '确定要退出吗？当前进度会被保存，下次可以继续。',
      '退出练习',
      { type: 'warning' }
    )
    
    clearInterval(timer.value)
    await updatePracticeSession(route.params.id, {
      currentWordIndex: currentWordIndex.value,
      currentPhase: phase.value
    })
    
    router.push('/word-practice')
  } catch {
    // 取消退出
  }
}

// 获取题目类型名称
function getQuestionTypeName(type) {
  const map = {
    'choice': '选择题',
    'fill': '填空题',
    'sentence': '造句题'
  }
  return map[type] || type
}

// 获取题目类型颜色
function getQuestionTypeColor(type) {
  const map = {
    'choice': 'success',
    'fill': 'warning',
    'sentence': 'danger'
  }
  return map[type] || 'info'
}

onMounted(() => {
  loadSession()
})

onBeforeUnmount(() => {
  clearInterval(timer.value)
})
</script>

<template>
  <div class="practice-do-page" v-loading="loading">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <el-button text @click="exitPractice">
        <el-icon><ArrowLeft /></el-icon> 退出
      </el-button>
      <div class="toolbar-center">
        <span v-if="phase === 'memorize'">记忆阶段</span>
        <span v-else-if="phase === 'quiz'">答题阶段</span>
        <span v-else-if="phase === 'reviewing'">批改中...</span>
      </div>
      <div class="toolbar-right">
        <el-progress 
          v-if="phase === 'memorize'" 
          :percentage="memorizeProgress" 
          :stroke-width="10"
          style="width: 120px"
        />
        <el-progress 
          v-else-if="phase === 'quiz'" 
          :percentage="quizProgress" 
          :stroke-width="10"
          status="success"
          style="width: 120px"
        />
      </div>
    </div>
    
    <!-- 记忆阶段 -->
    <div v-if="phase === 'memorize'" class="memorize-phase">
      <div class="word-card" v-if="currentWord">
        <!-- 倒计时 -->
        <div class="countdown">
          <el-progress 
            type="circle" 
            :percentage="(timeRemaining / (session?.display_time || 5)) * 100"
            :width="80"
            :stroke-width="8"
            :format="() => timeRemaining + 's'"
          />
        </div>
        
        <!-- 词汇内容 -->
        <div class="word-content">
          <h1 class="word-text">{{ currentWord.word }}</h1>
          <el-tag class="word-category">{{ currentWord.category }}</el-tag>
          
          <div class="word-meaning">
            <label>释义：</label>
            <p>{{ currentWord.meaning }}</p>
          </div>
          
          <div class="word-examples" v-if="currentWord.examples">
            <label>例句：</label>
            <p>{{ currentWord.examples }}</p>
          </div>
        </div>
        
        <!-- 进度指示 -->
        <div class="word-progress">
          {{ currentWordIndex + 1 }} / {{ words.length }}
        </div>
      </div>
      
      <!-- 控制按钮 -->
      <div class="control-buttons">
        <el-button 
          :disabled="currentWordIndex === 0" 
          @click="prevWord"
        >
          <el-icon><ArrowLeft /></el-icon> 上一个
        </el-button>
        <el-button @click="togglePause">
          {{ isPaused ? '继续' : '暂停' }}
        </el-button>
        <el-button type="primary" @click="skipWord">
          跳过 <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>
      
      <!-- 快速结束 -->
      <div class="quick-end">
        <el-button text type="primary" @click="endMemorizePhase">
          记住了，开始答题 →
        </el-button>
      </div>
    </div>
    
    <!-- 答题阶段 -->
    <div v-else-if="phase === 'quiz'" class="quiz-phase">
      <div class="question-card" v-if="currentQuestion">
        <!-- 题目类型标签 -->
        <div class="question-header">
          <el-tag :type="getQuestionTypeColor(currentQuestion.question_type)">
            {{ getQuestionTypeName(currentQuestion.question_type) }}
          </el-tag>
          <span class="question-number">
            第 {{ currentQuestionIndex + 1 }} / {{ questions.length }} 题
          </span>
        </div>
        
        <!-- 题目内容 -->
        <div class="question-content">
          <h2>{{ currentQuestion.question_content }}</h2>
        </div>
        
        <!-- 选择题选项 -->
        <div v-if="currentQuestion.question_type === 'choice'" class="choice-options">
          <el-radio-group 
            v-model="userAnswers[currentQuestion.id]" 
            class="option-group"
          >
            <el-radio 
              v-for="(option, index) in currentQuestion.options" 
              :key="index"
              :label="option"
              class="option-item"
            >
              {{ String.fromCharCode(65 + index) }}. {{ option }}
            </el-radio>
          </el-radio-group>
        </div>
        
        <!-- 填空题输入 -->
        <div v-else-if="currentQuestion.question_type === 'fill'" class="fill-input">
          <el-input 
            v-model="userAnswers[currentQuestion.id]"
            placeholder="请输入答案"
            size="large"
          />
        </div>
        
        <!-- 造句题输入 -->
        <div v-else-if="currentQuestion.question_type === 'sentence'" class="sentence-input">
          <el-input 
            v-model="userAnswers[currentQuestion.id]"
            type="textarea"
            :rows="4"
            placeholder="请用该词汇造一个句子..."
          />
          <p class="sentence-tip">
            造句将由AI进行批改，请认真作答
          </p>
        </div>
      </div>
      
      <!-- 答题按钮 -->
      <div class="quiz-buttons">
        <el-button @click="skipQuestion">跳过</el-button>
        <el-button 
          type="primary" 
          :loading="submitting"
          @click="handleSubmitAnswer"
        >
          提交答案
        </el-button>
      </div>
      
      <!-- 题目导航 -->
      <div class="question-nav">
        <span 
          v-for="(q, index) in questions" 
          :key="q.id"
          class="nav-dot"
          :class="{
            'current': index === currentQuestionIndex,
            'answered': answeredQuestions.has(q.id),
            'correct': q.is_correct === 1,
            'wrong': q.is_correct === 0
          }"
          @click="currentQuestionIndex = index"
        >
          {{ index + 1 }}
        </span>
      </div>
    </div>
    
    <!-- 批改中 -->
    <div v-else-if="phase === 'reviewing'" class="reviewing-phase">
      <div class="reviewing-content">
        <el-icon class="loading-icon" :size="60"><Loading /></el-icon>
        <h2>AI 正在批改中...</h2>
        <p>请稍候，造句题正在由AI进行评判</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.practice-do-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  padding: 20px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  background: white;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.toolbar-center {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}

/* 记忆阶段样式 */
.memorize-phase {
  max-width: 600px;
  margin: 0 auto;
}

.word-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  position: relative;
}

.countdown {
  position: absolute;
  top: 20px;
  right: 20px;
}

.word-content {
  margin-top: 20px;
}

.word-text {
  font-size: 48px;
  color: #409eff;
  margin: 0 0 16px 0;
  font-weight: 700;
}

.word-category {
  margin-bottom: 24px;
}

.word-meaning, .word-examples {
  text-align: left;
  margin-top: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 12px;
}

.word-meaning label, .word-examples label {
  font-weight: 600;
  color: #909399;
  display: block;
  margin-bottom: 8px;
}

.word-meaning p, .word-examples p {
  margin: 0;
  font-size: 16px;
  color: #303133;
  line-height: 1.6;
}

.word-progress {
  margin-top: 24px;
  color: #909399;
  font-size: 14px;
}

.control-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 30px;
}

.quick-end {
  text-align: center;
  margin-top: 20px;
}

/* 答题阶段样式 */
.quiz-phase {
  max-width: 700px;
  margin: 0 auto;
}

.question-card {
  background: white;
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.question-number {
  color: #909399;
  font-size: 14px;
}

.question-content h2 {
  font-size: 20px;
  color: #303133;
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.choice-options {
  margin-top: 24px;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.option-item {
  display: flex !important;
  align-items: center;
  padding: 16px 20px;
  background: #f5f7fa;
  border-radius: 12px;
  transition: all 0.3s;
  width: 100%;
  text-align: left;
  margin-right: 0 !important;
}

.option-item :deep(.el-radio__label) {
  white-space: normal;
  line-height: 1.5;
}

.option-item:hover {
  background: #ecf5ff;
}

.fill-input, .sentence-input {
  margin-top: 24px;
}

.sentence-tip {
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}

.quiz-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.question-nav {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 30px;
}

.nav-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-dot.current {
  background: #409eff;
  color: white;
  transform: scale(1.1);
}

.nav-dot.answered {
  background: #909399;
  color: white;
}

.nav-dot.correct {
  background: #67c23a;
  color: white;
}

.nav-dot.wrong {
  background: #f56c6c;
  color: white;
}

/* 批改中样式 */
.reviewing-phase {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
}

.reviewing-content {
  text-align: center;
  background: white;
  padding: 60px 80px;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
}

.loading-icon {
  color: #409eff;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.reviewing-content h2 {
  margin: 20px 0 10px 0;
  color: #303133;
}

.reviewing-content p {
  color: #909399;
  margin: 0;
}
</style>
