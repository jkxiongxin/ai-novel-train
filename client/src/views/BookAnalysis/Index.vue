<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Reading, Document, TrendCharts, Timer, Trophy } from '@element-plus/icons-vue'
import {
  getBookAnalysisStyles,
  getBookAnalysisNovels,
  getOutlinePractices,
  getBookAnalysisStatistics
} from '../../api/bookAnalysis'

const router = useRouter()
const loading = ref(false)

// 数据
const styles = ref([])
const novels = ref([])
const recentPractices = ref([])
const statistics = ref({
  analysis_count: 0,
  practice_count: 0,
  avg_score: 0,
  total_words: 0,
  total_time: 0
})

// 流派图标映射
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵'
}

// 流派颜色映射
const styleColors = {
  emotion_flow: '#e74c3c',
  plot_point_flow: '#3498db',
  structure_flow: '#2ecc71',
  rhythm_flow: '#9b59b6'
}

// 格式化时间
function formatTime(seconds) {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

// 格式化日期
function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const [stylesRes, novelsRes, practicesRes, statsRes] = await Promise.all([
      getBookAnalysisStyles(),
      getBookAnalysisNovels(),
      getOutlinePractices({ page: 1, pageSize: 5 }),
      getBookAnalysisStatistics()
    ])

    styles.value = stylesRes.data || []
    novels.value = novelsRes.data || []
    recentPractices.value = practicesRes.data?.list || []
    statistics.value = statsRes.data || {}
  } catch (error) {
    console.error('加载数据失败:', error)
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 开始拆书
function startAnalysis(styleKey) {
  router.push({
    path: '/book-analysis/select',
    query: { style: styleKey }
  })
}

// 进入练习
function goToPractice(practice) {
  if (practice.status === 'submitted') {
    router.push(`/book-analysis/practice/${practice.id}/result`)
  } else {
    router.push(`/book-analysis/practice/${practice.id}`)
  }
}

// 查看全部练习
function viewAllPractices() {
  router.push('/book-analysis/history')
}

// 选择小说开始
function selectNovel(novelName) {
  router.push({
    path: '/book-analysis/select',
    query: { novel: novelName }
  })
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="book-analysis-page" v-loading="loading">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1>📚 拆书学习</h1>
      <p>通过拆解大师作品，学习写作技巧，掌握细纲成文的能力</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: #e74c3c20; color: #e74c3c;">
          <el-icon><Reading /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.analysis_count }}</div>
          <div class="stat-label">拆书分析</div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: #3498db20; color: #3498db;">
          <el-icon><Document /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.practice_count }}</div>
          <div class="stat-label">成文练习</div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: #2ecc7120; color: #2ecc71;">
          <el-icon><Trophy /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.avg_score || '-' }}</div>
          <div class="stat-label">平均分数</div>
        </div>
      </el-card>

      <el-card class="stat-card" shadow="hover">
        <div class="stat-icon" style="background: #9b59b620; color: #9b59b6;">
          <el-icon><TrendCharts /></el-icon>
        </div>
        <div class="stat-info">
          <div class="stat-value">{{ statistics.total_words?.toLocaleString() || 0 }}</div>
          <div class="stat-label">练习字数</div>
        </div>
      </el-card>
    </div>

    <!-- 拆书流派 -->
    <el-card class="section-card">
      <template #header>
        <div class="section-header">
          <span>🎯 拆书流派</span>
          <el-button type="primary" link @click="router.push('/book-analysis/select')">
            选择章节拆书 →
          </el-button>
        </div>
      </template>

      <div class="styles-grid">
        <div
          v-for="style in styles"
          :key="style.style_key"
          class="style-card"
          :style="{ borderColor: styleColors[style.style_key] || '#409eff' }"
          @click="startAnalysis(style.style_key)"
        >
          <div class="style-icon">{{ styleIcons[style.style_key] || '📖' }}</div>
          <div class="style-name">{{ style.name }}</div>
          <div class="style-desc">{{ style.description }}</div>
          <el-button type="primary" size="small" plain>开始拆书</el-button>
        </div>
      </div>
    </el-card>

    <!-- 我的小说 -->
    <el-card class="section-card" v-if="novels.length > 0">
      <template #header>
        <div class="section-header">
          <span>📚 我的小说</span>
          <el-button type="primary" link @click="router.push('/chapters')">
            管理章节 →
          </el-button>
        </div>
      </template>

      <div class="novels-list">
        <div
          v-for="novel in novels.slice(0, 6)"
          :key="novel.novel_name"
          class="novel-item"
          @click="selectNovel(novel.novel_name)"
        >
          <div class="novel-info">
            <div class="novel-name">{{ novel.novel_name }}</div>
            <div class="novel-meta">
              <span v-if="novel.author">{{ novel.author }} · </span>
              <span>{{ novel.chapter_count }} 章</span>
              <span> · {{ novel.total_words?.toLocaleString() }} 字</span>
            </div>
          </div>
          <el-icon class="novel-arrow"><Reading /></el-icon>
        </div>
      </div>

      <el-empty v-if="novels.length === 0" description="暂无小说，请先上传" />
    </el-card>

    <!-- 最近练习 -->
    <el-card class="section-card">
      <template #header>
        <div class="section-header">
          <span>📝 最近练习</span>
          <el-button type="primary" link @click="viewAllPractices" v-if="recentPractices.length > 0">
            查看全部 →
          </el-button>
        </div>
      </template>

      <div class="practices-list" v-if="recentPractices.length > 0">
        <div
          v-for="practice in recentPractices"
          :key="practice.id"
          class="practice-item"
          @click="goToPractice(practice)"
        >
          <div class="practice-info">
            <div class="practice-title">{{ practice.chapter_title }}</div>
            <div class="practice-meta">
              <el-tag size="small" type="info">{{ practice.style_name }}</el-tag>
              <span>{{ practice.word_count }} 字</span>
              <span v-if="practice.ai_score">· {{ practice.ai_score }} 分</span>
            </div>
          </div>
          <div class="practice-status">
            <el-tag :type="practice.status === 'submitted' ? 'success' : 'warning'" size="small">
              {{ practice.status === 'submitted' ? '已完成' : '进行中' }}
            </el-tag>
            <div class="practice-date">{{ formatDate(practice.created_at) }}</div>
          </div>
        </div>
      </div>

      <el-empty v-else description="暂无练习记录" />
    </el-card>

    <!-- 使用指南 -->
    <el-card class="section-card guide-card">
      <template #header>
        <span>💡 使用指南</span>
      </template>

      <div class="guide-steps">
        <div class="guide-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <div class="step-title">选择章节</div>
            <div class="step-desc">从已导入的小说中选择要学习的章节</div>
          </div>
        </div>
        <div class="guide-arrow">→</div>
        <div class="guide-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <div class="step-title">选择流派</div>
            <div class="step-desc">选择情绪流、情节点流等拆书方式</div>
          </div>
        </div>
        <div class="guide-arrow">→</div>
        <div class="guide-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <div class="step-title">AI拆书</div>
            <div class="step-desc">AI 按流派分析章节，生成结构化细纲</div>
          </div>
        </div>
        <div class="guide-arrow">→</div>
        <div class="guide-step">
          <div class="step-number">4</div>
          <div class="step-content">
            <div class="step-title">细纲成文</div>
            <div class="step-desc">根据细纲自己写正文，AI 评价对比</div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.book-analysis-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.page-header p {
  color: #666;
  font-size: 14px;
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.stat-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stat-label {
  font-size: 13px;
  color: #909399;
}

/* 区块卡片 */
.section-card {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}

/* 流派网格 */
.styles-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.style-card {
  padding: 20px;
  border: 2px solid #ebeef5;
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
}

.style-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.style-icon {
  font-size: 40px;
  margin-bottom: 12px;
}

.style-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
}

.style-desc {
  font-size: 12px;
  color: #909399;
  margin-bottom: 16px;
  line-height: 1.5;
}

/* 小说列表 */
.novels-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.novel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.novel-item:hover {
  background: #e6f7ff;
}

.novel-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.novel-meta {
  font-size: 12px;
  color: #909399;
}

.novel-arrow {
  color: #909399;
}

/* 练习列表 */
.practices-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.practice-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.practice-item:hover {
  background: #f0f9ff;
}

.practice-title {
  font-weight: 500;
  margin-bottom: 6px;
}

.practice-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
}

.practice-status {
  text-align: right;
}

.practice-date {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

/* 使用指南 */
.guide-card :deep(.el-card__body) {
  padding: 24px;
}

.guide-steps {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.guide-step {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.step-number {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.step-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.guide-arrow {
  color: #dcdfe6;
  font-size: 20px;
  padding: 0 8px;
}

/* 响应式 */
@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .styles-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: 1fr;
  }

  .styles-grid {
    grid-template-columns: 1fr;
  }

  .novels-list {
    grid-template-columns: 1fr;
  }

  .guide-steps {
    flex-direction: column;
    gap: 16px;
  }

  .guide-arrow {
    transform: rotate(90deg);
  }
}
</style>
