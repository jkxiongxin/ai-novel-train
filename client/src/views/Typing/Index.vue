<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Refresh, Plus, Edit } from '@element-plus/icons-vue'
import { 
  getTypingPractices, 
  deleteTypingPractice, 
  getTypingStats,
  getRandomSegment,
  createFromSegment,
  createCustomTyping
} from '../../api/typing'
import { getSegmentTypes, getWritingStyles, getSegments } from '../../api/chapters'

const router = useRouter()
const loading = ref(false)
const practices = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

const stats = ref({
  overview: {
    total_practices: 0,
    total_words: 0,
    total_time: 0,
    avg_accuracy: 0,
    avg_speed: 0
  }
})

const segmentTypes = ref({})
const writingStyles = ref({})

// 筛选条件
const filters = ref({
  status: '',
  segment_type: '',
  writing_style: ''
})

// 片段选择对话框
const segmentDialogVisible = ref(false)
const segmentLoading = ref(false)
const segmentList = ref([])
const segmentFilters = ref({
  segment_type: '',
  writing_style: '',
  min_words: '',
  max_words: ''
})

// 自定义内容对话框
const customDialogVisible = ref(false)
const customForm = ref({
  content: '',
  segment_type: 'narrative',
  writing_style: 'plain'
})

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' }
]

const statusMap = {
  pending: { text: '待开始', type: 'info' },
  in_progress: { text: '进行中', type: 'warning' },
  completed: { text: '已完成', type: 'success' }
}

async function loadPractices() {
  loading.value = true
  try {
    const params = {
      page: currentPage.value,
      pageSize: pageSize.value,
      ...Object.fromEntries(
        Object.entries(filters.value).filter(([_, v]) => v)
      )
    }
    const res = await getTypingPractices(params)
    practices.value = res.data.list
    total.value = res.data.total
  } catch (error) {
    console.error('加载练习列表失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res = await getTypingStats()
    stats.value = res.data
  } catch (error) {
    console.error('加载统计数据失败:', error)
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

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm('确定要删除这个练习吗？', '提示', {
      type: 'warning'
    })
    await deleteTypingPractice(row.id)
    ElMessage.success('删除成功')
    loadPractices()
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

function handlePageChange(page) {
  currentPage.value = page
  loadPractices()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadPractices()
}

function handleFilterChange() {
  currentPage.value = 1
  loadPractices()
}

function startPractice(row) {
  router.push(`/typing/${row.id}`)
}

// 打开片段选择对话框
async function openSegmentDialog() {
  segmentDialogVisible.value = true
  await loadSegments()
}

async function loadSegments() {
  segmentLoading.value = true
  try {
    const params = {
      page: 1,
      pageSize: 50,
      ...Object.fromEntries(
        Object.entries(segmentFilters.value).filter(([_, v]) => v)
      )
    }
    const res = await getSegments(params)
    segmentList.value = res.data.list
  } catch (error) {
    console.error('加载片段失败:', error)
  } finally {
    segmentLoading.value = false
  }
}

async function handleSelectSegment(segment) {
  try {
    const res = await createFromSegment(segment.id)
    ElMessage.success('练习创建成功')
    segmentDialogVisible.value = false
    router.push(`/typing/${res.data.id}`)
  } catch (error) {
    console.error('创建练习失败:', error)
  }
}

// 随机开始练习
async function handleRandomStart() {
  try {
    const params = Object.fromEntries(
      Object.entries(filters.value).filter(([_, v]) => v)
    )
    const res = await getRandomSegment(params)
    const createRes = await createFromSegment(res.data.id)
    ElMessage.success('随机练习创建成功')
    router.push(`/typing/${createRes.data.id}`)
  } catch (error) {
    ElMessage.warning('没有符合条件的片段，请先添加章节并进行分析')
  }
}

// 打开自定义内容对话框
function openCustomDialog() {
  customForm.value = {
    content: '',
    segment_type: 'narrative',
    writing_style: 'plain'
  }
  customDialogVisible.value = true
}

async function handleCustomSubmit() {
  if (!customForm.value.content) {
    ElMessage.warning('请输入内容')
    return
  }
  try {
    const res = await createCustomTyping(customForm.value)
    ElMessage.success('自定义练习创建成功')
    customDialogVisible.value = false
    router.push(`/typing/${res.data.id}`)
  } catch (error) {
    console.error('创建失败:', error)
  }
}

function formatTime(seconds) {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

function getSegmentTypeName(type) {
  return segmentTypes.value[type]?.name || type || '-'
}

function getWritingStyleName(style) {
  return writingStyles.value[style]?.name || style || '-'
}

onMounted(() => {
  loadPractices()
  loadStats()
  loadMeta()
})
</script>

<template>
  <div class="typing-index">
    <div class="page-header">
      <h1>📝 抄书练习</h1>
      <p>通过抄写经典片段，练习打字速度，培养文字感觉</p>
    </div>

    <!-- 统计概览 -->
    <div class="stats-cards">
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #409eff">✍️</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.overview.total_practices }}</div>
          <div class="stat-label">练习次数</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #67c23a">📊</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.overview.total_words }}</div>
          <div class="stat-label">累计字数</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #e6a23c">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">{{ formatTime(stats.overview.total_time) }}</div>
          <div class="stat-label">累计时间</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #f56c6c">🎯</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.overview.avg_accuracy }}%</div>
          <div class="stat-label">平均准确率</div>
        </div>
      </el-card>
      <el-card class="stat-card">
        <div class="stat-icon" style="background: #9c27b0">⚡</div>
        <div class="stat-content">
          <div class="stat-value">{{ stats.overview.avg_speed }}</div>
          <div class="stat-label">平均速度(字/分)</div>
        </div>
      </el-card>
    </div>

    <!-- 快速开始 -->
    <el-card class="quick-start-card">
      <template #header>
        <span>快速开始</span>
      </template>
      <div class="quick-actions">
        <el-button type="primary" size="large" :icon="Refresh" @click="handleRandomStart">
          随机抄写
        </el-button>
        <el-button type="success" size="large" :icon="Plus" @click="openSegmentDialog">
          选择片段
        </el-button>
        <el-button type="warning" size="large" :icon="Edit" @click="openCustomDialog">
          自定义内容
        </el-button>
        <el-button size="large" @click="$router.push('/chapters')">
          管理章节
        </el-button>
      </div>
    </el-card>

    <!-- 筛选条件 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <el-select v-model="filters.status" placeholder="状态筛选" @change="handleFilterChange" clearable>
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select 
          v-model="filters.segment_type" 
          placeholder="片段类型" 
          @change="handleFilterChange"
          clearable
        >
          <el-option
            v-for="(info, key) in segmentTypes"
            :key="key"
            :label="info.name"
            :value="key"
          />
        </el-select>
        <el-select 
          v-model="filters.writing_style" 
          placeholder="文风筛选" 
          @change="handleFilterChange"
          clearable
        >
          <el-option
            v-for="(info, key) in writingStyles"
            :key="key"
            :label="info.name"
            :value="key"
          />
        </el-select>
      </div>
    </el-card>

    <!-- 练习列表 -->
    <el-card class="table-card" v-loading="loading">
      <el-table :data="practices" stripe>
        <el-table-column label="内容预览" min-width="300">
          <template #default="{ row }">
            <div class="content-preview">
              {{ row.original_content.slice(0, 100) }}{{ row.original_content.length > 100 ? '...' : '' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="segment_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ getSegmentTypeName(row.segment_type) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="writing_style" label="文风" width="100">
          <template #default="{ row }">
            {{ getWritingStyleName(row.writing_style) }}
          </template>
        </el-table-column>
        <el-table-column prop="word_count" label="字数" width="80" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusMap[row.status]?.type || 'info'">
              {{ statusMap[row.status]?.text || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="进度" width="120">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.word_count > 0 ? Math.round(row.typed_count / row.word_count * 100) : 0"
              :stroke-width="6"
            />
          </template>
        </el-table-column>
        <el-table-column label="准确率" width="80">
          <template #default="{ row }">
            {{ row.status === 'completed' ? `${row.accuracy?.toFixed(1)}%` : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="startPractice(row)">
              {{ row.status === 'completed' ? '查看' : '开始' }}
            </el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">
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

    <!-- 片段选择对话框 -->
    <el-dialog v-model="segmentDialogVisible" title="选择片段" width="800px">
      <div class="segment-filters">
        <el-select 
          v-model="segmentFilters.segment_type" 
          placeholder="片段类型"
          clearable
          @change="loadSegments"
        >
          <el-option
            v-for="(info, key) in segmentTypes"
            :key="key"
            :label="info.name"
            :value="key"
          />
        </el-select>
        <el-select 
          v-model="segmentFilters.writing_style" 
          placeholder="文风"
          clearable
          @change="loadSegments"
        >
          <el-option
            v-for="(info, key) in writingStyles"
            :key="key"
            :label="info.name"
            :value="key"
          />
        </el-select>
        <el-input-number 
          v-model="segmentFilters.min_words" 
          placeholder="最小字数"
          :min="0"
          @change="loadSegments"
        />
        <el-input-number 
          v-model="segmentFilters.max_words" 
          placeholder="最大字数"
          :min="0"
          @change="loadSegments"
        />
      </div>

      <div class="segment-list" v-loading="segmentLoading">
        <div
          v-for="segment in segmentList"
          :key="segment.id"
          class="segment-item"
          @click="handleSelectSegment(segment)"
        >
          <div class="segment-header">
            <el-tag size="small" type="primary">
              {{ getSegmentTypeName(segment.segment_type) }}
            </el-tag>
            <el-tag size="small" type="success" v-if="segment.writing_style">
              {{ getWritingStyleName(segment.writing_style) }}
            </el-tag>
            <span class="segment-source" v-if="segment.chapter_title">
              来自：{{ segment.chapter_title }}
            </span>
            <span class="segment-words">{{ segment.word_count }}字</span>
          </div>
          <div class="segment-content">
            {{ segment.content.slice(0, 150) }}{{ segment.content.length > 150 ? '...' : '' }}
          </div>
        </div>
        <el-empty v-if="segmentList.length === 0 && !segmentLoading" description="暂无片段，请先添加章节并进行分析" />
      </div>
    </el-dialog>

    <!-- 自定义内容对话框 -->
    <el-dialog v-model="customDialogVisible" title="自定义抄写内容" width="600px">
      <el-form :model="customForm" label-width="100px">
        <el-form-item label="片段类型">
          <el-select v-model="customForm.segment_type" placeholder="选择类型">
            <el-option
              v-for="(info, key) in segmentTypes"
              :key="key"
              :label="info.name"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="文风">
          <el-select v-model="customForm.writing_style" placeholder="选择文风">
            <el-option
              v-for="(info, key) in writingStyles"
              :key="key"
              :label="info.name"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="抄写内容" required>
          <el-input
            v-model="customForm.content"
            type="textarea"
            :rows="10"
            placeholder="粘贴你想要抄写的内容"
          />
          <div class="word-count">
            字数：{{ customForm.content.replace(/\s/g, '').length }}
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleCustomSubmit">开始抄写</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.typing-index {
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

.stats-cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 16px;
}

.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

.quick-start-card {
  margin-bottom: 20px;
}

.quick-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.table-card {
  min-height: 400px;
}

.content-preview {
  color: #606266;
  line-height: 1.5;
}

.pagination {
  margin-top: 20px;
  justify-content: flex-end;
}

.segment-filters {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.segment-list {
  max-height: 400px;
  overflow-y: auto;
}

.segment-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.segment-item:hover {
  border-color: #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
}

.segment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.segment-source {
  color: #909399;
  font-size: 12px;
}

.segment-words {
  margin-left: auto;
  color: #909399;
  font-size: 12px;
}

.segment-content {
  color: #606266;
  line-height: 1.6;
  font-size: 14px;
}

.word-count {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
}

@media (max-width: 1200px) {
  .stats-cards {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
