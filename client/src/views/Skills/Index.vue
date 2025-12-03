<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, RefreshRight, Download, Upload, Setting, InfoFilled } from '@element-plus/icons-vue'
import { 
  getSkills, getCategories, generateSkill, createSkill, deleteSkill,
  getPresetStatus, initPresetSkills, getPresetList, exportSkills, importSkills
} from '../../api/skills'

const router = useRouter()

// 状态
const loading = ref(false)
const generating = ref(false)
const skills = ref([])
const categories = ref([])
const pagination = ref({
  page: 1,
  pageSize: 12,
  total: 0
})

// 预设状态
const presetStatus = ref({
  initialized: false,
  presetCount: 0,
  totalPresets: 0
})

// 筛选条件
const filters = ref({
  category: '',
  difficulty: '',
  source: '',
  search: ''
})

// 添加知识点对话框
const addDialogVisible = ref(false)
const addMode = ref('ai') // ai | manual
const aiGenerateForm = ref({
  skillName: '',
  category: '',
  description: ''
})
const manualForm = ref({
  name: '',
  category: 'dialogue',
  difficulty: 'medium',
  summary: '',
  content: '',
  key_points: [''],
  examples: [{ title: '', content: '', analysis: '' }],
  common_mistakes: [{ mistake: '', reason: '', correction: '' }],
  practice_advice: ''
})
const generatedSkill = ref(null)

// 导入导出对话框
const importExportDialogVisible = ref(false)
const importExportMode = ref('export') // export | import
const exportOptions = ref({
  type: 'user', // user | category | selected | all
  category: '',
  selectedIds: []
})
const importData = ref('')
const importOptions = ref({
  overwrite: false
})
const importing = ref(false)

// 预设技巧对话框
const presetDialogVisible = ref(false)
const presetList = ref([])
const presetLoading = ref(false)

// 难度选项
const difficultyOptions = [
  { value: 'easy', label: '简单', type: 'success' },
  { value: 'medium', label: '中等', type: 'warning' },
  { value: 'hard', label: '困难', type: 'danger' }
]

// 来源选项
const sourceOptions = [
  { value: 'preset', label: '预设' },
  { value: 'ai', label: 'AI生成' },
  { value: 'user', label: '手动添加' },
  { value: 'imported', label: '导入' }
]

// 获取分类名称
const getCategoryName = (key) => {
  const cat = categories.value.find(c => c.key === key)
  return cat ? cat.name : key
}

// 获取分类图标
const getCategoryIcon = (key) => {
  const cat = categories.value.find(c => c.key === key)
  return cat ? cat.icon : '📚'
}

// 获取难度信息
const getDifficulty = (value) => {
  return difficultyOptions.find(d => d.value === value) || { label: value, type: 'info' }
}

// 加载分类
const loadCategories = async () => {
  try {
    const res = await getCategories()
    categories.value = res.data
  } catch (error) {
    console.error('加载分类失败:', error)
  }
}

// 加载预设状态
const loadPresetStatus = async () => {
  try {
    const res = await getPresetStatus()
    presetStatus.value = res.data
  } catch (error) {
    console.error('加载预设状态失败:', error)
  }
}

// 加载知识点列表
const loadSkills = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.value.page,
      pageSize: pagination.value.pageSize,
      ...filters.value
    }
    // 清除空值
    Object.keys(params).forEach(key => {
      if (!params[key]) delete params[key]
    })
    
    const res = await getSkills(params)
    skills.value = res.data
    pagination.value = res.pagination
  } catch (error) {
    ElMessage.error('加载知识点列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 搜索
const handleSearch = () => {
  pagination.value.page = 1
  loadSkills()
}

// 重置筛选
const resetFilters = () => {
  filters.value = {
    category: '',
    difficulty: '',
    source: '',
    search: ''
  }
  pagination.value.page = 1
  loadSkills()
}

// 分页
const handlePageChange = (page) => {
  pagination.value.page = page
  loadSkills()
}

// 查看详情
const viewSkill = (skill) => {
  router.push(`/skills/${skill.id}`)
}

// 开始练习
const startPractice = (skill) => {
  router.push(`/skills/${skill.id}/practice`)
}

// 打开添加对话框
const openAddDialog = () => {
  addDialogVisible.value = true
  addMode.value = 'ai'
  aiGenerateForm.value = { skillName: '', category: '', description: '' }
  generatedSkill.value = null
}

// AI 生成知识点
const handleGenerate = async () => {
  if (!aiGenerateForm.value.skillName.trim()) {
    ElMessage.warning('请输入要学习的技巧名称')
    return
  }
  
  generating.value = true
  try {
    const res = await generateSkill({
      skillName: aiGenerateForm.value.skillName.trim(),
      category: aiGenerateForm.value.category || undefined,
      description: aiGenerateForm.value.description.trim() || undefined
    })
    generatedSkill.value = res.data
    ElMessage.success('知识点生成成功')
  } catch (error) {
    ElMessage.error('生成失败: ' + (error.message || '未知错误'))
  } finally {
    generating.value = false
  }
}

// 保存 AI 生成的知识点
const saveGeneratedSkill = async () => {
  if (!generatedSkill.value) return
  
  try {
    await createSkill({
      name: generatedSkill.value.name,
      category: generatedSkill.value.category,
      difficulty: generatedSkill.value.difficulty,
      summary: generatedSkill.value.summary,
      content: generatedSkill.value.content,
      key_points: generatedSkill.value.keyPoints,
      examples: generatedSkill.value.examples,
      common_mistakes: generatedSkill.value.commonMistakes,
      practice_advice: generatedSkill.value.practiceAdvice,
      source: 'ai'
    })
    ElMessage.success('知识点保存成功')
    addDialogVisible.value = false
    loadSkills()
  } catch (error) {
    ElMessage.error('保存失败: ' + (error.message || '未知错误'))
  }
}

// 保存手动添加的知识点
const saveManualSkill = async () => {
  if (!manualForm.value.name.trim()) {
    ElMessage.warning('请输入技巧名称')
    return
  }
  
  try {
    // 过滤空值
    const keyPoints = manualForm.value.key_points.filter(p => p.trim())
    const examples = manualForm.value.examples.filter(e => e.title.trim() || e.content.trim())
    const mistakes = manualForm.value.common_mistakes.filter(m => m.mistake.trim())
    
    await createSkill({
      ...manualForm.value,
      key_points: keyPoints,
      examples,
      common_mistakes: mistakes,
      source: 'user'
    })
    ElMessage.success('知识点创建成功')
    addDialogVisible.value = false
    loadSkills()
  } catch (error) {
    ElMessage.error('创建失败: ' + (error.message || '未知错误'))
  }
}

// 删除知识点
const handleDelete = async (skill) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除"${skill.name}"吗？相关的练习记录也会被删除。`,
      '删除确认',
      { type: 'warning' }
    )
    
    await deleteSkill(skill.id)
    ElMessage.success('删除成功')
    loadSkills()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + (error.message || '未知错误'))
    }
  }
}

// 添加要点
const addKeyPoint = () => {
  manualForm.value.key_points.push('')
}

// 移除要点
const removeKeyPoint = (index) => {
  manualForm.value.key_points.splice(index, 1)
}

// 添加示例
const addExample = () => {
  manualForm.value.examples.push({ title: '', content: '', analysis: '' })
}

// 移除示例
const removeExample = (index) => {
  manualForm.value.examples.splice(index, 1)
}

// 添加常见错误
const addMistake = () => {
  manualForm.value.common_mistakes.push({ mistake: '', reason: '', correction: '' })
}

// 移除常见错误
const removeMistake = (index) => {
  manualForm.value.common_mistakes.splice(index, 1)
}

// ==================== 预设技巧相关 ====================

// 打开预设对话框
const openPresetDialog = async () => {
  presetDialogVisible.value = true
  presetLoading.value = true
  try {
    const res = await getPresetList()
    presetList.value = res.data
  } catch (error) {
    ElMessage.error('获取预设列表失败')
  } finally {
    presetLoading.value = false
  }
}

// 初始化预设技巧
const handleInitPresets = async (force = false) => {
  try {
    if (force) {
      await ElMessageBox.confirm(
        '强制重新初始化会删除所有已存在的预设技巧，确定继续吗？',
        '确认操作',
        { type: 'warning' }
      )
    }
    
    const res = await initPresetSkills({ force })
    ElMessage.success(res.message)
    presetDialogVisible.value = false
    loadSkills()
    loadPresetStatus()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('初始化失败: ' + (error.message || '未知错误'))
    }
  }
}

// ==================== 导入导出相关 ====================

// 打开导入导出对话框
const openImportExportDialog = (mode) => {
  importExportMode.value = mode
  importExportDialogVisible.value = true
  
  if (mode === 'export') {
    exportOptions.value = {
      type: 'user',
      category: '',
      selectedIds: []
    }
  } else {
    importData.value = ''
    importOptions.value = { overwrite: false }
  }
}

// 执行导出
const handleExport = async () => {
  try {
    const params = {}
    
    switch (exportOptions.value.type) {
      case 'user':
        // 默认只导出用户创建的
        break
      case 'category':
        if (!exportOptions.value.category) {
          ElMessage.warning('请选择要导出的分类')
          return
        }
        params.category = exportOptions.value.category
        break
      case 'selected':
        if (exportOptions.value.selectedIds.length === 0) {
          ElMessage.warning('请选择要导出的知识点')
          return
        }
        params.ids = exportOptions.value.selectedIds.join(',')
        break
      case 'all':
        params.all = 'true'
        break
    }
    
    const res = await exportSkills(params)
    
    // 下载 JSON 文件
    const dataStr = JSON.stringify(res.data, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `writing_skills_${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success(`成功导出 ${res.data.count} 个知识点`)
    importExportDialogVisible.value = false
  } catch (error) {
    ElMessage.error('导出失败: ' + (error.message || '未知错误'))
  }
}

// 处理文件选择
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (e) => {
    importData.value = e.target.result
  }
  reader.readAsText(file)
}

// 执行导入
const handleImport = async () => {
  if (!importData.value.trim()) {
    ElMessage.warning('请选择或粘贴要导入的数据')
    return
  }
  
  importing.value = true
  try {
    let data
    try {
      data = JSON.parse(importData.value)
    } catch (e) {
      ElMessage.error('JSON 格式错误，请检查数据格式')
      return
    }
    
    // 支持两种格式：直接数组 或 带 skills 字段的对象
    const skillsArray = Array.isArray(data) ? data : (data.skills || [])
    
    if (skillsArray.length === 0) {
      ElMessage.warning('未找到有效的知识点数据')
      return
    }
    
    const res = await importSkills({
      skills: skillsArray,
      overwrite: importOptions.value.overwrite
    })
    
    ElMessage.success(res.message)
    importExportDialogVisible.value = false
    loadSkills()
  } catch (error) {
    ElMessage.error('导入失败: ' + (error.message || '未知错误'))
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  loadCategories()
  loadSkills()
  loadPresetStatus()
})
</script>

<template>
  <div class="skills-page">
    <!-- 首次使用提示 -->
    <el-alert
      v-if="!presetStatus.initialized && skills.length === 0"
      title="欢迎使用写作技巧学习模块！"
      type="info"
      show-icon
      :closable="false"
      class="welcome-alert"
    >
      <template #default>
        <p>这里是空的，您可以：</p>
        <div class="welcome-actions">
          <el-button type="primary" size="small" @click="openPresetDialog">
            📚 导入预设技巧（推荐）
          </el-button>
          <el-button size="small" @click="openAddDialog">
            ✨ AI 生成新技巧
          </el-button>
          <el-button size="small" @click="openImportExportDialog('import')">
            📥 导入已有数据
          </el-button>
        </div>
      </template>
    </el-alert>
    
    <!-- 页面头部 -->
    <div class="page-header">
      <div class="header-left">
        <h1>📚 写作技巧库</h1>
        <p class="subtitle">学习各种小说写作技巧，通过练习提升写作能力</p>
      </div>
      <div class="header-actions">
        <el-button :icon="Download" @click="openImportExportDialog('export')">
          导出
        </el-button>
        <el-button :icon="Upload" @click="openImportExportDialog('import')">
          导入
        </el-button>
        <el-button :icon="Setting" @click="openPresetDialog">
          预设管理
        </el-button>
        <el-button type="primary" :icon="Plus" @click="openAddDialog">
          添加知识点
        </el-button>
      </div>
    </div>
    
    <!-- 分类快捷入口 -->
    <div class="category-cards">
      <div 
        v-for="cat in categories" 
        :key="cat.key"
        class="category-card"
        :class="{ active: filters.category === cat.key }"
        @click="filters.category = filters.category === cat.key ? '' : cat.key; handleSearch()"
      >
        <span class="cat-icon">{{ cat.icon }}</span>
        <span class="cat-name">{{ cat.name }}</span>
      </div>
    </div>
    
    <!-- 筛选栏 -->
    <el-card class="filter-card">
      <div class="filter-row">
        <el-input
          v-model="filters.search"
          placeholder="搜索技巧名称..."
          :prefix-icon="Search"
          clearable
          style="width: 250px"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        
        <el-select 
          v-model="filters.difficulty" 
          placeholder="难度" 
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in difficultyOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        
        <el-select 
          v-model="filters.source" 
          placeholder="来源" 
          clearable
          style="width: 120px"
          @change="handleSearch"
        >
          <el-option
            v-for="item in sourceOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        
        <el-button :icon="RefreshRight" @click="resetFilters">重置</el-button>
      </div>
    </el-card>
    
    <!-- 知识点列表 -->
    <div class="skills-grid" v-loading="loading">
      <el-card 
        v-for="skill in skills" 
        :key="skill.id" 
        class="skill-card"
        shadow="hover"
      >
        <div class="skill-header">
          <div class="skill-category">
            <span class="cat-icon">{{ getCategoryIcon(skill.category) }}</span>
            <span>{{ getCategoryName(skill.category) }}</span>
          </div>
          <el-tag :type="getDifficulty(skill.difficulty).type" size="small">
            {{ getDifficulty(skill.difficulty).label }}
          </el-tag>
        </div>
        
        <h3 class="skill-name" @click="viewSkill(skill)">{{ skill.name }}</h3>
        
        <p class="skill-summary">{{ skill.summary || '暂无描述' }}</p>
        
        <div class="skill-stats">
          <span>📖 学习 {{ skill.study_count }} 次</span>
          <span>✍️ 练习 {{ skill.practice_count }} 次</span>
          <span v-if="skill.avg_score > 0">⭐ {{ skill.avg_score.toFixed(1) }} 分</span>
        </div>
        
        <div class="skill-key-points" v-if="skill.key_points?.length">
          <el-tag 
            v-for="(point, index) in skill.key_points.slice(0, 3)" 
            :key="index"
            size="small"
            type="info"
          >
            {{ point }}
          </el-tag>
          <el-tag v-if="skill.key_points.length > 3" size="small" type="info">
            +{{ skill.key_points.length - 3 }}
          </el-tag>
        </div>
        
        <div class="skill-actions">
          <el-button type="primary" size="small" @click="viewSkill(skill)">
            学习
          </el-button>
          <el-button type="success" size="small" @click="startPractice(skill)">
            练习
          </el-button>
          <el-button 
            v-if="skill.source !== 'preset'"
            type="danger" 
            size="small" 
            text 
            @click.stop="handleDelete(skill)"
          >
            删除
          </el-button>
        </div>
      </el-card>
      
      <!-- 空状态 -->
      <div v-if="!loading && skills.length === 0" class="empty-state">
        <el-empty description="暂无知识点">
          <el-button type="primary" @click="openAddDialog">添加知识点</el-button>
        </el-empty>
      </div>
    </div>
    
    <!-- 分页 -->
    <div class="pagination-wrapper" v-if="pagination.total > pagination.pageSize">
      <el-pagination
        v-model:current-page="pagination.page"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        layout="total, prev, pager, next"
        @current-change="handlePageChange"
      />
    </div>
    
    <!-- 添加知识点对话框 -->
    <el-dialog 
      v-model="addDialogVisible" 
      title="添加知识点"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-tabs v-model="addMode">
        <el-tab-pane label="AI 生成" name="ai">
          <div class="ai-generate-form">
            <p class="form-tip">
              输入你想学习的写作技巧名称，AI 会自动生成完整的学习资料
            </p>
            
            <el-form label-position="top">
              <el-form-item label="技巧名称" required>
                <el-input 
                  v-model="aiGenerateForm.skillName" 
                  placeholder="例如：潜台词运用、悬念设置、人物出场..."
                />
              </el-form-item>
              
              <el-form-item label="描述说明（可选）">
                <el-input
                  v-model="aiGenerateForm.description"
                  type="textarea"
                  :rows="3"
                  placeholder="输入对该知识点的具体描述或期望内容，帮助 AI 更准确地理解你想要学习的内容。例如：我想学习如何在对话中暗示人物的真实想法，而不是直接说出来..."
                />
              </el-form-item>
              
              <el-form-item label="分类（可选）">
                <el-select v-model="aiGenerateForm.category" placeholder="AI 会自动判断分类" clearable>
                  <el-option
                    v-for="cat in categories"
                    :key="cat.key"
                    :label="cat.name"
                    :value="cat.key"
                  />
                </el-select>
              </el-form-item>
              
              <el-button 
                type="primary" 
                :loading="generating" 
                @click="handleGenerate"
              >
                {{ generating ? '生成中...' : '生成知识点' }}
              </el-button>
            </el-form>
            
            <!-- 生成结果预览 -->
            <div v-if="generatedSkill" class="generated-preview">
              <h4>📝 生成结果预览</h4>
              
              <div class="preview-header">
                <el-tag>{{ getCategoryName(generatedSkill.category) }}</el-tag>
                <el-tag :type="getDifficulty(generatedSkill.difficulty).type">
                  {{ getDifficulty(generatedSkill.difficulty).label }}
                </el-tag>
              </div>
              
              <h3>{{ generatedSkill.name }}</h3>
              <p class="preview-summary">{{ generatedSkill.summary }}</p>
              
              <div class="preview-section">
                <h5>核心要点</h5>
                <ul>
                  <li v-for="(point, i) in generatedSkill.keyPoints" :key="i">{{ point }}</li>
                </ul>
              </div>
              
              <div class="preview-section" v-if="generatedSkill.examples?.length">
                <h5>示例 ({{ generatedSkill.examples.length }} 个)</h5>
                <p class="preview-hint">{{ generatedSkill.examples[0].title }}</p>
              </div>
              
              <el-button type="success" @click="saveGeneratedSkill">
                保存到知识库
              </el-button>
            </div>
          </div>
        </el-tab-pane>
        
        <el-tab-pane label="手动添加" name="manual">
          <el-form :model="manualForm" label-position="top">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="技巧名称" required>
                  <el-input v-model="manualForm.name" placeholder="输入技巧名称" />
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="分类" required>
                  <el-select v-model="manualForm.category">
                    <el-option
                      v-for="cat in categories"
                      :key="cat.key"
                      :label="cat.name"
                      :value="cat.key"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="6">
                <el-form-item label="难度">
                  <el-select v-model="manualForm.difficulty">
                    <el-option
                      v-for="item in difficultyOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            
            <el-form-item label="简短描述">
              <el-input 
                v-model="manualForm.summary" 
                placeholder="50字以内的简短描述"
                maxlength="50"
                show-word-limit
              />
            </el-form-item>
            
            <el-form-item label="详细讲解">
              <el-input 
                v-model="manualForm.content" 
                type="textarea"
                :rows="6"
                placeholder="详细的技巧讲解（支持 Markdown 格式）"
              />
            </el-form-item>
            
            <el-form-item label="核心要点">
              <div v-for="(point, index) in manualForm.key_points" :key="index" class="array-item">
                <el-input v-model="manualForm.key_points[index]" placeholder="输入要点" />
                <el-button text type="danger" @click="removeKeyPoint(index)">删除</el-button>
              </div>
              <el-button text type="primary" @click="addKeyPoint">+ 添加要点</el-button>
            </el-form-item>
            
            <el-form-item label="练习建议">
              <el-input 
                v-model="manualForm.practice_advice" 
                type="textarea"
                :rows="2"
                placeholder="如何针对性练习这个技巧"
              />
            </el-form-item>
            
            <el-button type="success" @click="saveManualSkill">保存</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>
    
    <!-- 预设技巧管理对话框 -->
    <el-dialog 
      v-model="presetDialogVisible" 
      title="📚 预设技巧管理"
      width="600px"
    >
      <div class="preset-dialog-content">
        <el-alert
          type="info"
          :closable="false"
          show-icon
        >
          <template #title>
            系统内置了 {{ presetList.length }} 个精选写作技巧知识点，涵盖对白、描写、叙事、结构、情感等多个方面。
          </template>
        </el-alert>
        
        <div class="preset-status" v-if="presetStatus.initialized">
          <el-tag type="success">已初始化</el-tag>
          <span>当前已导入 {{ presetStatus.presetCount }} / {{ presetStatus.totalPresets }} 个预设</span>
        </div>
        
        <div class="preset-list" v-loading="presetLoading">
          <div 
            v-for="skill in presetList" 
            :key="skill.name"
            class="preset-item"
            :class="{ exists: skill.exists }"
          >
            <div class="preset-info">
              <span class="preset-name">{{ skill.name }}</span>
              <span class="preset-meta">
                <el-tag size="small" type="info">{{ getCategoryName(skill.category) }}</el-tag>
                <el-tag size="small" :type="getDifficulty(skill.difficulty).type">
                  {{ getDifficulty(skill.difficulty).label }}
                </el-tag>
              </span>
            </div>
            <el-tag v-if="skill.exists" size="small" type="success">已导入</el-tag>
          </div>
        </div>
        
        <div class="preset-actions">
          <el-button 
            type="primary"
            :disabled="presetStatus.presetCount >= presetStatus.totalPresets"
            @click="handleInitPresets(false)"
          >
            {{ presetStatus.initialized ? '补充缺失的预设' : '一键导入全部' }}
          </el-button>
          <el-button 
            v-if="presetStatus.initialized"
            type="warning" 
            @click="handleInitPresets(true)"
          >
            重新初始化
          </el-button>
        </div>
      </div>
    </el-dialog>
    
    <!-- 导入导出对话框 -->
    <el-dialog 
      v-model="importExportDialogVisible" 
      :title="importExportMode === 'export' ? '📤 导出知识点' : '📥 导入知识点'"
      width="600px"
    >
      <div class="import-export-content">
        <!-- 导出面板 -->
        <div v-if="importExportMode === 'export'" class="export-panel">
          <el-form label-position="top">
            <el-form-item label="导出范围">
              <el-radio-group v-model="exportOptions.type">
                <el-radio value="user">仅用户创建的</el-radio>
                <el-radio value="category">按分类导出</el-radio>
                <el-radio value="all">全部（包含预设）</el-radio>
              </el-radio-group>
            </el-form-item>
            
            <el-form-item v-if="exportOptions.type === 'category'" label="选择分类">
              <el-select v-model="exportOptions.category" placeholder="选择要导出的分类">
                <el-option
                  v-for="cat in categories"
                  :key="cat.key"
                  :label="cat.name"
                  :value="cat.key"
                />
              </el-select>
            </el-form-item>
          </el-form>
          
          <div class="export-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>导出的 JSON 文件可以分享给其他用户，或用于备份</span>
          </div>
          
          <el-button type="primary" :icon="Download" @click="handleExport">
            导出
          </el-button>
        </div>
        
        <!-- 导入面板 -->
        <div v-else class="import-panel">
          <el-form label-position="top">
            <el-form-item label="选择文件">
              <input 
                type="file" 
                accept=".json"
                @change="handleFileSelect"
                class="file-input"
              />
            </el-form-item>
            
            <el-form-item label="或粘贴 JSON 数据">
              <el-input
                v-model="importData"
                type="textarea"
                :rows="10"
                placeholder='粘贴导出的 JSON 数据，格式如：
{
  "skills": [
    { "name": "技巧名称", "category": "dialogue", ... }
  ]
}'
              />
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="importOptions.overwrite">
                覆盖已存在的同名知识点
              </el-checkbox>
            </el-form-item>
          </el-form>
          
          <div class="import-tip">
            <el-icon><InfoFilled /></el-icon>
            <span>系统会自动去重，同名知识点默认跳过（除非勾选覆盖）</span>
          </div>
          
          <el-button 
            type="primary" 
            :icon="Upload" 
            :loading="importing"
            @click="handleImport"
          >
            {{ importing ? '导入中...' : '导入' }}
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.skills-page {
  max-width: 1200px;
  margin: 0 auto;
  padding-bottom: 40px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.page-header h1 {
  margin: 0 0 8px;
  font-size: 24px;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

/* 分类卡片 */
.category-cards {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.category-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  white-space: nowrap;
}

.category-card:hover {
  background: #e6f0ff;
}

.category-card.active {
  background: #409eff;
  color: white;
}

.cat-icon {
  font-size: 20px;
}

.cat-name {
  font-size: 14px;
  font-weight: 500;
}

/* 筛选栏 */
.filter-card {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 知识点网格 */
.skills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  min-height: 200px;
}

.skill-card {
  display: flex;
  flex-direction: column;
}

.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.skill-category {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #909399;
}

.skill-category .cat-icon {
  font-size: 16px;
}

.skill-name {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.3s;
}

.skill-name:hover {
  color: #409eff;
}

.skill-summary {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.skill-stats {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 12px;
}

.skill-key-points {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.skill-actions {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

/* 空状态 */
.empty-state {
  grid-column: 1 / -1;
  padding: 60px 0;
}

/* 分页 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}

/* AI 生成表单 */
.ai-generate-form {
  padding: 20px 0;
}

.form-tip {
  margin: 0 0 20px;
  padding: 12px 16px;
  background: #f0f9ff;
  border-radius: 6px;
  color: #409eff;
  font-size: 14px;
}

/* 生成结果预览 */
.generated-preview {
  margin-top: 24px;
  padding: 20px;
  background: #fafafa;
  border-radius: 8px;
}

.generated-preview h4 {
  margin: 0 0 16px;
  font-size: 16px;
}

.preview-header {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.generated-preview h3 {
  margin: 0 0 8px;
  font-size: 18px;
}

.preview-summary {
  margin: 0 0 16px;
  color: #606266;
  font-size: 14px;
}

.preview-section {
  margin-bottom: 16px;
}

.preview-section h5 {
  margin: 0 0 8px;
  font-size: 14px;
  color: #303133;
}

.preview-section ul {
  margin: 0;
  padding-left: 20px;
}

.preview-section li {
  margin-bottom: 4px;
  font-size: 13px;
  color: #606266;
}

.preview-hint {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

/* 数组输入项 */
.array-item {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.array-item .el-input {
  flex: 1;
}

/* 欢迎提示 */
.welcome-alert {
  margin-bottom: 20px;
}

.welcome-alert p {
  margin: 0 0 12px;
}

.welcome-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 头部操作区 */
.header-actions {
  display: flex;
  gap: 12px;
}

/* 预设技巧对话框 */
.preset-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preset-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f0f9eb;
  border-radius: 6px;
}

.preset-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.preset-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
}

.preset-item:last-child {
  border-bottom: none;
}

.preset-item.exists {
  background: #f0f9eb;
}

.preset-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-name {
  font-weight: 500;
}

.preset-meta {
  display: flex;
  gap: 6px;
}

.preset-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  padding-top: 8px;
}

/* 导入导出 */
.import-export-content {
  min-height: 200px;
}

.export-panel,
.import-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.export-tip,
.import-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #f0f9ff;
  border-radius: 6px;
  color: #409eff;
  font-size: 13px;
}

.file-input {
  width: 100%;
  padding: 8px;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  cursor: pointer;
}

.file-input:hover {
  border-color: #409eff;
}
</style>
