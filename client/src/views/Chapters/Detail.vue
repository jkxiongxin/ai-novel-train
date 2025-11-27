<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Edit, Delete, Plus } from '@element-plus/icons-vue'
import { 
  getChapter, 
  analyzeChapter, 
  getSegmentTypes, 
  getWritingStyles,
  addSegment,
  updateSegment,
  deleteSegment
} from '../../api/chapters'
import { createFromSegment } from '../../api/typing'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const chapter = ref(null)
const segmentTypes = ref({})
const writingStyles = ref({})

const segmentDialogVisible = ref(false)
const segmentDialogTitle = ref('添加片段')
const editingSegmentId = ref(null)
const segmentForm = ref({
  content: '',
  segment_type: 'narrative',
  writing_style: 'plain',
  style_tags: [],
  difficulty: 'medium'
})

const difficultyOptions = [
  { value: 'easy', label: '简单' },
  { value: 'medium', label: '中等' },
  { value: 'hard', label: '困难' }
]

const statusMap = {
  pending: { text: '待分析', type: 'info' },
  analyzing: { text: '分析中', type: 'warning' },
  completed: { text: '已分析', type: 'success' },
  failed: { text: '分析失败', type: 'danger' }
}

async function loadChapter() {
  loading.value = true
  try {
    const res = await getChapter(route.params.id)
    chapter.value = res.data
  } catch (error) {
    console.error('加载章节失败:', error)
    ElMessage.error('章节不存在')
    router.push('/chapters')
  } finally {
    loading.value = false
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

async function handleAnalyze() {
  try {
    await ElMessageBox.confirm('确定要使用AI重新分析这个章节吗？现有的片段将被替换。', '提示', {
      type: 'warning'
    })
    ElMessage.info('开始分析章节，请稍候...')
    await analyzeChapter(chapter.value.id)
    ElMessage.success('章节分析完成')
    loadChapter()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('分析失败:', error)
    }
  }
}

function openAddSegmentDialog() {
  segmentDialogTitle.value = '添加片段'
  editingSegmentId.value = null
  segmentForm.value = {
    content: '',
    segment_type: 'narrative',
    writing_style: 'plain',
    style_tags: [],
    difficulty: 'medium'
  }
  segmentDialogVisible.value = true
}

function openEditSegmentDialog(segment) {
  segmentDialogTitle.value = '编辑片段'
  editingSegmentId.value = segment.id
  segmentForm.value = {
    content: segment.content,
    segment_type: segment.segment_type,
    writing_style: segment.writing_style || 'plain',
    style_tags: segment.style_tags || [],
    difficulty: segment.difficulty || 'medium'
  }
  segmentDialogVisible.value = true
}

async function handleSegmentSubmit() {
  if (!segmentForm.value.content) {
    ElMessage.warning('请填写片段内容')
    return
  }

  try {
    if (editingSegmentId.value) {
      await updateSegment(editingSegmentId.value, segmentForm.value)
      ElMessage.success('片段更新成功')
    } else {
      await addSegment(chapter.value.id, segmentForm.value)
      ElMessage.success('片段添加成功')
    }
    segmentDialogVisible.value = false
    loadChapter()
  } catch (error) {
    console.error('操作失败:', error)
  }
}

async function handleDeleteSegment(segment) {
  try {
    await ElMessageBox.confirm('确定要删除这个片段吗？', '提示', {
      type: 'warning'
    })
    await deleteSegment(segment.id)
    ElMessage.success('删除成功')
    loadChapter()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

async function handleStartTyping(segment) {
  try {
    const res = await createFromSegment(segment.id)
    ElMessage.success('抄书练习创建成功')
    router.push(`/typing/${res.data.id}`)
  } catch (error) {
    console.error('创建练习失败:', error)
  }
}

function getSegmentTypeName(type) {
  return segmentTypes.value[type]?.name || type
}

function getWritingStyleName(style) {
  return writingStyles.value[style]?.name || style
}

function goBack() {
  router.push('/chapters')
}

onMounted(() => {
  loadChapter()
  loadMeta()
})
</script>

<template>
  <div class="chapter-detail" v-loading="loading">
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <div class="header-info" v-if="chapter">
        <h1>{{ chapter.title }}</h1>
        <div class="meta">
          <span v-if="chapter.novel_name">《{{ chapter.novel_name }}》</span>
          <span v-if="chapter.author">作者：{{ chapter.author }}</span>
          <span>字数：{{ chapter.word_count }}</span>
          <el-tag :type="statusMap[chapter.analysis_status]?.type || 'info'" size="small">
            {{ statusMap[chapter.analysis_status]?.text }}
          </el-tag>
        </div>
      </div>
      <div class="header-actions" v-if="chapter">
        <el-button type="primary" @click="handleAnalyze">
          {{ chapter.analysis_status === 'completed' ? '重新分析' : 'AI分析' }}
        </el-button>
        <el-button :icon="Plus" @click="openAddSegmentDialog">
          手动添加片段
        </el-button>
      </div>
    </div>

    <div class="content-section" v-if="chapter">
      <!-- 原文展示 -->
      <el-card class="original-card">
        <template #header>
          <span>章节原文</span>
        </template>
        <div class="original-content">
          {{ chapter.content }}
        </div>
      </el-card>

      <!-- 片段列表 -->
      <el-card class="segments-card" v-if="chapter.segments && chapter.segments.length > 0">
        <template #header>
          <div class="segments-header">
            <span>分析结果（{{ chapter.segments.length }} 个片段）</span>
          </div>
        </template>
        
        <div class="segment-list">
          <div
            v-for="(segment, index) in chapter.segments"
            :key="segment.id"
            class="segment-item"
          >
            <div class="segment-header">
              <span class="segment-order">#{{ index + 1 }}</span>
              <el-tag size="small" type="primary">
                {{ getSegmentTypeName(segment.segment_type) }}
              </el-tag>
              <el-tag size="small" type="success" v-if="segment.writing_style">
                {{ getWritingStyleName(segment.writing_style) }}
              </el-tag>
              <el-tag
                v-for="tag in segment.style_tags"
                :key="tag"
                size="small"
                type="info"
              >
                {{ tag }}
              </el-tag>
              <span class="segment-words">{{ segment.word_count }}字</span>
            </div>
            <div class="segment-content">
              {{ segment.content }}
            </div>
            <div class="segment-actions">
              <el-button type="primary" size="small" @click="handleStartTyping(segment)">
                开始抄写
              </el-button>
              <el-button size="small" :icon="Edit" @click="openEditSegmentDialog(segment)">
                编辑
              </el-button>
              <el-button
                type="danger"
                size="small"
                :icon="Delete"
                @click="handleDeleteSegment(segment)"
              >
                删除
              </el-button>
            </div>
          </div>
        </div>
      </el-card>

      <el-empty
        v-else-if="chapter.analysis_status !== 'completed'"
        description="章节尚未分析，请点击 AI分析 按钮进行分析"
      />
    </div>

    <!-- 片段编辑对话框 -->
    <el-dialog v-model="segmentDialogVisible" :title="segmentDialogTitle" width="600px">
      <el-form :model="segmentForm" label-width="100px">
        <el-form-item label="片段类型" required>
          <el-select v-model="segmentForm.segment_type" placeholder="选择类型">
            <el-option
              v-for="(info, key) in segmentTypes"
              :key="key"
              :label="info.name"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文风">
          <el-select v-model="segmentForm.writing_style" placeholder="选择文风">
            <el-option
              v-for="(info, key) in writingStyles"
              :key="key"
              :label="info.name"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-select v-model="segmentForm.difficulty" placeholder="选择难度">
            <el-option
              v-for="item in difficultyOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="风格标签">
          <el-select
            v-model="segmentForm.style_tags"
            multiple
            filterable
            allow-create
            placeholder="输入标签后按回车添加"
          />
        </el-form-item>
        <el-form-item label="片段内容" required>
          <el-input
            v-model="segmentForm.content"
            type="textarea"
            :rows="10"
            placeholder="请输入片段内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="segmentDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSegmentSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.chapter-detail {
  padding: 20px;
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
  gap: 16px;
  color: #909399;
  font-size: 14px;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.original-card {
  max-height: 300px;
  overflow: hidden;
}

.original-content {
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.8;
  color: #606266;
}

.segments-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.segment-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.segment-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s;
}

.segment-item:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.segment-order {
  font-weight: bold;
  color: #409eff;
}

.segment-words {
  margin-left: auto;
  color: #909399;
  font-size: 12px;
}

.segment-content {
  white-space: pre-wrap;
  line-height: 1.8;
  color: #303133;
  margin-bottom: 12px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
}

.segment-actions {
  display: flex;
  gap: 8px;
}
</style>
