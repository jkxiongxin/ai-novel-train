<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Trophy, Timer, Document } from '@element-plus/icons-vue'
import { getMaskPractice, deleteOutlinePractice } from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const practice = ref(null)

const practiceId = route.params.practiceId

// 解析段落
const paragraphs = computed(() => {
  if (!practice.value || !practice.value.original_content) return []
  return String(practice.value.original_content)
    .split(/\r?\n/)
    .map((p, i) => ({ index: i + 1, text: p.trim() }))
    .filter(p => p.text.length > 0)
})

// 遮蔽块列表
const maskedBlocks = computed(() => {
  return practice.value?.masked_blocks || []
})

// AI 评价
const evaluation = computed(() => {
  return practice.value?.ai_evaluation || {}
})

// 各块评价
const blockEvaluations = computed(() => {
  return evaluation.value.blocks || []
})

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

// 获取评分等级颜色
function getScoreColor(score) {
  if (score >= 90) return '#67c23a'
  if (score >= 80) return '#409eff'
  if (score >= 70) return '#e6a23c'
  if (score >= 60) return '#f56c6c'
  return '#909399'
}

// 获取评分等级
function getScoreGrade(score) {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

// 获取遮蔽块的原文
function getBlockOriginalText(blockIndex) {
  const block = maskedBlocks.value[blockIndex]
  if (!block) return ''
  const startIdx = block.paragraph_start - 1
  const endIdx = block.paragraph_end
  return paragraphs.value.slice(startIdx, endIdx).map(p => p.text).join('\n')
}

// 获取用户作品
function getUserContent(blockIndex) {
  if (!practice.value?.user_content) return ''
  return practice.value.user_content[blockIndex] || ''
}

// 加载数据
async function loadData() {
  loading.value = true
  try {
    const res = await getMaskPractice(practiceId)
    practice.value = res.data

    if (practice.value.status !== 'submitted') {
      // 未提交，跳转回练习页
      router.replace(`/book-analysis/mask-practice/${practiceId}`)
      return
    }
  } catch (error) {
    console.error('加载练习结果失败:', error)
    ElMessage.error('加载练习结果失败')
    router.push('/book-analysis')
  } finally {
    loading.value = false
  }
}

// 再来一次
function tryAgain() {
  router.push(`/book-analysis/result/${practice.value.chapter_id}?style=${practice.value.style_key}`)
}

// 返回首页
function goHome() {
  router.push('/book-analysis')
}

// 查看历史
function viewHistory() {
  router.push('/book-analysis/history')
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="mask-result-page" v-loading="loading">
    <!-- 顶部导航 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goHome">返回首页</el-button>
      <div class="header-title">
        <h2>🎭 遮蔽练习结果</h2>
        <span class="chapter-info" v-if="practice">
          {{ practice.novel_name }} · {{ practice.chapter_title }}
        </span>
      </div>
      <div class="header-actions">
        <el-button @click="viewHistory">查看历史</el-button>
        <el-button type="primary" @click="tryAgain">再来一次</el-button>
      </div>
    </div>

    <!-- 总体评分卡片 -->
    <div class="score-overview" v-if="evaluation">
      <div class="score-main">
        <div class="score-circle" :style="{ borderColor: getScoreColor(evaluation.total_score || 0) }">
          <span class="score-value">{{ evaluation.total_score || 0 }}</span>
          <span class="score-grade" :style="{ color: getScoreColor(evaluation.total_score || 0) }">
            {{ getScoreGrade(evaluation.total_score || 0) }}
          </span>
        </div>
        <div class="score-label">综合得分</div>
      </div>

      <div class="score-stats">
        <div class="stat-item">
          <el-icon><Timer /></el-icon>
          <span class="stat-label">用时</span>
          <span class="stat-value">{{ formatTime(practice?.time_spent) }}</span>
        </div>
        <div class="stat-item">
          <el-icon><Document /></el-icon>
          <span class="stat-label">字数</span>
          <span class="stat-value">{{ practice?.word_count || 0 }} 字</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">🎭 遮蔽块</span>
          <span class="stat-value">{{ maskedBlocks.length }} 个</span>
        </div>
      </div>

      <div class="overall-comment" v-if="evaluation.overall_comment">
        <h4>📝 总体评价</h4>
        <p>{{ evaluation.overall_comment }}</p>
      </div>
    </div>

    <!-- 各块评价详情 -->
    <div class="blocks-detail">
      <h3>📋 分块评价详情</h3>

      <div 
        v-for="(block, idx) in maskedBlocks" 
        :key="idx" 
        class="block-result-card"
      >
        <div class="block-header">
          <div class="block-number">{{ idx + 1 }}</div>
          <div class="block-info">
            <span class="block-range">P{{ block.paragraph_start }}-P{{ block.paragraph_end }}</span>
            <el-tag 
              v-if="blockEvaluations[idx]" 
              :color="getScoreColor(blockEvaluations[idx]?.block_score || 0)"
              effect="dark"
              size="small"
            >
              {{ blockEvaluations[idx]?.block_score || 0 }} 分
            </el-tag>
          </div>
        </div>

        <div class="block-hint" v-if="block.outline_hint">
          <span class="hint-label">📋 细纲提示：</span>
          {{ block.outline_hint }}
        </div>

        <div class="comparison-section">
          <div class="comparison-item user-content">
            <div class="comparison-label">✍️ 你的作品</div>
            <div class="comparison-text">{{ getUserContent(idx) || '（未填写）' }}</div>
          </div>
          <div class="comparison-item original-content">
            <div class="comparison-label">📖 原文</div>
            <div class="comparison-text">{{ getBlockOriginalText(idx) }}</div>
          </div>
        </div>

        <!-- 各维度评分 -->
        <div class="dimension-scores" v-if="blockEvaluations[idx]?.scores">
          <div class="dimension-item" v-if="blockEvaluations[idx].scores.restoration">
            <div class="dimension-header">
              <span class="dimension-name">还原度</span>
              <span class="dimension-score" :style="{ color: getScoreColor(blockEvaluations[idx].scores.restoration.score) }">
                {{ blockEvaluations[idx].scores.restoration.score }} 分
              </span>
            </div>
            <p class="dimension-comment">{{ blockEvaluations[idx].scores.restoration.comment }}</p>
          </div>

          <div class="dimension-item" v-if="blockEvaluations[idx].scores.expression">
            <div class="dimension-header">
              <span class="dimension-name">表达力</span>
              <span class="dimension-score" :style="{ color: getScoreColor(blockEvaluations[idx].scores.expression.score) }">
                {{ blockEvaluations[idx].scores.expression.score }} 分
              </span>
            </div>
            <p class="dimension-comment">{{ blockEvaluations[idx].scores.expression.comment }}</p>
          </div>

          <div class="dimension-item" v-if="blockEvaluations[idx].scores.coherence">
            <div class="dimension-header">
              <span class="dimension-name">连贯性</span>
              <span class="dimension-score" :style="{ color: getScoreColor(blockEvaluations[idx].scores.coherence.score) }">
                {{ blockEvaluations[idx].scores.coherence.score }} 分
              </span>
            </div>
            <p class="dimension-comment">{{ blockEvaluations[idx].scores.coherence.comment }}</p>
          </div>
        </div>

        <!-- 亮点和改进 -->
        <div class="feedback-section" v-if="blockEvaluations[idx]">
          <div class="feedback-item highlights" v-if="blockEvaluations[idx].highlights?.length">
            <span class="feedback-label">✨ 亮点：</span>
            <span v-for="(h, i) in blockEvaluations[idx].highlights" :key="i">
              {{ h }}{{ i < blockEvaluations[idx].highlights.length - 1 ? '；' : '' }}
            </span>
          </div>
          <div class="feedback-item improvements" v-if="blockEvaluations[idx].improvements?.length">
            <span class="feedback-label">💡 建议：</span>
            <span v-for="(imp, i) in blockEvaluations[idx].improvements" :key="i">
              {{ imp }}{{ i < blockEvaluations[idx].improvements.length - 1 ? '；' : '' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask-result-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  min-height: 100vh;
  background: #f5f7fa;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.header-title {
  flex: 1;
}

.header-title h2 {
  margin: 0 0 4px 0;
  font-size: 20px;
}

.chapter-info {
  font-size: 13px;
  color: #909399;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* 总体评分 */
.score-overview {
  background: white;
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
  display: flex;
  flex-wrap: wrap;
  gap: 30px;
  align-items: center;
}

.score-main {
  text-align: center;
}

.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: 6px solid #67c23a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto 10px;
}

.score-value {
  font-size: 36px;
  font-weight: 700;
  color: #303133;
}

.score-grade {
  font-size: 20px;
  font-weight: 600;
}

.score-label {
  font-size: 14px;
  color: #909399;
}

.score-stats {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.score-stats .stat-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}

.stat-value {
  font-weight: 600;
  color: #303133;
}

.overall-comment {
  flex: 1;
  min-width: 300px;
  background: #f5f7fa;
  padding: 20px;
  border-radius: 12px;
}

.overall-comment h4 {
  margin: 0 0 10px 0;
  font-size: 15px;
}

.overall-comment p {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #606266;
}

/* 分块评价 */
.blocks-detail {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}

.blocks-detail h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
}

.block-result-card {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  background: #fafbfc;
}

.block-result-card:last-child {
  margin-bottom: 0;
}

.block-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.block-number {
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.block-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.block-range {
  font-weight: 600;
  color: #303133;
}

.block-hint {
  background: #fffbf0;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  border-left: 3px solid #e6a23c;
}

.hint-label {
  color: #e6a23c;
  font-weight: 500;
}

/* 对比区域 */
.comparison-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.comparison-item {
  padding: 16px;
  border-radius: 8px;
}

.user-content {
  background: #e8f4ff;
  border-left: 3px solid #409eff;
}

.original-content {
  background: #f0f9eb;
  border-left: 3px solid #67c23a;
}

.comparison-label {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.user-content .comparison-label {
  color: #409eff;
}

.original-content .comparison-label {
  color: #67c23a;
}

.comparison-text {
  font-size: 14px;
  line-height: 1.7;
  color: #303133;
  white-space: pre-wrap;
}

/* 维度评分 */
.dimension-scores {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.dimension-item {
  background: white;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
}

.dimension-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.dimension-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}

.dimension-score {
  font-weight: 700;
}

.dimension-comment {
  margin: 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

/* 反馈 */
.feedback-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feedback-item {
  font-size: 13px;
  line-height: 1.6;
}

.feedback-label {
  font-weight: 500;
}

.highlights .feedback-label {
  color: #67c23a;
}

.improvements .feedback-label {
  color: #e6a23c;
}

/* 响应式 */
@media (max-width: 768px) {
  .score-overview {
    flex-direction: column;
  }

  .comparison-section {
    grid-template-columns: 1fr;
  }

  .dimension-scores {
    grid-template-columns: 1fr;
  }
}
</style>
