<script setup>
import { ref, onMounted } from 'vue'
import { getPrompts, updatePrompt, resetPrompt, testPrompt } from '../api/prompts'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(true)
const prompts = ref([])
const activeTab = ref('generator')
const editDialogVisible = ref(false)
const testDialogVisible = ref(false)
const currentPrompt = ref(null)
const editContent = ref('')
const testVariables = ref({})
const testResult = ref(null)
const testing = ref(false)
const saving = ref(false)

const categoryNames = {
  generator: '题目生成器',
  evaluator: '评审模板',
  dictionary: 'AI 词典'
}

const typeNames = {
  dialogue: '人物对白',
  emotion: '情绪渲染',
  battle: '战斗场景',
  psychology: '心理活动',
  environment: '环境描写',
  plot: '情节转折',
  chapter: '章节创作',
  comprehensive: '综合训练',
  general: '通用评审',
  freewrite: '随心练习评审',
  search: 'AI 查词',
  generate: 'AI 生成词典'
}

async function loadPrompts() {
  try {
    loading.value = true
    const res = await getPrompts({ category: activeTab.value })
    prompts.value = res.data
  } catch (error) {
    console.error('加载 Prompt 列表失败:', error)
  } finally {
    loading.value = false
  }
}

function handleTabChange() {
  loadPrompts()
}

function editPrompt(prompt) {
  currentPrompt.value = prompt
  editContent.value = prompt.content
  editDialogVisible.value = true
}

async function savePrompt() {
  try {
    saving.value = true
    await updatePrompt(currentPrompt.value.id, {
      content: editContent.value
    })
    ElMessage.success('保存成功')
    editDialogVisible.value = false
    loadPrompts()
  } catch (error) {
    console.error('保存失败:', error)
  } finally {
    saving.value = false
  }
}

async function handleReset(prompt) {
  try {
    await ElMessageBox.confirm(
      '确定要重置为默认模板吗？当前修改将被覆盖。',
      '确认重置',
      { type: 'warning' }
    )
    
    await resetPrompt({
      type: prompt.type,
      category: prompt.category
    })
    ElMessage.success('已重置为默认')
    loadPrompts()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('重置失败:', error)
    }
  }
}

function openTestDialog(prompt) {
  currentPrompt.value = prompt
  testVariables.value = {}
  testResult.value = null
  
  // 解析变量
  try {
    const vars = JSON.parse(prompt.variables || '[]')
    vars.forEach(v => {
      testVariables.value[v] = ''
    })
  } catch {}
  
  testDialogVisible.value = true
}

async function runTest() {
  try {
    testing.value = true
    testResult.value = null
    
    const res = await testPrompt(currentPrompt.value.id, testVariables.value)
    testResult.value = res.data
  } catch (error) {
    console.error('测试失败:', error)
  } finally {
    testing.value = false
  }
}

// 提取变量
function extractVariables(content) {
  const matches = content.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))]
}

onMounted(() => {
  loadPrompts()
})
</script>

<template>
  <div class="prompts-page">
    <div class="page-header">
      <h1>Prompt 模板管理</h1>
    </div>
    
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <el-tab-pane label="题目生成器" name="generator" />
      <el-tab-pane label="评审模板" name="evaluator" />
      <el-tab-pane label="AI 词典" name="dictionary" />
    </el-tabs>
    
    <div class="prompts-list" v-loading="loading">
      <el-card
        v-for="prompt in prompts"
        :key="prompt.id"
        class="prompt-card"
      >
        <div class="card-header">
          <div class="prompt-info">
            <h3>{{ prompt.name }}</h3>
            <p>{{ prompt.description }}</p>
          </div>
          <div class="prompt-meta">
            <el-tag size="small">{{ typeNames[prompt.type] || prompt.type }}</el-tag>
            <el-tag v-if="prompt.is_default" size="small" type="info">默认</el-tag>
            <el-tag size="small" type="success">v{{ prompt.version }}</el-tag>
          </div>
        </div>
        
        <div class="prompt-preview">
          <pre>{{ prompt.content.substring(0, 200) }}...</pre>
        </div>
        
        <div class="card-actions">
          <el-button @click="editPrompt(prompt)">编辑</el-button>
          <el-button @click="openTestDialog(prompt)">测试</el-button>
          <el-button
            v-if="prompt.is_default"
            type="warning"
            text
            @click="handleReset(prompt)"
          >
            重置默认
          </el-button>
        </div>
      </el-card>
    </div>
    
    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editDialogVisible"
      :title="`编辑 - ${currentPrompt?.name}`"
      width="80%"
      :close-on-click-modal="false"
    >
      <div class="edit-dialog">
        <div class="variables-hint">
          <strong>可用变量:</strong>
          <el-tag
            v-for="v in extractVariables(editContent)"
            :key="v"
            size="small"
            type="info"
          >
            {{ '{' + v + '}' }}
          </el-tag>
        </div>
        
        <el-input
          v-model="editContent"
          type="textarea"
          :rows="20"
          placeholder="输入 Prompt 内容..."
        />
      </div>
      
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePrompt">
          保存
        </el-button>
      </template>
    </el-dialog>
    
    <!-- 测试对话框 -->
    <el-dialog
      v-model="testDialogVisible"
      :title="`测试 - ${currentPrompt?.name}`"
      width="70%"
    >
      <div class="test-dialog">
        <el-form label-width="120px">
          <el-form-item
            v-for="(value, key) in testVariables"
            :key="key"
            :label="key"
          >
            <el-input v-model="testVariables[key]" :placeholder="`输入 ${key} 的值`" />
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" :loading="testing" @click="runTest">
              {{ testing ? '测试中...' : '运行测试' }}
            </el-button>
          </el-form-item>
        </el-form>
        
        <div v-if="testResult" class="test-result">
          <el-divider>测试结果</el-divider>
          
          <div class="result-section">
            <h4>发送的 Prompt:</h4>
            <pre>{{ testResult.prompt }}</pre>
          </div>
          
          <div class="result-section">
            <h4>AI 响应:</h4>
            <pre>{{ testResult.response }}</pre>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.prompts-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prompt-card :deep(.el-card__body) {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.prompt-info h3 {
  font-size: 16px;
  color: #303133;
  margin: 0 0 4px 0;
}

.prompt-info p {
  color: #909399;
  font-size: 13px;
  margin: 0;
}

.prompt-meta {
  display: flex;
  gap: 8px;
}

.prompt-preview {
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 16px;
}

.prompt-preview pre {
  margin: 0;
  font-size: 12px;
  color: #606266;
  white-space: pre-wrap;
  font-family: 'Monaco', 'Menlo', monospace;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.edit-dialog .variables-hint {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.edit-dialog :deep(.el-textarea__inner) {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 13px;
}

.test-result {
  margin-top: 20px;
}

.result-section {
  margin-bottom: 20px;
}

.result-section h4 {
  color: #303133;
  margin-bottom: 8px;
}

.result-section pre {
  background: #f5f7fa;
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  max-height: 300px;
  overflow-y: auto;
}
</style>
