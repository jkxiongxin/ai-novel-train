<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  aiSearchWords,
  aiGenerateWords,
  getWords,
  addWord,
  addWordsBatch,
  deleteWord,
  useWord,
  getCategories
} from '../api/dictionary'
import { isMobile } from '../utils/device'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  context: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'select'])

// 状态
const activeTab = ref('search')
const loading = ref(false)
const searchQuery = ref('')
const searchResults = ref(null)
const searchTips = ref('')

// 词典管理
const categories = ref([])
const selectedCategory = ref('')
const wordList = ref([])
const wordListLoading = ref(false)

// 生成词典
const generateTopic = ref('')
const generateCount = ref(20)
const generatedWords = ref([])

// 添加词汇
const addDialogVisible = ref(false)
const newWord = ref({
  word: '',
  category: '',
  meaning: '',
  examples: ''
})

// 计算属性
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val)
})

// 抽屉方向：移动端从下方弹出，桌面端从右侧
const drawerDirection = computed(() => isMobile ? 'btt' : 'rtl')

// 抽屉大小：移动端占 66% 高度，桌面端宽度 450px
const drawerSize = computed(() => isMobile ? '66%' : '450px')

// AI 搜索
async function handleSearch() {
  if (!searchQuery.value.trim()) {
    ElMessage.warning('请输入要查询的内容')
    return
  }
  
  try {
    loading.value = true
    searchResults.value = null
    
    const res = await aiSearchWords(searchQuery.value, props.context)
    
    if (res.data) {
      searchResults.value = res.data.words || []
      searchTips.value = res.data.tips || ''
    }
  } catch (error) {
    console.error('搜索失败:', error)
    ElMessage.error('搜索失败，请检查 AI 配置')
  } finally {
    loading.value = false
  }
}

// 选择词汇
function selectWord(word) {
  emit('select', word)
  // 增加使用次数
  if (word.id) {
    useWord(word.id).catch(() => {})
  }
}

// 保存词汇到词典
async function saveWordToDictionary(word) {
  try {
    await addWord({
      word: word.word,
      category: word.category,
      meaning: word.meaning,
      examples: word.examples,
      source: 'ai'
    })
    ElMessage.success('已保存到词典')
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 批量保存搜索结果
async function saveAllResults() {
  if (!searchResults.value || searchResults.value.length === 0) return
  
  try {
    await addWordsBatch(searchResults.value.map(w => ({
      word: w.word,
      category: w.category,
      meaning: w.meaning,
      examples: w.examples,
      source: 'ai'
    })))
    ElMessage.success('已全部保存到词典')
  } catch (error) {
    console.error('批量保存失败:', error)
  }
}

// 加载词典分类
async function loadCategories() {
  try {
    const res = await getCategories()
    categories.value = res.data || []
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

// 加载词汇列表
async function loadWordList() {
  try {
    wordListLoading.value = true
    const res = await getWords({
      category: selectedCategory.value,
      pageSize: 100
    })
    wordList.value = res.data?.list || []
  } catch (error) {
    console.error('加载词汇失败:', error)
  } finally {
    wordListLoading.value = false
  }
}

// AI 生成词典
async function handleGenerate() {
  if (!generateTopic.value.trim()) {
    ElMessage.warning('请输入词典主题')
    return
  }
  
  try {
    loading.value = true
    generatedWords.value = []
    
    const res = await aiGenerateWords(generateTopic.value, generateCount.value)
    
    if (res.data?.words) {
      generatedWords.value = res.data.words
    }
  } catch (error) {
    console.error('生成失败:', error)
    ElMessage.error('生成失败，请检查 AI 配置')
  } finally {
    loading.value = false
  }
}

// 保存生成的词典
async function saveGeneratedWords() {
  if (generatedWords.value.length === 0) return
  
  try {
    await addWordsBatch(generatedWords.value.map(w => ({
      ...w,
      source: 'ai'
    })))
    ElMessage.success('词典已保存')
    generatedWords.value = []
    loadCategories()
  } catch (error) {
    console.error('保存失败:', error)
  }
}

// 添加自定义词汇
async function handleAddWord() {
  if (!newWord.value.word || !newWord.value.category) {
    ElMessage.warning('请填写词汇和分类')
    return
  }
  
  try {
    await addWord({
      ...newWord.value,
      source: 'user'
    })
    ElMessage.success('添加成功')
    addDialogVisible.value = false
    newWord.value = { word: '', category: '', meaning: '', examples: '' }
    loadWordList()
    loadCategories()
  } catch (error) {
    console.error('添加失败:', error)
  }
}

// 删除词汇
async function handleDeleteWord(id) {
  try {
    await deleteWord(id)
    ElMessage.success('删除成功')
    loadWordList()
  } catch (error) {
    console.error('删除失败:', error)
  }
}

// 监听对话框打开
watch(() => props.visible, (val) => {
  if (val) {
    loadCategories()
  }
})

// 监听分类变化
watch(selectedCategory, () => {
  loadWordList()
})
</script>

<template>
  <el-drawer
    v-model="dialogVisible"
    title="AI 写作词典"
    :direction="drawerDirection"
    :size="drawerSize"
    :append-to-body="true"
    class="dictionary-drawer"
  >
    <el-tabs v-model="activeTab" class="dictionary-tabs">
      <!-- AI 查词 -->
      <el-tab-pane label="AI 查词" name="search">
        <div class="search-section">
          <el-input
            v-model="searchQuery"
            placeholder="输入要查找的动作、情感或描述..."
            :prefix-icon="'Search'"
            @keyup.enter="handleSearch"
          >
            <template #append>
              <el-button :loading="loading" @click="handleSearch">
                查询
              </el-button>
            </template>
          </el-input>
          
          <div class="search-tips">
            <span>示例：</span>
            <el-tag 
              v-for="tip in ['愤怒地看', '快速移动', '悲伤的表情', '说话的语气']" 
              :key="tip"
              size="small"
              @click="searchQuery = tip; handleSearch()"
              style="cursor: pointer; margin-right: 8px;"
            >
              {{ tip }}
            </el-tag>
          </div>
        </div>
        
        <div v-if="loading" class="loading-section">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>AI 正在搜索相关词汇...</span>
        </div>
        
        <div v-else-if="searchResults && searchResults.length > 0" class="results-section">
          <div class="results-header">
            <span>找到 {{ searchResults.length }} 个相关词汇</span>
            <el-button size="small" type="primary" text @click="saveAllResults">
              全部保存
            </el-button>
          </div>
          
          <div v-if="searchTips" class="search-advice">
            💡 {{ searchTips }}
          </div>
          
          <div class="word-list">
            <div 
              v-for="(word, index) in searchResults" 
              :key="index" 
              class="word-item"
            >
              <div class="word-main">
                <span class="word-text" @click="selectWord(word)">
                  {{ word.word }}
                </span>
                <el-tag size="small" type="info">{{ word.category }}</el-tag>
                <el-tag v-if="word.intensity" size="small">{{ word.intensity }}</el-tag>
              </div>
              <div class="word-meaning">{{ word.meaning }}</div>
              <div v-if="word.examples" class="word-example">
                📝 {{ word.examples }}
              </div>
              <div class="word-actions">
                <el-button size="small" type="primary" @click="selectWord(word)">
                  使用
                </el-button>
                <el-button size="small" @click="saveWordToDictionary(word)">
                  收藏
                </el-button>
              </div>
            </div>
          </div>
        </div>
        
        <el-empty v-else-if="searchResults !== null" description="未找到相关词汇" />
      </el-tab-pane>
      
      <!-- 我的词典 -->
      <el-tab-pane label="我的词典" name="library">
        <div class="library-header">
          <el-select 
            v-model="selectedCategory" 
            placeholder="选择分类"
            clearable
            style="width: 150px"
          >
            <el-option 
              v-for="cat in categories" 
              :key="cat" 
              :label="cat" 
              :value="cat" 
            />
          </el-select>
          <el-button type="primary" @click="addDialogVisible = true">
            添加词汇
          </el-button>
        </div>
        
        <div v-loading="wordListLoading" class="word-list">
          <div 
            v-for="word in wordList" 
            :key="word.id" 
            class="word-item"
          >
            <div class="word-main">
              <span class="word-text" @click="selectWord(word)">
                {{ word.word }}
              </span>
              <el-tag size="small" type="info">{{ word.category }}</el-tag>
              <el-tag size="small" :type="word.source === 'ai' ? 'success' : ''">
                {{ word.source === 'ai' ? 'AI' : '自定义' }}
              </el-tag>
            </div>
            <div v-if="word.meaning" class="word-meaning">{{ word.meaning }}</div>
            <div v-if="word.examples" class="word-example">
              📝 {{ word.examples }}
            </div>
            <div class="word-actions">
              <el-button size="small" type="primary" @click="selectWord(word)">
                使用
              </el-button>
              <el-button size="small" type="danger" text @click="handleDeleteWord(word.id)">
                删除
              </el-button>
            </div>
          </div>
          
          <el-empty v-if="wordList.length === 0 && !wordListLoading" description="暂无词汇" />
        </div>
      </el-tab-pane>
      
      <!-- AI 生成词典 -->
      <el-tab-pane label="生成词典" name="generate">
        <div class="generate-section">
          <el-form label-position="top">
            <el-form-item label="词典主题">
              <el-input 
                v-model="generateTopic" 
                placeholder="如：战斗动作、情感表达、眼神描写..."
              />
            </el-form-item>
            <el-form-item label="词汇数量">
              <el-slider v-model="generateCount" :min="2" :max="50" show-input />
            </el-form-item>
            <el-form-item>
              <el-button 
                type="primary" 
                :loading="loading" 
                @click="handleGenerate"
                style="width: 100%"
              >
                {{ loading ? 'AI 生成中...' : '生成专题词典' }}
              </el-button>
            </el-form-item>
          </el-form>
          
          <div v-if="generatedWords.length > 0" class="generated-results">
            <div class="results-header">
              <span>已生成 {{ generatedWords.length }} 个词汇</span>
              <el-button type="primary" size="small" @click="saveGeneratedWords">
                保存到词典
              </el-button>
            </div>
            
            <div class="word-list">
              <div 
                v-for="(word, index) in generatedWords" 
                :key="index" 
                class="word-item compact"
              >
                <span class="word-text">{{ word.word }}</span>
                <span class="word-meaning">{{ word.meaning }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
    
    <!-- 添加词汇对话框 -->
    <el-dialog
      v-model="addDialogVisible"
      title="添加词汇"
      :width="isMobile ? '90%' : '400px'"
      :append-to-body="true"
      class="add-word-dialog"
    >
      <el-form label-width="80px">
        <el-form-item label="词汇" required>
          <el-input v-model="newWord.word" placeholder="输入词汇" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select 
            v-model="newWord.category" 
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
          <el-input v-model="newWord.meaning" placeholder="词义解释" />
        </el-form-item>
        <el-form-item label="示例">
          <el-input 
            v-model="newWord.examples" 
            type="textarea" 
            :rows="2"
            placeholder="使用示例"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAddWord">添加</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<script>
import { Loading } from '@element-plus/icons-vue'
export default {
  components: { Loading }
}
</script>

<style scoped>
.dictionary-tabs {
  height: 100%;
}

.dictionary-tabs :deep(.el-tabs__content) {
  height: calc(100% - 55px);
  overflow-y: auto;
}

.search-section {
  margin-bottom: 16px;
}

.search-tips {
  margin-top: 12px;
  font-size: 13px;
  color: #909399;
}

.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.loading-section .el-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.results-section {
  margin-top: 16px;
}

.results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  color: #606266;
  font-size: 14px;
}

.search-advice {
  background: #fdf6ec;
  border: 1px solid #faecd8;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #e6a23c;
}

.word-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.word-item {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 12px;
}

.word-item.compact {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
}

.word-item.compact .word-meaning {
  margin: 0;
  flex: 1;
}

.word-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.word-text {
  font-size: 16px;
  font-weight: 600;
  color: #409eff;
  cursor: pointer;
}

.word-text:hover {
  text-decoration: underline;
}

.word-meaning {
  color: #606266;
  font-size: 13px;
  margin-bottom: 6px;
}

.word-example {
  color: #909399;
  font-size: 12px;
  font-style: italic;
  margin-bottom: 8px;
}

.word-actions {
  display: flex;
  gap: 8px;
}

.library-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}

.generate-section {
  padding: 12px 0;
}

.generated-results {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 16px;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .dictionary-drawer :deep(.el-drawer) {
    border-radius: 16px 16px 0 0;
  }
  
  .dictionary-drawer :deep(.el-drawer__header) {
    padding: 12px 16px;
    margin-bottom: 0;
    border-bottom: 1px solid #ebeef5;
  }
  
  .dictionary-drawer :deep(.el-drawer__title) {
    font-size: 16px;
  }
  
  .dictionary-drawer :deep(.el-drawer__body) {
    padding: 12px;
  }
  
  .dictionary-tabs :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }
  
  .dictionary-tabs :deep(.el-tabs__nav) {
    width: 100%;
  }
  
  .dictionary-tabs :deep(.el-tabs__item) {
    flex: 1;
    text-align: center;
    font-size: 13px;
    padding: 0 12px;
  }
  
  .dictionary-tabs :deep(.el-tabs__content) {
    height: calc(100% - 50px);
  }
  
  .search-section {
    margin-bottom: 12px;
  }
  
  .search-section .el-input {
    font-size: 14px;
  }
  
  .search-tips {
    margin-top: 8px;
    font-size: 12px;
  }
  
  .search-tips .el-tag {
    margin-bottom: 4px;
  }
  
  .word-item {
    padding: 10px;
  }
  
  .word-main {
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
  }
  
  .word-text {
    font-size: 15px;
  }
  
  .word-meaning {
    font-size: 12px;
    margin-bottom: 4px;
  }
  
  .word-example {
    font-size: 11px;
    margin-bottom: 6px;
  }
  
  .word-actions {
    gap: 6px;
  }
  
  .word-actions .el-button {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .library-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .library-header .el-select {
    width: 100% !important;
  }
  
  .library-header .el-button {
    width: 100%;
  }
  
  .generate-section {
    padding: 8px 0;
  }
  
  .generate-section .el-slider {
    width: calc(100% - 80px);
  }
  
  .results-header {
    font-size: 13px;
  }
  
  .loading-section {
    padding: 30px;
  }
  
  .loading-section .el-icon {
    font-size: 28px;
  }
}
</style>
