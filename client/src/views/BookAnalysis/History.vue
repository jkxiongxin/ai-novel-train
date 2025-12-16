<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, View, Timer, Document } from '@element-plus/icons-vue'
import {
  getOutlinePractices,
  deleteOutlinePractice,
  getBookAnalysisStyles,
  getBookAnalysisNovels
} from '../../api/bookAnalysis'

const router = useRouter()

const loading = ref(false)
const practices = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

// 筛选条件
const filterStatus = ref('')
const filterStyle = ref('')
const filterNovel = ref('')

// 元数据
const styles = ref([])
const novels = ref([])

// 流派图标
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵'
}

// 状态选项
const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'submitted', label: '已完成' }
]

// 格式化时间
function formatTime(seconds) {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return `${h}时${m}分`
  }
  return `${m}分钟`
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString()
}

// 获取评分颜色
function getScoreColor(score) {
  if (score >= 90) return '#67c23a'
  if (score >= 80) return '#409eff'
  if (score >= 70) return '#e6a23c'
  return '#f56c6c'
}

// 加载元数据
async function loadMeta() {
  try {
    const [stylesRes, novelsRes] = await Promise.all([
      getBookAnalysisStyles(),
      getBookAnalysisNovels()
    ])
    styles.value = stylesRes.data || []
    novels.value = novelsRes.data || []
  } catch (error) {
    console.error('加载元数据失败:', error)
  }
}

// 加载练习列表
async function loadPractices() {
  loading.value = true
  try {
    const res = await getOutlinePractices({
      page: currentPage.value,
      pageSize: pageSize.value,
      status: filterStatus.value || undefined,
      style_key: filterStyle.value || undefined,
      novel_name: filterNovel.value || undefined
    })
    practices.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (error) {
    console.error('加载练习列表失败:', error)
    ElMessage.error('加载练习列表失败')
  } finally {
    loading.value = false
  }
}

// 查看练习
function viewPractice(practice) {
  if (practice.status === 'submitted') {
    router.push(`/book-analysis/practice/${practice.id}/result`)
  } else {
    router.push(`/book-analysis/practice/${practice.id}`)
  }
}

// 删除练习
async function handleDelete(practice) {
  try {
    await ElMessageBox.confirm(
      `确定要删除这个练习吗？`,
      '确认删除',
      { type: 'warning' }
    )

    await deleteOutlinePractice(practice.id)
    ElMessage.success('删除成功')
    loadPractices()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 筛选变化
function handleFilterChange() {
  currentPage.value = 1
  loadPractices()
}

// 分页变化
function handlePageChange(page) {
  currentPage.value = page
  loadPractices()
}

function handleSizeChange(size) {
  pageSize.value = size
  currentPage.value = 1
  loadPractices()
}

// 返回
function goBack() {
  router.push('/book-analysis')
}

onMounted(() => {
  loadMeta()
  loadPractices()
})
</script>

<template>
  <div class="history-page">
    <!-- 顶部 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <h2>练习历史</h2>
    </div>

    <!-- 筛选 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <el-select
          v-model="filterStatus"
          placeholder="状态"
          clearable
          @change="handleFilterChange"
          style="width: 120px;"
        >
          <el-option
            v-for="item in statusOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>

        <el-select
          v-model="filterStyle"
          placeholder="拆书流派"
          clearable
          @change="handleFilterChange"
          style="width: 150px;"
        >
          <el-option
            v-for="style in styles"
            :key="style.style_key"
            :label="style.name"
            :value="style.style_key"
          >
            <span>{{ styleIcons[style.style_key] }} {{ style.name }}</span>
          </el-option>
        </el-select>

        <el-select
          v-model="filterNovel"
          placeholder="小说"
          clearable
          filterable
          @change="handleFilterChange"
          style="width: 200px;"
        >
          <el-option
            v-for="novel in novels"
            :key="novel.novel_name"
            :label="novel.novel_name"
            :value="novel.novel_name"
          />
        </el-select>
      </div>
    </el-card>

    <!-- 列表 -->
    <el-card class="list-card" v-loading="loading">
      <el-table :data="practices" stripe>
        <el-table-column label="章节" min-width="200">
          <template #default="{ row }">
            <div class="chapter-cell">
              <span class="style-icon">{{ styleIcons[row.style_key] }}</span>
              <div class="chapter-info">
                <div class="chapter-title">{{ row.chapter_title }}</div>
                <div class="novel-name">{{ row.novel_name }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="流派" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.style_name || row.style_key }}</el-tag>
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

        <el-table-column label="评分" width="100">
          <template #default="{ row }">
            <span
              v-if="row.ai_score"
              :style="{ color: getScoreColor(row.ai_score), fontWeight: 600 }"
            >
              {{ row.ai_score }}
            </span>
            <span v-else class="no-score">-</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'submitted' ? 'success' : 'warning'" size="small">
              {{ row.status === 'submitted' ? '已完成' : '草稿' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.submitted_at || row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="viewPractice(row)">
              {{ row.status === 'submitted' ? '查看' : '继续' }}
            </el-button>
            <el-button type="danger" link :icon="Delete" @click="handleDelete(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > pageSize"
        class="pagination"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />

      <el-empty v-if="practices.length === 0 && !loading" description="暂无练习记录">
        <el-button type="primary" @click="router.push('/book-analysis/select')">
          开始练习
        </el-button>
      </el-empty>
    </el-card>
  </div>
</template>

<style scoped>
.history-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.filter-card {
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.list-card :deep(.el-card__body) {
  padding: 0;
}

.chapter-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.style-icon {
  font-size: 24px;
}

.chapter-title {
  font-weight: 500;
  margin-bottom: 2px;
}

.novel-name {
  font-size: 12px;
  color: #909399;
}

.no-score {
  color: #c0c4cc;
}

.pagination {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
