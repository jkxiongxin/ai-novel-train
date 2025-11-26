<script setup>
import { ref, onMounted, computed } from 'vue'
import { getStatistics } from '../api/statistics'
import * as echarts from 'echarts'
import { useElementSize } from '@vueuse/core'

const loading = ref(true)
const statistics = ref(null)
const timeRange = ref('week')

const chartContainer1 = ref(null)
const chartContainer2 = ref(null)
const chartContainer3 = ref(null)
let chart1, chart2, chart3

const typeNames = {
  dialogue: '人物对白',
  emotion: '情绪渲染',
  battle: '战斗场景',
  psychology: '心理活动',
  environment: '环境描写',
  plot: '情节转折',
  chapter: '章节创作',
  comprehensive: '综合训练'
}

// 计算总览数据
const overview = computed(() => {
  if (!statistics.value) {
    return {
      totalPractices: 0,
      avgScore: 0,
      totalWords: 0,
      streak: 0
    }
  }
  return {
    totalPractices: statistics.value.totalPractices || 0,
    avgScore: statistics.value.avgScore || 0,
    totalWords: statistics.value.totalWords || 0,
    streak: statistics.value.streak || 0
  }
})

async function loadStatistics() {
  try {
    loading.value = true
    const res = await getStatistics({ range: timeRange.value })
    statistics.value = res.data
    
    // 更新图表
    setTimeout(() => {
      renderCharts()
    }, 100)
  } catch (error) {
    console.error('加载统计数据失败:', error)
  } finally {
    loading.value = false
  }
}

function renderCharts() {
  renderTrendChart()
  renderTypeChart()
  renderHeatmapChart()
}

function renderTrendChart() {
  if (!chartContainer1.value) return
  
  if (!chart1) {
    chart1 = echarts.init(chartContainer1.value)
  }
  
  const data = statistics.value?.trendData || []
  
  const option = {
    title: {
      text: '练习趋势',
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['练习次数', '平均分数'],
      bottom: 0
    },
    xAxis: {
      type: 'category',
      data: data.map(d => d.date)
    },
    yAxis: [
      {
        type: 'value',
        name: '次数',
        position: 'left'
      },
      {
        type: 'value',
        name: '分数',
        position: 'right',
        min: 0,
        max: 100
      }
    ],
    series: [
      {
        name: '练习次数',
        type: 'bar',
        data: data.map(d => d.count),
        itemStyle: { color: '#409EFF' }
      },
      {
        name: '平均分数',
        type: 'line',
        yAxisIndex: 1,
        data: data.map(d => d.avgScore),
        itemStyle: { color: '#67C23A' }
      }
    ]
  }
  
  chart1.setOption(option)
}

function renderTypeChart() {
  if (!chartContainer2.value) return
  
  if (!chart2) {
    chart2 = echarts.init(chartContainer2.value)
  }
  
  const data = statistics.value?.typeDistribution || []
  
  const option = {
    title: {
      text: '练习类型分布',
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center'
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: {
          show: false
        },
        data: data.map(d => ({
          name: typeNames[d.type] || d.type,
          value: d.count
        }))
      }
    ]
  }
  
  chart2.setOption(option)
}

function renderHeatmapChart() {
  if (!chartContainer3.value) return
  
  if (!chart3) {
    chart3 = echarts.init(chartContainer3.value)
  }
  
  const scoreData = statistics.value?.scoreDistribution || []
  const types = Object.keys(typeNames)
  const dimensions = ['逻辑', '文笔', '创意', '情感', '结构']
  
  // 构建雷达图数据
  const radarData = types.map(type => {
    const typeData = scoreData.find(d => d.type === type)
    return {
      name: typeNames[type],
      value: typeData ? [
        typeData.logic || 0,
        typeData.writing || 0,
        typeData.creativity || 0,
        typeData.emotion || 0,
        typeData.structure || 0
      ] : [0, 0, 0, 0, 0]
    }
  }).filter(d => d.value.some(v => v > 0))
  
  const option = {
    title: {
      text: '各维度得分',
      left: 'center',
      textStyle: { fontSize: 14 }
    },
    tooltip: {},
    legend: {
      data: radarData.map(d => d.name),
      bottom: 0
    },
    radar: {
      indicator: dimensions.map(d => ({ name: d, max: 100 })),
      center: ['50%', '55%'],
      radius: '60%'
    },
    series: [
      {
        type: 'radar',
        data: radarData
      }
    ]
  }
  
  chart3.setOption(option)
}

function handleTimeRangeChange() {
  loadStatistics()
}

// 窗口大小改变时重新渲染图表
window.addEventListener('resize', () => {
  chart1?.resize()
  chart2?.resize()
  chart3?.resize()
})

onMounted(() => {
  loadStatistics()
})
</script>

<template>
  <div class="statistics-page" v-loading="loading">
    <div class="page-header">
      <h1>练习统计</h1>
      <el-radio-group v-model="timeRange" @change="handleTimeRangeChange">
        <el-radio-button label="week">最近一周</el-radio-button>
        <el-radio-button label="month">最近一月</el-radio-button>
        <el-radio-button label="year">最近一年</el-radio-button>
        <el-radio-button label="all">全部</el-radio-button>
      </el-radio-group>
    </div>
    
    <!-- 概览卡片 -->
    <el-row :gutter="20" class="overview-cards">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ overview.totalPractices }}</div>
          <div class="stat-label">练习次数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ overview.avgScore.toFixed(1) }}</div>
          <div class="stat-label">平均分数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ (overview.totalWords / 10000).toFixed(1) }}万</div>
          <div class="stat-label">总字数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ overview.streak }}天</div>
          <div class="stat-label">连续练习</div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <el-col :span="24">
        <el-card>
          <div ref="chartContainer1" class="chart-container tall"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" class="chart-row">
      <el-col :span="12">
        <el-card>
          <div ref="chartContainer2" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <div ref="chartContainer3" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 最近练习 -->
    <el-card class="recent-practices">
      <template #header>
        <span>最近练习记录</span>
      </template>
      
      <el-table :data="statistics?.recentPractices || []">
        <el-table-column prop="question_title" label="题目" />
        <el-table-column prop="type" label="类型">
          <template #default="{ row }">
            {{ typeNames[row.type] || row.type }}
          </template>
        </el-table-column>
        <el-table-column prop="word_count" label="字数" width="100" />
        <el-table-column prop="total_score" label="得分" width="100">
          <template #default="{ row }">
            <el-tag :type="row.total_score >= 80 ? 'success' : row.total_score >= 60 ? '' : 'warning'">
              {{ row.total_score }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
    </el-card>
  </div>
</template>

<style scoped>
.statistics-page {
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

.overview-cards {
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
}

.stat-value {
  font-size: 36px;
  font-weight: 600;
  color: #409EFF;
  margin-bottom: 8px;
}

.stat-label {
  color: #909399;
  font-size: 14px;
}

.chart-row {
  margin-bottom: 20px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.chart-container.tall {
  height: 350px;
}

.recent-practices {
  margin-top: 24px;
}
</style>
