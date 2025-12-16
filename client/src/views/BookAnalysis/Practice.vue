<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Timer, Document } from '@element-plus/icons-vue'
import {
  getOutlinePractice,
  saveOutlinePracticeDraft,
  submitOutlinePractice
} from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const submitting = ref(false)

const practice = ref(null)
const userContent = ref('')
const timeSpent = ref(0)
const showOriginal = ref(false)

const practiceId = route.params.practiceId

// 自动保存定时器
let autoSaveTimer = null
let timeTimer = null

// 字数统计
const wordCount = computed(() => {
  return (userContent.value || '').replace(/\s/g, '').length
})

// 原文字数
const originalWordCount = computed(() => {
  return (practice.value?.original_content || '').replace(/\s/g, '').length
})

// 格式化时间
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// 流派图标
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵'
}

// 加载练习
async function loadPractice() {
  loading.value = true
  try {
    const res = await getOutlinePractice(practiceId)
    practice.value = res.data

    // 恢复已有内容
    if (practice.value.user_content) {
      userContent.value = practice.value.user_content
    }
    if (practice.value.time_spent) {
      timeSpent.value = practice.value.time_spent
    }

    // 如果已提交，跳转到结果页
    if (practice.value.status === 'submitted') {
      router.replace(`/book-analysis/practice/${practiceId}/result`)
      return
    }

    // 启动计时
    startTimer()
    // 启动自动保存
    startAutoSave()
  } catch (error) {
    console.error('加载练习失败:', error)
    ElMessage.error('加载练习失败')
    router.push('/book-analysis')
  } finally {
    loading.value = false
  }
}

// 启动计时器
function startTimer() {
  timeTimer = setInterval(() => {
    timeSpent.value++
  }, 1000)
}

// 启动自动保存
function startAutoSave() {
  autoSaveTimer = setInterval(async () => {
    if (userContent.value) {
      await saveDraft(true)
    }
  }, 30000) // 每30秒自动保存
}

// 保存草稿
async function saveDraft(silent = false) {
  if (saving.value) return

  saving.value = true
  try {
    await saveOutlinePracticeDraft(practiceId, {
      user_content: userContent.value,
      time_spent: timeSpent.value
    })
    if (!silent) {
      ElMessage.success('草稿已保存')
    }
  } catch (error) {
    console.error('保存草稿失败:', error)
    if (!silent) {
      ElMessage.error('保存草稿失败')
    }
  } finally {
    saving.value = false
  }
}

// 提交练习
async function handleSubmit() {
  if (!userContent.value || wordCount.value < 50) {
    ElMessage.warning('请至少写50字再提交')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要提交吗？提交后将由 AI 评价你的作品。\n当前字数：${wordCount.value} 字，用时：${formatTime(timeSpent.value)}`,
      '确认提交',
      { type: 'info' }
    )

    submitting.value = true
    ElMessage.info('正在提交，AI 评价中...')

    const res = await submitOutlinePractice(practiceId, {
      user_content: userContent.value,
      time_spent: timeSpent.value
    })

    ElMessage.success('提交成功！')
    router.push(`/book-analysis/practice/${practiceId}/result`)
  } catch (error) {
    if (error !== 'cancel') {
      console.error('提交失败:', error)
      ElMessage.error('提交失败: ' + (error.message || '未知错误'))
    }
  } finally {
    submitting.value = false
  }
}

// 退出确认
async function handleExit() {
  if (userContent.value && wordCount.value > 0) {
    try {
      await ElMessageBox.confirm(
        '您的练习尚未提交，是否保存草稿后退出？',
        '提示',
        {
          distinguishCancelAndClose: true,
          confirmButtonText: '保存并退出',
          cancelButtonText: '不保存'
        }
      )
      await saveDraft()
    } catch (action) {
      if (action === 'close') return // 点击关闭按钮，不退出
    }
  }
  router.push('/book-analysis')
}

// 清理
function cleanup() {
  if (autoSaveTimer) {
    clearInterval(autoSaveTimer)
  }
  if (timeTimer) {
    clearInterval(timeTimer)
  }
}

onMounted(() => {
  loadPractice()
})

onUnmounted(() => {
  cleanup()
  // 离开时自动保存
  if (userContent.value && practice.value?.status !== 'submitted') {
    saveDraft(true)
  }
})
</script>

<template>
  <div class="practice-page" v-loading="loading || submitting">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" @click="handleExit">退出</el-button>
        <div class="practice-info" v-if="practice">
          <span class="style-icon">{{ styleIcons[practice.style_key] }}</span>
          <span class="chapter-title">{{ practice.chapter_title }}</span>
        </div>
      </div>

      <div class="toolbar-center">
        <div class="stat-item">
          <el-icon><Timer /></el-icon>
          <span>{{ formatTime(timeSpent) }}</span>
        </div>
        <div class="stat-item">
          <el-icon><Document /></el-icon>
          <span>{{ wordCount }} / {{ originalWordCount }} 字</span>
        </div>
      </div>

      <div class="toolbar-right">
        <el-button @click="saveDraft()" :loading="saving">保存草稿</el-button>
        <el-button
          type="success"
          @click="showOriginal = !showOriginal"
        >
          {{ showOriginal ? '隐藏原文' : '查看原文' }}
        </el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitting"
          :disabled="wordCount < 50"
        >
          提交评审
        </el-button>
      </div>
    </div>

    <div class="main-content" v-if="practice">
      <!-- 左侧：细纲参考 -->
      <div class="outline-panel">
        <div class="panel-header">
          <h3>📋 细纲参考</h3>
          <el-tag size="small">{{ practice.novel_name }}</el-tag>
        </div>

        <div class="outline-list">
          <div
            v-for="(item, index) in practice.outline_content"
            :key="index"
            class="outline-item"
          >
            <div class="outline-order">{{ item.order || index + 1 }}</div>
            <div class="outline-content">
              <p class="outline-summary">{{ item.content_summary }}</p>
              <div class="outline-meta">
                <el-tag size="small" type="info" v-if="item.emotion_state">{{ item.emotion_state }}</el-tag>
                <el-tag size="small" type="info" v-if="item.plot_point">{{ item.plot_point }}</el-tag>
                <el-tag size="small" type="info" v-if="item.structure_role">{{ item.structure_role }}</el-tag>
                <el-tag size="small" type="info" v-if="item.rhythm_type">{{ item.rhythm_type }}</el-tag>
                <el-tag size="small" type="info" v-if="item.detail_level">{{ item.detail_level }}</el-tag>
                <span class="word-suggest" v-if="item.word_count_suggest">
                  建议 {{ item.word_count_suggest }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 写作提示 -->
        <div class="writing-tips">
          <h4>💡 写作提示</h4>
          <ul>
            <li>仔细阅读细纲，理解每个段落的核心内容</li>
            <li>用自己的语言表达，不要机械复制</li>
            <li>注意情感基调和节奏把控</li>
            <li>可以查看原文参考，但尽量先自己写</li>
          </ul>
        </div>
      </div>

      <!-- 中间：写作区域 -->
      <div class="writing-panel">
        <div class="panel-header">
          <h3>✍️ 开始写作</h3>
        </div>

        <el-input
          v-model="userContent"
          type="textarea"
          :rows="30"
          placeholder="根据左侧的细纲，用自己的语言写出正文...&#10;&#10;提示：&#10;- 不要逐字复制原文&#10;- 体会作者的表达方式&#10;- 发挥自己的风格"
          class="writing-textarea"
        />
      </div>

      <!-- 右侧：原文参考（可折叠） -->
      <transition name="slide">
        <div class="original-panel" v-show="showOriginal">
          <div class="panel-header">
            <h3>📖 原文参考</h3>
            <el-button size="small" @click="showOriginal = false">收起</el-button>
          </div>

          <div class="original-content">
            {{ practice.original_content }}
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
.practice-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
}

/* 工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: white;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.practice-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style-icon {
  font-size: 20px;
}

.chapter-title {
  font-weight: 500;
  color: #303133;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 24px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #606266;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  gap: 20px;
  padding: 20px;
  overflow: hidden;
}

/* 面板通用样式 */
.outline-panel,
.writing-panel,
.original-panel {
  background: white;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  flex-shrink: 0;
}

.panel-header h3 {
  margin: 0;
  font-size: 15px;
}

/* 细纲面板 */
.outline-panel {
  width: 320px;
  flex-shrink: 0;
}

.outline-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.outline-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px dashed #ebeef5;
}

.outline-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.outline-order {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.outline-content {
  flex: 1;
}

.outline-summary {
  margin: 0 0 8px 0;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
}

.outline-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.word-suggest {
  font-size: 11px;
  color: #909399;
}

.writing-tips {
  padding: 16px;
  background: #f5f7fa;
  border-top: 1px solid #ebeef5;
}

.writing-tips h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
}

.writing-tips ul {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: #909399;
  line-height: 1.8;
}

/* 写作面板 */
.writing-panel {
  flex: 1;
  min-width: 0;
}

.writing-textarea {
  flex: 1;
  height: 100%;
}

.writing-textarea :deep(.el-textarea__inner) {
  height: 100% !important;
  resize: none;
  font-size: 15px;
  line-height: 1.8;
  padding: 20px;
  border: none;
  border-radius: 0;
}

/* 原文面板 */
.original-panel {
  width: 400px;
  flex-shrink: 0;
}

.original-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  font-size: 14px;
  line-height: 1.8;
  color: #606266;
  white-space: pre-wrap;
}

/* 过渡动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* 响应式 */
@media (max-width: 1200px) {
  .outline-panel {
    width: 280px;
  }

  .original-panel {
    width: 320px;
  }
}

@media (max-width: 768px) {
  .toolbar {
    flex-wrap: wrap;
    gap: 12px;
  }

  .main-content {
    flex-direction: column;
  }

  .outline-panel,
  .original-panel {
    width: 100%;
    max-height: 300px;
  }

  .writing-panel {
    min-height: 400px;
  }
}
</style>
