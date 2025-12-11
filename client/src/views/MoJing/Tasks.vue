<template>
  <div class="tasks-container">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="nav-title">今日任务</span>
      <el-button text @click="refreshTasks" :loading="refreshing">
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <div class="tasks-content" v-loading="loading">
      <!-- 今日进度 -->
      <div class="today-stats">
        <div class="stat-item">
          <span class="stat-value">{{ completedCount }}</span>
          <span class="stat-label">已完成</span>
        </div>
        <div class="stat-divider">/</div>
        <div class="stat-item">
          <span class="stat-value">{{ totalCount }}</span>
          <span class="stat-label">总任务</span>
        </div>
        <div class="stat-divider">|</div>
        <div class="stat-item">
          <span class="stat-value xp">+{{ todayXP }}</span>
          <span class="stat-label">今日XP</span>
        </div>
      </div>

      <!-- 任务类型标签 -->
      <div class="task-tabs">
        <div 
          v-for="tab in taskTabs" 
          :key="tab.value"
          :class="['tab-item', { active: currentTab === tab.value }]"
          @click="currentTab = tab.value"
        >
          {{ tab.icon }} {{ tab.label }}
          <span class="tab-count">{{ getTabCount(tab.value) }}</span>
        </div>
      </div>

      <!-- 任务列表 -->
      <div class="tasks-list">
        <div 
          v-for="task in filteredTasks" 
          :key="task.id"
          :class="['task-card', { completed: task.isCompleted }]"
          @click="goToTask(task)"
        >
          <div class="task-type-badge" :class="task.task_type">
            {{ getTaskTypeIcon(task.task_type) }}
          </div>
          <div class="task-content">
            <div class="task-title">{{ task.title }}</div>
            <div class="task-desc">{{ task.description }}</div>
            <div class="task-meta">
              <span class="attr-tag" :style="{ backgroundColor: getAttrColor(task.attr_type) }">
                {{ getAttrName(task.attr_type) }}
              </span>
              <span class="xp-tag">+{{ task.xp_reward }} XP</span>
              <span class="difficulty-tag" :class="task.difficulty">
                {{ getDifficultyName(task.difficulty) }}
              </span>
              <span class="time-tag" v-if="task.time_limit">
                ⏱️ {{ task.time_limit }}分钟
              </span>
            </div>
          </div>
          <div class="task-status">
            <el-icon v-if="task.isCompleted" class="completed-icon"><Check /></el-icon>
            <el-icon v-else class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredTasks.length === 0 && !loading" class="empty-tasks">
          <span class="empty-icon">📝</span>
          <p>暂无{{ currentTab === 'all' ? '' : taskTabMap[currentTab] }}任务</p>
          <el-button @click="refreshTasks" :loading="refreshing">刷新任务</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Check, ArrowRight, ArrowLeft, Refresh } from '@element-plus/icons-vue';
import { 
  getTodayTasks, 
  triggerTaskGeneration,
  ATTR_MAP, 
  TASK_TYPE_MAP, 
  DIFFICULTY_MAP 
} from '@/api/mojing';

const router = useRouter();
const loading = ref(false);
const refreshing = ref(false);
const allTasks = ref([]);
const currentTab = ref('all');
const todayXP = ref(0);

const taskTabs = [
  { label: '全部', value: 'all', icon: '📋' },
  { label: '墨点', value: 'inkdot', icon: '🔵' },
  { label: '墨线', value: 'inkline', icon: '📝' }
];

const taskTabMap = {
  all: '',
  inkdot: '墨点',
  inkline: '墨线'
};

const filteredTasks = computed(() => {
  if (currentTab.value === 'all') return allTasks.value;
  return allTasks.value.filter(t => t.task_type === currentTab.value);
});

const totalCount = computed(() => allTasks.value.length);
const completedCount = computed(() => allTasks.value.filter(t => t.isCompleted).length);

function getTabCount(tabValue) {
  if (tabValue === 'all') return allTasks.value.length;
  return allTasks.value.filter(t => t.task_type === tabValue).length;
}

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

async function loadTasks() {
  loading.value = true;
  try {
    const res = await getTodayTasks('all');
    if (res.success) {
      allTasks.value = res.data.tasks || [];
      // 计算今日XP（已完成任务的XP总和）
      todayXP.value = allTasks.value
        .filter(t => t.isCompleted)
        .reduce((sum, t) => sum + (t.xp_reward || 0), 0);
    }
  } catch (error) {
    console.error('加载任务失败:', error);
    ElMessage.error('加载任务失败');
  } finally {
    loading.value = false;
  }
}

async function refreshTasks() {
  refreshing.value = true;
  try {
    await triggerTaskGeneration({ preset: true });
    await loadTasks();
    ElMessage.success('任务已刷新');
  } catch (error) {
    console.error('刷新任务失败:', error);
    ElMessage.error('刷新失败');
  } finally {
    refreshing.value = false;
  }
}

function goToTask(task) {
  router.push(`/mojing/task/${task.id}`);
}

function goBack() {
  router.push('/mojing');
}

onMounted(() => {
  loadTasks();
});
</script>

<style scoped>
.tasks-container {
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
  font-size: 16px;
}

.tasks-content {
  padding: 16px;
}

/* 今日统计 */
.today-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  color: white;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 16px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
}

.stat-value.xp {
  color: #ffd700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
}

.stat-divider {
  font-size: 18px;
  opacity: 0.5;
}

/* 任务标签 */
.task-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.task-tabs::-webkit-scrollbar {
  display: none;
}

.tab-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 10px 16px;
  background: white;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item.active {
  background: #667eea;
  color: white;
}

.tab-count {
  font-size: 11px;
  opacity: 0.7;
}

/* 任务列表 */
.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: white;
  border-radius: 16px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.task-card:active {
  transform: scale(0.98);
}

.task-card.completed {
  opacity: 0.6;
  background: #f9f9f9;
}

.task-type-badge {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.task-type-badge.inkdot {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.task-type-badge.inkline {
  background: linear-gradient(135deg, #11998e, #38ef7d);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
}

.task-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.task-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.attr-tag {
  font-size: 10px;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
}

.xp-tag {
  font-size: 10px;
  color: #f39c12;
  background: #fff9e6;
  padding: 2px 8px;
  border-radius: 10px;
}

.difficulty-tag {
  font-size: 10px;
  padding: 2px 8px;
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

.time-tag {
  font-size: 10px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.task-status {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.completed-icon {
  font-size: 20px;
  color: #27ae60;
}

.arrow-icon {
  font-size: 16px;
  color: #ccc;
}

/* 空状态 */
.empty-tasks {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.empty-tasks p {
  margin: 0 0 16px 0;
  font-size: 14px;
}
</style>
