<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getPractices, deletePractice } from '../api/practices'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const loading = ref(true)
const practices = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref('')

const statusMap = {
  'draft': { label: '草稿', type: 'info' },
  'submitted': { label: '已提交', type: 'warning' },
  'evaluated': { label: '已评审', type: 'success' }
}

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

async function loadPractices() {
  try {
    loading.value = true
    const res = await getPractices({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined
    })
    practices.value = res.data.list
    total.value = res.data.total
  } catch (error) {
    console.error('加载练习列表失败:', error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(newPage) {
  page.value = newPage
  loadPractices()
}

function handleFilterChange() {
  page.value = 1
  loadPractices()
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

function formatTime(seconds) {
  if (!seconds) return '-'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  return `${hours}小时${minutes % 60}分钟`
}

function viewPractice(practice) {
  if (practice.status === 'draft') {
    router.push(`/practice/${practice.id}`)
  } else {
    // 查看评审结果
    router.push(`/evaluation/${practice.id}`)
  }
}

function continuePractice(practice) {
  router.push(`/practice/${practice.id}`)
}

async function handleDelete(practice) {
  try {
    await ElMessageBox.confirm(
      '确定要删除这条练习记录吗？此操作不可恢复。',
      '确认删除',
      { type: 'warning' }
    )
    
    await deletePractice(practice.id)
    ElMessage.success('删除成功')
    loadPractices()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

onMounted(() => {
  loadPractices()
})
</script>

<template>
  <div class="history-page">
    <div class="page-header">
      <h1>练习历史</h1>
      <div class="header-actions">
        <el-select
          v-model="statusFilter"
          placeholder="状态筛选"
          clearable
          @change="handleFilterChange"
        >
          <el-option label="草稿" value="draft" />
          <el-option label="已提交" value="submitted" />
          <el-option label="已评审" value="evaluated" />
        </el-select>
      </div>
    </div>
    
    <el-table
      :data="practices"
      v-loading="loading"
      stripe
      style="width: 100%"
    >
      <el-table-column label="题目" min-width="200">
        <template #default="{ row }">
          <div class="title-cell">
            <span class="title">{{ row.question_title }}</span>
            <div class="meta">
              <el-tag size="small">{{ typeNames[row.question_type] || row.question_type }}</el-tag>
              <el-tag size="small" type="info">{{ row.difficulty }}</el-tag>
            </div>
          </div>
        </template>
      </el-table-column>
      
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusMap[row.status]?.type">
            {{ statusMap[row.status]?.label }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column label="字数" width="100">
        <template #default="{ row }">
          {{ row.word_count || 0 }}
        </template>
      </el-table-column>
      
      <el-table-column label="用时" width="100">
        <template #default="{ row }">
          {{ formatTime(row.time_spent) }}
        </template>
      </el-table-column>
      
      <el-table-column label="更新时间" width="180">
        <template #default="{ row }">
          {{ formatDate(row.updated_at) }}
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'draft'"
            type="primary"
            text
            @click="continuePractice(row)"
          >
            继续作答
          </el-button>
          <el-button
            v-else
            type="primary"
            text
            @click="viewPractice(row)"
          >
            查看结果
          </el-button>
          <el-button
            type="danger"
            text
            @click="handleDelete(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <div class="pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
    
    <el-empty v-if="!loading && practices.length === 0" description="暂无练习记录" />
  </div>
</template>

<style scoped>
.history-page {
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

.title-cell .title {
  display: block;
  margin-bottom: 8px;
  color: #303133;
}

.title-cell .meta {
  display: flex;
  gap: 8px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
