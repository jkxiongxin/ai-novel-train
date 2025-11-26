<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { generateQuestion } from '../../api/questions'
import { createPractice } from '../../api/practices'
import { ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()

const type = computed(() => route.params.type)
const loading = ref(false)
const generating = ref(false)
const question = ref(null)
const difficulty = ref('中等')

// 关键词和一句话输入
const keywords = ref('')
const userIdea = ref('')

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

const typeName = computed(() => typeNames[type.value] || type.value)

const difficulties = ['简单', '中等', '困难']

// 章节创作需要额外参数
const chapterParams = ref({
  genre: '玄幻',
  protagonist: '',
  currentPlot: '',
  chapterGoal: '',
  targetWordCount: 3000
})

async function generate() {
  generating.value = true
  question.value = null
  
  try {
    const extraParams = type.value === 'chapter' ? chapterParams.value : {}
    
    // 添加关键词和用户想法
    if (keywords.value.trim()) {
      extraParams.keywords = keywords.value.trim()
    }
    if (userIdea.value.trim()) {
      extraParams.userIdea = userIdea.value.trim()
    }
    
    const res = await generateQuestion({
      type: type.value,
      difficulty: difficulty.value,
      extraParams
    })
    
    question.value = res.data
    ElMessage.success('题目生成成功')
  } catch (error) {
    console.error('生成题目失败:', error)
  } finally {
    generating.value = false
  }
}

async function startPractice() {
  if (!question.value) return
  
  loading.value = true
  try {
    const res = await createPractice(question.value.id)
    router.push(`/practice/${res.data.id}`)
  } catch (error) {
    console.error('创建练习失败:', error)
  } finally {
    loading.value = false
  }
}

function regenerate() {
  generate()
}
</script>

<template>
  <div class="new-practice">
    <div class="page-header">
      <el-page-header @back="$router.back()">
        <template #content>
          <span>{{ typeName }} - 生成题目</span>
        </template>
      </el-page-header>
    </div>
    
    <!-- 参数设置 -->
    <el-card class="params-card">
      <template #header>
        <span>📝 参数设置</span>
      </template>
      
      <el-form label-width="100px">
        <el-form-item label="难度选择">
          <el-radio-group v-model="difficulty">
            <el-radio-button
              v-for="d in difficulties"
              :key="d"
              :value="d"
            >
              {{ d }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="关键词">
          <el-input
            v-model="keywords"
            placeholder="输入关键词，用逗号分隔（如：修仙、门派、复仇）"
            clearable
          />
          <div class="form-tip">
            可选：提供关键词帮助AI生成更贴合你需求的题目
          </div>
        </el-form-item>
        
        <el-form-item label="一句话描述">
          <el-input
            v-model="userIdea"
            type="textarea"
            :rows="2"
            placeholder="描述你想要的题目场景或要求（如：主角在悬崖边对战仇人，需要展现复杂的心理斗争）"
          />
          <div class="form-tip">
            可选：用一句话描述你想要的特定场景、角色或情节
          </div>
        </el-form-item>
        
        <!-- 章节创作额外参数 -->
        <template v-if="type === 'chapter'">
          <el-form-item label="小说类型">
            <el-select v-model="chapterParams.genre" style="width: 200px">
              <el-option value="玄幻" />
              <el-option value="仙侠" />
              <el-option value="都市" />
              <el-option value="科幻" />
              <el-option value="历史" />
              <el-option value="言情" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="主角信息">
            <el-input
              v-model="chapterParams.protagonist"
              type="textarea"
              :rows="2"
              placeholder="描述主角的基本信息、性格、当前状态等"
            />
          </el-form-item>
          
          <el-form-item label="当前剧情">
            <el-input
              v-model="chapterParams.currentPlot"
              type="textarea"
              :rows="3"
              placeholder="描述当前的剧情背景，之前发生了什么"
            />
          </el-form-item>
          
          <el-form-item label="本章目标">
            <el-input
              v-model="chapterParams.chapterGoal"
              type="textarea"
              :rows="2"
              placeholder="本章需要达成的剧情目标"
            />
          </el-form-item>
          
          <el-form-item label="目标字数">
            <el-input-number
              v-model="chapterParams.targetWordCount"
              :min="1000"
              :max="10000"
              :step="500"
            />
          </el-form-item>
        </template>
        
        <el-form-item>
          <el-button
            type="primary"
            :loading="generating"
            @click="generate"
          >
            {{ generating ? '正在生成...' : '生成题目' }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <!-- 生成的题目 -->
    <el-card v-if="question" class="question-card">
      <template #header>
        <div class="question-header">
          <span>📋 {{ question.content?.title || question.title }}</span>
          <div>
            <el-button @click="regenerate" :loading="generating">
              重新生成
            </el-button>
            <el-button
              type="primary"
              @click="startPractice"
              :loading="loading"
            >
              开始作答
            </el-button>
          </div>
        </div>
      </template>
      
      <div class="question-content">
        <!-- 基本信息 -->
        <div class="info-row">
          <el-tag>{{ typeName }}</el-tag>
          <el-tag type="info">{{ question.difficulty }}</el-tag>
          <el-tag v-if="question.content?.wordCountRange" type="success">
            {{ question.content.wordCountRange.min }} - {{ question.content.wordCountRange.max }} 字
          </el-tag>
        </div>
        
        <!-- 背景 -->
        <div v-if="question.content?.background" class="section">
          <h4>📖 场景背景</h4>
          <p>{{ question.content.background }}</p>
        </div>
        
        <!-- 角色 -->
        <div v-if="question.content?.characters" class="section">
          <h4>👥 角色设定</h4>
          <div class="characters">
            <div
              v-for="char in question.content.characters"
              :key="char.name"
              class="character-card"
            >
              <div class="char-name">{{ char.name }}</div>
              <div class="char-info">身份: {{ char.identity }}</div>
              <div class="char-info">性格: {{ char.personality }}</div>
              <div v-if="char.currentEmotion" class="char-info">
                情绪: {{ char.currentEmotion }}
              </div>
              <div v-if="char.speakingStyle" class="char-info">
                说话风格: {{ char.speakingStyle }}
              </div>
            </div>
          </div>
        </div>
        
        <!-- 单个角色（情绪渲染等） -->
        <div v-if="question.content?.character" class="section">
          <h4>👤 角色设定</h4>
          <div class="character-card">
            <div class="char-name">{{ question.content.character.name }}</div>
            <div class="char-info">身份: {{ question.content.character.identity }}</div>
            <div class="char-info">性格: {{ question.content.character.personality }}</div>
            <div v-if="question.content.character.emotionalTrigger" class="char-info">
              情绪触发: {{ question.content.character.emotionalTrigger }}
            </div>
          </div>
        </div>
        
        <!-- 目标 -->
        <div v-if="question.content?.objective" class="section">
          <h4>🎯 目标要求</h4>
          <p>{{ question.content.objective }}</p>
        </div>
        
        <!-- 目标情绪 -->
        <div v-if="question.content?.targetEmotion" class="section">
          <h4>🎭 目标情绪</h4>
          <p>
            {{ question.content.targetEmotion }}
            <span v-if="question.content.emotionIntensity">
              (强度: {{ question.content.emotionIntensity }})
            </span>
          </p>
        </div>
        
        <!-- 约束条件 -->
        <div v-if="question.content?.constraints?.length" class="section">
          <h4>⚠️ 约束条件</h4>
          <ul>
            <li v-for="(c, i) in question.content.constraints" :key="i">{{ c }}</li>
          </ul>
        </div>
        
        <!-- 写作要求 -->
        <div v-if="question.content?.requirements?.length" class="section">
          <h4>📝 写作要求</h4>
          <ul>
            <li v-for="(r, i) in question.content.requirements" :key="i">{{ r }}</li>
          </ul>
        </div>
        
        <!-- 评审重点 -->
        <div v-if="question.content?.evaluationFocus?.length" class="section">
          <h4>🔍 评审重点</h4>
          <div class="tags">
            <el-tag
              v-for="(f, i) in question.content.evaluationFocus"
              :key="i"
              type="warning"
            >
              {{ f }}
            </el-tag>
          </div>
        </div>
        
        <!-- 提示 -->
        <div v-if="question.content?.hints?.length" class="section">
          <h4>💡 写作提示</h4>
          <ul>
            <li v-for="(h, i) in question.content.hints" :key="i">{{ h }}</li>
          </ul>
        </div>
      </div>
    </el-card>
    
    <!-- 加载状态 -->
    <el-card v-else-if="generating" class="loading-card">
      <div class="loading-content">
        <el-icon class="is-loading" :size="48"><Loading /></el-icon>
        <p>正在生成题目，请稍候...</p>
        <p class="loading-tip">AI 正在构思一道适合您的训练题</p>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.new-practice {
  max-width: 900px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.params-card {
  margin-bottom: 20px;
}

.question-card {
  margin-bottom: 20px;
}

.question-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-content {
  line-height: 1.8;
}

.info-row {
  margin-bottom: 20px;
  display: flex;
  gap: 8px;
}

.section {
  margin-bottom: 24px;
}

.section h4 {
  color: #303133;
  margin-bottom: 12px;
  font-size: 16px;
}

.section p {
  color: #606266;
  margin: 0;
}

.section ul {
  color: #606266;
  margin: 0;
  padding-left: 20px;
}

.section li {
  margin-bottom: 4px;
}

.characters {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.character-card {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
}

.char-name {
  font-weight: bold;
  color: #303133;
  margin-bottom: 8px;
  font-size: 16px;
}

.char-info {
  color: #606266;
  font-size: 14px;
  margin-bottom: 4px;
}

.tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.loading-card {
  text-align: center;
  padding: 60px 20px;
}

.loading-content p {
  margin: 16px 0 0;
  color: #606266;
}

.loading-tip {
  color: #909399 !important;
  font-size: 14px;
}

.form-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
  line-height: 1.4;
}
</style>
