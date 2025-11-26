<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

const questionTypes = [
  { 
    type: 'dialogue', 
    name: '人物对白', 
    icon: '💬', 
    color: '#409eff',
    description: '训练角色对话写作能力，包括语气、性格体现、潜台词等'
  },
  { 
    type: 'emotion', 
    name: '情绪渲染', 
    icon: '❤️', 
    color: '#f56c6c',
    description: '训练通过文字传达情绪氛围的能力'
  },
  { 
    type: 'battle', 
    name: '战斗场景', 
    icon: '⚔️', 
    color: '#e6a23c',
    description: '训练动作场面、打斗描写的能力'
  },
  { 
    type: 'psychology', 
    name: '心理活动', 
    icon: '🧠', 
    color: '#909399',
    description: '训练角色内心独白、心理描写能力'
  },
  { 
    type: 'environment', 
    name: '环境描写', 
    icon: '🌄', 
    color: '#67c23a',
    description: '训练场景、环境、氛围描写能力'
  },
  { 
    type: 'plot', 
    name: '情节转折', 
    icon: '🔄', 
    color: '#9c27b0',
    description: '训练设计和呈现情节转折的能力'
  },
  { 
    type: 'chapter', 
    name: '章节创作', 
    icon: '📖', 
    color: '#ff9800',
    description: '基于细纲完成完整章节创作'
  },
  { 
    type: 'comprehensive', 
    name: '综合训练', 
    icon: '⭐', 
    color: '#2196f3',
    description: '融合多种元素的综合写作训练'
  }
]

function startPractice(type) {
  router.push(`/practice/new/${type}`)
}
</script>

<template>
  <div class="practice-index">
    <div class="page-header">
      <h1>选择练习类型</h1>
      <p>选择一个训练类型，开始你的写作练习之旅</p>
    </div>
    
    <div class="type-grid">
      <el-card
        v-for="item in questionTypes"
        :key="item.type"
        class="type-card"
        shadow="hover"
        @click="startPractice(item.type)"
      >
        <div class="type-header">
          <div class="type-icon" :style="{ background: item.color }">
            {{ item.icon }}
          </div>
          <h3>{{ item.name }}</h3>
        </div>
        <p class="type-desc">{{ item.description }}</p>
        <el-button type="primary" plain class="start-btn">
          开始练习
        </el-button>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.practice-index {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 32px;
}

.page-header h1 {
  font-size: 28px;
  color: #303133;
  margin-bottom: 8px;
}

.page-header p {
  color: #909399;
  font-size: 16px;
}

.type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.type-card {
  cursor: pointer;
  transition: all 0.3s;
}

.type-card:hover {
  transform: translateY(-4px);
}

.type-card :deep(.el-card__body) {
  padding: 24px;
}

.type-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.type-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 16px;
}

.type-header h3 {
  font-size: 18px;
  color: #303133;
  margin: 0;
}

.type-desc {
  color: #606266;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
  min-height: 44px;
}

.start-btn {
  width: 100%;
}
</style>
