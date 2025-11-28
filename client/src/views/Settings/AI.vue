<script setup>
import { ref, onMounted, computed } from 'vue'
import { 
  getAIConfigs, 
  saveAIConfig, 
  deleteAIConfig,
  testAIConnection, 
  getAIModels,
  getAIFeatures,
  getFeatureConfigs,
  saveFeatureConfigs,
  saveFeatureConfigsBatch
} from '../../api/aiConfig'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isMobile } from '../../utils/device'

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const fetchingModels = ref(false)
const showApiKey = ref(false)
const activeTab = ref('configs')

// AI 配置列表
const configList = ref([])
const currentConfigId = ref(null)
const showConfigDialog = ref(false)
const configDialogTitle = ref('新增配置')

// 功能配置
const features = ref([])
const featureConfigs = ref({})
const savingFeatures = ref(false)
const batchConfigId = ref(null)

const config = ref({
  configName: '',
  description: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-3.5-turbo',
  maxTokens: 4096,
  temperature: 0.7
})

const presetModels = ref([
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'GPT-4', value: 'gpt-4' },
  { label: 'GPT-4 Turbo', value: 'gpt-4-turbo-preview' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
  { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
  { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
])

const presetProviders = [
  { label: 'OpenAI', value: 'https://api.openai.com/v1' },
  { label: 'Azure OpenAI', value: 'https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT' },
  { label: 'Anthropic', value: 'https://api.anthropic.com/v1' },
  { label: '自定义', value: '' }
]

async function loadConfigs() {
  try {
    loading.value = true
    const res = await getAIConfigs()
    if (res.data) {
      configList.value = res.data
    }
  } catch (error) {
    console.error('加载配置列表失败:', error)
    ElMessage.error('加载配置列表失败')
  } finally {
    loading.value = false
  }
}

async function loadFeatures() {
  try {
    const [featuresRes, configsRes] = await Promise.all([
      getAIFeatures(),
      getFeatureConfigs()
    ])
    
    if (featuresRes.data) {
      features.value = featuresRes.data
    }
    
    if (configsRes.data) {
      // 将配置列表转换为以 feature_key 为键的对象
      featureConfigs.value = {}
      configsRes.data.forEach(fc => {
        featureConfigs.value[fc.feature_key] = {
          config_id: fc.config_id,
          is_enabled: fc.is_enabled === 1
        }
      })
    }
  } catch (error) {
    console.error('加载功能配置失败:', error)
    ElMessage.error('加载功能配置失败')
  }
}

function openAddConfigDialog() {
  configDialogTitle.value = '新增配置'
  currentConfigId.value = null
  config.value = {
    configName: '',
    description: '',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    maxTokens: 4096,
    temperature: 0.7
  }
  showConfigDialog.value = true
}

function openEditConfigDialog(item) {
  configDialogTitle.value = '编辑配置'
  currentConfigId.value = item.id
  config.value = {
    configName: item.config_name,
    description: item.description || '',
    baseUrl: item.api_base_url,
    apiKey: item.api_key || '',
    model: item.model_name,
    maxTokens: item.max_tokens,
    temperature: item.temperature
  }
  showConfigDialog.value = true
}

function openCopyConfigDialog(item) {
  configDialogTitle.value = '复制配置'
  currentConfigId.value = null  // 新建，不设置 ID
  config.value = {
    configName: item.config_name + ' (副本)',
    description: item.description || '',
    baseUrl: item.api_base_url,
    apiKey: item.api_key || '',
    model: item.model_name,
    maxTokens: item.max_tokens,
    temperature: item.temperature
  }
  showConfigDialog.value = true
}

async function handleSaveConfig() {
  if (!config.value.configName) {
    ElMessage.warning('请输入配置名称')
    return
  }
  if (!config.value.baseUrl) {
    ElMessage.warning('请输入 API 地址')
    return
  }
  if (!config.value.apiKey) {
    ElMessage.warning('请输入 API Key')
    return
  }
  if (!config.value.model) {
    ElMessage.warning('请选择或输入模型')
    return
  }
  
  try {
    saving.value = true
    const dataToSave = {
      id: currentConfigId.value,
      config_name: config.value.configName,
      description: config.value.description,
      api_base_url: config.value.baseUrl,
      api_key: config.value.apiKey,
      model_name: config.value.model,
      max_tokens: config.value.maxTokens,
      temperature: config.value.temperature,
      is_active: true
    }
    await saveAIConfig(dataToSave)
    ElMessage.success('配置已保存')
    showConfigDialog.value = false
    await loadConfigs()
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存配置失败')
  } finally {
    saving.value = false
  }
}

async function handleDeleteConfig(item) {
  try {
    await ElMessageBox.confirm(
      `确定要删除配置"${item.config_name}"吗？`,
      '删除确认',
      { type: 'warning' }
    )
    
    await deleteAIConfig(item.id)
    ElMessage.success('配置已删除')
    await loadConfigs()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除配置失败:', error)
      ElMessage.error('删除配置失败')
    }
  }
}

async function handleTest() {
  if (!config.value.baseUrl || !config.value.apiKey) {
    ElMessage.warning('请先填写 API 地址和 API Key')
    return
  }
  
  try {
    testing.value = true
    const testData = {
      api_base_url: config.value.baseUrl,
      api_key: config.value.apiKey,
      model_name: config.value.model
    }
    const res = await testAIConnection(testData)
    
    if (res.success) {
      ElMessage.success(res.message || '连接测试成功！')
    } else {
      ElMessage.error(`连接测试失败：${res.message || res.error || '未知错误'}`)
    }
  } catch (error) {
    ElMessage.error('连接测试失败')
    console.error('连接测试失败:', error)
  } finally {
    testing.value = false
  }
}

function selectProvider(url) {
  if (url) {
    config.value.baseUrl = url
  }
}

async function fetchModels() {
  if (!config.value.baseUrl || !config.value.apiKey) {
    ElMessage.warning('请先填写 API 地址和 API Key')
    return
  }
  
  try {
    fetchingModels.value = true
    const res = await getAIModels({
      api_base_url: config.value.baseUrl,
      api_key: config.value.apiKey
    })
    
    if (res.data && res.data.length > 0) {
      const newModels = res.data.map(model => ({
        label: model.id || model,
        value: model.id || model
      }))
      
      // 直接用拉取到的模型覆盖原来的模型选项
      presetModels.value = newModels
      
      // 如果当前选择的模型不在新列表中，清空选择
      if (!newModels.some(model => model.value === config.value.model)) {
        config.value.model = ''
      }
      
      ElMessage.success(`已获取 ${newModels.length} 个模型`)
    } else {
      ElMessage.warning('未获取到可用模型')
    }
  } catch (error) {
    console.error('获取模型列表失败:', error)
    ElMessage.error('获取模型列表失败')
  } finally {
    fetchingModels.value = false
  }
}

async function handleSaveFeatureConfig(featureKey) {
  try {
    const fc = featureConfigs.value[featureKey] || {}
    await saveFeatureConfigs({
      feature_key: featureKey,
      config_id: fc.config_id,
      is_enabled: fc.is_enabled !== false ? 1 : 0
    })
    ElMessage.success('功能配置已保存')
  } catch (error) {
    console.error('保存功能配置失败:', error)
    ElMessage.error('保存功能配置失败')
  }
}

// 辅助函数：获取功能配置的 config_id
function getFeatureConfigId(featureKey) {
  return featureConfigs.value[featureKey]?.config_id
}

// 辅助函数：设置功能配置的 config_id
function setFeatureConfigId(featureKey, val) {
  if (!featureConfigs.value[featureKey]) {
    featureConfigs.value[featureKey] = { is_enabled: true }
  }
  featureConfigs.value[featureKey].config_id = val
}

// 辅助函数：获取功能配置的启用状态
function getFeatureEnabled(featureKey) {
  return featureConfigs.value[featureKey]?.is_enabled !== false
}

// 辅助函数：设置功能配置的启用状态
function setFeatureEnabled(featureKey, val) {
  if (!featureConfigs.value[featureKey]) {
    featureConfigs.value[featureKey] = {}
  }
  featureConfigs.value[featureKey].is_enabled = val
}

async function handleBatchSave() {
  if (!batchConfigId.value) {
    ElMessage.warning('请选择要批量设置的 AI 配置')
    return
  }
  
  try {
    await ElMessageBox.confirm(
      '确定要将所有功能的 AI 配置批量设置为选中的配置吗？',
      '批量设置确认',
      { type: 'warning' }
    )
    
    savingFeatures.value = true
    await saveFeatureConfigsBatch({
      config_id: batchConfigId.value,
      feature_keys: features.value.map(f => f.key)
    })
    
    // 更新本地状态
    features.value.forEach(f => {
      if (!featureConfigs.value[f.key]) {
        featureConfigs.value[f.key] = {}
      }
      featureConfigs.value[f.key].config_id = batchConfigId.value
    })
    
    ElMessage.success('批量设置成功')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量设置失败:', error)
      ElMessage.error('批量设置失败')
    }
  } finally {
    savingFeatures.value = false
  }
}

function getConfigName(configId) {
  const cfg = configList.value.find(c => c.id === configId)
  return cfg ? cfg.config_name : '未设置'
}

onMounted(async () => {
  await loadConfigs()
  await loadFeatures()
})
</script>

<template>
  <div class="ai-settings-page" v-loading="loading">
    <div class="page-header">
      <h1>AI 配置</h1>
    </div>
    
    <el-alert
      type="info"
      :closable="false"
      class="tip-alert"
    >
      <template #title>
        配置说明：本系统支持多套 AI 配置，可以为不同的功能指定使用不同的 AI 服务。
        支持 OpenAI、Azure OpenAI、Anthropic 等服务商，也支持本地部署的模型。
      </template>
    </el-alert>

    <el-tabs v-model="activeTab">
      <!-- AI 配置管理 -->
      <el-tab-pane label="AI 配置管理" name="configs">
        <div class="tab-header">
          <el-button type="primary" @click="openAddConfigDialog">
            新增配置
          </el-button>
        </div>
        
        <el-table :data="configList" stripe class="config-table">
          <el-table-column prop="config_name" label="配置名称" width="150" />
          <el-table-column prop="description" label="描述" width="200">
            <template #default="{ row }">
              {{ row.description || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="model_name" label="模型" width="180" />
          <el-table-column prop="api_base_url" label="API 地址" show-overflow-tooltip />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openEditConfigDialog(row)">编辑</el-button>
              <el-button link type="primary" @click="openCopyConfigDialog(row)">复制</el-button>
              <el-button link type="danger" @click="handleDeleteConfig(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 功能配置映射 -->
      <el-tab-pane label="功能配置映射" name="features">
        <el-card class="batch-card">
          <template #header>
            <span>批量设置</span>
          </template>
          <div class="batch-form">
            <el-select v-model="batchConfigId" placeholder="选择 AI 配置" style="width: 300px">
              <el-option
                v-for="cfg in configList"
                :key="cfg.id"
                :label="cfg.config_name"
                :value="cfg.id"
              />
            </el-select>
            <el-button 
              type="primary" 
              @click="handleBatchSave"
              :loading="savingFeatures"
              style="margin-left: 12px"
            >
              应用到所有功能
            </el-button>
          </div>
        </el-card>

        <el-card class="features-card">
          <template #header>
            <span>各功能 AI 配置</span>
          </template>
          
          <el-table :data="features" stripe>
            <el-table-column prop="name" label="功能名称" width="150" />
            <el-table-column prop="description" label="功能描述" width="250" />
            <el-table-column label="使用配置" width="250">
              <template #default="{ row }">
                <el-select 
                  :model-value="getFeatureConfigId(row.key)"
                  placeholder="选择配置"
                  @change="(val) => setFeatureConfigId(row.key, val)"
                  style="width: 200px"
                >
                  <el-option
                    v-for="cfg in configList"
                    :key="cfg.id"
                    :label="cfg.config_name"
                    :value="cfg.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="启用" width="100">
              <template #default="{ row }">
                <el-switch
                  :model-value="getFeatureEnabled(row.key)"
                  @change="(val) => setFeatureEnabled(row.key, val)"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ row }">
                <el-button link type="primary" @click="handleSaveFeatureConfig(row.key)">保存</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 配置编辑对话框 -->
    <el-dialog 
      v-model="showConfigDialog" 
      :title="configDialogTitle"
      :width="isMobile ? '95%' : '700px'"
      :fullscreen="isMobile"
      destroy-on-close
      class="config-dialog"
    >
      <el-form label-width="140px">
        <el-form-item label="配置名称" required>
          <el-input
            v-model="config.configName"
            placeholder="输入配置名称，如：GPT-4配置、本地模型等"
          />
        </el-form-item>

        <el-form-item label="配置描述">
          <el-input
            v-model="config.description"
            type="textarea"
            :rows="2"
            placeholder="可选，描述此配置的用途"
          />
        </el-form-item>
        
        <el-form-item label="服务商预设">
          <div class="provider-buttons">
            <el-button
              v-for="provider in presetProviders"
              :key="provider.value"
              :type="config.baseUrl === provider.value ? 'primary' : ''"
              size="small"
              @click="selectProvider(provider.value)"
            >
              {{ provider.label }}
            </el-button>
          </div>
        </el-form-item>
        
        <el-form-item label="API 地址" required>
          <el-input
            v-model="config.baseUrl"
            placeholder="https://api.openai.com/v1"
          />
        </el-form-item>
        
        <el-form-item label="API Key" required>
          <el-input
            v-model="config.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="sk-..."
          >
            <template #append>
              <el-button @click="showApiKey = !showApiKey">
                {{ showApiKey ? '隐藏' : '显示' }}
              </el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item label="模型" required>
          <div class="model-select-container">
            <el-select
              v-model="config.model"
              filterable
              allow-create
              placeholder="选择或输入模型名称"
              style="width: 250px"
            >
              <el-option
                v-for="model in presetModels"
                :key="model.value"
                :label="model.label"
                :value="model.value"
              />
            </el-select>
            <el-button
              :loading="fetchingModels"
              @click="fetchModels"
              style="margin-left: 12px"
            >
              获取模型列表
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="最大 Token 数">
          <el-input-number
            v-model="config.maxTokens"
            :min="256"
            :max="128000"
            :step="256"
          />
        </el-form-item>
        
        <el-form-item label="Temperature">
          <el-slider
            v-model="config.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            show-input
            style="max-width: 350px"
          />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showConfigDialog = false">取消</el-button>
        <el-button :loading="testing" @click="handleTest">
          测试连接
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveConfig">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.ai-settings-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  color: #303133;
  margin: 0;
}

.tip-alert {
  margin-bottom: 20px;
}

.tab-header {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.config-table {
  width: 100%;
}

.batch-card {
  margin-bottom: 20px;
}

.batch-form {
  display: flex;
  align-items: center;
}

.features-card {
  margin-bottom: 20px;
}

.provider-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.model-select-container {
  display: flex;
  align-items: center;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .ai-settings-page {
    padding: 12px;
  }
  
  .page-header h1 {
    font-size: 18px;
  }
  
  .tip-alert {
    font-size: 13px;
  }
  
  .tab-header {
    justify-content: flex-start;
  }
  
  .batch-form {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .batch-form .el-select {
    width: 100% !important;
  }
  
  .batch-form .el-button {
    margin-left: 0 !important;
  }
  
  .provider-buttons {
    gap: 6px;
  }
  
  .provider-buttons .el-button {
    padding: 6px 10px;
    font-size: 12px;
  }
  
  .model-select-container {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  
  .model-select-container .el-select {
    width: 100% !important;
  }
  
  .model-select-container .el-button {
    margin-left: 0 !important;
  }
}

/* 移动端对话框样式 */
.config-dialog :deep(.el-dialog__body) {
  padding: 16px;
}

@media (max-width: 768px) {
  .config-dialog :deep(.el-dialog) {
    margin: 0 !important;
    border-radius: 0;
  }
  
  .config-dialog :deep(.el-dialog__header) {
    padding: 12px 16px;
    border-bottom: 1px solid #ebeef5;
  }
  
  .config-dialog :deep(.el-dialog__body) {
    padding: 12px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
  }
  
  .config-dialog :deep(.el-dialog__footer) {
    padding: 12px 16px;
    border-top: 1px solid #ebeef5;
    display: flex;
    gap: 8px;
  }
  
  .config-dialog :deep(.el-dialog__footer .el-button) {
    flex: 1;
    margin: 0 !important;
  }
  
  .config-dialog :deep(.el-form-item) {
    margin-bottom: 16px;
  }
  
  .config-dialog :deep(.el-form-item__label) {
    float: none;
    display: block;
    text-align: left;
    margin-bottom: 6px;
    padding: 0;
    width: auto !important;
    font-size: 13px;
  }
  
  .config-dialog :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
  
  .config-dialog :deep(.el-input),
  .config-dialog :deep(.el-textarea),
  .config-dialog :deep(.el-select) {
    width: 100%;
  }
  
  .config-dialog :deep(.el-input-number) {
    width: 100%;
  }
  
  .config-dialog :deep(.el-slider) {
    max-width: 100% !important;
    width: 100%;
  }
  
  .config-dialog :deep(.el-slider__runway) {
    margin: 12px 0;
  }
  
  .config-dialog :deep(.el-slider .el-input-number) {
    width: 100px;
  }
}
</style>
