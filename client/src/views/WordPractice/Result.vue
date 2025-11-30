<script setup>
/**
 * 词汇练习 - 练习结果页面
 * 展示练习成绩、题目回顾、AI反馈
 */
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { 
  ArrowLeft, 
  Check, 
  Close,
  Trophy,
  Warning,
  Clock
} from '@element-plus/icons-vue'
import { getPracticeResult } from '../../api/wordPractice'

const router = useRouter()
const route = useRoute()

// 状态
const loading = ref(false)
const result = ref(null)
const questions = ref([])
const activeTab = ref('overview')

// 正确率
const accuracy = computed(() => {
  if (!result.value || result.value.total_questions === 0) return 0
  return Math.round((result.value.correct_count / result.value.total_questions) * 100)
})

// 评价等级
const grade = computed(() => {
  const acc = accuracy.value
  if (acc >= 90) return { text: '优秀', emoji: '🏆', color: '#67c23a' }
  if (acc >= 70) return { text: '良好', emoji: '👍', color: '#409eff' }
  if (acc >= 60) return { text: '及格', emoji: '💪', color: '#e6a23c' }
  return { text: '需努力', emoji: '📚', color: '#f56c6c' }
})

// 按题型分组
const questionsByType = computed(() => {
  return {
    choice: questions.value.filter(q => q.question_type === 'choice'),
    fill: questions.value.filter(q => q.question_type === 'fill'),
    sentence: questions.value.filter(q => q.question_type === 'sentence')
  }
})

// 错题列表（未作答或回答错误的都算错题）
const wrongQuestions = computed(() => {
  return questions.value.filter(q => q.is_correct !== 1)
})

// 每题满分（100/总题数）
const scorePerQuestion = computed(() => {
  if (!result.value || result.value.total_questions === 0) return 100
  return Math.round(100 / result.value.total_questions * 10) / 10
})

// 加载结果
async function loadResult() {
  loading.value = true
  try {
    const res = await getPracticeResult(route.params.id)
    if (res.success) {
      result.value = res.data
      questions.value = res.data.questions || []
    } else {
      ElMessage.error(res.message || '加载失败')
    }
  } catch (error) {
    console.error('加载结果失败:', error)
    ElMessage.error('加载结果失败')
  } finally {
    loading.value = false
  }
}

// 格式化时间
function formatDuration(seconds) {
  if (!seconds) return '0秒'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}分${secs}秒`
  }
  return `${secs}秒`
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

// 获取选项字母
function getOptionLetter(index) {
  return String.fromCharCode(65 + index)
}

// 再来一次
function tryAgain() {
  router.push('/word-practice/new')
}

// 返回
function goBack() {
  router.push('/word-practice')
}

// 查看错题集
function viewMistakes() {
  router.push('/word-practice/mistakes')
}

onMounted(() => {
  loadResult()
})
</script>

<template>
  <div class="result-page" v-loading="loading">
    <div class="page-header">
      <el-button text @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </el-button>
    </div>
    
    <div v-if="result" class="result-content">
      <!-- 成绩卡片 -->
      <div class="score-card" :style="{ borderColor: grade.color }">
        <div class="score-emoji">{{ grade.emoji }}</div>
        <div class="score-main">
          <div class="score-value" :style="{ color: grade.color }">
            {{ Math.round(result.avg_score) }}
          </div>
          <div class="score-label">平均分</div>
        </div>
        <div class="score-grade" :style="{ color: grade.color }">
          {{ grade.text }}
        </div>
      </div>
      
      <!-- 统计概览 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon" style="background: #409eff20; color: #409eff;">
              <el-icon><Trophy /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ result.correct_count }}/{{ result.total_questions }}</div>
              <div class="stat-label">正确数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon" style="background: #67c23a20; color: #67c23a;">
              <el-icon><Check /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ accuracy }}%</div>
              <div class="stat-label">正确率</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon" style="background: #f56c6c20; color: #f56c6c;">
              <el-icon><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ result.wrong_count }}</div>
              <div class="stat-label">错误数</div>
            </div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-icon" style="background: #e6a23c20; color: #e6a23c;">
              <el-icon><Clock /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ formatDuration(result.time_spent) }}</div>
              <div class="stat-label">用时</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <!-- 分题型统计 -->
      <el-card class="type-stats-card">
        <template #header>📊 分题型统计</template>
        <div class="type-stats">
          <div class="type-item">
            <span class="type-name">选择题</span>
            <el-progress 
              :percentage="result.choice_total > 0 ? Math.round(result.choice_correct / result.choice_total * 100) : 0"
              :stroke-width="20"
              :text-inside="true"
            />
            <span class="type-score">{{ result.choice_correct }}/{{ result.choice_total }}</span>
          </div>
          <div class="type-item">
            <span class="type-name">填空题</span>
            <el-progress 
              :percentage="result.fill_total > 0 ? Math.round(result.fill_correct / result.fill_total * 100) : 0"
              :stroke-width="20"
              :text-inside="true"
              status="warning"
            />
            <span class="type-score">{{ result.fill_correct }}/{{ result.fill_total }}</span>
          </div>
          <div class="type-item">
            <span class="type-name">造句题</span>
            <el-progress 
              :percentage="result.sentence_total > 0 ? Math.round(result.sentence_correct / result.sentence_total * 100) : 0"
              :stroke-width="20"
              :text-inside="true"
              status="exception"
            />
            <span class="type-score">{{ result.sentence_correct }}/{{ result.sentence_total }}</span>
          </div>
        </div>
      </el-card>
      
      <!-- AI总结 -->
      <el-card v-if="result.ai_summary" class="ai-summary-card">
        <template #header>🤖 AI 学习建议</template>
        <p class="ai-summary">{{ result.ai_summary }}</p>
      </el-card>
      
      <!-- 题目回顾 -->
      <el-card class="questions-card">
        <template #header>
          <div class="questions-header">
            <span>📝 题目回顾</span>
            <el-radio-group v-model="activeTab" size="small">
              <el-radio-button label="all">全部</el-radio-button>
              <el-radio-button label="wrong">
                错题 ({{ wrongQuestions.length }})
              </el-radio-button>
            </el-radio-group>
          </div>
        </template>
        
        <div class="questions-list">
          <div 
            v-for="(q, index) in (activeTab === 'wrong' ? wrongQuestions : questions)" 
            :key="q.id"
            class="question-item"
            :class="{ 'correct': q.is_correct === 1, 'wrong': q.is_correct !== 1 }"
          >
            <div class="question-header">
              <div class="question-info">
                <el-tag :type="q.is_correct === 1 ? 'success' : 'danger'" size="small">
                  {{ q.is_correct === 1 ? '正确' : (q.user_answer ? '错误' : '未作答') }}
                </el-tag>
                <el-tag type="info" size="small">{{ getTypeName(q.question_type) }}</el-tag>
                <span class="question-word">{{ q.word }}</span>
              </div>
              <span class="question-score">{{ Math.round((q.score || 0) / 100 * scorePerQuestion * 10) / 10 }}/{{ scorePerQuestion }}分</span>
            </div>
            
            <div class="question-content">
              <p class="question-text">{{ q.question_content }}</p>
              
              <!-- 选择题选项 -->
              <div v-if="q.question_type === 'choice' && q.options" class="options-list">
                <div 
                  v-for="(opt, i) in q.options" 
                  :key="i"
                  class="option-item"
                  :class="{
                    'selected': q.user_answer === opt,
                    'correct-answer': q.correct_answer === opt,
                    'wrong-answer': q.user_answer === opt && q.is_correct !== 1
                  }"
                >
                  {{ getOptionLetter(i) }}. {{ opt }}
                  <el-icon v-if="q.correct_answer === opt" class="correct-icon"><Check /></el-icon>
                  <el-icon v-if="q.user_answer === opt && q.is_correct === 0" class="wrong-icon"><Close /></el-icon>
                </div>
              </div>
              
              <!-- 填空/造句答案 -->
              <div v-else class="answer-display">
                <div class="user-answer">
                  <label>你的答案：</label>
                  <span :class="{ 'wrong': q.is_correct === 0 }">{{ q.user_answer || '未作答' }}</span>
                </div>
                <div class="correct-answer" v-if="q.is_correct === 0 && q.correct_answer">
                  <label>正确答案：</label>
                  <span>{{ q.correct_answer }}</span>
                </div>
              </div>
              
              <!-- AI反馈（造句题） -->
              <div v-if="q.ai_feedback" class="ai-feedback">
                <label>AI 反馈：</label>
                <p>{{ q.ai_feedback.feedback }}</p>
                <div v-if="q.ai_feedback.correction" class="correction">
                  <label>修改建议：</label>
                  <p>{{ q.ai_feedback.correction }}</p>
                </div>
                <div v-if="q.ai_feedback.highlights?.length" class="highlights">
                  <el-tag v-for="h in q.ai_feedback.highlights" :key="h" type="success" size="small">
                    {{ h }}
                  </el-tag>
                </div>
                <div v-if="q.ai_feedback.issues?.length" class="issues">
                  <el-tag v-for="issue in q.ai_feedback.issues" :key="issue" type="danger" size="small">
                    {{ issue }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-card>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button @click="goBack">返回首页</el-button>
        <el-button v-if="wrongQuestions.length > 0" @click="viewMistakes">
          查看错题集
        </el-button>
        <el-button type="primary" @click="tryAgain">再来一次</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.score-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 40px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border: 3px solid #67c23a;
}

.score-emoji {
  font-size: 64px;
}

.score-main {
  text-align: center;
}

.score-value {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
}

.score-label {
  color: #909399;
  font-size: 16px;
  margin-top: 8px;
}

.score-grade {
  font-size: 28px;
  font-weight: 600;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
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

.stat-info .stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stat-info .stat-label {
  font-size: 13px;
  color: #909399;
}

.type-stats-card {
  margin-bottom: 24px;
}

.type-stats {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.type-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.type-name {
  width: 80px;
  font-weight: 500;
  color: #303133;
}

.type-item .el-progress {
  flex: 1;
}

.type-score {
  width: 60px;
  text-align: right;
  color: #909399;
}

.ai-summary-card {
  margin-bottom: 24px;
}

.ai-summary {
  margin: 0;
  color: #606266;
  line-height: 1.8;
}

.questions-card {
  margin-bottom: 24px;
}

.questions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-item {
  border: 1px solid #ebeef5;
  border-radius: 12px;
  padding: 16px;
  transition: all 0.3s;
}

.question-item.correct {
  border-color: #67c23a;
  background: #f0f9eb;
}

.question-item.wrong {
  border-color: #f56c6c;
  background: #fef0f0;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.question-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-word {
  color: #409eff;
  font-weight: 500;
}

.question-score {
  font-weight: 600;
  color: #303133;
}

.question-text {
  margin: 0 0 12px 0;
  color: #303133;
  font-size: 15px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  padding: 10px 14px;
  background: white;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-item.correct-answer {
  background: #e1f3d8;
  color: #67c23a;
  font-weight: 500;
}

.option-item.wrong-answer {
  background: #fde2e2;
  color: #f56c6c;
  text-decoration: line-through;
}

.correct-icon {
  color: #67c23a;
  margin-left: auto;
}

.wrong-icon {
  color: #f56c6c;
  margin-left: auto;
}

.answer-display {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-answer, .correct-answer {
  display: flex;
  gap: 8px;
}

.user-answer label, .correct-answer label {
  color: #909399;
  flex-shrink: 0;
}

.user-answer span.wrong {
  color: #f56c6c;
  text-decoration: line-through;
}

.correct-answer span {
  color: #67c23a;
  font-weight: 500;
}

.ai-feedback {
  margin-top: 12px;
  padding: 12px;
  background: white;
  border-radius: 8px;
}

.ai-feedback label {
  color: #909399;
  font-size: 13px;
}

.ai-feedback p {
  margin: 4px 0 0 0;
  color: #606266;
}

.correction {
  margin-top: 8px;
}

.highlights, .issues {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}
</style>
