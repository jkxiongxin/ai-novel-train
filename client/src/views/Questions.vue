<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getQuestions, deleteQuestion, toggleFavorite, exportQuestions, importQuestions } from '../api/questions'
import { createPractice } from '../api/practices'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Download, ArrowDown } from '@element-plus/icons-vue'

const router = useRouter()
const loading = ref(true)
const questions = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const typeFilter = ref('')
const difficultyFilter = ref('')
const favoriteFilter = ref(false)

// 导入导出相关
const showImportDialog = ref(false)
const importLoading = ref(false)
const importOverwrite = ref(false)
const importFile = ref(null)
const importPreview = ref(null)
const selectedIds = ref([])
const selectionMode = ref(false)

const typeNames = {
  dialogue: '人物对白',
  emotion: '情绪渲染',
  battle: '战斗场景',
  psychology: '心理活动',
  environment: '环境描写',
  plot: '情节转折',
  chapter: '章节创作',
  comprehensive: '综合训练'
}

const typeOptions = Object.entries(typeNames).map(([value, label]) => ({ value, label }))

async function loadQuestions() {
  try {
    loading.value = true
    const res = await getQuestions({
      page: page.value,
      pageSize: pageSize.value,
      type: typeFilter.value || undefined,
      difficulty: difficultyFilter.value || undefined,
      is_favorite: favoriteFilter.value ? 'true' : undefined
    })
    questions.value = res.data.list
    total.value = res.data.total
  } catch (error) {
    console.error('加载题目列表失败:', error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(newPage) {
  page.value = newPage
  loadQuestions()
}

function handleFilterChange() {
  page.value = 1
  loadQuestions()
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN')
}

async function handleFavorite(question) {
  try {
    await toggleFavorite(question.id, !question.is_favorite)
    question.is_favorite = !question.is_favorite
    ElMessage.success(question.is_favorite ? '已收藏' : '已取消收藏')
  } catch (error) {
    console.error('操作失败:', error)
  }
}

async function startPractice(question) {
  try {
    const res = await createPractice(question.id)
    router.push(`/practice/${res.data.id}`)
  } catch (error) {
    console.error('创建练习失败:', error)
  }
}

async function handleDelete(question) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这道题目吗？相关的练习记录也会被删除。',
      '确认删除',
      { type: 'warning' }
    )
    
    await deleteQuestion(question.id)
    ElMessage.success('删除成功')
    loadQuestions()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

// 导出功能
async function handleExport(exportAll = false) {
  try {
    const params = {}
    
    if (exportAll) {
      // 全量导出
      params.all = 'true'
    } else if (selectionMode.value && selectedIds.value.length > 0) {
      // 导出选中的
      params.ids = selectedIds.value.join(',')
    } else {
      // 按筛选条件导出
      params.type = typeFilter.value || undefined
      params.difficulty = difficultyFilter.value || undefined
      params.is_favorite = favoriteFilter.value ? 'true' : undefined
    }
    
    const res = await exportQuestions(params)
    
    // 创建下载
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `questions_export_${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    ElMessage.success(`导出成功，共 ${res.count} 道题目`)
    
    // 退出选择模式
    if (selectionMode.value) {
      toggleSelectionMode()
    }
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 打开导入对话框
function openImportDialog() {
  showImportDialog.value = true
  importFile.value = null
  importPreview.value = null
  importOverwrite.value = false
}

// 处理文件选择
function handleFileChange(file) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (data.questions && Array.isArray(data.questions)) {
        importPreview.value = data
        importFile.value = file.raw
      } else if (Array.isArray(data)) {
        // 兼容直接是数组的格式
        importPreview.value = { questions: data, count: data.length }
        importFile.value = file.raw
      } else {
        ElMessage.error('无效的文件格式')
      }
    } catch (err) {
      ElMessage.error('文件解析失败：' + err.message)
    }
  }
  reader.readAsText(file.raw)
  return false
}

// 执行导入
async function handleImport() {
  if (!importPreview.value) {
    ElMessage.warning('请先选择文件')
    return
  }
  
  try {
    importLoading.value = true
    const res = await importQuestions({
      questions: importPreview.value.questions,
      overwrite: importOverwrite.value
    })
    
    ElMessage.success(res.message)
    showImportDialog.value = false
    loadQuestions()
  } catch (error) {
    console.error('导入失败:', error)
    ElMessage.error('导入失败')
  } finally {
    importLoading.value = false
  }
}

// 切换选择模式
function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value
  if (!selectionMode.value) {
    selectedIds.value = []
  }
}

// 切换选择
function toggleSelect(question) {
  const idx = selectedIds.value.indexOf(question.id)
  if (idx > -1) {
    selectedIds.value.splice(idx, 1)
  } else {
    selectedIds.value.push(question.id)
  }
}

// 全选/取消全选
function toggleSelectAll() {
  if (selectedIds.value.length === questions.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = questions.value.map(q => q.id)
  }
}

// 处理导出下拉菜单命令
function handleExportCommand(command) {
  if (command === 'all') {
    handleExport(true)
  } else {
    handleExport(false)
  }
}

onMounted(() => {
  loadQuestions()
})
</script>

<template>
  <div class="questions-page">
    <div class="page-header">
      <h1>题库管理</h1>
      <div class="header-actions">
        <!-- 导入导出按钮 -->
        <el-button :icon="Upload" @click="openImportDialog">导入</el-button>
        <el-dropdown @command="handleExportCommand">
          <el-button :icon="Download">
            {{ selectionMode && selectedIds.length > 0 ? `导出选中(${selectedIds.length})` : '导出' }}
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="all">导出全部题目</el-dropdown-item>
              <el-dropdown-item command="filtered">导出当前筛选</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-divider direction="vertical" />
        <el-button 
          :type="selectionMode ? 'primary' : ''" 
          @click="toggleSelectionMode"
        >
          {{ selectionMode ? '退出选择' : '批量选择' }}
        </el-button>
        <el-divider direction="vertical" />
        <el-checkbox v-model="favoriteFilter" @change="handleFilterChange">
          只看收藏
        </el-checkbox>
        <el-select
          v-model="typeFilter"
          placeholder="类型筛选"
          clearable
          style="width: 120px"
          @change="handleFilterChange"
        >
          <el-option
            v-for="opt in typeOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-select
          v-model="difficultyFilter"
          placeholder="难度筛选"
          clearable
          style="width: 120px"
          @change="handleFilterChange"
        >
          <el-option label="简单" value="简单" />
          <el-option label="中等" value="中等" />
          <el-option label="困难" value="困难" />
        </el-select>
      </div>
    </div>

    <!-- 选择模式工具栏 -->
    <div v-if="selectionMode" class="selection-toolbar">
      <el-checkbox
        :model-value="selectedIds.length === questions.length && questions.length > 0"
        :indeterminate="selectedIds.length > 0 && selectedIds.length < questions.length"
        @change="toggleSelectAll"
      >
        全选当前页
      </el-checkbox>
      <span class="selection-info">已选择 {{ selectedIds.length }} 项</span>
    </div>
    
    <div class="questions-grid" v-loading="loading">
      <el-card
        v-for="question in questions"
        :key="question.id"
        class="question-card"
        :class="{ selected: selectionMode && selectedIds.includes(question.id) }"
        shadow="hover"
        @click="selectionMode ? toggleSelect(question) : null"
      >
        <!-- 选择模式复选框 -->
        <el-checkbox
          v-if="selectionMode"
          class="select-checkbox"
          :model-value="selectedIds.includes(question.id)"
          @click.stop
          @change="toggleSelect(question)"
        />
        
        <div class="card-header">
          <h3>{{ question.title }}</h3>
          <el-icon
            v-if="!selectionMode"
            class="favorite-icon"
            :class="{ active: question.is_favorite }"
            @click="handleFavorite(question)"
          >
            <StarFilled v-if="question.is_favorite" />
            <Star v-else />
          </el-icon>
        </div>
        
        <div class="card-tags">
          <el-tag size="small">{{ typeNames[question.type] || question.type }}</el-tag>
          <el-tag size="small" type="info">{{ question.difficulty }}</el-tag>
          <el-tag size="small" type="success">使用 {{ question.use_count }} 次</el-tag>
        </div>
        
        <p class="card-desc">
          {{ question.content?.background || question.content?.objective || '暂无描述' }}
        </p>
        
        <div class="card-footer" v-if="!selectionMode">
          <span class="date">{{ formatDate(question.created_at) }}</span>
          <div class="actions">
            <el-button type="primary" size="small" @click.stop="startPractice(question)">
              开始练习
            </el-button>
            <el-button type="danger" size="small" text @click.stop="handleDelete(question)">
              删除
            </el-button>
          </div>
        </div>
        <div class="card-footer" v-else>
          <span class="date">{{ formatDate(question.created_at) }}</span>
        </div>
      </el-card>
    </div>
    
    <div class="pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
    
    <el-empty v-if="!loading && questions.length === 0" description="题库为空">
      <el-button type="primary" @click="$router.push('/practice')">
        去生成题目
      </el-button>
    </el-empty>

    <!-- 导入对话框 -->
    <el-dialog
      v-model="showImportDialog"
      title="导入题目"
      width="500px"
    >
      <el-upload
        class="upload-area"
        drag
        accept=".json"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="handleFileChange"
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">
          将 JSON 文件拖到此处，或<em>点击上传</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持导入之前导出的题目 JSON 文件
          </div>
        </template>
      </el-upload>

      <div v-if="importPreview" class="import-preview">
        <el-alert
          :title="`文件包含 ${importPreview.count || importPreview.questions?.length} 道题目`"
          type="success"
          :closable="false"
        />
        <el-checkbox v-model="importOverwrite" style="margin-top: 12px">
          覆盖已存在的同名题目
        </el-checkbox>
      </div>

      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button 
          type="primary" 
          :loading="importLoading"
          :disabled="!importPreview"
          @click="handleImport"
        >
          确认导入
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.questions-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.questions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.question-card :deep(.el-card__body) {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.card-header h3 {
  font-size: 16px;
  color: #303133;
  margin: 0;
  flex: 1;
}

.favorite-icon {
  font-size: 20px;
  color: #c0c4cc;
  cursor: pointer;
  transition: color 0.3s;
}

.favorite-icon:hover {
  color: #f7ba2a;
}

.favorite-icon.active {
  color: #f7ba2a;
}

.card-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.card-desc {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date {
  color: #909399;
  font-size: 12px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 选择模式样式 */
.selection-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 16px;
}

.selection-info {
  color: #606266;
  font-size: 14px;
}

.question-card {
  position: relative;
  transition: all 0.3s;
}

.question-card.selected {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.select-checkbox {
  position: absolute;
  top: 12px;
  right: 12px;
}

/* 导入对话框样式 */
.upload-area {
  width: 100%;
}

.import-preview {
  margin-top: 16px;
}
</style>
