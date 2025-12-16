<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Reading, Search } from '@element-plus/icons-vue'
import {
  getBookAnalysisStyles,
  getBookAnalysisNovels,
  getNovelChapters,
  analyzeChapterWithStyle,
  getChapterAnalyses
} from '../../api/bookAnalysis'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const analyzing = ref(false)

// 数据
const styles = ref([])
const novels = ref([])
const chapters = ref([])

// 选择状态
const selectedNovel = ref('')
const selectedChapter = ref(null)
const selectedStyle = ref('')

// 拆书详细程度: 'brief' | 'medium' | 'detailed'
const detailLevel = ref('medium')
// 细纲的详细程度（影响生成细纲的粒度）
const outlineDetailLevel = ref('medium')

// 搜索
const searchKeyword = ref('')

// 流派图标和颜色
const styleIcons = {
  emotion_flow: '💭',
  plot_point_flow: '📍',
  structure_flow: '🏗️',
  rhythm_flow: '🎵'
}

const styleColors = {
  emotion_flow: '#e74c3c',
  plot_point_flow: '#3498db',
  structure_flow: '#2ecc71',
  rhythm_flow: '#9b59b6'
}

// 过滤后的小说
const filteredNovels = computed(() => {
  if (!searchKeyword.value) return novels.value
  const keyword = searchKeyword.value.toLowerCase()
  return novels.value.filter(n =>
    n.novel_name.toLowerCase().includes(keyword) ||
    (n.author && n.author.toLowerCase().includes(keyword))
  )
})

// 加载流派
async function loadStyles() {
  try {
    const res = await getBookAnalysisStyles()
    styles.value = res.data || []
  } catch (error) {
    console.error('加载流派失败:', error)
  }
}

// 加载小说列表
async function loadNovels() {
  loading.value = true
  try {
    const res = await getBookAnalysisNovels()
    novels.value = res.data || []
  } catch (error) {
    console.error('加载小说列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 加载章节列表
async function loadChapters(novelName) {
  loading.value = true
  try {
    const res = await getNovelChapters(novelName)
    chapters.value = res.data || []
  } catch (error) {
    console.error('加载章节列表失败:', error)
    ElMessage.error('加载章节列表失败')
  } finally {
    loading.value = false
  }
}

// 选择小说
function selectNovel(novelName) {
  selectedNovel.value = novelName
  selectedChapter.value = null
  loadChapters(novelName)
}

// 选择章节
function selectChapter(chapter) {
  selectedChapter.value = chapter
}

// 选择流派
function selectStyle(styleKey) {
  selectedStyle.value = styleKey
}

// 检查章节是否有指定流派的分析
function hasAnalysis(chapter, styleKey) {
  return chapter.book_analyses?.some(a => a.style_key === styleKey)
}

// 开始拆书分析
async function startAnalysis() {
  if (!selectedChapter.value || !selectedStyle.value) {
    ElMessage.warning('请先选择章节和拆书流派')
    return
  }

  const styleName = styles.value.find(s => s.style_key === selectedStyle.value)?.name || selectedStyle.value
  const hasExisting = hasAnalysis(selectedChapter.value, selectedStyle.value)

  if (hasExisting) {
    try {
      await ElMessageBox.confirm(
        `该章节已有【${styleName}】分析结果，是否重新分析？`,
        '提示',
        { type: 'warning' }
      )
    } catch {
      // 用户取消，直接查看已有结果
      const existingAnalysis = selectedChapter.value.book_analyses.find(a => a.style_key === selectedStyle.value)
      if (existingAnalysis) {
        router.push(`/book-analysis/result/${selectedChapter.value.id}?style=${selectedStyle.value}`)
      }
      return
    }
  }

  analyzing.value = true
  try {
    ElMessage.info(`正在使用【${styleName}】方法分析章节，请稍候...`)

    const res = await analyzeChapterWithStyle({
      chapter_id: selectedChapter.value.id,
      style_key: selectedStyle.value,
      detail_level: detailLevel.value,
      outline_detail_level: outlineDetailLevel.value
    })

    ElMessage.success('拆书分析完成！')

    // 跳转到结果页
    router.push(`/book-analysis/result/${selectedChapter.value.id}?style=${selectedStyle.value}`)
  } catch (error) {
    console.error('拆书分析失败:', error)
    ElMessage.error('拆书分析失败: ' + (error.message || '未知错误'))
  } finally {
    analyzing.value = false
  }
}

// 查看已有分析
function viewExistingAnalysis(chapter, styleKey) {
  router.push(`/book-analysis/result/${chapter.id}?style=${styleKey}`)
}

// 返回
function goBack() {
  if (selectedNovel.value && !selectedChapter.value) {
    selectedNovel.value = ''
    chapters.value = []
  } else {
    router.push('/book-analysis')
  }
}

onMounted(() => {
  loadStyles()
  loadNovels()

  // 处理路由参数
  if (route.query.style) {
    selectedStyle.value = route.query.style
  }
  if (route.query.novel) {
    selectedNovel.value = route.query.novel
    loadChapters(route.query.novel)
  }
})
</script>

<template>
  <div class="select-page" v-loading="loading || analyzing">
    <!-- 顶部导航 -->
    <div class="page-header">
      <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
      <h2>选择章节进行拆书</h2>
    </div>

    <div class="main-content">
      <!-- 左侧：选择区域 -->
      <div class="select-panel">
        <!-- 小说列表 -->
        <div class="select-section" v-if="!selectedNovel">
          <div class="section-title">
            <el-icon><Reading /></el-icon>
            选择小说
          </div>

          <el-input
            v-model="searchKeyword"
            placeholder="搜索小说..."
            :prefix-icon="Search"
            clearable
            class="search-input"
          />

          <div class="novel-list">
            <div
              v-for="novel in filteredNovels"
              :key="novel.novel_name"
              class="novel-item"
              @click="selectNovel(novel.novel_name)"
            >
              <div class="novel-info">
                <div class="novel-name">{{ novel.novel_name }}</div>
                <div class="novel-meta">
                  <span v-if="novel.author">{{ novel.author }} · </span>
                  {{ novel.chapter_count }} 章 · {{ novel.total_words?.toLocaleString() }} 字
                </div>
              </div>
              <el-icon class="arrow-icon"><ArrowLeft style="transform: rotate(180deg)" /></el-icon>
            </div>
          </div>

          <el-empty v-if="filteredNovels.length === 0" description="暂无小说">
            <el-button type="primary" @click="router.push('/chapters')">上传小说</el-button>
          </el-empty>
        </div>

        <!-- 章节列表 -->
        <div class="select-section" v-else>
          <div class="section-title">
            <span class="novel-badge">{{ selectedNovel }}</span>
            选择章节
          </div>

          <div class="chapter-list">
            <div
              v-for="chapter in chapters"
              :key="chapter.id"
              :class="['chapter-item', { active: selectedChapter?.id === chapter.id }]"
              @click="selectChapter(chapter)"
            >
              <div class="chapter-info">
                <div class="chapter-title">{{ chapter.title }}</div>
                <div class="chapter-meta">{{ chapter.word_count }} 字</div>
              </div>
              <div class="chapter-tags" v-if="chapter.book_analyses?.length">
                <el-tag
                  v-for="analysis in chapter.book_analyses"
                  :key="analysis.style_key"
                  size="small"
                  type="success"
                  @click.stop="viewExistingAnalysis(chapter, analysis.style_key)"
                >
                  {{ styleIcons[analysis.style_key] }}
                </el-tag>
              </div>
            </div>
          </div>

          <el-empty v-if="chapters.length === 0" description="该小说暂无章节" />
        </div>
      </div>

      <!-- 右侧：流派选择和操作 -->
      <div class="action-panel">
        <!-- 流派选择 -->
        <div class="style-section">
          <div class="section-title">🎯 选择拆书流派</div>

          <div class="style-list">
            <div
              v-for="style in styles"
              :key="style.style_key"
              :class="['style-item', { active: selectedStyle === style.style_key }]"
              :style="{ '--accent-color': styleColors[style.style_key] || '#409eff' }"
              @click="selectStyle(style.style_key)"
            >
              <div class="style-icon">{{ styleIcons[style.style_key] || '📖' }}</div>
              <div class="style-info">
                <div class="style-name">{{ style.name }}</div>
                <div class="style-desc">{{ style.description }}</div>
              </div>
              <el-icon class="check-icon" v-if="selectedStyle === style.style_key">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </el-icon>
            </div>
          </div>
        </div>

        <!-- 选择预览 -->
        <div class="preview-section" v-if="selectedChapter">
          <div class="section-title">📋 已选择</div>
          <div class="preview-card">
            <div class="preview-item">
              <span class="label">小说：</span>
              <span class="value">{{ selectedNovel }}</span>
            </div>
            <div class="preview-item">
              <span class="label">章节：</span>
              <span class="value">{{ selectedChapter.title }}</span>
            </div>
            <div class="preview-item">
              <span class="label">字数：</span>
              <span class="value">{{ selectedChapter.word_count }} 字</span>
            </div>
            <div class="preview-item" v-if="selectedStyle">
              <span class="label">流派：</span>
              <span class="value">
                {{ styleIcons[selectedStyle] }}
                {{ styles.find(s => s.style_key === selectedStyle)?.name }}
              </span>
            </div>            <div class="preview-item">
              <span class="label">详细程度：</span>
              <span class="value">
                <el-select v-model="detailLevel" size="small" placeholder="选择详细程度" style="width:120px; margin-right:8px;">
                  <el-option label="简略" value="brief" />
                  <el-option label="中等" value="medium" />
                  <el-option label="详细" value="detailed" />
                </el-select>
                <el-select v-model="outlineDetailLevel" size="small" placeholder="细纲粒度" style="width:120px">
                  <el-option label="简略" value="brief" />
                  <el-option label="中等" value="medium" />
                  <el-option label="详细" value="detailed" />
                </el-select>
                <div style="font-size:12px;color:#909399;margin-top:6px">（第一个控制批注密度，第二个控制细纲粒度）</div>
              </span>
            </div>          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="action-buttons">
          <el-button
            type="primary"
            size="large"
            :disabled="!selectedChapter || !selectedStyle"
            :loading="analyzing"
            @click="startAnalysis"
          >
            {{ analyzing ? 'AI 分析中...' : '开始拆书分析' }}
          </el-button>

          <el-button
            size="large"
            v-if="selectedChapter && hasAnalysis(selectedChapter, selectedStyle)"
            @click="viewExistingAnalysis(selectedChapter, selectedStyle)"
          >
            查看已有分析
          </el-button>
          
          <el-divider v-if="selectedChapter" />
          
          <el-button
            size="large"
            type="info"
            v-if="selectedChapter"
            @click="$router.push(`/book-analysis/manual/${selectedChapter.id}`)"
          >
            ✏️ 手动拆书批注
          </el-button>
          <p class="manual-hint" v-if="selectedChapter">
            不使用 AI，自己添加批注和细纲
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 100px);
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
}

.main-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
}

/* 选择面板 */
.select-panel {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.select-section {
  height: 100%;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #303133;
}

.novel-badge {
  background: #409eff;
  color: white;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
}

.search-input {
  margin-bottom: 16px;
}

/* 小说列表 */
.novel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.novel-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.novel-item:hover {
  background: #e6f7ff;
  transform: translateX(4px);
}

.novel-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.novel-meta {
  font-size: 12px;
  color: #909399;
}

.arrow-icon {
  color: #c0c4cc;
}

/* 章节列表 */
.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.chapter-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.chapter-item:hover {
  background: #e6f7ff;
}

.chapter-item.active {
  border-color: #409eff;
  background: #e6f7ff;
}

.chapter-title {
  font-weight: 500;
  margin-bottom: 2px;
}

.chapter-meta {
  font-size: 12px;
  color: #909399;
}

.chapter-tags {
  display: flex;
  gap: 4px;
}

/* 操作面板 */
.action-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.style-section,
.preview-section {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.style-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.style-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 2px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.style-item:hover {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 5%, white);
}

.style-item.active {
  border-color: var(--accent-color);
  background: color-mix(in srgb, var(--accent-color) 10%, white);
}

.style-icon {
  font-size: 28px;
}

.style-info {
  flex: 1;
}

.style-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.style-desc {
  font-size: 12px;
  color: #909399;
}

.check-icon {
  color: var(--accent-color);
  font-size: 20px;
}

/* 预览卡片 */
.preview-card {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
}

.preview-item {
  display: flex;
  margin-bottom: 8px;
}

.preview-item:last-child {
  margin-bottom: 0;
}

.preview-item .label {
  color: #909399;
  width: 60px;
}

.preview-item .value {
  color: #303133;
  font-weight: 500;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-buttons .el-button {
  width: 100%;
}

.manual-hint {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: #909399;
}

/* 响应式 */
@media (max-width: 1024px) {
  .main-content {
    grid-template-columns: 1fr;
  }

  .action-panel {
    order: -1;
  }
}
</style>
