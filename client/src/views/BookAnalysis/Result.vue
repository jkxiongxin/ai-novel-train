<script setup>
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Delete, Refresh, FullScreen, Close } from '@element-plus/icons-vue'
import {
  getChapterAnalyses,
  getBookAnalysisStyles,
  deleteAnalysis,
  createOutlinePractice
} from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const analysis = ref(null)
const styles = ref([])

const chapterId = route.params.chapterId
const styleKey = route.query.style

// 当前选中的批注
const activeAnnotationId = ref(null)
// 滚动容器引用
const contentRef = ref(null)
const annotationsRef = ref(null)

// 解析段落
const paragraphs = computed(() => {
  if (!analysis.value || !analysis.value.chapter_content) return []
  return String(analysis.value.chapter_content)
    .split(/\r?\n/)
    .map((p, i) => ({ index: i + 1, text: p.trim() }))
    .filter(p => p.text.length > 0)
})

// 获取批注列表
const annotations = computed(() => {
  if (!analysis.value || !analysis.value.analysis_result) return []
  const anns = analysis.value.analysis_result.annotations || []
  return anns.map((ann, idx) => ({
    ...ann,
    id: ann.id || idx + 1,
    paragraph_start: ann.paragraph_start || 1,
    paragraph_end: ann.paragraph_end || ann.paragraph_start || 1
  })).sort((a, b) => a.paragraph_start - b.paragraph_start)
})

// 获取细纲列表
const outlineItems = computed(() => {
  if (!analysis.value || !analysis.value.analysis_result) return []
  return analysis.value.analysis_result.outline || []
})

// 整体分析
const overallAnalysis = computed(() => {
  if (!analysis.value || !analysis.value.analysis_result) return null
  return analysis.value.analysis_result.overall_analysis || null
})

const metaSettings = computed(() => {
  return analysis.value?.analysis_result?._meta || null
})

const annotationCoverage = computed(() => {
  return analysis.value?.analysis_result?.annotations_coverage || null
})

const missingRangesText = computed(() => {
  const cov = annotationCoverage.value
  if (!cov || !cov.missing_ranges) return ''
  return cov.missing_ranges.map(r => `P${r.start}${r.end !== r.start ? '-P' + r.end : ''}`).join(', ')
})

// 判断某个段落是否有批注
function getParagraphAnnotations(paragraphIndex) {
  return annotations.value.filter(ann => 
    paragraphIndex >= ann.paragraph_start && paragraphIndex <= ann.paragraph_end
  )
}

// 判断段落是否是某个批注的起始段
function isAnnotationStart(paragraphIndex) {
  return annotations.value.filter(ann => ann.paragraph_start === paragraphIndex)
}

// 批注类型对应的颜色
const typeColors = {
  '情绪变化': '#e74c3c',
  '情节推进': '#3498db',
  '人物刻画': '#9b59b6',
  '环境描写': '#27ae60',
  '技法运用': '#f39c12',
  '节奏控制': '#1abc9c',
  '结构安排': '#34495e',
  '对话': '#e67e22',
  '心理': '#8e44ad',
  '伏笔': '#2c3e50',
  '高潮': '#c0392b',
  '转折': '#d35400'
}

function getAnnotationColor(type) {
  // 模糊匹配
  for (const [key, color] of Object.entries(typeColors)) {
    if (type && type.includes(key)) return color
  }
  return '#409eff'
}

// 流派图标
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵'
}

// 获取当前流派名称
const currentStyleName = computed(() => {
  if (!analysis.value) return ''
  const style = styles.value.find(s => s.style_key === analysis.value.style_key)
  return style?.name || analysis.value.style_key
})

// 点击批注时高亮对应段落
function handleAnnotationClick(ann) {
  activeAnnotationId.value = ann.id
  // 滚动到对应段落
  const paraEl = document.querySelector(`[data-para-index="${ann.paragraph_start}"]`)
  if (paraEl && contentRef.value) {
    paraEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// 点击段落时高亮对应批注
function handleParagraphClick(paragraphIndex) {
  const anns = isAnnotationStart(paragraphIndex)
  if (anns.length > 0) {
    activeAnnotationId.value = anns[0].id
    // 滚动批注面板到对应批注
    nextTick(() => {
      const annEl = document.querySelector(`[data-annotation-id="${anns[0].id}"]`)
      if (annEl && annotationsRef.value) {
        annEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
  }
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [analysisRes, stylesRes] = await Promise.all([
      getChapterAnalyses(chapterId, styleKey),
      getBookAnalysisStyles()
    ])

    analysis.value = analysisRes.data
    styles.value = stylesRes.data || []

    if (!analysis.value) {
      ElMessage.warning('未找到分析结果')
      router.push('/book-analysis/select')
    }
  } catch (error) {
    console.error('加载分析结果失败:', error)
    ElMessage.error('加载分析结果失败')
  } finally {
    loading.value = false
  }
}

// 开始细纲成文练习
async function startPractice() {
  if (!analysis.value) return

  try {
    const res = await createOutlinePractice({
      analysis_id: analysis.value.id
    })

    ElMessage.success('练习创建成功')
    router.push(`/book-analysis/practice/${res.data.id}`)
  } catch (error) {
    console.error('创建练习失败:', error)
    ElMessage.error('创建练习失败: ' + (error.message || '未知错误'))
  }
}

// 开始遮蔽练习
function startMaskPractice() {
  if (!analysis.value) return
  router.push(`/book-analysis/mask-select/${chapterId}?style=${styleKey}`)
}

// 手动批注
function goToManualAnnotation() {
  router.push(`/book-analysis/manual/${chapterId}`)
}

// 全屏模式控制
const isFullscreen = ref(false)

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

function handleGlobalKeydown(e) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

// 删除分析
async function handleDelete() {
  if (!analysis.value) return

  try {
    await ElMessageBox.confirm('确定要删除这个分析结果吗？相关的练习也会被删除。', '确认删除', {
      type: 'warning'
    })

    await deleteAnalysis(analysis.value.id)
    ElMessage.success('删除成功')
    router.push('/book-analysis')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 重新分析
function reAnalyze() {
  router.push({
    path: '/book-analysis/select',
    query: {
      novel: analysis.value?.novel_name,
      style: analysis.value?.style_key
    }
  })
}

// 返回
function goBack() {
  router.push('/book-analysis')
}

onMounted(() => {
  loadData()
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div class="result-page" v-loading="loading" :class="{ fullscreen: isFullscreen }">
    <!-- 顶部导航 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <div class="header-title">
        <h2>{{ styleIcons[analysis?.style_key] }} {{ currentStyleName }} 拆书结果</h2>
        <span class="chapter-info" v-if="analysis">
          {{ analysis.novel_name }} · {{ analysis.chapter_title }}
        </span>
      </div>
      <div class="header-actions">
        <el-button @click="toggleFullscreen" class="fullscreen-btn" :title="isFullscreen ? '退出全屏' : '全屏浏览'">
          <el-icon><FullScreen v-if="!isFullscreen" /><Close v-else /></el-icon>
        </el-button>
        <el-button type="primary" @click="startPractice" class="practice-btn">✍️ 开始细纲成文练习</el-button>
        <el-button type="warning" @click="startMaskPractice" class="practice-btn">🎭 开始遮蔽练习</el-button>
        <el-button :icon="Refresh" @click="reAnalyze">重新分析</el-button>
        <el-button type="danger" :icon="Delete" @click="handleDelete">删除</el-button>
      </div>
    </div>

    <!-- 摘要栏 -->
    <div class="summary-bar" v-if="analysis?.summary">
      <div class="summary-icon">📋</div>
      <div class="summary-content">
        <strong>分析摘要：</strong>{{ analysis.summary }}
      </div>
    </div>

    <!-- 整体分析（如有） -->
    <div class="overall-bar" v-if="overallAnalysis">
      <div class="overall-item" v-if="overallAnalysis.main_theme">
        <span class="label">📖 主题：</span>
        <span>{{ overallAnalysis.main_theme }}</span>
      </div>
      <div class="overall-item" v-if="overallAnalysis.key_techniques?.length">
        <span class="label">✨ 技巧：</span>
        <el-tag 
          v-for="(tech, i) in overallAnalysis.key_techniques" 
          :key="i" 
          size="small" 
          type="success"
          style="margin-right: 6px;"
        >{{ tech }}</el-tag>
      </div>
      <div class="overall-item" v-if="overallAnalysis.structure_pattern">
        <span class="label">🏗️ 结构：</span>
        <span>{{ overallAnalysis.structure_pattern }}</span>
      </div>
    <div class="overall-item" v-if="metaSettings">
      <span class="label">📊 生成配置：</span>
      <el-tag size="small">批注：{{ metaSettings.detail_level }}</el-tag>
      <el-tag size="small" type="warning">细纲：{{ metaSettings.outline_detail_level }}</el-tag>
    </div>
    <div class="overall-item" v-if="annotationCoverage && !annotationCoverage.covered">
      <span class="label">⚠️ 覆盖检查：</span>
      <el-tag type="danger" size="small">存在未标注段落</el-tag>
      <span style="font-size:12px;color:#909399;margin-left:8px;">缺失：{{ missingRangesText }}</span>
    </div>
  </div>
  <div class="main-content" :class="{ 'fullscreen': isFullscreen }">
      <el-button v-if="isFullscreen" class="fullscreen-exit" type="primary" size="small" @click="toggleFullscreen">退出全屏</el-button>
      <div class="document-panel" ref="contentRef">
        <div class="document-content">
          <template v-for="(p, idx) in paragraphs" :key="p.index">
            <!-- 如果这个段落是某批注的起始段，显示批注标记 -->
            <div 
              v-for="ann in isAnnotationStart(p.index)" 
              :key="'marker-' + ann.id"
              class="annotation-marker"
              :style="{ borderColor: getAnnotationColor(ann.type) }"
              @click="handleAnnotationClick(ann)"
            >
              <span class="marker-icon" :style="{ background: getAnnotationColor(ann.type) }">{{ ann.id }}</span>
              <span class="marker-range">P{{ ann.paragraph_start }}{{ ann.paragraph_end !== ann.paragraph_start ? `-P${ann.paragraph_end}` : '' }}</span>
              <span class="marker-type">{{ ann.type }}</span>
            </div>
            
            <!-- 段落文本 -->
            <p 
              :data-para-index="p.index"
              :class="[
                'paragraph-text',
                { 
                  'has-annotation': getParagraphAnnotations(p.index).length > 0,
                  'active': getParagraphAnnotations(p.index).some(a => a.id === activeAnnotationId)
                }
              ]"
              :style="getParagraphAnnotations(p.index).length > 0 ? {
                borderLeftColor: getAnnotationColor(getParagraphAnnotations(p.index)[0].type)
              } : {}"
              @click="handleParagraphClick(p.index)"
            >
              <span class="para-num">{{ p.index }}</span>
              {{ p.text }}
            </p>
          </template>
        </div>
      </div>

      <!-- 右侧：批注面板 -->
      <div class="annotations-panel" ref="annotationsRef">
        <div class="panel-header">
          <span>📝 拆书批注</span>
          <el-tag size="small" type="info">{{ annotations.length }} 条</el-tag>
        </div>
        
        <div class="annotations-list">
          <div 
            v-for="ann in annotations" 
            :key="ann.id"
            :data-annotation-id="ann.id"
            :class="['annotation-card', { active: activeAnnotationId === ann.id }]"
            :style="{ borderLeftColor: getAnnotationColor(ann.type) }"
            @click="handleAnnotationClick(ann)"
          >
            <div class="annotation-header">
              <span class="annotation-id" :style="{ background: getAnnotationColor(ann.type) }">{{ ann.id }}</span>
              <span class="annotation-range">P{{ ann.paragraph_start }}{{ ann.paragraph_end !== ann.paragraph_start ? `-P${ann.paragraph_end}` : '' }}</span>
              <el-tag size="small" :color="getAnnotationColor(ann.type)" effect="dark">{{ ann.type }}</el-tag>
            </div>
            <div class="annotation-title" v-if="ann.title">{{ ann.title }}</div>
            <div class="annotation-content">{{ ann.content }}</div>
            <div class="annotation-technique" v-if="ann.technique">
              <span class="technique-label">✨ 技法：</span>{{ ann.technique }}
            </div>
            <div class="annotation-highlight" v-if="ann.highlight_text">
              「{{ ann.highlight_text }}」
            </div>
          </div>
        </div>

        <!-- 细纲预览 -->
        <div class="outline-section" v-if="outlineItems.length">
          <div class="panel-header">
            <span>📑 细纲大意</span>
            <el-tag size="small" type="warning">{{ outlineItems.length }} 段</el-tag>
          </div>
          <div class="outline-list">
            <div v-for="(item, idx) in outlineItems" :key="idx" class="outline-item">
              <div class="outline-order">{{ item.order || idx + 1 }}</div>
              <div class="outline-body">
                <p class="outline-summary">{{ item.content_summary }}</p>
                <span class="outline-words" v-if="item.word_count_suggest">约 {{ item.word_count_suggest }} 字</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮（已移动到顶部） -->
        <div class="action-buttons">
          <el-button size="large" @click="goToManualAnnotation" style="width: 100%;">
            ✏️ 手动拆书批注
          </el-button>
          <!-- <p class="action-hint">自己添加批注和细纲，实现个性化学习</p> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-page {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f7fa;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.header-title {
  flex: 1;
}

.header-title h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
}

.chapter-info {
  font-size: 13px;
  color: #909399;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* 顶部练习按钮样式 */
.header-actions .practice-btn {
  white-space: nowrap;
}

/* 全屏按钮小样式 */
.header-actions .fullscreen-btn {
  margin-right: 6px;
}

@media (max-width: 900px) {
  .header-actions {
    flex-wrap: wrap;
    gap: 6px;
  }

  .header-actions .practice-btn {
    flex-basis: 100%;
  }
}

/* 全屏样式 */
.result-page.fullscreen {
  padding: 0;
  min-height: 100vh;
  background: #ffffff;
}

/* 隐藏除主内容外的所有元素（header、摘要、整体分析等） */
.result-page.fullscreen > :not(.main-content) {
  display: none;
}

.result-page.fullscreen .main-content {
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 0;
  height: 100vh;
  align-items: stretch;
}

.result-page.fullscreen .document-panel {
  max-height: none;
  height: 100vh;
  border-radius: 0;
  box-shadow: none;
  overflow-y: auto;
}

.result-page.fullscreen .annotations-panel {
  height: 100vh;
  border-radius: 0;
  box-shadow: none;
  overflow-y: auto;
  border-left: 1px solid #eef0f3;
}

/* 退出全屏按钮 */
.fullscreen-exit {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10000;
}

/* 当主内容处于 fullscreen 子状态时，移除右侧面板外的边距 */
.main-content.fullscreen {
  gap: 0;
}


.fullscreen-exit {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 10000;
}

/* 摘要栏 */
.summary-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  padding: 16px 20px;
  border-radius: 12px;
  margin-bottom: 16px;
  border-left: 4px solid #667eea;
}

.summary-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.summary-content {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
}

/* 整体分析栏 */
.overall-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  background: white;
  padding: 14px 20px;
  border-radius: 12px;
  margin-bottom: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.overall-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.overall-item .label {
  color: #909399;
  font-weight: 500;
}

/* 主内容区 - 类似 Word 文档布局 */
.main-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 20px;
  align-items: start;
  align-content: start;
}

/* 左侧文档面板 */
.document-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  min-width: 0; /* 防止子元素撑开导致右侧面板换行 */
}

.document-content {
  padding: 32px 40px;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', Georgia, serif;
  line-height: 2;
  font-size: 16px;
  color: #2c3e50;
  word-break: break-word; /* 确保长文本能换行，不会撑开容器 */
  white-space: pre-wrap;
}

/* 右侧面板保证最小宽度，避免在宽度稍小时被挤到下一行 */
.annotations-panel {
  min-width: 300px;
}

/* 批注标记（插入在段落上方） */
.annotation-marker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 8px 0;
  padding: 6px 12px;
  background: #f8f9fa;
  border: 1px dashed #ddd;
  border-left: 3px solid;
  border-radius: 0 6px 6px 0;
  cursor: pointer;
  transition: all 0.2s;
  font-family: system-ui, sans-serif;
  font-size: 12px;
}

.annotation-marker:hover {
  background: #e8f4ff;
  border-color: #409eff;
}

.marker-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.marker-range {
  color: #606266;
  font-weight: 600;
}

.marker-type {
  color: #909399;
}

/* 段落文本 */
.paragraph-text {
  margin: 0;
  padding: 8px 0 8px 20px;
  text-indent: 2em;
  border-left: 3px solid transparent;
  transition: all 0.2s;
  cursor: pointer;
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

.paragraph-text.has-annotation {
  background: linear-gradient(90deg, rgba(64, 158, 255, 0.08) 0%, transparent 100%);
  border-left-width: 3px;
}

.paragraph-text.active {
  background: linear-gradient(90deg, rgba(64, 158, 255, 0.15) 0%, rgba(64, 158, 255, 0.05) 100%);
}

.paragraph-text:hover {
  background: rgba(64, 158, 255, 0.06);
}

/* 右侧批注面板 */
.annotations-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  max-height: calc(100vh - 280px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
  font-size: 15px;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
}

.annotations-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 批注卡片 */
.annotation-card {
  padding: 14px 16px;
  background: #fafbfc;
  border-radius: 10px;
  border-left: 4px solid #409eff;
  cursor: pointer;
  transition: all 0.2s;
}

.annotation-card:hover {
  background: #f0f7ff;
  transform: translateX(4px);
}

.annotation-card.active {
  background: #e8f4ff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.annotation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.annotation-id {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.annotation-range {
  font-size: 12px;
  color: #606266;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.annotation-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.annotation-content {
  font-size: 13px;
  line-height: 1.7;
  color: #606266;
  margin-bottom: 8px;
}

.annotation-technique {
  font-size: 12px;
  color: #67c23a;
  margin-bottom: 6px;
}

.technique-label {
  font-weight: 500;
}

.annotation-highlight {
  font-size: 12px;
  color: #e6a23c;
  font-style: italic;
  padding: 8px 12px;
  background: #fff8e6;
  border-radius: 6px;
}

/* 细纲区域 */
.outline-section {
  border-top: 1px solid #ebeef5;
  margin-top: 12px;
}

.outline-list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.outline-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fffbf0;
  border-radius: 8px;
  border-left: 3px solid #e6a23c;
}

.outline-order {
  width: 28px;
  height: 28px;
  background: #e6a23c;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.outline-body {
  flex: 1;
}

.outline-summary {
  margin: 0 0 4px 0;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
}

.outline-words {
  font-size: 11px;
  color: #909399;
}

/* 操作按钮 */
.action-buttons {
  padding: 16px;
  border-top: 1px solid #ebeef5;
  margin-top: auto;
  background: white;
  position: sticky;
  bottom: 0;
}

.action-hint {
  margin: 10px 0 0 0;
  text-align: center;
  font-size: 12px;
  color: #909399;
}

/* 响应式 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .annotations-panel {
    max-height: 500px;
  }
  
  .document-panel {
    max-height: 60vh;
  }
}

/* 滚动条美化 */
.document-panel::-webkit-scrollbar,
.annotations-panel::-webkit-scrollbar {
  width: 6px;
}

.document-panel::-webkit-scrollbar-thumb,
.annotations-panel::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

.document-panel::-webkit-scrollbar-thumb:hover,
.annotations-panel::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}
</style>
