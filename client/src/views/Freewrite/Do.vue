<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createFreewrite, updateFreewrite, finishFreewrite, getFreewrite } from '../../api/freewrite'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDebounceFn } from '@vueuse/core'
import DictionaryDrawer from '../../components/DictionaryDrawer.vue'

const route = useRoute()
const router = useRouter()

const loading = ref(true)
const saving = ref(false)
const finishing = ref(false)
const practiceId = ref(null)
const practice = ref(null)
const content = ref('')
const title = ref('')
const isFullscreen = ref(false)

// 从 URL 获取参数
const parentId = computed(() => route.query.parentId)
const initialTitle = computed(() => route.query.title || '随心练习')
const pomodoroDuration = computed(() => {
  const d = route.query.duration
  return d ? parseInt(d) : null
})

// 词典
const dictionaryVisible = ref(false)

// 计时器相关
const timeSpent = ref(0)
const timerActive = ref(true)
let timerInterval = null

// 番茄钟相关
const pomodoroRemaining = ref(0)
const pomodoroActive = ref(false)
const pomodoroFinished = ref(false)

// 字数统计
const wordCount = computed(() => {
  if (!content.value) return 0
  return content.value.replace(/[\s\p{P}]/gu, '').length
})

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

// 格式化番茄钟剩余时间
function formatPomodoro(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// 启动计时器
function startTimer() {
  if (timerInterval) return
  timerInterval = setInterval(() => {
    if (timerActive.value) {
      timeSpent.value++
      
      // 番茄钟倒计时
      if (pomodoroActive.value && pomodoroRemaining.value > 0) {
        pomodoroRemaining.value--
        
        if (pomodoroRemaining.value === 0) {
          handlePomodoroEnd()
        }
      }
    }
  }, 1000)
}

// 停止计时器
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

// 番茄钟结束处理
async function handlePomodoroEnd() {
  pomodoroActive.value = false
  pomodoroFinished.value = true
  timerActive.value = false
  
  // 播放提示音（可选）
  try {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleHQ6TWOj0NzVtHxbQ0tpl5mmm4RvWFZmfJWeoJR+amBfa3SBiIaCfXZxb3N5fYGEhIJ/fHp5en2AgoSEg4F+fHt7fH6AgYODgoB+fHt7fH6AgoODgoB+fHt7fH6AgoODgoB+fHt7fH6AgoODgoB+fHt7fH6AgoODgoB+fHt7fH6AgoODgoB+fXx8fX6AgoODgoB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoOCgYB+fXx8fX6AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+fXx8fX+AgoKCgYB+')
    audio.play().catch(() => {})
  } catch {}
  
  ElMessageBox.alert(
    '番茄钟时间到！休息一下，或者选择如何处理这次写作。',
    '⏰ 时间到',
    {
      confirmButtonText: '我知道了',
      type: 'success'
    }
  )
}

// 自动保存（防抖）
const autoSave = useDebounceFn(async () => {
  if (!practiceId.value || saving.value) return
  
  try {
    saving.value = true
    await updateFreewrite(practiceId.value, {
      title: title.value,
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
watch([content, title], () => {
  if (practiceId.value) {
    autoSave()
  }
})

// 手动保存
async function save() {
  if (!practiceId.value) return
  
  try {
    saving.value = true
    await updateFreewrite(practiceId.value, {
      title: title.value,
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

// 完成写作
async function finish(finishType = 'manual') {
  if (wordCount.value === 0) {
    ElMessage.warning('请先写点内容再结束')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      '确定要结束写作吗？结束后可以选择是否进行评审。',
      '结束写作',
      { type: 'info' }
    )
  } catch {
    return
  }
  
  try {
    finishing.value = true
    await finishFreewrite(practiceId.value, {
      content: content.value,
      time_spent: timeSpent.value,
      finish_type: finishType
    })
    
    ElMessage.success('写作完成')
    router.push(`/freewrite/${practiceId.value}`)
  } catch (error) {
    console.error('完成失败:', error)
  } finally {
    finishing.value = false
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

// 初始化练习
async function initPractice() {
  try {
    loading.value = true
    
    // 检查是否是继续已有练习
    const existingId = route.params.id
    if (existingId) {
      const res = await getFreewrite(existingId)
      practice.value = res.data
      practiceId.value = res.data.id
      content.value = res.data.content || ''
      title.value = res.data.title || ''
      timeSpent.value = res.data.time_spent || 0
      
      if (res.data.pomodoro_duration && res.data.status === 'writing') {
        const elapsed = timeSpent.value
        const total = res.data.pomodoro_duration * 60
        pomodoroRemaining.value = Math.max(0, total - elapsed)
        pomodoroActive.value = pomodoroRemaining.value > 0
      }
    } else {
      // 创建新练习
      const res = await createFreewrite({
        title: initialTitle.value,
        pomodoro_duration: pomodoroDuration.value,
        parent_id: parentId.value
      })
      
      practiceId.value = res.data.id
      practice.value = res.data
      content.value = res.data.content || ''
      title.value = res.data.title || initialTitle.value
      
      if (pomodoroDuration.value) {
        pomodoroRemaining.value = pomodoroDuration.value * 60
        pomodoroActive.value = true
      }
    }
    
    startTimer()
  } catch (error) {
    console.error('初始化失败:', error)
    ElMessage.error('初始化失败')
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
  // Ctrl/Cmd + Enter 完成
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    finish()
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
  content.value += word.word
  ElMessage.success(`已插入：${word.word}`)
}

// 返回确认
async function handleBack() {
  if (wordCount.value > 0) {
    try {
      await ElMessageBox.confirm(
        '确定要离开吗？当前内容已自动保存。',
        '确认离开',
        { type: 'warning' }
      )
    } catch {
      return
    }
  }
  router.push('/freewrite')
}

onMounted(() => {
  initPractice()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  stopTimer()
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="freewrite-do" :class="{ fullscreen: isFullscreen }" v-loading="loading">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button @click="handleBack" :disabled="isFullscreen">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <el-input
          v-model="title"
          placeholder="输入标题..."
          class="title-input"
          :maxlength="50"
        />
      </div>
      
      <div class="toolbar-center">
        <!-- 番茄钟倒计时 -->
        <div v-if="pomodoroDuration" class="pomodoro-timer" :class="{ active: pomodoroActive, finished: pomodoroFinished }">
          <span class="pomodoro-icon">🍅</span>
          <span class="pomodoro-time">{{ formatPomodoro(pomodoroRemaining) }}</span>
          <el-tag v-if="pomodoroFinished" size="small" type="success">已完成</el-tag>
        </div>
        
        <div class="word-count">
          <span class="count">{{ wordCount }}</span>
          <span class="label">字</span>
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
          保存
        </el-button>
        <el-button
          type="primary"
          @click="finish('manual')"
          :loading="finishing"
        >
          结束写作
        </el-button>
      </div>
    </div>
    
    <!-- 主内容区 -->
    <div class="main-content">
      <div class="writing-area">
        <el-input
          v-model="content"
          type="textarea"
          placeholder="开始你的自由写作...

在这里，没有题目限制，没有字数要求，
只需要跟随你的思绪，尽情表达。

写作的秘诀就是：先写下去，再说其他的。"
          :autosize="{ minRows: 20 }"
          class="writing-input"
        />
      </div>
      
      <!-- 右侧提示区 -->
      <div v-if="!isFullscreen" class="tip-panel">
        <div class="tip-header">
          <span>💡 写作提示</span>
        </div>
        <div class="tip-content">
          <div class="tip-section">
            <h4>🎯 核心理念</h4>
            <p>随心练习的目标是培养你的输出习惯，让写作成为一种自然的表达方式。</p>
          </div>
          
          <div class="tip-section">
            <h4>✨ 写作建议</h4>
            <ul>
              <li>不要在意完美，先写下来</li>
              <li>跟随思绪，不设限制</li>
              <li>专注当下，享受过程</li>
              <li>坚持输出，量变引质变</li>
            </ul>
          </div>
          
          <div v-if="pomodoroDuration" class="tip-section">
            <h4>🍅 番茄时间</h4>
            <p>你设定了 {{ pomodoroDuration }} 分钟的专注时间。在时间结束前，请保持写作状态，尽量不要中断。</p>
          </div>
          
          <div class="tip-section">
            <h4>⌨️ 快捷键</h4>
            <ul class="shortcuts">
              <li><kbd>Ctrl</kbd>+<kbd>S</kbd> 保存</li>
              <li><kbd>Ctrl</kbd>+<kbd>Enter</kbd> 结束</li>
              <li><kbd>Ctrl</kbd>+<kbd>D</kbd> 词典</li>
              <li><kbd>Esc</kbd> 退出全屏</li>
            </ul>
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
        Ctrl+S 保存 | Ctrl+Enter 结束 | Ctrl+D 词典
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
.freewrite-do {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
  margin: -20px;
  background: #fff;
  /* 移动端安全区域适配 */
  padding-top: env(safe-area-inset-top, 0px);
}

.freewrite-do.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  height: 100vh;
  margin: 0;
  padding-top: env(safe-area-inset-top, 0px);
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

.title-input {
  width: 300px;
}

.title-input :deep(.el-input__inner) {
  border: none;
  font-size: 16px;
  font-weight: 500;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 24px;
}

.pomodoro-timer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: #fef0f0;
  border-radius: 20px;
  color: #f56c6c;
}

.pomodoro-timer.active {
  background: #fef0f0;
  animation: pulse 2s infinite;
}

.pomodoro-timer.finished {
  background: #f0f9eb;
  color: #67c23a;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.pomodoro-icon {
  font-size: 18px;
}

.pomodoro-time {
  font-size: 18px;
  font-weight: bold;
  font-family: 'Courier New', monospace;
}

.word-count {
  font-size: 16px;
  font-weight: 500;
}

.word-count .count {
  color: #409eff;
  font-size: 20px;
}

.word-count .label {
  color: #909399;
  margin-left: 4px;
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

.writing-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
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

.tip-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  overflow: hidden;
}

.tip-header {
  padding: 12px 16px;
  font-weight: 600;
  color: #303133;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  font-size: 15px;
}

.tip-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.tip-section {
  margin-bottom: 20px;
}

.tip-section h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #303133;
}

.tip-section p {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.tip-section ul {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #606266;
  line-height: 1.8;
}

.shortcuts {
  list-style: none;
  padding: 0;
}

.shortcuts li {
  margin-bottom: 4px;
}

.shortcuts kbd {
  display: inline-block;
  padding: 2px 6px;
  font-size: 12px;
  font-family: monospace;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  margin: 0 2px;
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

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .freewrite-do {
    height: 100vh;
    margin: 0;
    padding: 0;
    padding-top: env(safe-area-inset-top, 0px);
  }
  
  .toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 8px 12px;
  }
  
  .toolbar-left {
    order: 1;
    flex: 1;
    min-width: 100%;
    gap: 8px;
  }
  
  .toolbar-left .el-button {
    padding: 8px;
  }
  
  .toolbar-left .el-button span {
    display: none;
  }
  
  .title-input {
    flex: 1;
    width: auto;
  }
  
  .title-input :deep(.el-input__inner) {
    font-size: 14px;
  }
  
  .toolbar-center {
    order: 2;
    flex: 1;
    justify-content: flex-start;
    gap: 12px;
  }
  
  .pomodoro-timer {
    padding: 4px 10px;
    font-size: 14px;
  }
  
  .pomodoro-icon {
    font-size: 14px;
  }
  
  .pomodoro-time {
    font-size: 14px;
  }
  
  .word-count {
    font-size: 14px;
  }
  
  .word-count .count {
    font-size: 16px;
  }
  
  .timer {
    font-size: 13px;
    padding: 2px 8px;
    gap: 4px;
  }
  
  .toolbar-right {
    order: 3;
    gap: 6px;
  }
  
  .toolbar-right .el-button {
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .toolbar-right .el-button:first-child {
    display: none; /* 隐藏全屏按钮 */
  }
  
  .main-content {
    flex-direction: column;
    padding: 12px;
    gap: 12px;
  }
  
  .writing-area {
    flex: 1;
    min-height: 0;
  }
  
  .writing-input :deep(.el-textarea__inner) {
    font-size: 15px;
    line-height: 1.8;
    padding: 12px;
    min-height: calc(100vh - 220px) !important;
  }
  
  .tip-panel {
    display: none; /* 移动端隐藏提示面板 */
  }
  
  .status-bar {
    padding: 6px 12px;
    font-size: 11px;
  }
  
  .status-bar .tips {
    display: none; /* 移动端隐藏快捷键提示 */
  }
  
  .dictionary-fab {
    right: 16px;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  }
  
  .dictionary-fab .el-button {
    width: 48px;
    height: 48px;
  }
  
  .dictionary-fab .el-button .el-icon {
    font-size: 20px !important;
  }
}
</style>
