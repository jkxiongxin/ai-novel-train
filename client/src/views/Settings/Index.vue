<script setup>
import { ref, onMounted } from 'vue'
import { getSettings, updateSettings } from '../../api/settings'
import { ElMessage } from 'element-plus'

const loading = ref(true)
const saving = ref(false)
const settings = ref({
  theme: 'light',
  editorFontSize: 16,
  editorFontFamily: 'system',
  autoSaveInterval: 30,
  showWordCount: true,
  showTimer: true,
  defaultWritingTime: 30,
  notificationSound: true
})

const fontFamilyOptions = [
  { label: '系统默认', value: 'system' },
  { label: '思源宋体', value: 'source-han-serif' },
  { label: '思源黑体', value: 'source-han-sans' },
  { label: '霞鹜文楷', value: 'lxgw-wenkai' },
  { label: 'Monaco', value: 'monaco' }
]

async function loadSettings() {
  try {
    loading.value = true
    const res = await getSettings()
    settings.value = { ...settings.value, ...res.data }
  } catch (error) {
    console.error('加载设置失败:', error)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  try {
    saving.value = true
    await updateSettings(settings.value)
    ElMessage.success('设置已保存')
  } catch (error) {
    console.error('保存设置失败:', error)
  } finally {
    saving.value = false
  }
}

function resetSettings() {
  settings.value = {
    theme: 'light',
    editorFontSize: 16,
    editorFontFamily: 'system',
    autoSaveInterval: 30,
    showWordCount: true,
    showTimer: true,
    defaultWritingTime: 30,
    notificationSound: true
  }
  ElMessage.info('已重置为默认设置')
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div class="settings-page" v-loading="loading">
    <div class="page-header">
      <h1>系统设置</h1>
    </div>
    
    <el-card class="settings-card">
      <template #header>
        <span>外观设置</span>
      </template>
      
      <el-form label-width="140px">
        <el-form-item label="主题模式">
          <el-radio-group v-model="settings.theme">
            <el-radio-button label="light">浅色</el-radio-button>
            <el-radio-button label="dark">深色</el-radio-button>
            <el-radio-button label="auto">跟随系统</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card class="settings-card">
      <template #header>
        <span>编辑器设置</span>
      </template>
      
      <el-form label-width="140px">
        <el-form-item label="字体大小">
          <el-slider
            v-model="settings.editorFontSize"
            :min="12"
            :max="24"
            :step="1"
            show-input
            style="max-width: 400px"
          />
        </el-form-item>
        
        <el-form-item label="字体">
          <el-select v-model="settings.editorFontFamily" style="width: 200px">
            <el-option
              v-for="opt in fontFamilyOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        
        <el-form-item label="自动保存间隔">
          <el-input-number
            v-model="settings.autoSaveInterval"
            :min="10"
            :max="300"
            :step="10"
          />
          <span class="input-hint">秒</span>
        </el-form-item>
        
        <el-form-item label="显示字数统计">
          <el-switch v-model="settings.showWordCount" />
        </el-form-item>
        
        <el-form-item label="显示计时器">
          <el-switch v-model="settings.showTimer" />
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card class="settings-card">
      <template #header>
        <span>练习设置</span>
      </template>
      
      <el-form label-width="140px">
        <el-form-item label="默认写作时间">
          <el-input-number
            v-model="settings.defaultWritingTime"
            :min="10"
            :max="120"
            :step="5"
          />
          <span class="input-hint">分钟</span>
        </el-form-item>
        
        <el-form-item label="时间提醒音效">
          <el-switch v-model="settings.notificationSound" />
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card class="settings-card">
      <template #header>
        <span>AI 配置</span>
      </template>
      
      <el-form label-width="140px">
        <el-form-item label="AI 服务配置">
          <div class="ai-config-item">
            <span class="ai-config-desc">配置 AI API 接口、模型和相关参数</span>
            <el-button type="primary" @click="$router.push('/settings/ai')">
              配置 AI
            </el-button>
          </div>
        </el-form-item>
      </el-form>
    </el-card>
    
    <div class="actions">
      <el-button @click="resetSettings">重置默认</el-button>
      <el-button type="primary" :loading="saving" @click="saveSettings">
        保存设置
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 800px;
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

.settings-card {
  margin-bottom: 20px;
}

.settings-card :deep(.el-card__header) {
  font-weight: 600;
  color: #303133;
}

.input-hint {
  margin-left: 8px;
  color: #909399;
}

.ai-config-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.ai-config-desc {
  color: #606266;
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
</style>
