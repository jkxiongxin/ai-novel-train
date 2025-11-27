<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, View, Refresh, Upload } from '@element-plus/icons-vue'
import { 
  getChapters, 
  createChapter, 
  deleteChapter, 
  analyzeChapter,
  getSegmentTypes,
  getWritingStyles
} from '../../api/chapters'

const loading = ref(false)
const chapters = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

const dialogVisible = ref(false)
const dialogTitle = ref('添加章节')
const formData = ref({
  title: '',
  novel_name: '',
  author: '',
  content: ''
})

const segmentTypes = ref({})
const writingStyles = ref({})

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待分析' },
  { value: 'analyzing', label: '分析中' },
  { value: 'completed', label: '已分析' },
  { value: 'failed', label: '分析失败' }
]

const filterStatus = ref('')

const statusMap = {
  pending: { text: '待分析', type: 'info' },
  analyzing: { text: '分析中', type: 'warning' },
  completed: { text: '已分析', type: 'success' },
  failed: { text: '分析失败', type: 'danger' }
}

async function loadChapters() {
  loading.value = true
  try {
    const res = await getChapters({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: filterStatus.value || undefined
    })
    chapters.value = res.data.list
    total.value = res.data.total
  } catch (error) {
    console.error('加载章节失败:', error)
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

function openAddDialog() {
  dialogTitle.value = '添加章节'
  formData.value = {
    title: '',
    novel_name: '',
    author: '',
    content: ''
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formData.value.title || !formData.value.content) {
    ElMessage.warning('请填写标题和内容')
    return
  }

  try {
    await createChapter(formData.value)
    ElMessage.success('章节添加成功')
    dialogVisible.value = false
    loadChapters()
  } catch (error) {
    console.error('添加章节失败:', error)
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除这个章节吗？相关的片段也会被删除。', '提示', {
      type: 'warning'
    })
    await deleteChapter(row.id)
    ElMessage.success('删除成功')
    loadChapters()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

async function handleAnalyze(row) {
  try {
    await ElMessageBox.confirm('确定要使用AI分析这个章节吗？这将会拆分章节内容并识别文风。', '提示', {
      type: 'info'
    })
    ElMessage.info('开始分析章节，请稍候...')
    await analyzeChapter(row.id)
    ElMessage.success('章节分析完成')
    loadChapters()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('分析失败:', error)
    }
  }
}

function handlePageChange(page) {
  currentPage.value = page
  loadChapters()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadChapters()
}

function handleFilterChange() {
  currentPage.value = 1
  loadChapters()
}

const wordCount = computed(() => {
  return formData.value.content.replace(/\s/g, '').length
})

onMounted(() => {
  loadChapters()
  loadMeta()
})
</script>

<template>
  <div class="chapters-page">
    <div class="page-header">
      <h1>章节管理</h1>
      <p>上传小说章节，使用AI进行内容分析和拆分</p>
    </div>

    <el-card class="filter-card">
      <div class="filter-row">
        <el-select v-model="filterStatus" placeholder="状态筛选" @change="handleFilterChange">
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button type="primary" :icon="Plus" @click="openAddDialog">
          添加章节
        </el-button>
      </div>
    </el-card>

    <el-card class="table-card" v-loading="loading">
      <el-table :data="chapters" stripe>
        <el-table-column prop="title" label="章节标题" min-width="200" />
        <el-table-column prop="novel_name" label="小说名称" width="150">
          <template #default="{ row }">
            {{ row.novel_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="author" label="作者" width="100">
          <template #default="{ row }">
            {{ row.author || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="word_count" label="字数" width="100" />
        <el-table-column prop="analysis_status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.analysis_status]?.type || 'info'">
              {{ statusMap[row.analysis_status]?.text || row.analysis_status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.created_at).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              :icon="Refresh"
              @click="handleAnalyze(row)"
              :disabled="row.analysis_status === 'analyzing'"
            >
              {{ row.analysis_status === 'completed' ? '重新分析' : 'AI分析' }}
            </el-button>
            <el-button
              type="primary"
              link
              :icon="View"
              @click="$router.push(`/chapters/${row.id}`)"
            >
              查看
            </el-button>
            <el-button
              type="danger"
              link
              :icon="Delete"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />
    </el-card>

    <!-- 添加章节对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="700px">
      <el-form :model="formData" label-width="100px">
        <el-form-item label="章节标题" required>
          <el-input v-model="formData.title" placeholder="请输入章节标题" />
        </el-form-item>
        <el-form-item label="小说名称">
          <el-input v-model="formData.novel_name" placeholder="可选，填写小说名称" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="formData.author" placeholder="可选，填写作者名" />
        </el-form-item>
        <el-form-item label="章节内容" required>
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="15"
            placeholder="请粘贴章节内容"
          />
          <div class="word-count">字数：{{ wordCount }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.chapters-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 24px;
  margin: 0 0 8px 0;
}

.page-header p {
  color: #909399;
  margin: 0;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.table-card {
  min-height: 400px;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}

.word-count {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
