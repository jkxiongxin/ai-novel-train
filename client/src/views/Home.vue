<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getOverview } from '../api/statistics'
import { getAIConfig, getAIConfigs } from '../api/aiConfig'

const router = useRouter()
const loading = ref(true)
const hasAIConfig = ref(false)
const overview = ref({
  totalPractices: 0,
  evaluatedPractices: 0,
  avgScore: 0,
  totalWords: 0,
  totalTime: 0,
  totalQuestions: 0,
  favoriteQuestions: 0,
  recentPractices: 0
})

const questionTypes = [
  { type: 'dialogue', name: '人物对白', icon: '💬', color: '#409eff' },
  { type: 'emotion', name: '情绪渲染', icon: '❤️', color: '#f56c6c' },
  { type: 'battle', name: '战斗场景', icon: '⚔️', color: '#e6a23c' },
  { type: 'psychology', name: '心理活动', icon: '🧠', color: '#909399' },
  { type: 'environment', name: '环境描写', icon: '🌄', color: '#67c23a' },
  { type: 'plot', name: '情节转折', icon: '🔄', color: '#9c27b0' },
  { type: 'chapter', name: '章节创作', icon: '📖', color: '#ff9800' },
  { type: 'comprehensive', name: '综合训练', icon: '⭐', color: '#2196f3' }
]

function formatTime(seconds) {
  if (!seconds) return '0分钟'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`
  }
  return `${minutes}分钟`
}

function formatWords(count) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + '万'
  }
  return count.toString()
}

function startPractice(type) {
  router.push(`/practice/new/${type}`)
}

function goToAISettings() {
  router.push('/settings/ai')
}

onMounted(async () => {
  try {
    // 检查 AI 配置 - 检查是否存在任何配置（不只是激活的）
    const configRes = await getAIConfigs()
    hasAIConfig.value = configRes.data && configRes.data.length > 0
    
    // 获取统计数据
    const statsRes = await getOverview()
    overview.value = statsRes.data
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="home" v-loading="loading">
    <!-- AI 配置提示 -->
    <el-alert
      v-if="!hasAIConfig && !loading"
      title="请先配置 AI API"
      description="在开始练习之前，您需要配置 AI API 以启用题目生成和评审功能。"
      type="warning"
      show-icon
      :closable="false"
      class="config-alert"
    >
      <template #default>
        <el-button type="primary" size="small" @click="goToAISettings">
          前往配置
        </el-button>
      </template>
    </el-alert>
    
    <!-- 概览卡片 -->
    <div class="overview-cards">
      <el-card class="overview-card">
        <div class="card-icon" style="background: #409eff">📝</div>
        <div class="card-content">
          <div class="card-value">{{ overview.totalPractices }}</div>
          <div class="card-label">总练习次数</div>
        </div>
      </el-card>
      
      <el-card class="overview-card">
        <div class="card-icon" style="background: #67c23a">✅</div>
        <div class="card-content">
          <div class="card-value">{{ overview.evaluatedPractices }}</div>
          <div class="card-label">已完成评审</div>
        </div>
      </el-card>
      
      <el-card class="overview-card">
        <div class="card-icon" style="background: #e6a23c">⭐</div>
        <div class="card-content">
          <div class="card-value">{{ overview.avgScore }}</div>
          <div class="card-label">平均得分</div>
        </div>
      </el-card>
      
      <el-card class="overview-card">
        <div class="card-icon" style="background: #f56c6c">📄</div>
        <div class="card-content">
          <div class="card-value">{{ formatWords(overview.totalWords) }}</div>
          <div class="card-label">累计字数</div>
        </div>
      </el-card>
      
      <el-card class="overview-card">
        <div class="card-icon" style="background: #909399">⏱️</div>
        <div class="card-content">
          <div class="card-value">{{ formatTime(overview.totalTime) }}</div>
          <div class="card-label">累计时间</div>
        </div>
      </el-card>
      
      <el-card class="overview-card">
        <div class="card-icon" style="background: #9c27b0">📚</div>
        <div class="card-content">
          <div class="card-value">{{ overview.totalQuestions }}</div>
          <div class="card-label">题库数量</div>
        </div>
      </el-card>
    </div>
    
    <!-- 快速开始 -->
    <el-card class="quick-start">
      <template #header>
        <div class="card-header">
          <span>🚀 快速开始练习</span>
          <el-button type="primary" text @click="$router.push('/practice')">
            查看全部
          </el-button>
        </div>
      </template>
      
      <div class="practice-types">
        <div
          v-for="item in questionTypes"
          :key="item.type"
          class="practice-type-card"
          @click="startPractice(item.type)"
        >
          <div class="type-icon" :style="{ background: item.color }">
            {{ item.icon }}
          </div>
          <div class="type-name">{{ item.name }}</div>
        </div>
      </div>
    </el-card>
    
    <!-- 随心练习入口 -->
    <el-card class="freewrite-entry" @click="$router.push('/freewrite')">
      <div class="freewrite-content">
        <div class="freewrite-left">
          <div class="freewrite-icon">✍️</div>
          <div class="freewrite-info">
            <h3>随心练习</h3>
            <p>自由写作，释放表达欲，培养输出习惯</p>
          </div>
        </div>
        <div class="freewrite-features">
          <el-tag size="small" type="success">🍅 番茄时间</el-tag>
          <el-tag size="small" type="info">📖 支持续写</el-tag>
          <el-tag size="small" type="warning">✨ AI评审</el-tag>
        </div>
        <el-icon class="freewrite-arrow"><ArrowRight /></el-icon>
      </div>
    </el-card>
    
    <!-- 最近7天 -->
    <el-card class="recent-stats">
      <template #header>
        <span>📊 最近7天</span>
      </template>
      <div class="recent-content">
        <div class="recent-item">
          <span class="recent-value">{{ overview.recentPractices }}</span>
          <span class="recent-label">次练习</span>
        </div>
        <div class="recent-tip">
          保持每天练习，提升写作能力！
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
}

.config-alert {
  margin-bottom: 20px;
}

.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.overview-card {
  display: flex;
  align-items: center;
  padding: 16px;
}

.overview-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 16px;
}

.card-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
}

.card-content {
  flex: 1;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #303133;
}

.card-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

.quick-start {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.practice-types {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.practice-type-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-radius: 8px;
  background: #f5f7fa;
  cursor: pointer;
  transition: all 0.3s;
}

.practice-type-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.type-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 12px;
}

.type-name {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.recent-stats {
  margin-bottom: 20px;
}

.recent-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.recent-item {
  display: flex;
  align-items: baseline;
}

.recent-value {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
}

.recent-label {
  font-size: 16px;
  color: #606266;
  margin-left: 8px;
}

.recent-tip {
  color: #909399;
  font-size: 14px;
}

/* 随心练习入口 */
.freewrite-entry {
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.freewrite-entry:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.freewrite-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.freewrite-left {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
}

.freewrite-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.freewrite-info h3 {
  margin: 0 0 4px;
  font-size: 18px;
  color: #303133;
}

.freewrite-info p {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

.freewrite-features {
  display: flex;
  gap: 8px;
}

.freewrite-arrow {
  font-size: 20px;
  color: #909399;
}
</style>
