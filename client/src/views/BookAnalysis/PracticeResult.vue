<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Trophy, Timer, Document, TrendCharts } from '@element-plus/icons-vue'
import { getOutlinePractice } from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const practice = ref(null)
const showComparison = ref(false)

const practiceId = route.params.practiceId

// 流派图标
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵'
}

// 格式化时间
function formatTime(seconds) {
  if (!seconds) return '0分钟'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return `${h}小时${m}分钟`
  }
  return `${m}分钟`
}

// 获取评分等级
function getScoreLevel(score) {
  if (score >= 90) return { text: '优秀', color: '#67c23a', bg: '#f0f9eb' }
  if (score >= 80) return { text: '良好', color: '#409eff', bg: '#ecf5ff' }
  if (score >= 70) return { text: '中等', color: '#e6a23c', bg: '#fdf6ec' }
  if (score >= 60) return { text: '及格', color: '#f56c6c', bg: '#fef0f0' }
  return { text: '需努力', color: '#909399', bg: '#f4f4f5' }
}

// 评分维度映射
const dimensionNames = {
  restoration: '还原度',
  expression: '表达力',
  structure: '结构性',
  personal_style: '个人风格',
  outline_usage: '细纲应用'
}

// 加载练习
async function loadPractice() {
  loading.value = true
  try {
    const res = await getOutlinePractice(practiceId)
    practice.value = res.data

    // 如果未提交，跳转到练习页
    if (practice.value.status !== 'submitted') {
      router.replace(`/book-analysis/practice/${practiceId}`)
    }
  } catch (error) {
    console.error('加载练习失败:', error)
    ElMessage.error('加载练习失败')
    router.push('/book-analysis')
  } finally {
    loading.value = false
  }
}

// 返回
function goBack() {
  router.push('/book-analysis')
}

// 重新练习
function retryPractice() {
  // 基于同一分析创建新练习
  router.push(`/book-analysis/result/${practice.value.chapter_id}?style=${practice.value.style_key}`)
}

// 查看历史
function viewHistory() {
  router.push('/book-analysis/history')
}

onMounted(() => {
  loadPractice()
})
</script>

<template>
  <div class="result-page" v-loading="loading">
    <!-- 顶部 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <h2>练习评审结果</h2>
    </div>

    <div class="main-content" v-if="practice">
      <!-- 成绩卡片 -->
      <div class="score-card">
        <div class="score-main">
          <div
            class="score-circle"
            :style="{ background: getScoreLevel(practice.ai_score).bg }"
          >
            <div class="score-value" :style="{ color: getScoreLevel(practice.ai_score).color }">
              {{ practice.ai_score || '-' }}
            </div>
            <div class="score-label">总分</div>
          </div>

          <div class="score-level" :style="{ color: getScoreLevel(practice.ai_score).color }">
            {{ getScoreLevel(practice.ai_score).text }}
          </div>
        </div>

        <div class="score-stats">
          <div class="stat-item">
            <el-icon><Document /></el-icon>
            <span class="stat-value">{{ practice.word_count }}</span>
            <span class="stat-label">字数</span>
          </div>
          <div class="stat-item">
            <el-icon><Timer /></el-icon>
            <span class="stat-value">{{ formatTime(practice.time_spent) }}</span>
            <span class="stat-label">用时</span>
          </div>
          <div class="stat-item">
            <span class="style-icon">{{ styleIcons[practice.style_key] }}</span>
            <span class="stat-value">{{ practice.style_key }}</span>
            <span class="stat-label">流派</span>
          </div>
        </div>

        <div class="practice-meta">
          <span>{{ practice.novel_name }}</span>
          <span>·</span>
          <span>{{ practice.chapter_title }}</span>
        </div>
      </div>

      <!-- 评审详情 -->
      <div class="evaluation-section" v-if="practice.ai_evaluation">
        <!-- 维度评分 -->
        <el-card class="dimension-card" v-if="practice.ai_evaluation.scores">
          <template #header>
            <span>📊 维度评分</span>
          </template>

          <div class="dimension-list">
            <div
              v-for="(data, key) in practice.ai_evaluation.scores"
              :key="key"
              class="dimension-item"
            >
              <div class="dimension-header">
                <span class="dimension-name">{{ dimensionNames[key] || key }}</span>
                <span
                  class="dimension-score"
                  :style="{ color: getScoreLevel(data.score).color }"
                >
                  {{ data.score }}
                </span>
              </div>
              <el-progress
                :percentage="data.score"
                :color="getScoreLevel(data.score).color"
                :stroke-width="8"
                :show-text="false"
              />
              <div class="dimension-comment">{{ data.comment }}</div>
            </div>
          </div>
        </el-card>

        <!-- 亮点与改进 -->
        <div class="feedback-row">
          <el-card class="feedback-card highlights" v-if="practice.ai_evaluation.highlights?.length">
            <template #header>
              <span>✨ 亮点</span>
            </template>
            <ul>
              <li v-for="(item, index) in practice.ai_evaluation.highlights" :key="index">
                {{ item }}
              </li>
            </ul>
          </el-card>

          <el-card class="feedback-card improvements" v-if="practice.ai_evaluation.improvements?.length">
            <template #header>
              <span>📝 改进建议</span>
            </template>
            <ul>
              <li v-for="(item, index) in practice.ai_evaluation.improvements" :key="index">
                {{ item }}
              </li>
            </ul>
          </el-card>
        </div>

        <!-- 总体评价 -->
        <el-card class="overall-card" v-if="practice.ai_evaluation.overall_comment">
          <template #header>
            <span>💬 总体评价</span>
          </template>
          <p class="overall-comment">{{ practice.ai_evaluation.overall_comment }}</p>
        </el-card>

        <!-- 与原文对比 -->
        <el-card class="comparison-card" v-if="practice.ai_evaluation.comparison_notes">
          <template #header>
            <span>📖 与原文对比</span>
          </template>
          <p class="comparison-notes">{{ practice.ai_evaluation.comparison_notes }}</p>
        </el-card>
      </div>

      <!-- 作品对比 -->
      <el-card class="content-card">
        <template #header>
          <div class="content-header">
            <span>📄 作品内容</span>
            <el-button
              type="primary"
              link
              @click="showComparison = !showComparison"
            >
              {{ showComparison ? '隐藏原文' : '对比原文' }}
            </el-button>
          </div>
        </template>

        <div :class="['content-compare', { 'show-comparison': showComparison }]">
          <div class="content-column user-content">
            <div class="column-header">我的作品（{{ practice.word_count }} 字）</div>
            <div class="column-body">{{ practice.user_content }}</div>
          </div>

          <div class="content-column original-content" v-show="showComparison">
            <div class="column-header">原文参考</div>
            <div class="column-body">{{ practice.original_content }}</div>
          </div>
        </div>
      </el-card>

      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button size="large" @click="viewHistory">查看历史</el-button>
        <el-button type="primary" size="large" @click="retryPractice">再练一次</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-page {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 成绩卡片 */
.score-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 32px;
  color: white;
  text-align: center;
}

.score-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.score-value {
  font-size: 42px;
  font-weight: 700;
}

.score-label {
  font-size: 12px;
  color: #909399;
}

.score-level {
  font-size: 18px;
  font-weight: 600;
  padding: 4px 16px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 20px;
}

.score-stats {
  display: flex;
  justify-content: center;
  gap: 48px;
  margin-bottom: 16px;
}

.score-stats .stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-stats .stat-value {
  font-size: 18px;
  font-weight: 600;
}

.score-stats .stat-label {
  font-size: 12px;
  opacity: 0.8;
}

.style-icon {
  font-size: 24px;
}

.practice-meta {
  font-size: 13px;
  opacity: 0.9;
  display: flex;
  justify-content: center;
  gap: 8px;
}

/* 评审详情 */
.evaluation-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dimension-card :deep(.el-card__body) {
  padding: 20px;
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dimension-item {
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.dimension-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dimension-name {
  font-weight: 500;
}

.dimension-score {
  font-size: 18px;
  font-weight: 600;
}

.dimension-comment {
  margin-top: 8px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.feedback-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.feedback-card ul {
  margin: 0;
  padding-left: 20px;
}

.feedback-card li {
  margin-bottom: 8px;
  line-height: 1.6;
}

.feedback-card li:last-child {
  margin-bottom: 0;
}

.highlights :deep(.el-card__header) {
  background: #f0f9eb;
  color: #67c23a;
}

.improvements :deep(.el-card__header) {
  background: #fdf6ec;
  color: #e6a23c;
}

.overall-comment,
.comparison-notes {
  margin: 0;
  line-height: 1.8;
  color: #606266;
}

/* 作品对比 */
.content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.content-compare {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  transition: all 0.3s;
}

.content-compare.show-comparison {
  grid-template-columns: 1fr 1fr;
}

.content-column {
  background: #f5f7fa;
  border-radius: 8px;
  overflow: hidden;
}

.column-header {
  padding: 12px 16px;
  font-weight: 500;
  border-bottom: 1px solid #ebeef5;
}

.user-content .column-header {
  background: #ecf5ff;
  color: #409eff;
}

.original-content .column-header {
  background: #f0f9eb;
  color: #67c23a;
}

.column-body {
  padding: 16px;
  font-size: 14px;
  line-height: 1.8;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.action-buttons .el-button {
  min-width: 140px;
}

/* 响应式 */
@media (max-width: 768px) {
  .feedback-row {
    grid-template-columns: 1fr;
  }

  .score-stats {
    gap: 24px;
  }

  .content-compare.show-comparison {
    grid-template-columns: 1fr;
  }
}
</style>
