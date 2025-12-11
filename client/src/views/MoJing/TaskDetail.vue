<template>
  <div class="task-detail-container">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="nav-title">{{ task?.task_type === 'inkdot' ? '墨点任务' : '墨线任务' }}</span>
      <div class="nav-spacer"></div>
    </div>

    <div class="task-content" v-loading="loading">
      <!-- 任务信息卡 -->
      <div class="task-info-card" v-if="task">
        <div class="task-header">
          <div class="task-type-badge" :class="task.task_type">
            {{ getTaskTypeIcon(task.task_type) }}
          </div>
          <div class="task-meta">
            <h2 class="task-title">{{ task.title }}</h2>
            <div class="task-tags">
              <span class="attr-tag" :style="{ backgroundColor: getAttrColor(task.attr_type) }">
                {{ getAttrName(task.attr_type) }} +{{ task.attr_reward }}
              </span>
              <span class="xp-tag">+{{ task.xp_reward }} XP</span>
              <span class="difficulty-tag" :class="task.difficulty">
                {{ getDifficultyName(task.difficulty) }}
              </span>
            </div>
          </div>
        </div>
        
        <div class="task-description">
          <h4>任务要求</h4>
          <p>{{ task.description }}</p>
          <p v-if="task.requirements" class="requirements">
            💡 {{ task.requirements }}
          </p>
        </div>

        <div class="task-limits">
          <div class="limit-item" v-if="task.time_limit">
            <span class="limit-icon">⏱️</span>
            <span class="limit-text">建议时间: {{ task.time_limit }}分钟</span>
          </div>
          <div class="limit-item" v-if="task.word_limit_max">
            <span class="limit-icon">📝</span>
            <span class="limit-text">字数要求: {{ task.word_limit_min || 0 }}-{{ task.word_limit_max }}字</span>
          </div>
        </div>
      </div>

      <!-- 写作区域 -->
      <div class="writing-section">
        <div class="writing-header">
          <h3>开始创作</h3>
          <div class="writing-stats">
            <span class="word-count">{{ wordCount }} 字</span>
            <span class="time-spent">{{ formatTime(timeSpent) }}</span>
          </div>
        </div>
        
        <el-input
          v-model="content"
          type="textarea"
          :rows="12"
          placeholder="在这里写下你的作品..."
          :disabled="isCompleted"
          @input="handleContentChange"
        />

        <!-- 字数进度条 -->
        <div class="word-progress" v-if="task?.word_limit_max">
          <el-progress 
            :percentage="wordProgressPercent"
            :status="wordProgressStatus"
            :stroke-width="4"
          />
          <span class="word-progress-text">
            {{ wordCount }} / {{ task.word_limit_min || 0 }}-{{ task.word_limit_max }} 字
          </span>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-buttons" v-if="!isCompleted">
        <el-button @click="saveDraft" :loading="saving" :disabled="!content">
          保存草稿
        </el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit" 
          :loading="submitting"
          :disabled="!canSubmit"
        >
          提交作品
        </el-button>
      </div>

      <!-- 已完成状态 -->
      <div class="completion-section" v-if="isCompleted && feedback">
        <div class="score-card">
          <div class="score-circle" :class="getGradeClass(feedback.score)">
            <span class="score-value">{{ feedback.score }}</span>
            <span class="score-grade">{{ getGrade(feedback.score).grade }}</span>
          </div>
          <div class="score-info">
            <div class="xp-earned">+{{ record?.xp_earned || 0 }} XP</div>
            <div class="attr-earned" v-if="record?.attr_type">
              {{ getAttrName(record.attr_type) }} +{{ record.attr_earned }}
            </div>
          </div>
        </div>

        <!-- 维度评分 -->
        <div class="dimension-scores" v-if="feedback.dimensions">
          <h4>维度评分</h4>
          <div class="dimension-list">
            <div 
              v-for="(dim, key) in feedback.dimensions" 
              :key="key" 
              class="dimension-item"
            >
              <div class="dim-header">
                <span class="dim-name">{{ getDimensionName(key) }}</span>
                <span class="dim-score">{{ dim.score }}/20</span>
              </div>
              <el-progress 
                :percentage="dim.score * 5" 
                :stroke-width="4"
                :show-text="false"
              />
              <p class="dim-comment">{{ dim.comment }}</p>
            </div>
          </div>
        </div>

        <!-- 亮点 -->
        <div class="highlights" v-if="feedback.highlights?.length">
          <h4>✨ 亮点</h4>
          <ul>
            <li v-for="(h, i) in feedback.highlights" :key="i">{{ h }}</li>
          </ul>
        </div>

        <!-- 改进建议 -->
        <div class="improvements" v-if="feedback.improvements?.length">
          <h4>💡 改进建议</h4>
          <ul>
            <li v-for="(imp, i) in feedback.improvements" :key="i">{{ imp }}</li>
          </ul>
        </div>

        <!-- 总评 -->
        <div class="overall" v-if="feedback.overall">
          <h4>📝 总评</h4>
          <p>{{ feedback.overall }}</p>
        </div>

        <!-- 新解锁成就 -->
        <div class="new-achievements" v-if="newAchievements?.length">
          <h4>🎉 新解锁成就</h4>
          <div class="achievement-list">
            <div v-for="a in newAchievements" :key="a.id" class="achievement-badge">
              <span class="a-icon">{{ a.icon }}</span>
              <span class="a-name">{{ a.name }}</span>
            </div>
          </div>
        </div>

        <el-button type="primary" @click="goBack" class="back-btn">
          返回任务列表
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { 
  getTaskDetail, 
  startTask, 
  saveTaskDraft, 
  submitTask,
  ATTR_MAP, 
  TASK_TYPE_MAP, 
  DIFFICULTY_MAP,
  getGrade
} from '@/api/mojing';

const route = useRoute();
const router = useRouter();
const taskId = computed(() => route.params.id);

const loading = ref(false);
const saving = ref(false);
const submitting = ref(false);
const task = ref(null);
const record = ref(null);
const content = ref('');
const timeSpent = ref(0);
const feedback = ref(null);
const newAchievements = ref([]);

let timerInterval = null;
let autoSaveInterval = null;

// 计算属性
const wordCount = computed(() => {
  return content.value.replace(/[\s\p{P}]/gu, '').length;
});

const isCompleted = computed(() => {
  return record.value?.status === 'completed';
});

const canSubmit = computed(() => {
  if (!content.value) return false;
  if (!task.value) return true;
  
  const min = task.value.word_limit_min || 0;
  return wordCount.value >= min;
});

const wordProgressPercent = computed(() => {
  if (!task.value?.word_limit_max) return 0;
  return Math.min(100, (wordCount.value / task.value.word_limit_max) * 100);
});

const wordProgressStatus = computed(() => {
  if (!task.value) return '';
  const min = task.value.word_limit_min || 0;
  const max = task.value.word_limit_max;
  
  if (wordCount.value < min) return 'exception';
  if (wordCount.value > max) return 'warning';
  return 'success';
});

// 辅助函数
function getAttrName(attrType) {
  return ATTR_MAP[attrType]?.name || attrType;
}

function getAttrColor(attrType) {
  return ATTR_MAP[attrType]?.color || '#666';
}

function getTaskTypeIcon(taskType) {
  return TASK_TYPE_MAP[taskType]?.icon || '📝';
}

function getDifficultyName(difficulty) {
  return DIFFICULTY_MAP[difficulty]?.name || difficulty;
}

function getDimensionName(key) {
  const names = {
    completion: '任务完成度',
    technique: '技巧运用',
    creativity: '创意表现',
    expression: '语言表达',
    detail: '细节处理'
  };
  return names[key] || key;
}

function getGradeClass(score) {
  if (score >= 95) return 'grade-s';
  if (score >= 85) return 'grade-a';
  if (score >= 75) return 'grade-b';
  if (score >= 60) return 'grade-c';
  return 'grade-d';
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 加载任务详情
async function loadTaskDetail() {
  loading.value = true;
  try {
    const res = await getTaskDetail(taskId.value);
    if (res.success) {
      task.value = res.data.task;
      record.value = res.data.record;
      
      if (record.value) {
        content.value = record.value.content || '';
        timeSpent.value = record.value.time_spent || 0;
        
        if (record.value.ai_feedback) {
          try {
            feedback.value = JSON.parse(record.value.ai_feedback);
          } catch (e) {
            console.error('解析反馈失败', e);
          }
        }
      }
      
      // 如果未开始，自动开始任务
      if (!record.value) {
        await doStartTask();
      }
      
      // 如果未完成，启动计时器
      if (!isCompleted.value) {
        startTimer();
        startAutoSave();
      }
    }
  } catch (error) {
    console.error('加载任务失败:', error);
    ElMessage.error('加载任务失败');
  } finally {
    loading.value = false;
  }
}

// 开始任务
async function doStartTask() {
  try {
    const res = await startTask(taskId.value);
    if (res.success) {
      record.value = res.data.record;
    }
  } catch (error) {
    console.error('开始任务失败:', error);
  }
}

// 启动计时器
function startTimer() {
  timerInterval = setInterval(() => {
    timeSpent.value++;
  }, 1000);
}

// 停止计时器
function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// 启动自动保存
function startAutoSave() {
  autoSaveInterval = setInterval(() => {
    if (content.value && record.value && !isCompleted.value) {
      doSaveDraft(false);
    }
  }, 30000); // 30秒自动保存
}

// 停止自动保存
function stopAutoSave() {
  if (autoSaveInterval) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }
}

// 内容变化处理
function handleContentChange() {
  // 可以在这里添加防抖保存等逻辑
}

// 保存草稿
async function saveDraft() {
  await doSaveDraft(true);
}

async function doSaveDraft(showMessage = true) {
  if (!record.value) return;
  
  saving.value = true;
  try {
    const res = await saveTaskDraft(record.value.id, {
      content: content.value,
      timeSpent: timeSpent.value
    });
    if (res.success) {
      record.value = res.data;
      if (showMessage) {
        ElMessage.success('已保存');
      }
    }
  } catch (error) {
    console.error('保存失败:', error);
    if (showMessage) {
      ElMessage.error('保存失败');
    }
  } finally {
    saving.value = false;
  }
}

// 提交作品
async function handleSubmit() {
  if (!canSubmit.value) {
    ElMessage.warning(`请至少写 ${task.value?.word_limit_min || 0} 字`);
    return;
  }

  try {
    await ElMessageBox.confirm(
      '提交后将进行AI评审，确定提交吗？',
      '确认提交',
      { confirmButtonText: '确定', cancelButtonText: '取消' }
    );
  } catch {
    return;
  }
  
  submitting.value = true;
  stopTimer();
  stopAutoSave();
  
  try {
    const res = await submitTask(record.value.id, {
      content: content.value,
      timeSpent: timeSpent.value
    });
    
    if (res.success) {
      const result = res.data;
      record.value = result.record;
      feedback.value = result.feedback;
      newAchievements.value = result.newAchievements || [];
      
      ElMessage.success('提交成功！');
    }
  } catch (error) {
    console.error('提交失败:', error);
    ElMessage.error('提交失败，请重试');
    // 重启计时器
    startTimer();
    startAutoSave();
  } finally {
    submitting.value = false;
  }
}

// 返回
function goBack() {
  router.push('/mojing');
}

onMounted(() => {
  loadTaskDetail();
});

onUnmounted(() => {
  stopTimer();
  stopAutoSave();
});
</script>

<style scoped>
.task-detail-container {
  min-height: 100vh;
  background: #f5f7fa;
}

.nav-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-title {
  flex: 1;
  text-align: center;
  font-weight: bold;
}

.nav-spacer {
  width: 60px;
}

.task-content {
  padding: 16px;
}

/* 任务信息卡 */
.task-info-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.task-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.task-type-badge {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.task-type-badge.inkdot {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.task-type-badge.inkline {
  background: linear-gradient(135deg, #11998e, #38ef7d);
}

.task-meta {
  flex: 1;
}

.task-title {
  font-size: 18px;
  margin: 0 0 8px 0;
  color: #333;
}

.task-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.attr-tag {
  font-size: 11px;
  color: white;
  padding: 3px 8px;
  border-radius: 10px;
}

.xp-tag {
  font-size: 11px;
  color: #f39c12;
  background: #fff9e6;
  padding: 3px 8px;
  border-radius: 10px;
}

.difficulty-tag {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
}

.difficulty-tag.easy {
  color: #27ae60;
  background: #e8f5e9;
}

.difficulty-tag.normal {
  color: #3498db;
  background: #e3f2fd;
}

.difficulty-tag.hard {
  color: #e74c3c;
  background: #ffebee;
}

.task-description {
  margin-bottom: 16px;
}

.task-description h4 {
  font-size: 14px;
  color: #333;
  margin: 0 0 8px 0;
}

.task-description p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0;
}

.requirements {
  margin-top: 8px !important;
  color: #667eea !important;
  background: #f0f4ff;
  padding: 8px 12px;
  border-radius: 8px;
}

.task-limits {
  display: flex;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.limit-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #666;
}

/* 写作区域 */
.writing-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.writing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.writing-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.writing-stats {
  display: flex;
  gap: 12px;
  font-size: 13px;
  color: #666;
}

.word-count {
  color: #667eea;
  font-weight: bold;
}

.word-progress {
  margin-top: 12px;
}

.word-progress-text {
  font-size: 12px;
  color: #999;
  text-align: right;
  display: block;
  margin-top: 4px;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
}

.action-buttons .el-button {
  flex: 1;
  max-width: 160px;
}

/* 完成区域 */
.completion-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
}

.score-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px;
  margin-bottom: 20px;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.score-value {
  font-size: 28px;
  font-weight: bold;
}

.score-grade {
  font-size: 14px;
  font-weight: bold;
}

.grade-s .score-value, .grade-s .score-grade { color: #ffd700; }
.grade-a .score-value, .grade-a .score-grade { color: #27ae60; }
.grade-b .score-value, .grade-b .score-grade { color: #3498db; }
.grade-c .score-value, .grade-c .score-grade { color: #f39c12; }
.grade-d .score-value, .grade-d .score-grade { color: #e74c3c; }

.score-info {
  color: white;
  text-align: center;
}

.xp-earned {
  font-size: 24px;
  font-weight: bold;
  color: #ffd700;
}

.attr-earned {
  font-size: 14px;
  opacity: 0.9;
  margin-top: 4px;
}

/* 维度评分 */
.dimension-scores h4,
.highlights h4,
.improvements h4,
.overall h4 {
  font-size: 15px;
  color: #333;
  margin: 0 0 12px 0;
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.dimension-item {
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.dim-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.dim-name {
  font-size: 13px;
  color: #333;
}

.dim-score {
  font-size: 13px;
  color: #667eea;
  font-weight: bold;
}

.dim-comment {
  font-size: 12px;
  color: #666;
  margin: 8px 0 0 0;
  line-height: 1.5;
}

/* 亮点和改进 */
.highlights, .improvements, .overall {
  margin-bottom: 20px;
}

.highlights ul, .improvements ul {
  margin: 0;
  padding-left: 20px;
}

.highlights li, .improvements li {
  font-size: 13px;
  color: #666;
  line-height: 1.8;
}

.overall p {
  font-size: 14px;
  color: #666;
  line-height: 1.6;
  margin: 0;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

/* 新成就 */
.new-achievements {
  margin-bottom: 20px;
}

.achievement-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.achievement-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  border-radius: 20px;
  color: #333;
}

.a-icon {
  font-size: 18px;
}

.a-name {
  font-size: 13px;
  font-weight: bold;
}

.back-btn {
  width: 100%;
  margin-top: 12px;
}
</style>
