<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getEvaluationDetail } from '../api/evaluations'
import * as echarts from 'echarts'

const route = useRoute()
const router = useRouter()

const evaluationId = computed(() => route.params.id)
const loading = ref(true)
const evaluation = ref(null)

// 评级颜色
const gradeColors = {
  'S': '#ff4081',
  'A': '#7c4dff',
  'B': '#448aff',
  'C': '#69f0ae',
  'D': '#ffd740'
}

// 初始化雷达图
function initRadarChart() {
  if (!evaluation.value?.dimensions) return
  
  const chartDom = document.getElementById('radar-chart')
  if (!chartDom) return
  
  const chart = echarts.init(chartDom)
  
  const dimensions = evaluation.value.dimensions
  const dimensionNames = {
    completion: '完成度',
    writing: '文笔表现',
    technique: '技巧运用',
    creativity: '创意表现',
    overall: '整体效果',
    naturalness: '对白自然度',
    characterization: '角色区分度',
    subtext: '潜台词运用',
    emotion: '情感传达',
    narrative: '叙事推进',
    accuracy: '情绪准确度',
    impact: '感染力',
    layers: '层次感',
    balance: '克制与表达',
    action: '动作描写',
    pacing: '节奏把控',
    visualization: '画面感',
    tension: '紧张感',
    logic: '战斗逻辑',
    execution: '细纲执行度',
    flow: '情节流畅度',
    climax: '高潮设计',
    structure: '开篇与结尾'
  }
  
  const indicator = []
  const data = []
  
  Object.entries(dimensions).forEach(([key, value]) => {
    if (value && typeof value.score === 'number') {
      indicator.push({
        name: dimensionNames[key] || key,
        max: 20
      })
      data.push(value.score)
    }
  })
  
  chart.setOption({
    radar: {
      indicator,
      radius: '65%'
    },
    series: [{
      type: 'radar',
      data: [{
        value: data,
        name: '得分',
        areaStyle: {
          color: 'rgba(64, 158, 255, 0.3)'
        },
        lineStyle: {
          color: '#409eff'
        },
        itemStyle: {
          color: '#409eff'
        }
      }]
    }]
  })
}

async function loadEvaluation() {
  try {
    loading.value = true
    const res = await getEvaluationDetail(evaluationId.value)
    evaluation.value = res.data
    
    // 等待 DOM 更新后初始化图表
    setTimeout(() => {
      initRadarChart()
    }, 100)
  } catch (error) {
    console.error('加载评审失败:', error)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/history')
}

function redoPractice() {
  if (evaluation.value?.question_content) {
    // 重新开始同类练习
    router.push(`/practice/new/${evaluation.value.question_type}`)
  }
}

onMounted(() => {
  loadEvaluation()
})
</script>

<template>
  <div class="evaluation-page" v-loading="loading">
    <div class="page-header">
      <el-page-header @back="goBack">
        <template #content>
          <span>评审结果</span>
        </template>
      </el-page-header>
    </div>
    
    <template v-if="evaluation">
      <!-- 总分展示 -->
      <el-card class="score-card">
        <div class="score-display">
          <div class="total-score">
            <div class="score-value">{{ evaluation.total_score }}</div>
            <div class="score-label">总分</div>
          </div>
          
          <div
            class="grade-badge"
            :style="{ background: gradeColors[evaluation.dimensions?.grade] || '#909399' }"
          >
            {{ evaluation.dimensions?.grade || '-' }}
          </div>
          
          <div class="score-meta">
            <div>题目: {{ evaluation.question_title }}</div>
            <div>类型: {{ evaluation.question_type }} | 难度: {{ evaluation.difficulty }}</div>
            <div>字数: {{ evaluation.word_count }} | 用时: {{ Math.round(evaluation.time_spent / 60) }}分钟</div>
          </div>
        </div>
      </el-card>
      
      <!-- 雷达图和维度详情 -->
      <div class="detail-grid">
        <el-card class="radar-card">
          <template #header>
            <span>📊 能力分布</span>
          </template>
          <div id="radar-chart" style="width: 100%; height: 300px;"></div>
        </el-card>
        
        <el-card class="dimensions-card">
          <template #header>
            <span>📝 维度评价</span>
          </template>
          <div class="dimensions-list">
            <div
              v-for="(value, key) in evaluation.dimensions"
              :key="key"
              class="dimension-item"
              v-if="value && typeof value.score === 'number'"
            >
              <div class="dim-header">
                <span class="dim-name">{{ key }}</span>
                <span class="dim-score">{{ value.score }}/20</span>
              </div>
              <el-progress
                :percentage="value.score * 5"
                :stroke-width="8"
                :color="value.score >= 16 ? '#67c23a' : value.score >= 12 ? '#409eff' : value.score >= 8 ? '#e6a23c' : '#f56c6c'"
              />
              <p class="dim-comment">{{ value.comment }}</p>
            </div>
          </div>
        </el-card>
      </div>
      
      <!-- 亮点和改进建议 -->
      <div class="feedback-grid">
        <el-card class="highlights-card">
          <template #header>
            <span>✨ 亮点</span>
          </template>
          <ul class="highlight-list">
            <li v-for="(h, i) in evaluation.highlights" :key="i">{{ h }}</li>
          </ul>
          <el-empty v-if="!evaluation.highlights?.length" description="暂无亮点" />
        </el-card>
        
        <el-card class="improvements-card">
          <template #header>
            <span>📈 改进建议</span>
          </template>
          <div class="improvement-list">
            <div
              v-for="(item, i) in evaluation.improvements"
              :key="i"
              class="improvement-item"
            >
              <div class="imp-issue">
                <el-icon><Warning /></el-icon>
                {{ typeof item === 'string' ? item : item.issue }}
              </div>
              <div v-if="item.suggestion" class="imp-suggestion">
                <el-icon><InfoFilled /></el-icon>
                {{ item.suggestion }}
              </div>
              <div v-if="item.example" class="imp-example">
                <el-icon><Edit /></el-icon>
                示例: {{ item.example }}
              </div>
            </div>
          </div>
          <el-empty v-if="!evaluation.improvements?.length" description="暂无改进建议" />
        </el-card>
      </div>
      
      <!-- 总评 -->
      <el-card class="overall-card">
        <template #header>
          <span>💬 总体评价</span>
        </template>
        <p class="overall-comment">{{ evaluation.overall_comment }}</p>
        
        <div v-if="evaluation.rewrite_suggestion" class="rewrite-section">
          <h4>改写建议</h4>
          <p>{{ evaluation.rewrite_suggestion }}</p>
        </div>
      </el-card>
      
      <!-- 操作按钮 -->
      <div class="actions">
        <el-button @click="goBack">返回历史</el-button>
        <el-button type="primary" @click="redoPractice">
          再来一题
        </el-button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.evaluation-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.score-card {
  margin-bottom: 20px;
}

.score-display {
  display: flex;
  align-items: center;
  gap: 32px;
}

.total-score {
  text-align: center;
}

.score-value {
  font-size: 64px;
  font-weight: bold;
  color: #409eff;
  line-height: 1;
}

.score-label {
  color: #909399;
  margin-top: 8px;
}

.grade-badge {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  color: #fff;
}

.score-meta {
  flex: 1;
  color: #606266;
  line-height: 1.8;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

.dimensions-list {
  max-height: 300px;
  overflow-y: auto;
}

.dimension-item {
  margin-bottom: 20px;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.dim-name {
  font-weight: 500;
  color: #303133;
}

.dim-score {
  color: #409eff;
  font-weight: 500;
}

.dim-comment {
  color: #606266;
  font-size: 13px;
  margin-top: 8px;
  line-height: 1.6;
}

.feedback-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .feedback-grid {
    grid-template-columns: 1fr;
  }
}

.highlight-list {
  margin: 0;
  padding-left: 20px;
  color: #67c23a;
}

.highlight-list li {
  margin-bottom: 8px;
  line-height: 1.6;
}

.improvement-item {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.improvement-item:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.imp-issue {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #f56c6c;
  margin-bottom: 8px;
}

.imp-suggestion {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #409eff;
  margin-bottom: 8px;
  padding-left: 24px;
}

.imp-example {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: #67c23a;
  padding-left: 24px;
  font-style: italic;
}

.overall-card {
  margin-bottom: 20px;
}

.overall-comment {
  color: #303133;
  line-height: 2;
  font-size: 15px;
}

.rewrite-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.rewrite-section h4 {
  color: #303133;
  margin-bottom: 12px;
}

.rewrite-section p {
  color: #606266;
  line-height: 1.8;
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
}

.actions {
  display: flex;
  justify-content: center;
  gap: 16px;
}
</style>
