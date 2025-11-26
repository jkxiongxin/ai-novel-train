<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getPractice, updatePractice, submitPractice } from '../../api/practices'
import { requestEvaluation } from '../../api/evaluations'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIntervalFn, useDebounceFn } from '@vueuse/core'
import DictionaryDrawer from '../../components/DictionaryDrawer.vue'

const route = useRoute()
const router = useRouter()

const practiceId = computed(() => route.params.id)
const loading = ref(true)
const saving = ref(false)
const submitting = ref(false)
const evaluating = ref(false)
const practice = ref(null)
const content = ref('')
const isFullscreen = ref(false)

// 词典
const dictionaryVisible = ref(false)

// 计时器
const timeSpent = ref(0)
const timerActive = ref(true)

// 字数统计
const wordCount = computed(() => {
  if (!content.value) return 0
  return content.value.replace(/[\s\p{P}]/gu, '').length
})

// 字数范围
const wordRange = computed(() => {
  if (!practice.value?.question_content?.wordCountRange) {
    return { min: 0, max: Infinity }
  }
  return practice.value.question_content.wordCountRange
})

// 字数状态
const wordCountStatus = computed(() => {
  if (wordCount.value < wordRange.value.min) return 'below'
  if (wordCount.value > wordRange.value.max) return 'above'
  return 'ok'
})

// 计时器
const { pause: pauseTimer, resume: resumeTimer } = useIntervalFn(() => {
  if (timerActive.value) {
    timeSpent.value++
  }
}, 1000)

// 格式化时间
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

// 自动保存（防抖）
const autoSave = useDebounceFn(async () => {
  if (!content.value || saving.value) return
  
  try {
    saving.value = true
    await updatePractice(practiceId.value, {
      content: content.value,
      time_spent: timeSpent.value
    })
  } catch (error) {
    console.error('自动保存失败:', error)
  } finally {
    saving.value = false
  }
}, 3000)

// 监听内容变化，触发自动保存
watch(content, () => {
  autoSave()
})

// 手动保存
async function save() {
  try {
    saving.value = true
    await updatePractice(practiceId.value, {
      content: content.value,
      time_spent: timeSpent.value
    })
    ElMessage.success('保存成功')
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

// 提交并评审
async function submit() {
  if (wordCount.value < wordRange.value.min) {
    ElMessage.warning(`字数不足，要求至少 ${wordRange.value.min} 字`)
    return
  }
  
  try {
    await ElMessageBox.confirm(
      '提交后将进行 AI 评审，确定要提交吗？',
      '确认提交',
      { type: 'info' }
    )
  } catch {
    return
  }
  
  try {
    submitting.value = true
    
    // 先提交
    await submitPractice(practiceId.value, {
      content: content.value,
      time_spent: timeSpent.value
    })
    
    // 然后评审
    evaluating.value = true
    const res = await requestEvaluation(practiceId.value)
    
    ElMessage.success('评审完成')
    router.push(`/evaluation/${res.data.id}`)
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
    evaluating.value = false
  }
}

// 切换全屏
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

// 切换计时器
function toggleTimer() {
  timerActive.value = !timerActive.value
}

// 加载练习数据
async function loadPractice() {
  try {
    loading.value = true
    const res = await getPractice(practiceId.value)
    practice.value = res.data
    content.value = res.data.content || ''
    timeSpent.value = res.data.time_spent || 0
  } catch (error) {
    console.error('加载练习失败:', error)
    ElMessage.error('加载练习失败')
  } finally {
    loading.value = false
  }
}

// 键盘快捷键
function handleKeydown(e) {
  // Ctrl/Cmd + S 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    save()
  }
  // Ctrl/Cmd + Enter 提交
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    submit()
  }
  // Ctrl/Cmd + D 打开词典
  if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
    e.preventDefault()
    dictionaryVisible.value = true
  }
  // Esc 退出全屏
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

// 从词典选择词汇
function handleDictionarySelect(word) {
  // 将选中的词汇插入到光标位置或追加到末尾
  content.value += word.word
  ElMessage.success(`已插入：${word.word}`)
}

onMounted(() => {
  loadPractice()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  pauseTimer()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="do-practice" :class="{ fullscreen: isFullscreen }" v-loading="loading">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button @click="$router.back()" :disabled="isFullscreen">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="practice-title">
          {{ practice?.question_title }}
        </span>
      </div>
      
      <div class="toolbar-center">
        <div class="word-count" :class="wordCountStatus">
          <span class="count">{{ wordCount }}</span>
          <span class="range" v-if="wordRange.min > 0">
            / {{ wordRange.min }}-{{ wordRange.max }} 字
          </span>
        </div>
        
        <div class="timer" @click="toggleTimer">
          <el-icon><Timer /></el-icon>
          <span>{{ formatTime(timeSpent) }}</span>
          <el-tag v-if="!timerActive" size="small" type="info">暂停</el-tag>
        </div>
      </div>
      
      <div class="toolbar-right">
        <el-button @click="toggleFullscreen">
          <el-icon><FullScreen v-if="!isFullscreen" /><Close v-else /></el-icon>
        </el-button>
        <el-button @click="save" :loading="saving">
          保存草稿
        </el-button>
        <el-button
          type="primary"
          @click="submit"
          :loading="submitting || evaluating"
        >
          {{ evaluating ? '评审中...' : '提交评审' }}
        </el-button>
      </div>
    </div>
    
    <!-- 主内容区：左右分栏 -->
    <div class="main-content" :class="{ 'full-width': isFullscreen }">
      <!-- 左侧：写作区域 -->
      <div class="writing-panel">
        <div class="writing-area">
          <el-input
            v-model="content"
            type="textarea"
            placeholder="在这里开始你的写作..."
            :autosize="{ minRows: 20 }"
            class="writing-input"
          />
        </div>
      </div>
      
      <!-- 右侧：题目信息 -->
      <div v-if="!isFullscreen" class="question-panel">
        <div class="panel-header">
          <span>📋 题目信息</span>
        </div>
        <div class="panel-content">
          <div v-if="practice?.question_content" class="question-detail">
            <div class="info-tags">
              <el-tag size="small">{{ practice.question_type }}</el-tag>
              <el-tag size="small" type="info">{{ practice.difficulty }}</el-tag>
            </div>
            
            <div v-if="practice.question_content.background" class="section">
              <h4>📖 场景背景</h4>
              <p>{{ practice.question_content.background }}</p>
            </div>
            
            <div v-if="practice.question_content.characters" class="section">
              <h4>👥 角色设定</h4>
              <div class="characters">
                <div
                  v-for="char in practice.question_content.characters"
                  :key="char.name"
                  class="character-card"
                >
                  <div class="char-name">{{ char.name }}</div>
                  <div class="char-info">身份: {{ char.identity }}</div>
                  <div v-if="char.personality" class="char-info">性格: {{ char.personality }}</div>
                  <div v-if="char.currentEmotion" class="char-info">
                    情绪: {{ char.currentEmotion }}
                  </div>
                  <div v-if="char.speakingStyle" class="char-info">
                    说话风格: {{ char.speakingStyle }}
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 单个角色（情绪渲染等） -->
            <div v-if="practice.question_content.character" class="section">
              <h4>👤 角色设定</h4>
              <div class="character-card">
                <div class="char-name">{{ practice.question_content.character.name }}</div>
                <div class="char-info">身份: {{ practice.question_content.character.identity }}</div>
                <div v-if="practice.question_content.character.personality" class="char-info">
                  性格: {{ practice.question_content.character.personality }}
                </div>
                <div v-if="practice.question_content.character.emotionalTrigger" class="char-info">
                  情绪触发: {{ practice.question_content.character.emotionalTrigger }}
                </div>
              </div>
            </div>
            
            <div v-if="practice.question_content.objective" class="section">
              <h4>🎯 目标要求</h4>
              <p>{{ practice.question_content.objective }}</p>
            </div>
            
            <!-- 目标情绪 -->
            <div v-if="practice.question_content.targetEmotion" class="section">
              <h4>🎭 目标情绪</h4>
              <p>
                {{ practice.question_content.targetEmotion }}
                <span v-if="practice.question_content.emotionIntensity">
                  (强度: {{ practice.question_content.emotionIntensity }})
                </span>
              </p>
            </div>
            
            <!-- 约束条件 -->
            <div v-if="practice.question_content.constraints?.length" class="section">
              <h4>⚠️ 约束条件</h4>
              <ul class="list-items">
                <li v-for="(c, i) in practice.question_content.constraints" :key="i">{{ c }}</li>
              </ul>
            </div>
            
            <!-- 写作要求 -->
            <div v-if="practice.question_content.requirements?.length" class="section">
              <h4>📝 写作要求</h4>
              <ul class="list-items">
                <li v-for="(r, i) in practice.question_content.requirements" :key="i">{{ r }}</li>
              </ul>
            </div>
            
            <!-- 写作提示 -->
            <div v-if="practice.question_content.hints?.length" class="section">
              <h4>💡 写作提示</h4>
              <ul class="list-items hints">
                <li v-for="(h, i) in practice.question_content.hints" :key="i">{{ h }}</li>
              </ul>
            </div>
            
            <div v-if="practice.question_content.evaluationFocus" class="section">
              <h4>🔍 评审重点</h4>
              <div class="focus-tags">
                <el-tag
                  v-for="f in practice.question_content.evaluationFocus"
                  :key="f"
                  size="small"
                  type="warning"
                >
                  {{ f }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 底部状态栏 -->
    <div class="status-bar">
      <span v-if="saving" class="save-status">
        <el-icon class="is-loading"><Loading /></el-icon>
        保存中...
      </span>
      <span v-else class="save-status saved">
        <el-icon><Check /></el-icon>
        已自动保存
      </span>
      
      <span class="tips">
        Ctrl+S 保存 | Ctrl+Enter 提交 | Ctrl+D 词典 | Esc 退出全屏
      </span>
    </div>
    
    <!-- 词典悬浮按钮 -->
    <div class="dictionary-fab" @click="dictionaryVisible = true">
      <el-tooltip content="AI 词典 (Ctrl+D)" placement="left">
        <el-button type="primary" circle size="large">
          <el-icon :size="24"><Reading /></el-icon>
        </el-button>
      </el-tooltip>
    </div>
    
    <!-- 词典抽屉 -->
    <DictionaryDrawer 
      v-model:visible="dictionaryVisible"
      :context="content"
      @select="handleDictionarySelect"
    />
  </div>
</template>

<style scoped>
.do-practice {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
  margin: -20px;
  background: #fff;
}

.do-practice.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  height: 100vh;
  margin: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #ebeef5;
  background: #fff;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.practice-title {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 24px;
}

.word-count {
  font-size: 16px;
  font-weight: 500;
}

.word-count .count {
  color: #303133;
}

.word-count .range {
  color: #909399;
  font-size: 14px;
}

.word-count.below .count {
  color: #e6a23c;
}

.word-count.above .count {
  color: #f56c6c;
}

.word-count.ok .count {
  color: #67c23a;
}

.timer {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #606266;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 4px;
}

.timer:hover {
  background: #f5f7fa;
}

.toolbar-right {
  display: flex;
  gap: 8px;
}

.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
}

.main-content.full-width .writing-panel {
  flex: 1;
}

/* 左侧写作面板 */
.writing-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* 右侧题目面板 */
.question-panel {
  width: 380px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.panel-header {
  padding: 12px 16px;
  font-weight: 600;
  color: #303133;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  font-size: 15px;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.question-detail {
  line-height: 1.7;
}

.info-tags {
  margin-bottom: 16px;
  display: flex;
  gap: 8px;
}

.section {
  margin-bottom: 16px;
}

.section h4 {
  color: #303133;
  margin-bottom: 8px;
  font-size: 14px;
}

.section p {
  color: #606266;
  margin: 0;
}

/* 角色卡片样式 */
.characters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.character-card {
  background: #fff;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.char-name {
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
  font-size: 15px;
}

.char-info {
  color: #606266;
  font-size: 13px;
  margin-bottom: 4px;
  line-height: 1.5;
}

/* 列表项样式 */
.list-items {
  margin: 0;
  padding-left: 20px;
  color: #606266;
}

.list-items li {
  margin-bottom: 4px;
  line-height: 1.6;
}

.list-items.hints {
  color: #909399;
  font-style: italic;
}

.mini-chars {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.mini-char {
  color: #409eff;
  font-size: 14px;
}

.focus-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.writing-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.writing-input {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.writing-input :deep(.el-textarea__inner) {
  flex: 1;
  font-size: 16px;
  line-height: 2;
  padding: 20px;
  border-radius: 8px;
  resize: none;
  min-height: calc(100vh - 200px) !important;
}

.fullscreen .writing-input :deep(.el-textarea__inner) {
  min-height: calc(100vh - 160px) !important;
}

.status-bar {
  display: flex;
  justify-content: space-between;
  padding: 8px 20px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
  font-size: 12px;
  color: #909399;
}

.save-status {
  display: flex;
  align-items: center;
  gap: 4px;
}

.save-status.saved {
  color: #67c23a;
}

/* 词典悬浮按钮 */
.dictionary-fab {
  position: fixed;
  right: 30px;
  bottom: 80px;
  z-index: 100;
}

.dictionary-fab .el-button {
  width: 56px;
  height: 56px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dictionary-fab .el-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}
</style>
