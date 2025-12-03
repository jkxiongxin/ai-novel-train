<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Timer, Document } from '@element-plus/icons-vue'
import { 
  getSkill, 
  generatePractice, 
  createPractice, 
  updatePractice, 
  submitPractice, 
  evaluatePractice,
  getPractice,
  getQuestionBank,
  useQuestion
} from '../../api/skills'

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(true)
const generating = ref(false)
const submitting = ref(false)
const evaluating = ref(false)
const skill = ref(null)
const question = ref(null)
const practiceId = ref(null)
const userAnswer = ref('')
const timeSpent = ref(0)
const timerInterval = ref(null)
const autoSaveInterval = ref(null)
const lastSavedAnswer = ref('')

// 生成选项
const generateOptions = ref({
  keywords: '',
  description: '',
  saveToBank: true,
  wordCountMin: 200,
  wordCountMax: 500
})
const showAdvancedOptions = ref(false)

// 题目选择相关
const existingQuestions = ref([])
const selectedQuestion = ref(null)
const loadingQuestions = ref(false)
const actionMode = ref('generate') // 'generate' | 'select'

// 计算字数
const wordCount = computed(() => {
  return userAnswer.value.replace(/\s/g, '').length
})

// 格式化时间
const formattedTime = computed(() => {
  const hours = Math.floor(timeSpent.value / 3600)
  const minutes = Math.floor((timeSpent.value % 3600) / 60)
  const seconds = timeSpent.value % 60
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

// 检查字数是否达标
const isWordCountValid = computed(() => {
  if (!question.value?.wordCountRange) return true
  const { min, max } = question.value.wordCountRange
  return wordCount.value >= min && wordCount.value <= max
})

// 加载知识点
const loadSkill = async () => {
  try {
    const res = await getSkill(route.params.id)
    skill.value = res.data
  } catch (error) {
    ElMessage.error('加载知识点失败')
    console.error(error)
  }
}

// 加载已有题目（从题库加载）
const loadExistingQuestions = async () => {
  if (!skill.value) return
  
  loadingQuestions.value = true
  try {
    const res = await getQuestionBank(route.params.id, { pageSize: 100 })
    
    // 处理不同的响应格式
    let list = []
    if (Array.isArray(res.data)) {
      list = res.data
    } else if (res.data?.list && Array.isArray(res.data.list)) {
      list = res.data.list
    } else if (res.data?.data && Array.isArray(res.data.data)) {
      list = res.data.data
    }
    
    existingQuestions.value = list.map(item => {
      const content = typeof item.content === 'string' 
        ? JSON.parse(item.content) 
        : item.content
      return {
        id: item.id,
        title: item.title,
        keywords: item.keywords,
        difficulty: item.difficulty,
        useCount: item.use_count || 0,
        ...content
      }
    })
  } catch (error) {
    console.error('加载题库失败:', error)
    ElMessage.error('加载题库失败')
    existingQuestions.value = [] // 确保为空数组
  } finally {
    loadingQuestions.value = false
  }
}

// 选择已有题目
const selectQuestion = async (q) => {
  selectedQuestion.value = q
  
  // 使用 useQuestion API 创建新的练习记录
  try {
    const res = await useQuestion(q.id)
    
    // 确保正确获取 practiceId
    if (res.data && res.data.id) {
      practiceId.value = res.data.id
      question.value = q
      console.log('从题库选择题目，练习ID:', practiceId.value)
      
      // 开始计时
      startTimer()
      ElMessage.success('已选择题目，开始练习')
    } else {
      console.error('选择题目返回数据异常:', res)
      ElMessage.error('创建练习记录失败')
    }
  } catch (error) {
    ElMessage.error('创建练习失败: ' + (error.message || '未知错误'))
    console.error('选择题目错误:', error)
  }
}

// 获取难度对应的标签类型
const getDifficultyType = (difficulty) => {
  const map = {
    '简单': 'success',
    '中等': 'warning',
    '困难': 'danger'
  }
  return map[difficulty] || 'info'
}

// 切换操作模式时的处理
const onActionModeChange = async (mode) => {
  if (mode === 'select' && existingQuestions.value.length === 0) {
    await loadExistingQuestions()
  }
}

// 生成练习题
const generateQuestion = async () => {
  generating.value = true
  try {
    const options = {}
    if (generateOptions.value.keywords?.trim()) {
      options.keywords = generateOptions.value.keywords.trim()
    }
    if (generateOptions.value.description?.trim()) {
      options.description = generateOptions.value.description.trim()
    }
    options.saveToBank = generateOptions.value.saveToBank
    
    // 添加字数区间参数
    options.wordCountMin = generateOptions.value.wordCountMin
    options.wordCountMax = generateOptions.value.wordCountMax
    
    const res = await generatePractice(route.params.id, options)
    question.value = res.data
    
    // 创建练习记录
    const createRes = await createPractice(route.params.id, {
      questionTitle: question.value.title || '练习题',
      questionContent: question.value
    })
    
    // 确保正确获取 practiceId
    if (createRes.data && createRes.data.id) {
      practiceId.value = createRes.data.id
      console.log('练习记录创建成功，ID:', practiceId.value)
    } else {
      console.error('创建练习返回数据异常:', createRes)
      ElMessage.error('创建练习记录失败')
      return
    }
    
    // 开始计时
    startTimer()
  } catch (error) {
    ElMessage.error('生成练习题失败: ' + (error.message || '未知错误'))
    console.error('生成练习题错误:', error)
  } finally {
    generating.value = false
  }
}

// 开始计时
const startTimer = () => {
  if (timerInterval.value) return
  
  timerInterval.value = setInterval(() => {
    timeSpent.value++
  }, 1000)
  
  // 自动保存
  autoSaveInterval.value = setInterval(() => {
    autoSave()
  }, 30000) // 30秒自动保存
}

// 停止计时
const stopTimer = () => {
  if (timerInterval.value) {
    clearInterval(timerInterval.value)
    timerInterval.value = null
  }
  if (autoSaveInterval.value) {
    clearInterval(autoSaveInterval.value)
    autoSaveInterval.value = null
  }
}

// 自动保存
const autoSave = async () => {
  if (!practiceId.value || !userAnswer.value) return
  if (userAnswer.value === lastSavedAnswer.value) return
  
  try {
    await updatePractice(practiceId.value, {
      userAnswer: userAnswer.value,
      timeSpent: 0 // 时间累计在后端处理
    })
    lastSavedAnswer.value = userAnswer.value
    console.log('自动保存成功')
  } catch (error) {
    console.error('自动保存失败:', error)
  }
}

// 手动保存
const handleSave = async () => {
  if (!practiceId.value) return
  
  try {
    await updatePractice(practiceId.value, {
      userAnswer: userAnswer.value,
      timeSpent: timeSpent.value
    })
    lastSavedAnswer.value = userAnswer.value
    ElMessage.success('保存成功')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

// 提交练习
const handleSubmit = async () => {
  if (!practiceId.value) {
    ElMessage.warning('练习记录不存在，请重新生成或选择题目')
    return
  }
  
  if (!userAnswer.value || !userAnswer.value.trim()) {
    ElMessage.warning('请先输入答案')
    return
  }
  
  // 检查字数
  if (question.value?.wordCountRange) {
    const { min, max } = question.value.wordCountRange
    if (wordCount.value < min) {
      ElMessage.warning(`字数不足，要求最少 ${min} 字，当前 ${wordCount.value} 字`)
      return
    }
    if (wordCount.value > max * 1.5) {
      ElMessage.warning(`字数超出太多，建议控制在 ${max} 字左右`)
    }
  }
  
  try {
    await ElMessageBox.confirm(
      '提交后将无法修改，确定要提交吗？',
      '提交确认',
      { type: 'warning' }
    )
    
    submitting.value = true
    stopTimer()
    
    await submitPractice(practiceId.value, {
      userAnswer: userAnswer.value,
      timeSpent: timeSpent.value
    })
    
    ElMessage.success('提交成功，正在进行 AI 评审...')
    
    // 自动开始评审
    handleEvaluate()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('提交失败')
      startTimer()
    }
  } finally {
    submitting.value = false
  }
}

// AI 评审
const handleEvaluate = async () => {
  if (!practiceId.value) return
  
  evaluating.value = true
  try {
    const res = await evaluatePractice(practiceId.value)
    ElMessage.success('评审完成')
    
    // 跳转到评审结果页
    router.push(`/skills/practice/${practiceId.value}`)
  } catch (error) {
    ElMessage.error('评审失败: ' + (error.message || '未知错误'))
  } finally {
    evaluating.value = false
  }
}

// 返回
const goBack = async () => {
  if (userAnswer.value && userAnswer.value !== lastSavedAnswer.value) {
    try {
      await ElMessageBox.confirm(
        '有未保存的内容，是否保存后离开？',
        '提示',
        {
          confirmButtonText: '保存并离开',
          cancelButtonText: '直接离开',
          distinguishCancelAndClose: true
        }
      )
      await handleSave()
    } catch (action) {
      if (action === 'close') return
    }
  }
  
  stopTimer()
  router.push(`/skills/${route.params.id}`)
}

onMounted(async () => {
  await loadSkill()
  
  // 如果 URL 中有 practiceId，加载已有练习
  const existingPracticeId = route.query.practiceId
  if (existingPracticeId) {
    await loadExistingPractice(existingPracticeId)
  }
  
  loading.value = false
})

// 加载已有练习
const loadExistingPractice = async (id) => {
  try {
    const res = await getPractice(id)
    const practice = res.data
    
    // 解析题目内容
    let questionContent = practice.question_content
    if (typeof questionContent === 'string') {
      questionContent = JSON.parse(questionContent)
    }
    
    question.value = questionContent
    practiceId.value = practice.id
    userAnswer.value = practice.user_answer || ''
    lastSavedAnswer.value = practice.user_answer || ''
    timeSpent.value = practice.time_spent || 0
    
    // 如果是草稿状态，开始计时
    if (practice.status === 'draft') {
      startTimer()
    }
  } catch (error) {
    ElMessage.error('加载练习失败: ' + (error.message || '未知错误'))
    console.error(error)
  }
}

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <div class="practice-page" v-loading="loading">
    <!-- 返回按钮 -->
    <div class="back-bar">
      <el-button :icon="ArrowLeft" text @click="goBack">返回技巧详情</el-button>
    </div>
    
    <template v-if="skill">
      <!-- 还没有生成题目 -->
      <div v-if="!question" class="generate-section">
        <el-card class="skill-info-card">
          <div class="skill-brief">
            <h2>{{ skill.name }}</h2>
            <p>{{ skill.summary }}</p>
            
            <div class="key-points" v-if="skill.key_points?.length">
              <h4>核心要点</h4>
              <ul>
                <li v-for="(point, i) in skill.key_points" :key="i">{{ point }}</li>
              </ul>
            </div>
          </div>
          
          <div class="generate-action">
            <div class="action-tabs">
              <el-radio-group v-model="actionMode" size="large" @change="onActionModeChange">
                <el-radio-button label="generate">生成新题目</el-radio-button>
                <el-radio-button label="select">选择已有题目</el-radio-button>
              </el-radio-group>
            </div>
            
            <!-- 生成新题目 -->
            <div v-if="actionMode === 'generate'" class="generate-mode">
              <p class="tip">
                AI 将根据这个技巧的核心要点，为你生成一道针对性的练习题
              </p>
              
              <!-- 高级选项 -->
              <div class="advanced-toggle">
                <el-button link type="primary" @click="showAdvancedOptions = !showAdvancedOptions">
                  {{ showAdvancedOptions ? '收起自定义选项' : '自定义生成选项' }}
                  <el-icon class="toggle-icon" :class="{ expanded: showAdvancedOptions }">
                    <ArrowLeft />
                  </el-icon>
                </el-button>
              </div>
              
              <el-collapse-transition>
                <div v-show="showAdvancedOptions" class="advanced-options">
                  <el-form label-position="top" size="small">
                    <el-form-item label="关键词 / 元素（可选）">
                      <el-input
                        v-model="generateOptions.keywords"
                        placeholder="如：校园、春天、分离、暗恋..."
                        clearable
                      />
                      <div class="form-tip">输入你希望题目包含的关键词或元素，多个用逗号分隔</div>
                    </el-form-item>
                    
                    <el-form-item label="具体要求（可选）">
                      <el-input
                        v-model="generateOptions.description"
                        type="textarea"
                        :rows="2"
                        placeholder="描述你希望生成什么样的题目..."
                        clearable
                      />
                      <div class="form-tip">更详细地描述你的需求，让题目更符合你的练习目标</div>
                    </el-form-item>
                    
                    <el-form-item label="目标字数区间">
                      <div class="word-count-range">
                        <el-input-number
                          v-model="generateOptions.wordCountMin"
                          :min="10"
                          :max="generateOptions.wordCountMax - 10"
                          :step="10"
                          size="small"
                          controls-position="right"
                        />
                        <span class="range-separator">至</span>
                        <el-input-number
                          v-model="generateOptions.wordCountMax"
                          :min="generateOptions.wordCountMin + 10"
                          :max="30000"
                          :step="50"
                          size="small"
                          controls-position="right"
                        />
                        <span class="range-unit">字</span>
                      </div>
                      <div class="form-tip">设置练习的目标字数范围，最小10字，最大3万字</div>
                    </el-form-item>
                    
                    <el-form-item>
                      <el-checkbox v-model="generateOptions.saveToBank">
                        将生成的题目保存到题目库，方便以后继续练习
                      </el-checkbox>
                    </el-form-item>
                  </el-form>
                </div>
              </el-collapse-transition>
              
              <el-button 
                type="primary" 
                size="large"
                :loading="generating"
                @click="generateQuestion"
              >
                {{ generating ? '正在生成练习题...' : '生成练习题' }}
              </el-button>
            </div>
            
            <!-- 选择已有题目 -->
            <div v-else class="select-mode">
              <p class="tip">
                从该技巧的题库中选择一个题目进行练习
              </p>
              
              <div class="question-bank-list" v-loading="loadingQuestions">
                <div v-if="existingQuestions.length === 0 && !loadingQuestions" class="no-questions">
                  <el-empty description="题库暂无题目">
                    <el-button type="primary" @click="actionMode = 'generate'">
                      生成新题目
                    </el-button>
                  </el-empty>
                </div>
                
                <div v-else class="questions-list">
                  <el-card 
                    v-for="(q, index) in existingQuestions" 
                    :key="index"
                    class="question-item"
                    shadow="hover"
                  >
                    <div class="question-item-header">
                      <h4>{{ q.title }}</h4>
                      <div class="question-item-tags">
                        <el-tag v-if="q.difficulty" size="small" :type="getDifficultyType(q.difficulty)">
                          {{ q.difficulty }}
                        </el-tag>
                        <el-tag size="small" type="info">已练习 {{ q.useCount || 0 }} 次</el-tag>
                      </div>
                    </div>
                    
                    <div class="question-item-content">
                      <p v-if="q.background" class="background">
                        <strong>背景：</strong>{{ q.background.length > 100 ? q.background.slice(0, 100) + '...' : q.background }}
                      </p>
                      <p v-if="q.task" class="task">
                        <strong>任务：</strong>{{ q.task.length > 100 ? q.task.slice(0, 100) + '...' : q.task }}
                      </p>
                      <p v-if="q.keywords" class="keywords">
                        <strong>关键词：</strong>{{ q.keywords }}
                      </p>
                    </div>
                    
                    <div class="question-item-footer">
                      <span v-if="q.wordCountRange" class="word-range">
                        字数要求：{{ q.wordCountRange?.min }}-{{ q.wordCountRange?.max }}
                      </span>
                      <el-button type="primary" size="small" @click="selectQuestion(q)">
                        选择此题
                      </el-button>
                    </div>
                  </el-card>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </div>
      
      <!-- 练习区域 -->
      <div v-else class="practice-area">
        <!-- 写作区域 -->
        <el-card class="writing-card">
          <template #header>
            <div class="writing-header">
              <span>开始写作</span>
              <div class="writing-stats">
                <span class="timer">
                  <el-icon><Timer /></el-icon>
                  {{ formattedTime }}
                </span>
                <span class="word-count" :class="{ warning: !isWordCountValid }">
                  <el-icon><Document /></el-icon>
                  {{ wordCount }} 字
                </span>
              </div>
            </div>
          </template>
          
          <el-input
            v-model="userAnswer"
            type="textarea"
            :rows="15"
            placeholder="在这里开始你的写作..."
            :disabled="evaluating"
          />
          
          <div class="writing-actions">
            <el-button @click="handleSave" :disabled="evaluating || !practiceId">保存草稿</el-button>
            <el-button 
              type="primary" 
              @click="handleSubmit"
              :loading="submitting || evaluating"
              :disabled="!userAnswer || !userAnswer.trim() || practiceId === null"
            >
              {{ evaluating ? 'AI 评审中...' : '提交并评审' }}
            </el-button>
          </div>
        </el-card>
        
        <!-- 题目信息 -->
        <el-card class="question-card">
          <template #header>
            <div class="question-header">
              <h3>{{ question.title }}</h3>
              <div class="question-meta">
                <el-tag type="info" size="small">{{ skill.name }}</el-tag>
                <span class="word-range">
                  字数要求：{{ question.wordCountRange?.min }}-{{ question.wordCountRange?.max }}
                </span>
              </div>
            </div>
          </template>
          
          <div class="question-content">
            <div class="section" v-if="question.background">
              <h4>📖 背景</h4>
              <p>{{ question.background }}</p>
            </div>
            
            <div class="section" v-if="question.task">
              <h4>✍️ 写作任务</h4>
              <p>{{ question.task }}</p>
            </div>
            
            <div class="section" v-if="question.requirements?.length">
              <h4>📋 要求</h4>
              <ul>
                <li v-for="(req, i) in question.requirements" :key="i">{{ req }}</li>
              </ul>
            </div>
            
            <div class="section" v-if="question.skillFocus?.length">
              <h4>🎯 技巧重点</h4>
              <div class="skill-focus-tags">
                <el-tag v-for="(focus, i) in question.skillFocus" :key="i" type="warning">
                  {{ focus }}
                </el-tag>
              </div>
            </div>
            
            <el-collapse v-if="question.hints?.length">
              <el-collapse-item title="💡 提示（点击展开）">
                <ul>
                  <li v-for="(hint, i) in question.hints" :key="i">{{ hint }}</li>
                </ul>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </div>
    </template>
    
  </div>
</template>

<style scoped>
.practice-page {
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 40px;
}

.back-bar {
  margin-bottom: 16px;
}

/* 生成题目部分 */
.generate-section {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.skill-info-card {
  max-width: 600px;
  width: 100%;
}

.skill-brief {
  margin-bottom: 24px;
}

.skill-brief h2 {
  margin: 0 0 12px;
  font-size: 22px;
}

.skill-brief p {
  margin: 0 0 16px;
  color: #606266;
  line-height: 1.6;
}

.key-points h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #909399;
}

.key-points ul {
  margin: 0;
  padding-left: 20px;
}

.key-points li {
  margin-bottom: 6px;
  font-size: 14px;
  color: #606266;
}

.generate-action {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
}

.generate-action .tip {
  margin: 0 0 16px;
  color: #909399;
  font-size: 14px;
}

.advanced-toggle {
  margin-bottom: 12px;
}

.toggle-icon {
  transform: rotate(-90deg);
  transition: transform 0.3s;
  margin-left: 4px;
}

.toggle-icon.expanded {
  transform: rotate(90deg);
}

.advanced-options {
  text-align: left;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.advanced-options .el-form-item {
  margin-bottom: 12px;
}

.advanced-options .el-form-item:last-child {
  margin-bottom: 0;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 字数区间输入 */
.word-count-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.word-count-range .el-input-number {
  width: 120px;
}

.range-separator {
  color: #909399;
  font-size: 14px;
}

.range-unit {
  color: #909399;
  font-size: 14px;
}

/* 动作选项卡 */
.action-tabs {
  margin-bottom: 20px;
}

.generate-mode, .select-mode {
  padding: 20px 0;
}

.existing-questions-preview {
  margin-top: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.preview-title {
  margin: 0 0 8px;
  font-size: 13px;
  color: #606266;
}

.question-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 题目选择器 */
.question-selector {
  max-height: 60vh;
  overflow-y: auto;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-item {
  cursor: pointer;
  transition: all 0.3s;
}

.question-item:hover {
  transform: translateY(-2px);
}

.question-item.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.question-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.question-item-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.question-item-content {
  margin-bottom: 8px;
}

.question-item-content p {
  margin: 0 0 4px;
  font-size: 14px;
  color: #606266;
  line-height: 1.5;
}

.question-item-meta {
  font-size: 12px;
  color: #909399;
}

/* 题库列表样式 */
.question-bank-list {
  max-height: 500px;
  overflow-y: auto;
  text-align: left;
}

.question-bank-list .questions-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-bank-list .question-item {
  cursor: default;
}

.question-bank-list .question-item:hover {
  transform: none;
}

.question-item-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.question-item-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.question-item-content p {
  margin: 0 0 6px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.question-item-content .keywords {
  color: #909399;
}

.select-mode .tip {
  text-align: center;
}

.no-questions {
  padding: 40px 0;
}

/* 练习区域 */
.practice-area {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
  align-items: start;
}

.practice-area > :first-child {
  grid-column: 1;
}

.practice-area > :last-child {
  grid-column: 2;
}

/* 题目卡片 */
.question-card {
  margin-bottom: 0;
  position: sticky;
  top: 20px;
}

.question-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-header h3 {
  margin: 0;
  font-size: 16px;
}

.question-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.word-range {
  font-size: 12px;
  color: #909399;
}

.question-content .section {
  margin-bottom: 16px;
}

.question-content .section:last-child {
  margin-bottom: 0;
}

.question-content h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: #303133;
}

.question-content p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
}

.question-content ul {
  margin: 0;
  padding-left: 16px;
}

.question-content li {
  margin-bottom: 4px;
  font-size: 13px;
  line-height: 1.5;
}

.skill-focus-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 写作卡片 */
.writing-card {
  margin-bottom: 0;
}

.writing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.writing-stats {
  display: flex;
  gap: 20px;
}

.timer, .word-count {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #606266;
}

.word-count.warning {
  color: #e6a23c;
}

.writing-card :deep(.el-textarea__inner) {
  font-size: 15px;
  line-height: 1.8;
  font-family: inherit;
  min-height: 400px;
}

.writing-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}
</style>
