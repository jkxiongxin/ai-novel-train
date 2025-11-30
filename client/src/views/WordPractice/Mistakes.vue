<script setup>
/**
 * 错题集页面
 * 展示用户答错的题目，支持标记已掌握
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Check, Refresh, Delete, Calendar } from '@element-plus/icons-vue'
import { 
  getMistakes, 
  getMistakeStats,
  markMistakeMastered,
  batchMarkMastered,
  getFrequentMistakes,
  createReviewPlansForMistakes
} from '../../api/wordPractice'
import { getCategories } from '../../api/dictionary'

const router = useRouter()

// 状态
const loading = ref(false)
const mistakes = ref([])
const stats = ref(null)
const frequentMistakes = ref([])
const categories = ref([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 筛选条件
const filters = ref({
  category: '',
  isMastered: false
})

// 选中的错题
const selectedMistakes = ref([])

// 正在创建复习计划
const creatingPlans = ref(false)

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [mistakesRes, statsRes, frequentRes, categoriesRes] = await Promise.all([
      getMistakes({
        page: pagination.value.page,
        pageSize: pagination.value.pageSize,
        category: filters.value.category,
        isMastered: filters.value.isMastered
      }),
      getMistakeStats(),
      getFrequentMistakes(5),
      getCategories()
    ])
    
    mistakes.value = mistakesRes.data?.list || []
    pagination.value.total = mistakesRes.data?.total || 0
    stats.value = statsRes.data
    frequentMistakes.value = frequentRes.data || []
    categories.value = categoriesRes.data || []
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 筛选
function handleFilter() {
  pagination.value.page = 1
  loadData()
}

// 分页
function handlePageChange(page) {
  pagination.value.page = page
  loadData()
}

// 标记为已掌握
async function handleMaster(mistake) {
  try {
    await ElMessageBox.confirm(
      `确定将「${mistake.word}」标记为已掌握吗？`,
      '确认',
      { type: 'info' }
    )
    
    await markMistakeMastered(mistake.id)
    ElMessage.success('已标记为掌握')
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('标记失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

// 批量标记为已掌握
async function handleBatchMaster() {
  if (selectedMistakes.value.length === 0) {
    ElMessage.warning('请先选择错题')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      `确定将选中的 ${selectedMistakes.value.length} 个词汇标记为已掌握吗？`,
      '批量操作',
      { type: 'info' }
    )
    
    await batchMarkMastered(selectedMistakes.value)
    ElMessage.success('批量标记成功')
    selectedMistakes.value = []
    loadData()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量标记失败:', error)
      ElMessage.error('操作失败')
    }
  }
}

// 为选中的错题创建复习计划
async function handleCreateReviewPlans() {
  if (selectedMistakes.value.length === 0) {
    ElMessage.warning('请先选择错题')
    return
  }
  
  try {
    creatingPlans.value = true
    
    const res = await createReviewPlansForMistakes(selectedMistakes.value)
    if (res.success) {
      const { created, skipped, message } = res.data
      if (created > 0) {
        ElMessage.success(message)
      } else {
        ElMessage.info(skipped > 0 ? '所有选中的词汇已有复习计划' : message)
      }
      selectedMistakes.value = []
    } else {
      ElMessage.error(res.message || '创建失败')
    }
  } catch (error) {
    console.error('创建复习计划失败:', error)
    ElMessage.error('创建复习计划失败')
  } finally {
    creatingPlans.value = false
  }
}

// 选择变化
function handleSelectionChange(selection) {
  selectedMistakes.value = selection.map(m => m.id)
}

// 获取题型名称
function getTypeName(type) {
  const map = {
    'choice': '选择题',
    'fill': '填空题',
    'sentence': '造句题'
  }
  return map[type] || type
}

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString().slice(0, 5)
}

// 返回
function goBack() {
  router.push('/word-practice')
}

// 开始复习
function startReview() {
  router.push('/word-practice/review')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="mistakes-page" v-loading="loading">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <h1>📝 错题集</h1>
    </div>
    
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row" v-if="stats">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.total_mistakes || 0 }}</div>
          <div class="stat-label">总错题数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card warning">
          <div class="stat-value">{{ stats.unmastered_count || 0 }}</div>
          <div class="stat-label">待攻克</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card success">
          <div class="stat-value">{{ stats.mastered_count || 0 }}</div>
          <div class="stat-label">已掌握</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.total_mistake_times || 0 }}</div>
          <div class="stat-label">累计错误次数</div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 高频错题 -->
    <el-card v-if="frequentMistakes.length > 0" class="frequent-card">
      <template #header>
        <div class="card-header">
          <span>🔥 高频错题</span>
          <el-button type="primary" size="small" @click="startReview">
            开始复习
          </el-button>
        </div>
      </template>
      <div class="frequent-list">
        <div v-for="m in frequentMistakes" :key="m.id" class="frequent-item">
          <div class="word-info">
            <span class="word">{{ m.word }}</span>
            <el-tag size="small">{{ m.category }}</el-tag>
          </div>
          <div class="mistake-count">
            错误 {{ m.mistake_count }} 次
          </div>
        </div>
      </div>
    </el-card>
    
    <!-- 筛选和列表 -->
    <el-card class="list-card">
      <template #header>
        <div class="list-header">
          <div class="filters">
            <el-select 
              v-model="filters.category" 
              placeholder="选择分类" 
              clearable
              @change="handleFilter"
              style="width: 150px"
            >
              <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
            </el-select>
            <el-checkbox v-model="filters.isMastered" @change="handleFilter">
              显示已掌握
            </el-checkbox>
          </div>
          <div class="actions">
            <el-button 
              v-if="selectedMistakes.length > 0"
              type="primary"
              size="small"
              :loading="creatingPlans"
              @click="handleCreateReviewPlans"
            >
              <el-icon><Calendar /></el-icon>
              生成复习计划 ({{ selectedMistakes.length }})
            </el-button>
            <el-button 
              v-if="selectedMistakes.length > 0"
              type="success"
              size="small"
              @click="handleBatchMaster"
            >
              <el-icon><Check /></el-icon>
              批量标记掌握 ({{ selectedMistakes.length }})
            </el-button>
            <el-button size="small" @click="loadData">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>
      
      <el-table 
        :data="mistakes" 
        @selection-change="handleSelectionChange"
        style="width: 100%"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column label="词汇" width="150">
          <template #default="{ row }">
            <div class="word-cell">
              <span class="word-text">{{ row.word }}</span>
              <el-tag size="small" v-if="row.is_mastered" type="success">已掌握</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="释义" min-width="200" />
        <el-table-column label="题型" width="100">
          <template #default="{ row }">
            {{ getTypeName(row.question_type) }}
          </template>
        </el-table-column>
        <el-table-column prop="mistake_count" label="错误次数" width="100" />
        <el-table-column label="最近错误" width="150">
          <template #default="{ row }">
            {{ formatTime(row.last_mistake_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button 
              v-if="!row.is_mastered"
              size="small" 
              type="success" 
              text
              @click="handleMaster(row)"
            >
              标记掌握
            </el-button>
            <span v-else class="mastered-text">✓ 已掌握</span>
          </template>
        </el-table-column>
      </el-table>
      
      <el-pagination
        v-if="pagination.total > pagination.pageSize"
        class="pagination"
        :current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
      
      <el-empty v-if="mistakes.length === 0 && !loading" description="暂无错题记录">
        <p class="empty-tip">继续练习，错题会自动收录到这里</p>
      </el-empty>
    </el-card>
    
    <!-- 分类统计 -->
    <el-card v-if="stats?.byCategory?.length > 0" class="category-stats-card">
      <template #header>📊 分类错题统计</template>
      <div class="category-chart">
        <div v-for="cat in stats.byCategory" :key="cat.category" class="category-bar">
          <span class="category-name">{{ cat.category }}</span>
          <el-progress 
            :percentage="stats.total_mistakes > 0 ? Math.round(cat.count / stats.total_mistakes * 100) : 0"
            :stroke-width="16"
          />
          <span class="category-count">{{ cat.count }} ({{ cat.unmastered }} 待攻克)</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.mistakes-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 16px 0 0 0;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  padding: 16px;
}

.stat-card.warning .stat-value {
  color: #e6a23c;
}

.stat-card.success .stat-value {
  color: #67c23a;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.frequent-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.frequent-list {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.frequent-item {
  flex: 1;
  min-width: 180px;
  padding: 12px;
  background: #fef0f0;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.word-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.word-info .word {
  font-weight: 600;
  color: #f56c6c;
}

.mistake-count {
  font-size: 12px;
  color: #909399;
}

.list-card {
  margin-bottom: 24px;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  display: flex;
  align-items: center;
  gap: 16px;
}

.actions {
  display: flex;
  gap: 8px;
}

.word-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.word-text {
  font-weight: 500;
  color: #303133;
}

.mastered-text {
  color: #67c23a;
  font-size: 13px;
}

.pagination {
  margin-top: 20px;
  justify-content: center;
}

.empty-tip {
  color: #909399;
  font-size: 13px;
  margin-top: 8px;
}

.category-stats-card {
  margin-bottom: 24px;
}

.category-chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-bar {
  display: flex;
  align-items: center;
  gap: 16px;
}

.category-name {
  width: 100px;
  font-weight: 500;
  color: #303133;
}

.category-bar .el-progress {
  flex: 1;
}

.category-count {
  width: 150px;
  text-align: right;
  color: #909399;
  font-size: 13px;
}
</style>
