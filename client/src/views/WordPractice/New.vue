<script setup>
/**
 * 词汇练习 - 新建练习配置页面
 * 用户选择分类、词汇数量、展示时间等
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { createPracticeSession } from '../../api/wordPractice'
import { getCategories, getDictionaryStats } from '../../api/dictionary'

const router = useRouter()

// 状态
const loading = ref(false)
const creating = ref(false)
const categories = ref([])
const categoryCounts = ref({})
const stats = ref(null)

// 练习配置
const practiceConfig = ref({
  title: '',
  categories: [],
  wordCount: 10,
  displayTime: 5
})

// 可用词汇数量
const availableWordCount = computed(() => {
  if (practiceConfig.value.categories.length === 0) {
    return stats.value?.totalWords || 0
  }
  return practiceConfig.value.categories.reduce((sum, cat) => {
    return sum + (categoryCounts.value[cat] || 0)
  }, 0)
})

// 词汇数量范围
const minWordCount = 1
const maxWordCount = 100

// 展示时间选项（秒）
const displayTimeOptions = [3, 5, 8, 10, 15, 20]

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [categoriesRes, statsRes] = await Promise.all([
      getCategories(),
      getDictionaryStats()
    ])
    
    categories.value = categoriesRes.data || []
    stats.value = statsRes.data
    
    // 这里可以获取每个分类的词汇数量
    // 暂时使用总数平均估算
    const avgPerCategory = Math.ceil((stats.value?.totalWords || 0) / (categories.value.length || 1))
    categories.value.forEach(cat => {
      categoryCounts.value[cat] = avgPerCategory
    })
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 选择/取消选择分类
function toggleCategory(category) {
  const index = practiceConfig.value.categories.indexOf(category)
  if (index === -1) {
    practiceConfig.value.categories.push(category)
  } else {
    practiceConfig.value.categories.splice(index, 1)
  }
}

// 全选/取消全选
function toggleAllCategories() {
  if (practiceConfig.value.categories.length === categories.value.length) {
    practiceConfig.value.categories = []
  } else {
    practiceConfig.value.categories = [...categories.value]
  }
}

// 开始练习
async function startPractice() {
  if (availableWordCount.value === 0) {
    ElMessage.warning('没有可用的词汇，请先添加词汇到词典')
    return
  }
  
  if (practiceConfig.value.wordCount > availableWordCount.value) {
    ElMessage.warning(`可用词汇不足，最多只能选择 ${availableWordCount.value} 个`)
    practiceConfig.value.wordCount = availableWordCount.value
    return
  }
  
  creating.value = true
  try {
    const res = await createPracticeSession({
      title: practiceConfig.value.title || `词汇练习 - ${new Date().toLocaleDateString()}`,
      categories: practiceConfig.value.categories,
      wordCount: practiceConfig.value.wordCount,
      displayTime: practiceConfig.value.displayTime
    })
    
    if (res.success) {
      ElMessage.success('练习创建成功，开始记忆！')
      router.push(`/word-practice/session/${res.data.sessionId}`)
    } else {
      ElMessage.error(res.message || '创建练习失败')
    }
  } catch (error) {
    console.error('创建练习失败:', error)
    ElMessage.error('创建练习失败')
  } finally {
    creating.value = false
  }
}

// 返回
function goBack() {
  router.push('/word-practice')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="new-practice-page" v-loading="loading">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
      <h1>📚 新建词汇练习</h1>
    </div>
    
    <el-card class="config-card">
      <el-form label-position="top">
        <!-- 练习标题 -->
        <el-form-item label="练习标题（可选）">
          <el-input 
            v-model="practiceConfig.title" 
            placeholder="给这次练习起个名字吧"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        
        <!-- 选择分类 -->
        <el-form-item label="选择词汇分类">
          <div class="category-selector">
            <div class="category-header">
              <el-button size="small" @click="toggleAllCategories">
                {{ practiceConfig.categories.length === categories.length ? '取消全选' : '全选' }}
              </el-button>
              <span class="selected-count">
                已选择 {{ practiceConfig.categories.length }} 个分类
              </span>
            </div>
            <div class="category-list">
              <el-check-tag 
                v-for="cat in categories" 
                :key="cat"
                :checked="practiceConfig.categories.includes(cat)"
                @change="toggleCategory(cat)"
              >
                {{ cat }}
              </el-check-tag>
            </div>
            <p class="category-tip">
              <el-icon><InfoFilled /></el-icon>
              不选择分类将从全部词库中随机抽取
            </p>
          </div>
        </el-form-item>
        
        <!-- 词汇数量 -->
        <el-form-item label="本次练习词汇数量">
          <div class="option-selector">
            <el-input-number 
              v-model="practiceConfig.wordCount" 
              :min="minWordCount" 
              :max="Math.min(maxWordCount, availableWordCount)"
              :step="1"
              controls-position="right"
              style="width: 150px"
            />
            <span style="margin-left: 8px; color: #666;">个</span>
            <p class="option-tip">
              可用词汇: {{ availableWordCount }} 个（可选 {{ minWordCount }}-{{ Math.min(maxWordCount, availableWordCount) }} 个）
            </p>
          </div>
        </el-form-item>
        
        <!-- 展示时间 -->
        <el-form-item label="每个词汇展示时间">
          <div class="option-selector">
            <el-radio-group v-model="practiceConfig.displayTime">
              <el-radio-button 
                v-for="time in displayTimeOptions" 
                :key="time" 
                :label="time"
              >
                {{ time }} 秒
              </el-radio-button>
            </el-radio-group>
            <p class="option-tip">
              建议新手选择较长时间，熟练后可以缩短
            </p>
          </div>
        </el-form-item>
      </el-form>
      
      <!-- 预览信息 -->
      <div class="preview-info">
        <h3>练习预览</h3>
        <div class="preview-items">
          <div class="preview-item">
            <span class="label">词汇数量:</span>
            <span class="value">{{ practiceConfig.wordCount }} 个</span>
          </div>
          <div class="preview-item">
            <span class="label">记忆阶段:</span>
            <span class="value">约 {{ Math.ceil(practiceConfig.wordCount * practiceConfig.displayTime / 60) }} 分钟</span>
          </div>
          <div class="preview-item">
            <span class="label">预计题目:</span>
            <span class="value">{{ practiceConfig.wordCount * 3 }} 道</span>
          </div>
          <div class="preview-item">
            <span class="label">总时长:</span>
            <span class="value">约 {{ Math.ceil(practiceConfig.wordCount * (practiceConfig.displayTime + 30) / 60) }} 分钟</span>
          </div>
        </div>
      </div>
      
      <!-- 开始按钮 -->
      <div class="action-buttons">
        <el-button @click="goBack">取消</el-button>
        <el-button 
          type="primary" 
          size="large"
          :loading="creating"
          :disabled="availableWordCount === 0"
          @click="startPractice"
        >
          🚀 开始练习
        </el-button>
      </div>
    </el-card>
    
    <!-- 练习说明 -->
    <el-card class="tips-card">
      <h3>📖 练习说明</h3>
      <div class="tips-content">
        <div class="tip-item">
          <span class="tip-number">1</span>
          <div class="tip-text">
            <strong>记忆阶段</strong>
            <p>系统会依次展示每个词汇的词语、释义和例句，请认真记忆</p>
          </div>
        </div>
        <div class="tip-item">
          <span class="tip-number">2</span>
          <div class="tip-text">
            <strong>答题阶段</strong>
            <p>记忆结束后，依次回答选择题、填空题和造句题，难度递增</p>
          </div>
        </div>
        <div class="tip-item">
          <span class="tip-number">3</span>
          <div class="tip-text">
            <strong>AI批改</strong>
            <p>造句题由AI进行批改，会给出详细的反馈和修改建议</p>
          </div>
        </div>
        <div class="tip-item">
          <span class="tip-number">4</span>
          <div class="tip-text">
            <strong>复习计划</strong>
            <p>答错的词汇会进入错题集，系统会基于艾宾浩斯遗忘曲线生成复习计划</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.new-practice-page {
  max-width: 800px;
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

.config-card {
  margin-bottom: 20px;
}

.category-selector {
  width: 100%;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.selected-count {
  color: #909399;
  font-size: 13px;
}

.category-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.category-list .el-check-tag {
  padding: 8px 16px;
  border-radius: 20px;
}

.category-tip {
  margin-top: 12px;
  color: #909399;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.option-selector {
  width: 100%;
}

.option-tip {
  margin-top: 8px;
  color: #909399;
  font-size: 13px;
}

.preview-info {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
  margin: 24px 0;
}

.preview-info h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #303133;
}

.preview-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.preview-item {
  display: flex;
  justify-content: space-between;
}

.preview-item .label {
  color: #909399;
}

.preview-item .value {
  font-weight: 500;
  color: #303133;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.tips-card h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #303133;
}

.tips-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.tip-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.tip-number {
  width: 28px;
  height: 28px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.tip-text strong {
  display: block;
  margin-bottom: 4px;
  color: #303133;
}

.tip-text p {
  margin: 0;
  color: #606266;
  font-size: 14px;
}
</style>
