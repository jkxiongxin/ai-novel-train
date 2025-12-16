<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Check, Close, Edit, View, Hide, Timer, Document } from '@element-plus/icons-vue'
import {
  getChapterAnalyses,
  getBookAnalysisStyles,
  createMaskPractice
} from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const analysis = ref(null)
const styles = ref([])

const chapterId = route.params.chapterId
const styleKey = route.query.style

// 选中的遮蔽块
const selectedBlocks = ref([])
// 当前高亮的块
const activeBlockIndex = ref(null)

// 细纲选择对话框
const outlineDialogVisible = ref(false)
const selectedOutlineIndexes = ref([])

// 解析段落
const paragraphs = computed(() => {
  if (!analysis.value || !analysis.value.chapter_content) return []
  return String(analysis.value.chapter_content)
    .split(/\r?\n/)
    .map((p, i) => ({ index: i + 1, text: p.trim() }))
    .filter(p => p.text.length > 0)
})

// 获取细纲列表
const outlineItems = computed(() => {
  if (!analysis.value || !analysis.value.analysis_result) return []
  return analysis.value.analysis_result.outline || []
})

// 批注列表（用于关联细纲提示）
const annotations = computed(() => {
  if (!analysis.value || !analysis.value.analysis_result) return []
  return analysis.value.analysis_result.annotations || []
})

// 流派图标
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵',
  manual: '✍️'
}

// 获取当前流派名称
const currentStyleName = computed(() => {
  if (!analysis.value) return ''
  const style = styles.value.find(s => s.style_key === analysis.value.style_key)
  return style?.name || (analysis.value.style_key === 'manual' ? '手动批注' : analysis.value.style_key)
})

// 判断段落是否被选中为遮蔽块的一部分
function isParagraphMasked(paragraphIndex) {
  return selectedBlocks.value.some(block => 
    paragraphIndex >= block.paragraph_start && paragraphIndex <= block.paragraph_end
  )
}

// 获取段落所属的遮蔽块索引
function getMaskedBlockIndex(paragraphIndex) {
  return selectedBlocks.value.findIndex(block => 
    paragraphIndex >= block.paragraph_start && paragraphIndex <= block.paragraph_end
  )
}

// 判断段落是否是某个遮蔽块的起始段
function isMaskBlockStart(paragraphIndex) {
  return selectedBlocks.value.filter(block => block.paragraph_start === paragraphIndex)
}

// 获取关联的细纲提示
function getOutlineHintForRange(start, end) {
  const relatedOutlines = outlineItems.value.filter(item => {
    if (!item.paragraph_start || !item.paragraph_end) return false
    // 检查是否有交集
    return !(item.paragraph_end < start || item.paragraph_start > end)
  })
  if (relatedOutlines.length > 0) {
    return relatedOutlines.map(o => o.content_summary).join('；')
  }
  // 如果没有段落关联，按顺序取
  const orderIndex = selectedBlocks.value.findIndex(b => b.paragraph_start === start)
  if (orderIndex >= 0 && outlineItems.value[orderIndex]) {
    return outlineItems.value[orderIndex].content_summary
  }
  return ''
}

// 切换段落的遮蔽状态
function toggleParagraphMask(paragraphIndex, event) {
  const existingBlockIndex = getMaskedBlockIndex(paragraphIndex)
  
  if (existingBlockIndex >= 0) {
    // 如果已经是遮蔽块的一部分，移除该块
    selectedBlocks.value.splice(existingBlockIndex, 1)
  } else if (event.shiftKey && activeBlockIndex.value !== null && selectedBlocks.value.length > 0) {
    // Shift+点击扩展最后一个块
    const lastBlock = selectedBlocks.value[selectedBlocks.value.length - 1]
    if (paragraphIndex > lastBlock.paragraph_end) {
      lastBlock.paragraph_end = paragraphIndex
      lastBlock.outline_hint = getOutlineHintForRange(lastBlock.paragraph_start, lastBlock.paragraph_end)
    } else if (paragraphIndex < lastBlock.paragraph_start) {
      lastBlock.paragraph_start = paragraphIndex
      lastBlock.outline_hint = getOutlineHintForRange(lastBlock.paragraph_start, lastBlock.paragraph_end)
    }
  } else {
    // 添加新的遮蔽块
    selectedBlocks.value.push({
      paragraph_start: paragraphIndex,
      paragraph_end: paragraphIndex,
      outline_hint: getOutlineHintForRange(paragraphIndex, paragraphIndex)
    })
    // 排序
    selectedBlocks.value.sort((a, b) => a.paragraph_start - b.paragraph_start)
  }
}

// 扩展遮蔽块范围
function extendBlock(blockIndex, direction) {
  const block = selectedBlocks.value[blockIndex]
  if (!block) return

  if (direction === 'start' && block.paragraph_start > 1) {
    block.paragraph_start--
    block.outline_hint = getOutlineHintForRange(block.paragraph_start, block.paragraph_end)
  } else if (direction === 'end' && block.paragraph_end < paragraphs.value.length) {
    block.paragraph_end++
    block.outline_hint = getOutlineHintForRange(block.paragraph_start, block.paragraph_end)
  }
}

// 收缩遮蔽块范围
function shrinkBlock(blockIndex, direction) {
  const block = selectedBlocks.value[blockIndex]
  if (!block) return

  if (direction === 'start' && block.paragraph_start < block.paragraph_end) {
    block.paragraph_start++
    block.outline_hint = getOutlineHintForRange(block.paragraph_start, block.paragraph_end)
  } else if (direction === 'end' && block.paragraph_end > block.paragraph_start) {
    block.paragraph_end--
    block.outline_hint = getOutlineHintForRange(block.paragraph_start, block.paragraph_end)
  }
}

// 移除遮蔽块
function removeBlock(blockIndex) {
  selectedBlocks.value.splice(blockIndex, 1)
}

// 编辑细纲提示
function editOutlineHint(blockIndex) {
  const block = selectedBlocks.value[blockIndex]
  ElMessageBox.prompt('编辑细纲提示', '细纲提示', {
    inputValue: block.outline_hint || '',
    inputType: 'textarea'
  }).then(({ value }) => {
    block.outline_hint = value
  }).catch(() => {})
}

// 开始遮蔽练习
async function startMaskPractice() {
  if (selectedBlocks.value.length === 0) {
    ElMessage.warning('请至少选择一个段落进行遮蔽')
    return
  }

  try {
    const res = await createMaskPractice({
      analysis_id: analysis.value.id,
      masked_blocks: selectedBlocks.value
    })

    ElMessage.success('遮蔽练习创建成功')
    router.push(`/book-analysis/mask-practice/${res.data.id}`)
  } catch (error) {
    console.error('创建遮蔽练习失败:', error)
    ElMessage.error('创建遮蔽练习失败: ' + (error.message || '未知错误'))
  }
}

// 打开细纲选择对话框
function autoMaskFromOutline() {
  if (outlineItems.value.length === 0) {
    ElMessage.warning('该分析没有细纲数据')
    return
  }
  
  // 默认全选
  selectedOutlineIndexes.value = outlineItems.value.map((_, idx) => idx)
  outlineDialogVisible.value = true
}

// 根据选中的细纲创建遮蔽块
function applyOutlineMask() {
  if (selectedOutlineIndexes.value.length === 0) {
    ElMessage.warning('请至少选择一个细纲项')
    return
  }

  const selectedOutlines = selectedOutlineIndexes.value
    .map(idx => outlineItems.value[idx])
    .filter(Boolean)

  // 先尝试使用段落关联信息
  const blocksWithParagraphs = selectedOutlines
    .filter(item => item.paragraph_start && item.paragraph_end)
    .map(item => ({
      paragraph_start: item.paragraph_start,
      paragraph_end: item.paragraph_end,
      outline_hint: item.content_summary || ''
    }))

  if (blocksWithParagraphs.length === selectedOutlines.length) {
    // 所有选中的细纲都有段落关联
    selectedBlocks.value = blocksWithParagraphs
  } else {
    // 部分或全部没有段落关联，需要估算
    const totalParas = paragraphs.value.length
    const totalOutlines = outlineItems.value.length
    const parasPerBlock = Math.ceil(totalParas / totalOutlines)
    
    selectedBlocks.value = selectedOutlineIndexes.value.map(idx => {
      const item = outlineItems.value[idx]
      
      // 如果有段落关联，使用实际的
      if (item.paragraph_start && item.paragraph_end) {
        return {
          paragraph_start: item.paragraph_start,
          paragraph_end: item.paragraph_end,
          outline_hint: item.content_summary || ''
        }
      }
      
      // 否则按顺序估算
      return {
        paragraph_start: idx * parasPerBlock + 1,
        paragraph_end: Math.min((idx + 1) * parasPerBlock, totalParas),
        outline_hint: item.content_summary || ''
      }
    })
  }

  // 排序
  selectedBlocks.value.sort((a, b) => a.paragraph_start - b.paragraph_start)
  
  outlineDialogVisible.value = false
  ElMessage.success(`已根据 ${selectedBlocks.value.length} 个细纲创建遮蔽块`)
}

// 全选/取消全选细纲
function toggleAllOutlines() {
  if (selectedOutlineIndexes.value.length === outlineItems.value.length) {
    selectedOutlineIndexes.value = []
  } else {
    selectedOutlineIndexes.value = outlineItems.value.map((_, idx) => idx)
  }
}

// 清空所有遮蔽
function clearAllMasks() {
  selectedBlocks.value = []
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

// 返回
function goBack() {
  router.push(`/book-analysis/result/${chapterId}?style=${styleKey}`)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="mask-select-page" v-loading="loading">
    <!-- 顶部导航 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <div class="header-title">
        <h2>🎭 选择遮蔽区域</h2>
        <span class="chapter-info" v-if="analysis">
          {{ analysis.novel_name }} · {{ analysis.chapter_title }}
        </span>
      </div>
      <div class="header-actions">
        <el-button @click="autoMaskFromOutline" :disabled="outlineItems.length === 0">
          🔮 按细纲自动遮蔽
        </el-button>
        <el-button @click="clearAllMasks" :disabled="selectedBlocks.length === 0">
          清空遮蔽
        </el-button>
        <el-button type="primary" @click="startMaskPractice" :disabled="selectedBlocks.length === 0">
          ✍️ 开始遮蔽练习（{{ selectedBlocks.length }} 块）
        </el-button>
      </div>
    </div>

    <!-- 操作提示 -->
    <div class="tip-bar">
      <span class="tip-icon">💡</span>
      <span class="tip-text">
        <strong>操作指南：</strong>
        点击段落添加/移除遮蔽；按住 Shift 点击可扩展已选块的范围。
        遮蔽后的段落将在练习时隐藏，你需要根据细纲提示还原内容。
      </span>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧：文档预览 -->
      <div class="document-panel">
        <div class="panel-header">
          <span>📖 章节正文</span>
          <el-tag size="small" type="info">{{ paragraphs.length }} 段</el-tag>
        </div>

        <div class="document-content">
          <template v-for="(p, idx) in paragraphs" :key="p.index">
            <!-- 遮蔽块标记 -->
            <div 
              v-for="block in isMaskBlockStart(p.index)" 
              :key="'mask-' + block.paragraph_start"
              class="mask-block-marker"
            >
              <span class="mask-icon">🎭</span>
              <span class="mask-range">
                遮蔽块 P{{ block.paragraph_start }}{{ block.paragraph_end !== block.paragraph_start ? `-P${block.paragraph_end}` : '' }}
              </span>
            </div>
            
            <!-- 段落文本 -->
            <p 
              :data-para-index="p.index"
              :class="[
                'paragraph-text',
                { 'masked': isParagraphMasked(p.index) }
              ]"
              @click="toggleParagraphMask(p.index, $event)"
            >
              <span class="para-num">{{ p.index }}</span>
              {{ p.text }}
            </p>
          </template>
        </div>
      </div>

      <!-- 右侧：遮蔽块管理 -->
      <div class="mask-panel">
        <div class="panel-header">
          <span>🎭 已选遮蔽块</span>
          <el-tag size="small" :type="selectedBlocks.length > 0 ? 'success' : 'info'">
            {{ selectedBlocks.length }} 块
          </el-tag>
        </div>

        <div class="mask-blocks-list" v-if="selectedBlocks.length > 0">
          <div 
            v-for="(block, idx) in selectedBlocks" 
            :key="idx"
            class="mask-block-card"
            @mouseenter="activeBlockIndex = idx"
            @mouseleave="activeBlockIndex = null"
          >
            <div class="block-header">
              <span class="block-number">{{ idx + 1 }}</span>
              <span class="block-range">P{{ block.paragraph_start }}-P{{ block.paragraph_end }}</span>
              <el-button size="small" type="danger" link :icon="Close" @click="removeBlock(idx)" />
            </div>
            
            <div class="block-range-controls">
              <el-button-group size="small">
                <el-button @click="extendBlock(idx, 'start')" :disabled="block.paragraph_start <= 1">← 扩展</el-button>
                <el-button @click="shrinkBlock(idx, 'start')" :disabled="block.paragraph_start >= block.paragraph_end">收缩 →</el-button>
              </el-button-group>
              <span class="range-label">起始</span>
            </div>
            
            <div class="block-range-controls">
              <el-button-group size="small">
                <el-button @click="shrinkBlock(idx, 'end')" :disabled="block.paragraph_end <= block.paragraph_start">← 收缩</el-button>
                <el-button @click="extendBlock(idx, 'end')" :disabled="block.paragraph_end >= paragraphs.length">扩展 →</el-button>
              </el-button-group>
              <span class="range-label">结束</span>
            </div>

            <div class="block-hint">
              <div class="hint-label">
                <span>📋 细纲提示</span>
                <el-button size="small" link :icon="Edit" @click="editOutlineHint(idx)">编辑</el-button>
              </div>
              <p class="hint-text">{{ block.outline_hint || '（无提示）' }}</p>
            </div>

            <div class="block-preview">
              <div class="preview-label">预览：</div>
              <p class="preview-text">
                {{ paragraphs.slice(block.paragraph_start - 1, block.paragraph_end).map(p => p.text).join(' ').slice(0, 100) }}...
              </p>
            </div>
          </div>
        </div>

        <el-empty v-else description="点击段落选择遮蔽区域" :image-size="80" />

        <!-- 细纲参考 -->
        <div class="outline-reference" v-if="outlineItems.length > 0">
          <div class="panel-header">
            <span>📑 细纲参考</span>
            <el-tag size="small" type="warning">{{ outlineItems.length }} 条</el-tag>
          </div>
          <div class="outline-list">
            <div v-for="(item, idx) in outlineItems" :key="idx" class="outline-item">
              <span class="outline-order">{{ item.order || idx + 1 }}</span>
              <span class="outline-text">{{ item.content_summary }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 细纲选择对话框 -->
    <el-dialog
      v-model="outlineDialogVisible"
      title="选择要遮蔽的细纲"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="outline-select-dialog">
        <div class="dialog-header">
          <el-button size="small" @click="toggleAllOutlines">
            {{ selectedOutlineIndexes.length === outlineItems.length ? '取消全选' : '全选' }}
          </el-button>
          <span class="selected-count">已选择 {{ selectedOutlineIndexes.length }}/{{ outlineItems.length }}</span>
        </div>
        
        <div class="outline-checkbox-list">
          <el-checkbox-group v-model="selectedOutlineIndexes">
            <div
              v-for="(item, index) in outlineItems"
              :key="index"
              class="outline-checkbox-item"
            >
              <el-checkbox :label="index">
                <div class="outline-content">
                  <div class="outline-index">细纲 {{ index + 1 }}</div>
                  <div class="outline-summary">{{ item.content_summary || '(无内容摘要)' }}</div>
                  <div class="outline-meta" v-if="item.paragraph_start && item.paragraph_end">
                    <el-tag size="small" type="info">段落 {{ item.paragraph_start }}-{{ item.paragraph_end }}</el-tag>
                  </div>
                </div>
              </el-checkbox>
            </div>
          </el-checkbox-group>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="outlineDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="applyOutlineMask">确定遮蔽</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mask-select-page {
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
}

/* 提示条 */
.tip-bar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: linear-gradient(135deg, #f39c1220 0%, #e67e2220 100%);
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 16px;
  border-left: 4px solid #f39c12;
}

.tip-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.tip-text {
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
}

/* 主内容区 */
.main-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 420px;
  gap: 20px;
  align-items: start;
}

/* 面板通用样式 */
.document-panel,
.mask-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  font-weight: 600;
  font-size: 14px;
  position: sticky;
  top: 0;
  background: white;
  z-index: 10;
  border-radius: 12px 12px 0 0;
}

/* 文档面板 */
.document-panel {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}

.document-content {
  padding: 24px 32px;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', Georgia, serif;
  line-height: 2;
  font-size: 16px;
  color: #2c3e50;
}

/* 遮蔽块标记 */
.mask-block-marker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 16px 0 8px 0;
  padding: 6px 14px;
  background: linear-gradient(135deg, #f39c1220 0%, #e67e2220 100%);
  border: 2px dashed #f39c12;
  border-radius: 8px;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  color: #e67e22;
  font-weight: 600;
}

.mask-icon {
  font-size: 16px;
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

.paragraph-text:hover {
  background: rgba(243, 156, 18, 0.08);
  border-left-color: #f39c12;
}

.paragraph-text.masked {
  background: linear-gradient(90deg, rgba(243, 156, 18, 0.15) 0%, rgba(243, 156, 18, 0.05) 100%);
  border-left-color: #f39c12;
  position: relative;
}

.paragraph-text.masked::after {
  content: '🎭';
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0.5;
}

/* 遮蔽块管理面板 */
.mask-panel {
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.mask-blocks-list {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mask-block-card {
  padding: 16px;
  background: #fffbf0;
  border-radius: 12px;
  border: 2px solid #f39c1240;
  transition: all 0.2s;
}

.mask-block-card:hover {
  border-color: #f39c12;
  box-shadow: 0 4px 12px rgba(243, 156, 18, 0.15);
}

.block-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.block-number {
  width: 26px;
  height: 26px;
  background: #f39c12;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
}

.block-range {
  font-weight: 600;
  color: #303133;
  flex: 1;
}

.block-range-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.range-label {
  font-size: 12px;
  color: #909399;
}

.block-hint {
  margin-top: 12px;
  padding: 10px;
  background: white;
  border-radius: 8px;
}

.hint-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #606266;
  margin-bottom: 6px;
}

.hint-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #303133;
}

.block-preview {
  margin-top: 10px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 6px;
}

.preview-label {
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.preview-text {
  margin: 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
}

/* 细纲参考 */
.outline-reference {
  border-top: 1px solid #ebeef5;
  margin-top: auto;
}

.outline-list {
  padding: 12px 16px;
  max-height: 200px;
  overflow-y: auto;
}

.outline-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px dashed #ebeef5;
}

.outline-item:last-child {
  border-bottom: none;
}

.outline-order {
  width: 20px;
  height: 20px;
  background: #e6a23c;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.outline-text {
  font-size: 12px;
  line-height: 1.5;
  color: #606266;
}

/* 响应式 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .mask-panel {
    max-height: none;
  }
  
  .document-panel {
    max-height: 50vh;
  }
}

/* 滚动条美化 */
.document-panel::-webkit-scrollbar,
.mask-panel::-webkit-scrollbar,
.outline-list::-webkit-scrollbar {
  width: 6px;
}

.document-panel::-webkit-scrollbar-thumb,
.mask-panel::-webkit-scrollbar-thumb,
.outline-list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}

/* 细纲选择对话框样式 */
.outline-select-dialog {
  max-height: 500px;
  display: flex;
  flex-direction: column;
}

.outline-select-dialog .dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.outline-select-dialog .selected-count {
  color: #606266;
  font-size: 14px;
}

.outline-select-dialog .outline-checkbox-list {
  max-height: 400px;
  overflow-y: auto;
}

.outline-select-dialog .outline-checkbox-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.outline-select-dialog .outline-checkbox-item:hover {
  background-color: #f5f7fa;
}

.outline-select-dialog .outline-checkbox-item:last-child {
  border-bottom: none;
}

.outline-select-dialog .outline-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 8px;
}

.outline-select-dialog .outline-index {
  font-weight: 600;
  color: #409eff;
  font-size: 13px;
}

.outline-select-dialog .outline-summary {
  color: #303133;
  font-size: 14px;
  line-height: 1.5;
}

.outline-select-dialog .outline-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}

.outline-select-dialog .outline-checkbox-list::-webkit-scrollbar {
  width: 6px;
}

.outline-select-dialog .outline-checkbox-list::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}
</style>
