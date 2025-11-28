<script setup>
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getWords,
  addWord,
  addWordsBatch,
  updateWord,
  deleteWord,
  getCategories,
  getDictionaryStats,
  aiGenerateWords
} from '../api/dictionary'

// 状态
const loading = ref(false)
const stats = ref(null)
const categories = ref([])
const selectedCategory = ref('')
const searchKeyword = ref('')
const wordList = ref([])
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
})

// 编辑对话框
const editDialogVisible = ref(false)
const editMode = ref('add') // 'add' | 'edit'
const editForm = ref({
  id: null,
  word: '',
  category: '',
  meaning: '',
  examples: ''
})

// 生成对话框
const generateDialogVisible = ref(false)
const generateForm = ref({
  topic: '',
  count: 20
})
const generating = ref(false)
const generatedWords = ref([])

// 加载分类
async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data || []
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

// 加载统计
async function loadStats() {
  try {
    const res = await getDictionaryStats()
    stats.value = res.data
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 加载词汇列表
async function loadWords() {
  try {
    loading.value = true
    const res = await getWords({
      category: selectedCategory.value,
      keyword: searchKeyword.value,
      page: pagination.value.page,
      pageSize: pagination.value.pageSize
    })
    wordList.value = res.data?.list || []
    pagination.value.total = res.data?.total || 0
  } catch (error) {
    console.error('加载词汇失败:', error)
  } finally {
    loading.value = false
  }
}

// 搜索
function handleSearch() {
  pagination.value.page = 1
  loadWords()
}

// 分页
function handlePageChange(page) {
  pagination.value.page = page
  loadWords()
}

// 打开添加对话框
function openAddDialog() {
  editMode.value = 'add'
  editForm.value = {
    id: null,
    word: '',
    category: '',
    meaning: '',
    examples: ''
  }
  editDialogVisible.value = true
}

// 打开编辑对话框
function openEditDialog(word) {
  editMode.value = 'edit'
  editForm.value = { ...word }
  editDialogVisible.value = true
}

// 保存词汇
async function saveWord() {
  if (!editForm.value.word || !editForm.value.category) {
    ElMessage.warning('请填写词汇和分类')
    return
  }
  
  try {
    if (editMode.value === 'add') {
      await addWord({
        ...editForm.value,
        source: 'user'
      })
      ElMessage.success('添加成功')
    } else {
      await updateWord(editForm.value.id, editForm.value)
      ElMessage.success('更新成功')
    }
    editDialogVisible.value = false
    loadWords()
    loadCategories()
    loadStats()
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 删除词汇
async function handleDelete(id) {
  try {
    await ElMessageBox.confirm('确定要删除这个词汇吗？', '确认删除', { type: 'warning' })
    await deleteWord(id)
    ElMessage.success('删除成功')
    loadWords()
    loadStats()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
    }
  }
}

// 打开生成对话框
function openGenerateDialog() {
  generateForm.value = { topic: '', count: 20 }
  generatedWords.value = []
  generateDialogVisible.value = true
}

// AI 生成词典
async function handleGenerate() {
  if (!generateForm.value.topic) {
    ElMessage.warning('请输入词典主题')
    return
  }
  
  try {
    generating.value = true
    generatedWords.value = []
    
    const res = await aiGenerateWords(generateForm.value.topic, generateForm.value.count)
    generatedWords.value = res.data?.words || []
  } catch (error) {
    console.error('生成失败:', error)
    ElMessage.error('生成失败，请检查 AI 配置')
  } finally {
    generating.value = false
  }
}

// 保存生成的词汇
async function saveGeneratedWords() {
  if (generatedWords.value.length === 0) return
  
  try {
    await addWordsBatch(generatedWords.value.map(w => ({
      ...w,
      source: 'ai'
    })))
    ElMessage.success('词典已保存')
    generateDialogVisible.value = false
    loadWords()
    loadCategories()
    loadStats()
  } catch (error) {
    console.error('保存失败:', error)
  }
}

onMounted(() => {
  loadCategories()
  loadStats()
  loadWords()
})
</script>

<template>
  <div class="dictionary-page">
    <div class="page-header">
      <h1>AI 词典</h1>
      <div class="header-actions">
        <el-button type="primary" @click="openGenerateDialog">
          <el-icon><MagicStick /></el-icon>
          AI 生成词典
        </el-button>
        <el-button @click="openAddDialog">
          <el-icon><Plus /></el-icon>
          添加词汇
        </el-button>
      </div>
    </div>
    
    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row" v-if="stats">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.totalWords }}</div>
          <div class="stat-label">总词汇数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.categories }}</div>
          <div class="stat-label">分类数量</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.userWords }}</div>
          <div class="stat-label">自定义词汇</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ stats.aiWords }}</div>
          <div class="stat-label">AI 生成词汇</div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 筛选和搜索 -->
    <el-card class="filter-card">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-select 
            v-model="selectedCategory" 
            placeholder="选择分类" 
            clearable 
            @change="handleSearch"
            style="width: 100%"
          >
            <el-option 
              v-for="cat in categories" 
              :key="cat" 
              :label="cat" 
              :value="cat" 
            />
          </el-select>
        </el-col>
        <el-col :span="12">
          <el-input 
            v-model="searchKeyword" 
            placeholder="搜索词汇、释义..." 
            clearable
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button @click="handleSearch">搜索</el-button>
            </template>
          </el-input>
        </el-col>
      </el-row>
    </el-card>
    
    <!-- 词汇列表 -->
    <el-card class="word-list-card" v-loading="loading">
      <el-table :data="wordList" stripe>
        <el-table-column prop="word" label="词汇" width="150">
          <template #default="{ row }">
            <span class="word-text">{{ row.word }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ row.category }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="meaning" label="释义" min-width="200" />
        <el-table-column prop="examples" label="示例" min-width="200">
          <template #default="{ row }">
            <span class="examples-text">{{ row.examples }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="source" label="来源" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source === 'ai' ? 'success' : 'info'">
              {{ row.source === 'ai' ? 'AI' : '自定义' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="use_count" label="使用次数" width="100" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" text type="danger" @click="handleDelete(row.id)">删除</el-button>
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
      
      <el-empty v-if="wordList.length === 0 && !loading" description="暂无词汇" />
    </el-card>
    
    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="editMode === 'add' ? '添加词汇' : '编辑词汇'"
      width="500px"
    >
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="词汇" required>
          <el-input v-model="editForm.word" placeholder="输入词汇" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select 
            v-model="editForm.category" 
            filterable 
            allow-create
            placeholder="选择或输入分类"
            style="width: 100%"
          >
            <el-option 
              v-for="cat in categories" 
              :key="cat" 
              :label="cat" 
              :value="cat" 
            />
          </el-select>
        </el-form-item>
        <el-form-item label="释义">
          <el-input v-model="editForm.meaning" placeholder="词义解释" />
        </el-form-item>
        <el-form-item label="示例">
          <el-input 
            v-model="editForm.examples" 
            type="textarea" 
            :rows="3"
            placeholder="使用示例"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveWord">保存</el-button>
      </template>
    </el-dialog>
    
    <!-- AI 生成对话框 -->
    <el-dialog
      v-model="generateDialogVisible"
      title="AI 生成专题词典"
      width="600px"
    >
      <el-form :model="generateForm" label-width="100px">
        <el-form-item label="词典主题">
          <el-input 
            v-model="generateForm.topic" 
            placeholder="如：战斗动作、情感表达、眼神描写..."
          />
        </el-form-item>
        <el-form-item label="词汇数量">
          <el-slider v-model="generateForm.count" :min="10" :max="50" show-input />
        </el-form-item>
        <el-form-item>
          <el-button 
            type="primary" 
            :loading="generating" 
            @click="handleGenerate"
          >
            {{ generating ? 'AI 生成中...' : '生成词典' }}
          </el-button>
        </el-form-item>
      </el-form>
      
      <div v-if="generatedWords.length > 0" class="generated-preview">
        <el-divider>预览（{{ generatedWords.length }} 个词汇）</el-divider>
        <div class="preview-list">
          <div v-for="(w, i) in generatedWords" :key="i" class="preview-item">
            <span class="word">{{ w.word }}</span>
            <span class="meaning">{{ w.meaning }}</span>
          </div>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="generateDialogVisible = false">取消</el-button>
        <el-button 
          type="primary" 
          :disabled="generatedWords.length === 0"
          @click="saveGeneratedWords"
        >
          保存到词典
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dictionary-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.stats-row {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #409eff;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.filter-card {
  margin-bottom: 20px;
}

.word-list-card {
  min-height: 400px;
}

.word-text {
  font-weight: 600;
  color: #409eff;
}

.examples-text {
  color: #909399;
  font-style: italic;
}

.pagination {
  margin-top: 20px;
  justify-content: center;
}

.generated-preview {
  margin-top: 20px;
}

.preview-list {
  max-height: 300px;
  overflow-y: auto;
}

.preview-item {
  display: flex;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
}

.preview-item .word {
  font-weight: 600;
  color: #303133;
  min-width: 80px;
}

.preview-item .meaning {
  color: #606266;
  flex: 1;
}
</style>
