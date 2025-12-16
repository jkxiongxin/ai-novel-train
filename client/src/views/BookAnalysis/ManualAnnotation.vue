<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Edit, Delete, Check, Close, DocumentCopy, Tickets } from '@element-plus/icons-vue'
import {
  getChapterById,
  saveManualAnnotation,
  getManualAnnotation,
  createOutlinePracticeFromManual,
  saveTypingExcerpts,
  getTypingExcerpts,
  createTypingPracticeFromExcerpt,
  batchCreateTypingPractices
} from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const saving = ref(false)
const chapter = ref(null)
const chapterId = route.params.chapterId

// 批注数据
const annotations = ref([])
const outlineItems = ref([])
const summary = ref('')

// 抄写片段数据
const typingExcerpts = ref([])
const excerptDialogVisible = ref(false)
const editingExcerptIndex = ref(null)
const newExcerpt = ref({
  paragraph_start: null,
  paragraph_end: null,
  content: '',
  segment_type: 'narrative',
  writing_style: '',
  tags: [],
  difficulty: 'medium'
})

// 编辑状态
const editingAnnotationId = ref(null)
const editingOutlineIndex = ref(null)

// 当前选中的段落范围
const selectionStart = ref(null)
const selectionEnd = ref(null)

// 新批注表单
const newAnnotation = ref({
  type: '情节推进',
  title: '',
  content: '',
  technique: '',
  highlight_text: ''
})

// 新细纲表单
const newOutline = ref({
  content_summary: '',
  word_count_suggest: ''
})

// 批注对话框
const annotationDialogVisible = ref(false)
const outlineDialogVisible = ref(false)
const dialogMode = ref('add') // 'add' or 'edit'

// 批注类型选项
const annotationTypes = [
  '情绪变化', '情节推进', '人物刻画', '环境描写', 
  '技法运用', '节奏控制', '结构安排', '对话', 
  '心理', '伏笔', '高潮', '转折', '过渡'
]

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
  '转折': '#d35400',
  '过渡': '#95a5a6'
}

// 片段类型选项（与 AI 分析一致）
const segmentTypeOptions = [
  { value: 'dialogue', label: '人物对白', desc: '角色之间的对话内容' },
  { value: 'emotion', label: '情绪渲染', desc: '情感氛围的描写' },
  { value: 'battle', label: '战斗场景', desc: '动作打斗场面' },
  { value: 'psychology', label: '心理活动', desc: '角色内心独白' },
  { value: 'environment', label: '环境描写', desc: '场景环境描写' },
  { value: 'plot', label: '情节推进', desc: '故事情节发展' },
  { value: 'transition', label: '过渡衔接', desc: '段落之间的过渡' },
  { value: 'narrative', label: '叙事描述', desc: '一般性叙述内容' }
]

// 文风选项（与 AI 分析一致）
const writingStyleOptions = [
  { value: 'concise', label: '简洁明快', desc: '用词精炼，节奏快速' },
  { value: 'detailed', label: '细腻详尽', desc: '描写细致，铺陈丰富' },
  { value: 'poetic', label: '诗意唯美', desc: '语言优美，意境深远' },
  { value: 'humorous', label: '幽默诙谐', desc: '轻松有趣，富有笑点' },
  { value: 'tense', label: '紧张刺激', desc: '节奏紧凑，悬念感强' },
  { value: 'lyrical', label: '抒情感人', desc: '情感真挚，打动人心' },
  { value: 'plain', label: '平实质朴', desc: '语言朴素，贴近生活' },
  { value: 'grand', label: '大气磅礴', desc: '气势恢宏，格局宏大' }
]

// 难度选项
const difficultyOptions = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' }
]

// 常用标签选项
const commonTagOptions = [
  '精彩对话', '细腻描写', '心理刻画', '动作场面', '环境渲染', '名句金句',
  '悲伤', '激烈', '温馨', '幽默', '紧张', '感人', '优美', '深刻'
]

// 获取片段类型名称
function getSegmentTypeName(type) {
  const opt = segmentTypeOptions.find(o => o.value === type)
  return opt ? opt.label : type || '叙事描述'
}

// 获取文风名称
function getWritingStyleName(style) {
  const opt = writingStyleOptions.find(o => o.value === style)
  return opt ? opt.label : style || ''
}

function getAnnotationColor(type) {
  for (const [key, color] of Object.entries(typeColors)) {
    if (type && type.includes(key)) return color
  }
  return '#409eff'
}

// 解析段落
const paragraphs = computed(() => {
  if (!chapter.value || !chapter.value.content) return []
  return String(chapter.value.content)
    .split(/\r?\n/)
    .map((p, i) => ({ index: i + 1, text: p.trim() }))
    .filter(p => p.text.length > 0)
})

// 获取某段落的批注
function getParagraphAnnotations(paragraphIndex) {
  return annotations.value.filter(ann => 
    paragraphIndex >= ann.paragraph_start && paragraphIndex <= ann.paragraph_end
  )
}

// 判断段落是否是某个批注的起始段
function isAnnotationStart(paragraphIndex) {
  return annotations.value.filter(ann => ann.paragraph_start === paragraphIndex)
}

// 判断段落是否被选中
function isParagraphSelected(paragraphIndex) {
  if (selectionStart.value === null || selectionEnd.value === null) return false
  const start = Math.min(selectionStart.value, selectionEnd.value)
  const end = Math.max(selectionStart.value, selectionEnd.value)
  return paragraphIndex >= start && paragraphIndex <= end
}

// 判断段落是否是选中范围的起始
function isSelectionStart(paragraphIndex) {
  if (selectionStart.value === null || selectionEnd.value === null) return false
  return paragraphIndex === Math.min(selectionStart.value, selectionEnd.value)
}

// 点击段落 - 选择批注范围
function handleParagraphClick(paragraphIndex, event) {
  if (event.shiftKey && selectionStart.value !== null) {
    // Shift+点击 - 扩展选择范围
    selectionEnd.value = paragraphIndex
  } else {
    // 普通点击 - 开始新选择
    selectionStart.value = paragraphIndex
    selectionEnd.value = paragraphIndex
  }
}

// 双击段落 - 快速添加单段批注
function handleParagraphDblClick(paragraphIndex) {
  selectionStart.value = paragraphIndex
  selectionEnd.value = paragraphIndex
  openAddAnnotationDialog()
}

// 获取选中范围
const selectedRange = computed(() => {
  if (selectionStart.value === null || selectionEnd.value === null) return null
  const start = Math.min(selectionStart.value, selectionEnd.value)
  const end = Math.max(selectionStart.value, selectionEnd.value)
  return { start, end }
})

// 获取选中段落的文本
const selectedText = computed(() => {
  if (!selectedRange.value) return ''
  const { start, end } = selectedRange.value
  return paragraphs.value
    .filter(p => p.index >= start && p.index <= end)
    .map(p => p.text)
    .join('\n')
})

// 打开添加批注对话框
function openAddAnnotationDialog() {
  if (!selectedRange.value) {
    ElMessage.warning('请先选择要批注的段落范围')
    return
  }
  dialogMode.value = 'add'
  newAnnotation.value = {
    type: '情节推进',
    title: '',
    content: '',
    technique: '',
    highlight_text: ''
  }
  annotationDialogVisible.value = true
}

// 编辑批注
function openEditAnnotationDialog(annotation) {
  dialogMode.value = 'edit'
  editingAnnotationId.value = annotation.id
  selectionStart.value = annotation.paragraph_start
  selectionEnd.value = annotation.paragraph_end
  newAnnotation.value = {
    type: annotation.type,
    title: annotation.title || '',
    content: annotation.content || '',
    technique: annotation.technique || '',
    highlight_text: annotation.highlight_text || ''
  }
  annotationDialogVisible.value = true
}

// 保存批注
function saveAnnotation() {
  if (!newAnnotation.value.content.trim()) {
    ElMessage.warning('请填写批注内容')
    return
  }

  const { start, end } = selectedRange.value

  if (dialogMode.value === 'add') {
    // 添加新批注
    const newId = annotations.value.length > 0 
      ? Math.max(...annotations.value.map(a => a.id)) + 1 
      : 1
    annotations.value.push({
      id: newId,
      paragraph_start: start,
      paragraph_end: end,
      ...newAnnotation.value
    })
    // 排序
    annotations.value.sort((a, b) => a.paragraph_start - b.paragraph_start)
  } else {
    // 更新现有批注
    const index = annotations.value.findIndex(a => a.id === editingAnnotationId.value)
    if (index !== -1) {
      annotations.value[index] = {
        ...annotations.value[index],
        paragraph_start: start,
        paragraph_end: end,
        ...newAnnotation.value
      }
      annotations.value.sort((a, b) => a.paragraph_start - b.paragraph_start)
    }
  }

  annotationDialogVisible.value = false
  selectionStart.value = null
  selectionEnd.value = null
  editingAnnotationId.value = null
  
  // 自动保存
  autoSave()
}

// 删除批注
async function deleteAnnotation(annotation) {
  try {
    await ElMessageBox.confirm('确定要删除这条批注吗？', '确认删除', { type: 'warning' })
    const index = annotations.value.findIndex(a => a.id === annotation.id)
    if (index !== -1) {
      annotations.value.splice(index, 1)
      autoSave()
    }
  } catch (e) {
    // 取消
  }
}

// 打开添加细纲对话框
function openAddOutlineDialog() {
  dialogMode.value = 'add'
  newOutline.value = {
    content_summary: '',
    word_count_suggest: ''
  }
  outlineDialogVisible.value = true
}

// 编辑细纲
function openEditOutlineDialog(item, index) {
  dialogMode.value = 'edit'
  editingOutlineIndex.value = index
  newOutline.value = {
    content_summary: item.content_summary || '',
    word_count_suggest: item.word_count_suggest || ''
  }
  outlineDialogVisible.value = true
}

// 保存细纲
function saveOutline() {
  if (!newOutline.value.content_summary.trim()) {
    ElMessage.warning('请填写细纲内容')
    return
  }

  if (dialogMode.value === 'add') {
    outlineItems.value.push({
      order: outlineItems.value.length + 1,
      ...newOutline.value
    })
  } else {
    outlineItems.value[editingOutlineIndex.value] = {
      order: editingOutlineIndex.value + 1,
      ...newOutline.value
    }
  }

  outlineDialogVisible.value = false
  editingOutlineIndex.value = null
  autoSave()
}

// 删除细纲
async function deleteOutline(index) {
  try {
    await ElMessageBox.confirm('确定要删除这条细纲吗？', '确认删除', { type: 'warning' })
    outlineItems.value.splice(index, 1)
    // 重新编号
    outlineItems.value.forEach((item, i) => {
      item.order = i + 1
    })
    autoSave()
  } catch (e) {
    // 取消
  }
}

// 移动细纲顺序
function moveOutline(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= outlineItems.value.length) return
  
  const temp = outlineItems.value[index]
  outlineItems.value[index] = outlineItems.value[newIndex]
  outlineItems.value[newIndex] = temp
  
  // 重新编号
  outlineItems.value.forEach((item, i) => {
    item.order = i + 1
  })
  autoSave()
}

// ==================== 抄写片段相关方法 ====================

// 打开添加抄写片段对话框
function openAddExcerptDialog() {
  if (!selectedRange.value) {
    ElMessage.warning('请先选择要作为抄写片段的段落范围')
    return
  }
  dialogMode.value = 'add'
  editingExcerptIndex.value = null
  newExcerpt.value = {
    paragraph_start: selectedRange.value.start,
    paragraph_end: selectedRange.value.end,
    content: selectedText.value,
    segment_type: 'narrative',
    writing_style: '',
    tags: [],
    difficulty: 'medium'
  }
  excerptDialogVisible.value = true
}

// 编辑抄写片段
function openEditExcerptDialog(excerpt, index) {
  dialogMode.value = 'edit'
  editingExcerptIndex.value = index
  selectionStart.value = excerpt.paragraph_start
  selectionEnd.value = excerpt.paragraph_end
  newExcerpt.value = {
    paragraph_start: excerpt.paragraph_start,
    paragraph_end: excerpt.paragraph_end,
    content: excerpt.content,
    segment_type: excerpt.segment_type || 'narrative',
    writing_style: excerpt.writing_style || '',
    tags: excerpt.tags || [],
    difficulty: excerpt.difficulty || 'medium'
  }
  excerptDialogVisible.value = true
}

// 保存抄写片段
function saveExcerpt() {
  if (!newExcerpt.value.content.trim()) {
    ElMessage.warning('片段内容不能为空')
    return
  }

  const excerptData = {
    paragraph_start: newExcerpt.value.paragraph_start,
    paragraph_end: newExcerpt.value.paragraph_end,
    content: newExcerpt.value.content,
    segment_type: newExcerpt.value.segment_type,
    writing_style: newExcerpt.value.writing_style,
    tags: newExcerpt.value.tags,
    difficulty: newExcerpt.value.difficulty,
    word_count: newExcerpt.value.content.replace(/\s/g, '').length
  }

  if (dialogMode.value === 'add') {
    typingExcerpts.value.push(excerptData)
  } else {
    typingExcerpts.value[editingExcerptIndex.value] = excerptData
  }

  excerptDialogVisible.value = false
  selectionStart.value = null
  selectionEnd.value = null
  editingExcerptIndex.value = null
  
  autoSaveExcerpts()
}

// 删除抄写片段
async function deleteExcerpt(index) {
  try {
    await ElMessageBox.confirm('确定要删除这个抄写片段吗？', '确认删除', { type: 'warning' })
    typingExcerpts.value.splice(index, 1)
    autoSaveExcerpts()
  } catch (e) {
    // 取消
  }
}

// 移动抄写片段顺序
function moveExcerpt(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= typingExcerpts.value.length) return
  
  const temp = typingExcerpts.value[index]
  typingExcerpts.value[index] = typingExcerpts.value[newIndex]
  typingExcerpts.value[newIndex] = temp
  
  autoSaveExcerpts()
}

// 自动保存抄写片段
let excerptSaveTimer = null

async function autoSaveExcerpts() {
  if (excerptSaveTimer) {
    clearTimeout(excerptSaveTimer)
  }
  excerptSaveTimer = setTimeout(async () => {
    try {
      await saveTypingExcerpts(chapterId, typingExcerpts.value)
    } catch (error) {
      console.error('保存抄写片段失败:', error)
    }
  }, 2000)
}

// 从片段创建抄写练习
async function createTypingPractice(excerpt, index) {
  try {
    // 先保存确保有ID
    if (!excerpt.id) {
      await saveTypingExcerpts(chapterId, typingExcerpts.value)
      const res = await getTypingExcerpts(chapterId)
      if (res.data && res.data[index]) {
        excerpt.id = res.data[index].id
      }
    }
    
    if (!excerpt.id) {
      ElMessage.error('无法获取片段ID，请刷新后重试')
      return
    }
    
    const res = await createTypingPracticeFromExcerpt(excerpt.id)
    ElMessage.success('抄写练习创建成功')
    router.push(`/typing/${res.data.id}`)
  } catch (error) {
    console.error('创建抄写练习失败:', error)
    ElMessage.error('创建抄写练习失败: ' + (error.message || '未知错误'))
  }
}

// 批量创建抄写练习
async function batchCreateTypingPractice() {
  if (typingExcerpts.value.length === 0) {
    ElMessage.warning('暂无抄写片段')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要为全部 ${typingExcerpts.value.length} 个片段创建抄写练习吗？`,
      '批量创建',
      { type: 'info' }
    )

    // 先保存确保有ID
    await saveTypingExcerpts(chapterId, typingExcerpts.value)
    const excerptRes = await getTypingExcerpts(chapterId)
    const excerptIds = excerptRes.data.map(e => e.id)
    
    if (excerptIds.length === 0) {
      ElMessage.error('没有可用的抄写片段')
      return
    }

    const res = await batchCreateTypingPractices(excerptIds)
    ElMessage.success(`成功创建 ${res.data.count} 个抄写练习`)
    router.push('/typing')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量创建失败:', error)
      ElMessage.error('批量创建失败: ' + (error.message || '未知错误'))
    }
  }
}

// 从选中段落快速添加抄写片段
function quickAddExcerpt() {
  if (!selectedRange.value) {
    ElMessage.warning('请先选择段落范围')
    return
  }
  
  const excerptData = {
    paragraph_start: selectedRange.value.start,
    paragraph_end: selectedRange.value.end,
    content: selectedText.value,
    segment_type: 'narrative',
    writing_style: '',
    tags: [],
    difficulty: 'medium',
    word_count: selectedText.value.replace(/\s/g, '').length
  }
  
  typingExcerpts.value.push(excerptData)
  selectionStart.value = null
  selectionEnd.value = null
  ElMessage.success('已添加抄写片段')
  autoSaveExcerpts()
}

// 自动保存定时器
let autoSaveTimer = null

function autoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
  }
  autoSaveTimer = setTimeout(() => {
    saveData(true)
  }, 2000)
}

// 保存数据
async function saveData(silent = false) {
  if (saving.value) return
  
  saving.value = true
  try {
    await saveManualAnnotation(chapterId, {
      annotations: annotations.value,
      outline: outlineItems.value,
      summary: summary.value
    })
    if (!silent) {
      ElMessage.success('保存成功')
    }
  } catch (error) {
    console.error('保存失败:', error)
    if (!silent) {
      ElMessage.error('保存失败: ' + (error.message || '未知错误'))
    }
  } finally {
    saving.value = false
  }
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [chapterRes, annotationRes, excerptsRes] = await Promise.all([
      getChapterById(chapterId),
      getManualAnnotation(chapterId).catch(() => ({ data: null })),
      getTypingExcerpts(chapterId).catch(() => ({ data: [] }))
    ])

    chapter.value = chapterRes.data

    // 如果有已保存的手动批注
    if (annotationRes.data) {
      annotations.value = annotationRes.data.annotations || []
      outlineItems.value = annotationRes.data.outline || []
      summary.value = annotationRes.data.summary || ''
    }

    // 加载抄写片段
    if (excerptsRes.data && excerptsRes.data.length > 0) {
      typingExcerpts.value = excerptsRes.data.map(e => ({
        id: e.id,
        paragraph_start: null, // 从数据库取出的可能没有段落信息
        paragraph_end: null,
        content: e.content,
        segment_type: e.segment_type || 'narrative',
        writing_style: e.writing_style || '',
        tags: e.tags || [],
        difficulty: e.difficulty || 'medium',
        word_count: e.word_count
      }))
    }
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
    router.push('/book-analysis')
  } finally {
    loading.value = false
  }
}

// 开始细纲成文练习
async function startPractice() {
  if (outlineItems.value.length === 0) {
    ElMessage.warning('请先添加细纲内容')
    return
  }

  try {
    await saveData()
    
    const res = await createOutlinePracticeFromManual({
      chapter_id: parseInt(chapterId),
      annotations: annotations.value,
      outline: outlineItems.value,
      summary: summary.value
    })

    ElMessage.success('练习创建成功')
    router.push(`/book-analysis/practice/${res.data.id}`)
  } catch (error) {
    console.error('创建练习失败:', error)
    ElMessage.error('创建练习失败: ' + (error.message || '未知错误'))
  }
}

// 清空选择
function clearSelection() {
  selectionStart.value = null
  selectionEnd.value = null
}

// 从选中段落提取关键句
function extractHighlight() {
  if (selectedText.value) {
    // 取前30字作为高亮
    newAnnotation.value.highlight_text = selectedText.value.slice(0, 30)
  }
}

// 快速生成细纲（从批注）
function generateOutlineFromAnnotations() {
  if (annotations.value.length === 0) {
    ElMessage.warning('请先添加批注')
    return
  }

  const newOutlines = annotations.value.map((ann, idx) => ({
    order: idx + 1,
    content_summary: ann.content.slice(0, 50) + (ann.content.length > 50 ? '...' : ''),
    word_count_suggest: ''
  }))

  outlineItems.value = newOutlines
  ElMessage.success('已从批注生成细纲，请根据需要调整')
  autoSave()
}

// 返回
function goBack() {
  router.push('/book-analysis/select')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="manual-annotation-page" v-loading="loading">
    <!-- 顶部导航 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <div class="header-title">
        <h2>✍️ 手动拆书批注</h2>
        <span class="chapter-info" v-if="chapter">
          {{ chapter.novel_name }} · {{ chapter.title }}
        </span>
      </div>
      <div class="header-actions">
        <el-button @click="saveData()" :loading="saving">
          💾 保存
        </el-button>
        <el-button type="primary" @click="startPractice" :disabled="outlineItems.length === 0">
          ✍️ 开始细纲成文练习
        </el-button>
      </div>
    </div>

    <!-- 操作提示 -->
    <div class="tip-bar">
      <span class="tip-icon">💡</span>
      <span class="tip-text">
        <strong>操作指南：</strong>
        点击段落选择起始位置，按住 Shift 点击选择结束位置，然后点击「添加批注」；
        双击段落可快速添加单段批注。
      </span>
    </div>

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 左侧：文档面板 -->
      <div class="document-panel">
        <!-- 选择工具栏 -->
        <div class="selection-toolbar" v-if="selectedRange">
          <span class="selection-info">
            已选择 P{{ selectedRange.start }}{{ selectedRange.end !== selectedRange.start ? `-P${selectedRange.end}` : '' }}
            （{{ selectedText.length }}字）
          </span>
          <div class="selection-actions">
            <el-button type="primary" size="small" :icon="Plus" @click="openAddAnnotationDialog">
              添加批注
            </el-button>
            <el-button type="success" size="small" :icon="Tickets" @click="quickAddExcerpt">
              添加抄写片段
            </el-button>
            <el-button size="small" @click="clearSelection">取消选择</el-button>
          </div>
        </div>

        <div class="document-content">
          <template v-for="(p, idx) in paragraphs" :key="p.index">
            <!-- 批注标记 -->
            <div 
              v-for="ann in isAnnotationStart(p.index)" 
              :key="'marker-' + ann.id"
              class="annotation-marker"
              :style="{ borderColor: getAnnotationColor(ann.type) }"
              @click.stop="openEditAnnotationDialog(ann)"
            >
              <span class="marker-icon" :style="{ background: getAnnotationColor(ann.type) }">{{ ann.id }}</span>
              <span class="marker-range">P{{ ann.paragraph_start }}{{ ann.paragraph_end !== ann.paragraph_start ? `-P${ann.paragraph_end}` : '' }}</span>
              <span class="marker-type">{{ ann.type }}</span>
              <el-button size="small" type="danger" link :icon="Delete" @click.stop="deleteAnnotation(ann)" />
            </div>
            
            <!-- 段落文本 -->
            <p 
              :data-para-index="p.index"
              :class="[
                'paragraph-text',
                { 
                  'has-annotation': getParagraphAnnotations(p.index).length > 0,
                  'selected': isParagraphSelected(p.index),
                  'selection-start': isSelectionStart(p.index)
                }
              ]"
              :style="getParagraphAnnotations(p.index).length > 0 ? {
                borderLeftColor: getAnnotationColor(getParagraphAnnotations(p.index)[0].type)
              } : {}"
              @click="handleParagraphClick(p.index, $event)"
              @dblclick="handleParagraphDblClick(p.index)"
            >
              <span class="para-num">{{ p.index }}</span>
              {{ p.text }}
            </p>
          </template>
        </div>
      </div>

      <!-- 右侧：批注和细纲面板 -->
      <div class="side-panel">
        <!-- 摘要 -->
        <div class="summary-section">
          <div class="section-header">
            <span>📋 分析摘要</span>
          </div>
          <el-input
            v-model="summary"
            type="textarea"
            :rows="2"
            placeholder="填写整体分析摘要（可选）..."
            @change="autoSave"
          />
        </div>

        <!-- 批注列表 -->
        <div class="annotations-section">
          <div class="section-header">
            <span>📝 批注列表</span>
            <el-tag size="small" type="info">{{ annotations.length }} 条</el-tag>
          </div>
          
          <div class="annotations-list" v-if="annotations.length > 0">
            <div 
              v-for="ann in annotations" 
              :key="ann.id"
              class="annotation-card"
              :style="{ borderLeftColor: getAnnotationColor(ann.type) }"
              @click="openEditAnnotationDialog(ann)"
            >
              <div class="annotation-header">
                <span class="annotation-id" :style="{ background: getAnnotationColor(ann.type) }">{{ ann.id }}</span>
                <span class="annotation-range">P{{ ann.paragraph_start }}{{ ann.paragraph_end !== ann.paragraph_start ? `-P${ann.paragraph_end}` : '' }}</span>
                <el-tag size="small" :color="getAnnotationColor(ann.type)" effect="dark">{{ ann.type }}</el-tag>
                <el-button size="small" type="danger" link :icon="Delete" @click.stop="deleteAnnotation(ann)" />
              </div>
              <div class="annotation-title" v-if="ann.title">{{ ann.title }}</div>
              <div class="annotation-content">{{ ann.content }}</div>
              <div class="annotation-technique" v-if="ann.technique">
                ✨ {{ ann.technique }}
              </div>
            </div>
          </div>
          
          <el-empty v-else description="暂无批注，选择段落后添加" :image-size="60" />
        </div>

        <!-- 细纲列表 -->
        <div class="outline-section">
          <div class="section-header">
            <span>📑 细纲大意</span>
            <div class="section-actions">
              <el-button size="small" link @click="generateOutlineFromAnnotations" :disabled="annotations.length === 0">
                从批注生成
              </el-button>
              <el-button size="small" type="primary" :icon="Plus" @click="openAddOutlineDialog">
                添加
              </el-button>
            </div>
          </div>

          <div class="outline-list" v-if="outlineItems.length > 0">
            <div v-for="(item, idx) in outlineItems" :key="idx" class="outline-item">
              <div class="outline-order">{{ item.order || idx + 1 }}</div>
              <div class="outline-body">
                <p class="outline-summary">{{ item.content_summary }}</p>
                <span class="outline-words" v-if="item.word_count_suggest">约 {{ item.word_count_suggest }} 字</span>
              </div>
              <div class="outline-actions">
                <el-button size="small" link @click="moveOutline(idx, -1)" :disabled="idx === 0">↑</el-button>
                <el-button size="small" link @click="moveOutline(idx, 1)" :disabled="idx === outlineItems.length - 1">↓</el-button>
                <el-button size="small" link :icon="Edit" @click="openEditOutlineDialog(item, idx)" />
                <el-button size="small" type="danger" link :icon="Delete" @click="deleteOutline(idx)" />
              </div>
            </div>
          </div>

          <el-empty v-else description="暂无细纲，请添加或从批注生成" :image-size="60" />
        </div>

        <!-- 抄写片段列表 -->
        <div class="excerpts-section">
          <div class="section-header">
            <span>✏️ 抄写片段</span>
            <div class="section-actions">
              <el-button 
                size="small" 
                type="success" 
                link 
                @click="batchCreateTypingPractice" 
                :disabled="typingExcerpts.length === 0"
              >
                全部开始抄写
              </el-button>
              <el-button size="small" type="primary" :icon="Plus" @click="openAddExcerptDialog" :disabled="!selectedRange">
                添加
              </el-button>
            </div>
          </div>

          <div class="tip-text-small" v-if="typingExcerpts.length === 0 && !selectedRange">
            💡 选择段落后可添加抄写片段
          </div>

          <div class="excerpts-list" v-if="typingExcerpts.length > 0">
            <div v-for="(excerpt, idx) in typingExcerpts" :key="idx" class="excerpt-item">
              <div class="excerpt-order">{{ idx + 1 }}</div>
              <div class="excerpt-body">
                <p class="excerpt-preview">
                  {{ excerpt.content.slice(0, 60) }}{{ excerpt.content.length > 60 ? '...' : '' }}
                </p>
                <div class="excerpt-meta">
                  <span class="excerpt-words">{{ excerpt.word_count || excerpt.content.replace(/\s/g, '').length }} 字</span>
                  <el-tag size="small">{{ getSegmentTypeName(excerpt.segment_type) }}</el-tag>
                  <el-tag v-if="excerpt.writing_style" size="small" type="info">{{ getWritingStyleName(excerpt.writing_style) }}</el-tag>
                  <el-tag v-if="excerpt.difficulty" size="small" :type="excerpt.difficulty === 'hard' ? 'danger' : excerpt.difficulty === 'easy' ? 'success' : 'warning'">
                    {{ excerpt.difficulty === 'easy' ? '简单' : excerpt.difficulty === 'hard' ? '困难' : '中等' }}
                  </el-tag>
                </div>
                <div class="excerpt-tags" v-if="excerpt.tags && excerpt.tags.length > 0">
                  <el-tag v-for="tag in excerpt.tags" :key="tag" size="small" effect="plain" type="success">
                    {{ tag }}
                  </el-tag>
                </div>
              </div>
              <div class="excerpt-actions">
                <el-button size="small" link @click="moveExcerpt(idx, -1)" :disabled="idx === 0">↑</el-button>
                <el-button size="small" link @click="moveExcerpt(idx, 1)" :disabled="idx === typingExcerpts.length - 1">↓</el-button>
                <el-button size="small" type="success" link @click="createTypingPractice(excerpt, idx)">抄写</el-button>
                <el-button size="small" link :icon="Edit" @click="openEditExcerptDialog(excerpt, idx)" />
                <el-button size="small" type="danger" link :icon="Delete" @click="deleteExcerpt(idx)" />
              </div>
            </div>
          </div>

          <el-empty v-else-if="typingExcerpts.length === 0 && selectedRange" description="点击上方「添加」按钮添加抄写片段" :image-size="60" />
        </div>
      </div>
    </div>

    <!-- 添加/编辑批注对话框 -->
    <el-dialog
      v-model="annotationDialogVisible"
      :title="dialogMode === 'add' ? '添加批注' : '编辑批注'"
      width="500px"
    >
      <div class="dialog-content">
        <div class="selected-range-info" v-if="selectedRange">
          <strong>选中范围：</strong>P{{ selectedRange.start }}{{ selectedRange.end !== selectedRange.start ? `-P${selectedRange.end}` : '' }}
          <div class="selected-preview" v-if="selectedText">
            <em>「{{ selectedText.slice(0, 100) }}{{ selectedText.length > 100 ? '...' : '' }}」</em>
          </div>
        </div>

        <el-form label-position="top">
          <el-form-item label="批注类型">
            <el-select v-model="newAnnotation.type" placeholder="选择类型">
              <el-option 
                v-for="type in annotationTypes" 
                :key="type" 
                :value="type" 
                :label="type"
              >
                <span :style="{ color: getAnnotationColor(type) }">●</span> {{ type }}
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="简短标题（可选）">
            <el-input v-model="newAnnotation.title" placeholder="如：引入悬念、情绪转折点..." maxlength="20" show-word-limit />
          </el-form-item>

          <el-form-item label="批注内容" required>
            <el-input 
              v-model="newAnnotation.content" 
              type="textarea" 
              :rows="4" 
              placeholder="详细分析这部分内容的写作技巧、效果等..."
            />
          </el-form-item>

          <el-form-item label="写作技法（可选）">
            <el-input v-model="newAnnotation.technique" placeholder="如：倒叙、对比、伏笔..." />
          </el-form-item>

          <el-form-item label="高亮原文（可选）">
            <el-input v-model="newAnnotation.highlight_text" placeholder="值得注意的原文片段">
              <template #append>
                <el-button @click="extractHighlight" :disabled="!selectedText">提取</el-button>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="annotationDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAnnotation">
          {{ dialogMode === 'add' ? '添加' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑细纲对话框 -->
    <el-dialog
      v-model="outlineDialogVisible"
      :title="dialogMode === 'add' ? '添加细纲' : '编辑细纲'"
      width="450px"
    >
      <el-form label-position="top">
        <el-form-item label="内容概要" required>
          <el-input 
            v-model="newOutline.content_summary" 
            type="textarea" 
            :rows="3" 
            placeholder="描述这部分内容的主要信息，用于指导细纲成文练习..."
          />
        </el-form-item>

        <el-form-item label="建议字数（可选）">
          <el-input v-model="newOutline.word_count_suggest" placeholder="如：100-150字" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="outlineDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveOutline">
          {{ dialogMode === 'add' ? '添加' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 添加/编辑抄写片段对话框 -->
    <el-dialog
      v-model="excerptDialogVisible"
      :title="dialogMode === 'add' ? '添加抄写片段' : '编辑抄写片段'"
      width="550px"
    >
      <div class="dialog-content">
        <div class="selected-range-info" v-if="newExcerpt.paragraph_start">
          <strong>段落范围：</strong>P{{ newExcerpt.paragraph_start }}{{ newExcerpt.paragraph_end !== newExcerpt.paragraph_start ? `-P${newExcerpt.paragraph_end}` : '' }}
          <span class="excerpt-word-count">（{{ newExcerpt.content.replace(/\s/g, '').length }} 字）</span>
        </div>

        <el-form label-position="top">
          <el-form-item label="片段内容" required>
            <el-input 
              v-model="newExcerpt.content" 
              type="textarea" 
              :rows="6" 
              placeholder="抄写片段的内容..."
            />
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="片段类型">
                <el-select v-model="newExcerpt.segment_type" placeholder="选择类型">
                  <el-option 
                    v-for="opt in segmentTypeOptions" 
                    :key="opt.value" 
                    :value="opt.value" 
                    :label="opt.label"
                  >
                    <span>{{ opt.label }}</span>
                    <span style="color: #909399; font-size: 12px; margin-left: 8px;">{{ opt.desc }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="难度">
                <el-select v-model="newExcerpt.difficulty" placeholder="选择难度">
                  <el-option 
                    v-for="opt in difficultyOptions" 
                    :key="opt.value" 
                    :value="opt.value" 
                    :label="opt.label"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="24">
              <el-form-item label="文风类型（可选）">
                <el-select v-model="newExcerpt.writing_style" placeholder="选择文风" clearable style="width: 100%">
                  <el-option 
                    v-for="opt in writingStyleOptions" 
                    :key="opt.value" 
                    :value="opt.value" 
                    :label="opt.label"
                  >
                    <span>{{ opt.label }}</span>
                    <span style="color: #909399; font-size: 12px; margin-left: 8px;">{{ opt.desc }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="标签（可选）">
            <el-select 
              v-model="newExcerpt.tags" 
              multiple 
              filterable 
              allow-create 
              default-first-option
              placeholder="添加标签，可自定义输入..."
              style="width: 100%"
            >
              <el-option 
                v-for="tag in commonTagOptions" 
                :key="tag" 
                :value="tag" 
                :label="tag" 
              />
            </el-select>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="excerptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveExcerpt">
          {{ dialogMode === 'add' ? '添加' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.manual-annotation-page {
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
  background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
  padding: 12px 20px;
  border-radius: 12px;
  margin-bottom: 16px;
  border-left: 4px solid #667eea;
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
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 20px;
  align-items: start;
}

/* 文档面板 */
.document-panel {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  max-height: calc(100vh - 220px);
  overflow-y: auto;
  position: relative;
}

.selection-toolbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: linear-gradient(135deg, #409eff20 0%, #67c23a20 100%);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #ebeef5;
}

.selection-info {
  font-size: 13px;
  font-weight: 500;
  color: #409eff;
}

.selection-actions {
  display: flex;
  gap: 8px;
}

.document-content {
  padding: 32px 40px;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'Songti SC', Georgia, serif;
  line-height: 2;
  font-size: 16px;
  color: #2c3e50;
}

/* 批注标记 */
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
  flex: 1;
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
  user-select: none;
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

.paragraph-text.selected {
  background: linear-gradient(90deg, rgba(103, 194, 58, 0.15) 0%, rgba(103, 194, 58, 0.05) 100%);
  border-left-color: #67c23a;
}

.paragraph-text.selection-start {
  border-radius: 4px 4px 0 0;
}

.paragraph-text:hover {
  background: rgba(64, 158, 255, 0.06);
}

/* 右侧面板 */
.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 220px);
  overflow-y: auto;
}

.summary-section,
.annotations-section,
.outline-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
  font-size: 14px;
}

.section-actions {
  display: flex;
  gap: 4px;
}

/* 批注列表 */
.annotations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.annotation-card {
  padding: 12px 14px;
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

.annotation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.annotation-id {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.annotation-range {
  font-size: 11px;
  color: #606266;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.annotation-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 6px;
}

.annotation-content {
  font-size: 12px;
  line-height: 1.6;
  color: #606266;
}

.annotation-technique {
  font-size: 11px;
  color: #67c23a;
  margin-top: 6px;
}

/* 细纲列表 */
.outline-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.outline-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: #fffbf0;
  border-radius: 8px;
  border-left: 3px solid #e6a23c;
}

.outline-order {
  width: 24px;
  height: 24px;
  background: #e6a23c;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}

.outline-body {
  flex: 1;
  min-width: 0;
}

.outline-summary {
  margin: 0 0 4px 0;
  font-size: 13px;
  line-height: 1.5;
  color: #303133;
}

.outline-words {
  font-size: 11px;
  color: #909399;
}

.outline-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
}

/* 抄写片段区块 */
.excerpts-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
  padding: 16px;
}

.tip-text-small {
  font-size: 12px;
  color: #909399;
  padding: 8px 0;
}

.excerpts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.excerpt-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(135deg, #67c23a10 0%, #85ce6110 100%);
  border-radius: 8px;
  border-left: 3px solid #67c23a;
  transition: all 0.2s;
}

.excerpt-item:hover {
  background: linear-gradient(135deg, #67c23a18 0%, #85ce6118 100%);
}

.excerpt-order {
  width: 24px;
  height: 24px;
  background: #67c23a;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
  flex-shrink: 0;
}

.excerpt-body {
  flex: 1;
  min-width: 0;
}

.excerpt-preview {
  margin: 0 0 6px 0;
  font-size: 13px;
  line-height: 1.5;
  color: #303133;
}

.excerpt-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.excerpt-words {
  font-size: 11px;
  color: #909399;
}

.excerpt-actions {
  display: flex;
  gap: 0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.excerpt-word-count {
  font-size: 12px;
  color: #67c23a;
  margin-left: 8px;
}

.excerpt-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

/* 对话框 */
.dialog-content {
  padding: 10px 0;
}

.selected-range-info {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
}

.selected-preview {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

/* 响应式 */
@media (max-width: 1200px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .side-panel {
    max-height: none;
  }
  
  .document-panel {
    max-height: 60vh;
  }
}

/* 滚动条美化 */
.document-panel::-webkit-scrollbar,
.side-panel::-webkit-scrollbar {
  width: 6px;
}

.document-panel::-webkit-scrollbar-thumb,
.side-panel::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 3px;
}
</style>
