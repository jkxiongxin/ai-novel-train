<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Timer, Document, View, Hide, Check } from '@element-plus/icons-vue'
import {
  getMaskPractice,
  saveMaskPracticeDraft,
  submitMaskPractice
} from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const submitting = ref(false)

const practice = ref(null)
const userContent = ref({}) // { blockIndex: content }
const timeSpent = ref(0)
const showOriginal = ref({}) // { blockIndex: boolean }

const practiceId = route.params.practiceId

// 自动保存定时器
let autoSaveTimer = null
let timeTimer = null

// 解析段落
const paragraphs = computed(() => {
  if (!practice.value || !practice.value.original_content) return []
  return String(practice.value.original_content)
    .split(/\r?\n/)
    .map((p, i) => ({ index: i + 1, text: p.trim() }))
    .filter(p => p.text.length > 0)
})

// 遮蔽块列表
const maskedBlocks = computed(() => {
  return practice.value?.masked_blocks || []
})

// 总字数统计
const totalWordCount = computed(() => {
  let count = 0
  Object.values(userContent.value).forEach(content => {
    count += (content || '').replace(/\s/g, '').length
  })
  return count
})

// 原文总字数
const originalMaskedWordCount = computed(() => {
  let count = 0
  maskedBlocks.value.forEach(block => {
    const startIdx = block.paragraph_start - 1
    const endIdx = block.paragraph_end
    const blockText = paragraphs.value.slice(startIdx, endIdx).map(p => p.text).join('')
    count += blockText.replace(/\s/g, '').length
  })
  return count
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
  rhythm_flow: '🎵',
  manual: '✍️'
}

// 判断段落是否被遮蔽
function isParagraphMasked(paragraphIndex) {
  return maskedBlocks.value.some(block => 
    paragraphIndex >= block.paragraph_start && paragraphIndex <= block.paragraph_end
  )
}

// 获取段落所属的遮蔽块索引
function getMaskedBlockIndex(paragraphIndex) {
  return maskedBlocks.value.findIndex(block => 
    paragraphIndex >= block.paragraph_start && paragraphIndex <= block.paragraph_end
  )
}

// 判断是否是遮蔽块的起始段落
function isMaskBlockStart(paragraphIndex) {
  return maskedBlocks.value.filter(block => block.paragraph_start === paragraphIndex)
}

// 获取遮蔽块的原文
function getBlockOriginalText(blockIndex) {
  const block = maskedBlocks.value[blockIndex]
  if (!block) return ''
  const startIdx = block.paragraph_start - 1
  const endIdx = block.paragraph_end
  return paragraphs.value.slice(startIdx, endIdx).map(p => p.text).join('\n')
}

// 切换显示原文
function toggleOriginal(blockIndex) {
  showOriginal.value[blockIndex] = !showOriginal.value[blockIndex]
}

// 加载练习
async function loadPractice() {
  loading.value = true
  try {
    const res = await getMaskPractice(practiceId)
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
      router.replace(`/book-analysis/mask-practice/${practiceId}/result`)
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
    if (Object.keys(userContent.value).length > 0) {
      await saveDraft(true)
    }
  }, 30000) // 每30秒自动保存
}

// 保存草稿
async function saveDraft(silent = false) {
  if (saving.value) return

  saving.value = true
  try {
    await saveMaskPracticeDraft(practiceId, {
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
  // 检查是否所有遮蔽块都已填写
  const filledCount = Object.keys(userContent.value).filter(k => userContent.value[k]?.trim()).length
  if (filledCount === 0) {
    ElMessage.warning('请至少填写一个遮蔽块的内容')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要提交吗？提交后将由 AI 评价你的作品。\n已填写 ${filledCount}/${maskedBlocks.value.length} 块，共 ${totalWordCount.value} 字，用时：${formatTime(timeSpent.value)}`,
      '确认提交',
      { type: 'info' }
    )

    submitting.value = true
    ElMessage.info('正在提交，AI 评价中...')

    const res = await submitMaskPractice(practiceId, {
      user_content: userContent.value,
      time_spent: timeSpent.value
    })

    ElMessage.success('提交成功！')
    router.push(`/book-analysis/mask-practice/${practiceId}/result`)
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
  if (Object.keys(userContent.value).length > 0 && totalWordCount.value > 0) {
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
      if (action === 'close') return
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
  if (Object.keys(userContent.value).length > 0 && practice.value?.status !== 'submitted') {
    saveDraft(true)
  }
})
</script>

<template>
  <div class="mask-practice-page" v-loading="loading || submitting">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" @click="handleExit">退出</el-button>
        <div class="practice-info" v-if="practice">
          <span class="style-icon">{{ styleIcons[practice.style_key] || '📖' }}</span>
          <span class="chapter-title">{{ practice.chapter_title }}</span>
          <el-tag size="small" type="warning">遮蔽练习</el-tag>
        </div>
      </div>

      <div class="toolbar-center">
        <div class="stat-item">
          <el-icon><Timer /></el-icon>
          <span>{{ formatTime(timeSpent) }}</span>
        </div>
        <div class="stat-item">
          <el-icon><Document /></el-icon>
          <span>{{ totalWordCount }} / {{ originalMaskedWordCount }} 字</span>
        </div>
        <div class="stat-item">
          <span>🎭 {{ maskedBlocks.length }} 块</span>
        </div>
      </div>

      <div class="toolbar-right">
        <el-button @click="saveDraft()" :loading="saving">保存草稿</el-button>
        <el-button
          type="primary"
          @click="handleSubmit"
          :loading="submitting"
          :disabled="totalWordCount < 10"
        >
          提交评审
        </el-button>
      </div>
    </div>

    <div class="main-content" v-if="practice">
      <!-- 左侧：章节内容（带遮蔽） -->
      <div class="document-panel">
        <div class="panel-header">
          <span>📖 章节内容</span>
          <span class="hint-text">被遮蔽的部分需要你根据细纲提示来还原</span>
        </div>

        <div class="document-content">
          <template v-for="(p, idx) in paragraphs" :key="p.index">
            <!-- 遮蔽块写作区域 -->
            <template v-for="block in isMaskBlockStart(p.index)" :key="'editor-' + block.paragraph_start">
              <div class="mask-editor-block">
                <div class="mask-editor-header">
                  <span class="mask-icon">🎭</span>
                  <span class="mask-title">
                    遮蔽块 {{ maskedBlocks.indexOf(block) + 1 }} 
                    (P{{ block.paragraph_start }}-P{{ block.paragraph_end }})
                  </span>
                  <el-button 
                    size="small" 
                    :type="showOriginal[maskedBlocks.indexOf(block)] ? 'warning' : 'default'"
                    @click="toggleOriginal(maskedBlocks.indexOf(block))"
                  >
                    <el-icon><component :is="showOriginal[maskedBlocks.indexOf(block)] ? Hide : View" /></el-icon>
                    {{ showOriginal[maskedBlocks.indexOf(block)] ? '隐藏原文' : '查看原文' }}
                  </el-button>
                </div>
                
                <div class="mask-hint" v-if="block.outline_hint">
                  <span class="hint-label">📋 细纲提示：</span>
                  <span class="hint-content">{{ block.outline_hint }}</span>
                </div>

                <el-input
                  v-model="userContent[maskedBlocks.indexOf(block)]"
                  type="textarea"
                  :rows="5"
                  :placeholder="`根据细纲提示，写出这部分的内容...`"
                  class="mask-textarea"
                />

                <div class="mask-word-count">
                  已写 {{ (userContent[maskedBlocks.indexOf(block)] || '').replace(/\s/g, '').length }} 字
                </div>

                <!-- 原文参考（可折叠） -->
                <transition name="fade">
                  <div 
                    class="original-reference" 
                    v-if="showOriginal[maskedBlocks.indexOf(block)]"
                  >
                    <div class="reference-label">📖 原文参考：</div>
                    <div class="reference-content">
                      {{ getBlockOriginalText(maskedBlocks.indexOf(block)) }}
                    </div>
                  </div>
                </transition>
              </div>
            </template>
            
            <!-- 正常段落（未遮蔽的） -->
            <p 
              v-if="!isParagraphMasked(p.index)"
              class="paragraph-text"
            >
              <span class="para-num">{{ p.index }}</span>
              {{ p.text }}
            </p>
          </template>
        </div>
      </div>

      <!-- 右侧：遮蔽块导航 -->
      <div class="nav-panel">
        <div class="panel-header">
          <span>📑 遮蔽块导航</span>
        </div>

        <div class="nav-list">
          <div 
            v-for="(block, idx) in maskedBlocks" 
            :key="idx"
            :class="['nav-item', { completed: userContent[idx]?.trim() }]"
            @click="scrollToBlock(idx)"
          >
            <span class="nav-number">{{ idx + 1 }}</span>
            <div class="nav-content">
              <div class="nav-range">P{{ block.paragraph_start }}-P{{ block.paragraph_end }}</div>
              <div class="nav-hint">{{ block.outline_hint?.slice(0, 30) }}{{ block.outline_hint?.length > 30 ? '...' : '' }}</div>
            </div>
            <el-icon class="nav-check" v-if="userContent[idx]?.trim()"><Check /></el-icon>
          </div>
        </div>

        <!-- 写作提示 -->
        <div class="writing-tips">
          <h4>💡 写作提示</h4>
          <ul>
            <li>仔细阅读前后文，保持内容连贯</li>
            <li>根据细纲提示把握核心内容</li>
            <li>用自己的语言表达，不要机械复制</li>
            <li>可以查看原文参考，但尽量先自己写</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Check } from '@element-plus/icons-vue'
export default {
  components: { Check }
}
</script>

<style scoped>
.mask-practice-page {
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
.document-panel,
.nav-panel {
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
  font-weight: 600;
}

.hint-text {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
}

/* 文档面板 */
.document-panel {
  flex: 1;
  min-width: 0;
}

.document-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', Georgia, serif;
  line-height: 2;
  font-size: 16px;
  color: #2c3e50;
}

/* 段落文本 */
.paragraph-text {
  margin: 0;
  padding: 8px 0 8px 20px;
  text-indent: 2em;
  position: relative;
}

.paragraph-text .para-num {
  position: absolute;
  left: -30px;
  top: 10px;
  font-size: 11px;
  color: #c0c4cc;
  font-family: system-ui, sans-serif;
  font-weight: 500;
}

/* 遮蔽块编辑区域 */
.mask-editor-block {
  margin: 20px 0;
  padding: 20px;
  background: linear-gradient(135deg, #f39c1210 0%, #e67e2210 100%);
  border: 2px dashed #f39c12;
  border-radius: 12px;
}

.mask-editor-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.mask-icon {
  font-size: 20px;
}

.mask-title {
  flex: 1;
  font-weight: 600;
  color: #e67e22;
  font-family: system-ui, sans-serif;
}

.mask-hint {
  background: white;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  line-height: 1.6;
}

.hint-label {
  color: #e6a23c;
  font-weight: 500;
}

.hint-content {
  color: #606266;
}

.mask-textarea :deep(.el-textarea__inner) {
  font-size: 15px;
  line-height: 1.8;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', Georgia, serif;
}

.mask-word-count {
  text-align: right;
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

/* 原文参考 */
.original-reference {
  margin-top: 12px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  border-left: 4px solid #909399;
}

.reference-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
  font-family: system-ui, sans-serif;
}

.reference-content {
  font-size: 14px;
  line-height: 1.8;
  color: #606266;
  white-space: pre-wrap;
}

/* 导航面板 */
.nav-panel {
  width: 300px;
  flex-shrink: 0;
}

.nav-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
}

.nav-item:hover {
  background: #f0f7ff;
  border-color: #409eff;
}

.nav-item.completed {
  background: #f0f9eb;
  border-color: #67c23a;
}

.nav-number {
  width: 28px;
  height: 28px;
  background: #f39c12;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.nav-item.completed .nav-number {
  background: #67c23a;
}

.nav-content {
  flex: 1;
  min-width: 0;
}

.nav-range {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.nav-hint {
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}

.nav-check {
  color: #67c23a;
  font-size: 18px;
}

/* 写作提示 */
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

/* 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  max-height: 0;
}

/* 响应式 */
@media (max-width: 1200px) {
  .nav-panel {
    width: 250px;
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

  .nav-panel {
    width: 100%;
    max-height: 200px;
  }

  .document-panel {
    min-height: 400px;
  }
}

/* 滚动条美化 */
.document-content::-webkit-scrollbar,
.nav-list::-webkit-scrollbar {
  width: 6px;
}

.document-content::-webkit-scrollbar-thumb,
.nav-list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}
</style>
