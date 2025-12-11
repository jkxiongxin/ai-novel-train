<template>
  <div class="mojing-container">
    <!-- 顶部用户信息卡 -->
    <div class="profile-card">
      <div class="profile-header">
        <div class="avatar-section">
          <div class="avatar">
            <span class="avatar-text">{{ profile?.nickname?.[0] || '墨' }}</span>
          </div>
          <div class="level-badge">Lv.{{ profile?.current_level || 1 }}</div>
        </div>
        <div class="profile-info">
          <div class="nickname">{{ profile?.nickname || '故事编织者' }}</div>
          <div class="title">{{ profile?.current_title || '墨境新人' }}</div>
          <div class="stage-tag">{{ profile?.levelConfig?.stage || '新手村' }}</div>
        </div>
        <div class="streak-info" v-if="profile?.current_streak > 0">
          <span class="streak-icon">🔥</span>
          <span class="streak-count">{{ profile?.current_streak }}</span>
          <span class="streak-label">连续</span>
        </div>
      </div>
      
      <!-- 经验值进度条 -->
      <div class="xp-section">
        <div class="xp-info">
          <span class="xp-current">{{ formatXP(profile?.total_xp || 0) }} XP</span>
          <span class="xp-next" v-if="profile?.nextLevelConfig">
            下一级: {{ formatXP(profile?.nextLevelConfig?.required_xp || 0) }} XP
          </span>
        </div>
        <el-progress 
          :percentage="profile?.levelProgress || 0" 
          :stroke-width="8"
          :show-text="false"
          color="#667eea"
        />
      </div>
    </div>

    <!-- 六维属性雷达图 -->
    <div class="attributes-card">
      <div class="card-header">
        <h3>六维属性</h3>
        <router-link to="/mojing/profile" class="view-detail">详情 →</router-link>
      </div>
      <div class="radar-chart" ref="radarChart"></div>
    </div>

    <!-- 今日进度 -->
    <div class="today-progress">
      <div class="progress-header">
        <h3>今日进度</h3>
        <span class="today-xp">+{{ homeData?.today?.xpEarned || 0 }} XP</span>
      </div>
      <div class="progress-stats">
        <div class="stat-item">
          <span class="stat-value">{{ homeData?.today?.completed || 0 }}</span>
          <span class="stat-label">已完成</span>
        </div>
        <div class="stat-divider">/</div>
        <div class="stat-item">
          <span class="stat-value">{{ homeData?.today?.total || 0 }}</span>
          <span class="stat-label">任务总数</span>
        </div>
      </div>
    </div>

    <!-- 每日挑战 -->
    <div class="daily-challenge" v-if="homeData?.dailyChallenge">
      <div class="challenge-header">
        <span class="challenge-icon">🎯</span>
        <span class="challenge-title">{{ homeData.dailyChallenge.title }}</span>
        <span class="challenge-reward">+{{ homeData.dailyChallenge.xp_reward }} XP</span>
      </div>
      <div class="challenge-desc">{{ homeData.dailyChallenge.description }}</div>
      <el-progress 
        :percentage="Math.min(100, (homeData.dailyChallenge.current_value / homeData.dailyChallenge.target_value) * 100)"
        :status="homeData.dailyChallenge.is_completed ? 'success' : ''"
        :stroke-width="6"
      />
      <div class="challenge-progress-text">
        {{ homeData.dailyChallenge.current_value }} / {{ homeData.dailyChallenge.target_value }}
        <span v-if="homeData.dailyChallenge.is_completed" class="completed-badge">✓ 已完成</span>
      </div>
    </div>

    <!-- 今日任务卡片 -->
    <div class="tasks-section">
      <div class="section-header">
        <h3>今日任务</h3>
        <router-link to="/mojing/tasks" class="view-all">查看全部 →</router-link>
      </div>
      
      <div class="task-tabs">
        <div 
          v-for="tab in taskTabs" 
          :key="tab.value"
          :class="['tab-item', { active: currentTab === tab.value }]"
          @click="currentTab = tab.value"
        >
          {{ tab.icon }} {{ tab.label }}
        </div>
      </div>

      <div class="tasks-list" v-loading="loading">
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
            </div>
          </div>
          <div class="task-status">
            <el-icon v-if="task.isCompleted" class="completed-icon"><Check /></el-icon>
            <el-icon v-else class="arrow-icon"><ArrowRight /></el-icon>
          </div>
        </div>

        <div v-if="filteredTasks.length === 0" class="empty-tasks">
          <p>暂无任务，点击下方按钮刷新</p>
          <el-button @click="refreshTasks" :loading="refreshing">刷新任务</el-button>
        </div>
      </div>
    </div>

    <!-- 周挑战入口 -->
    <div class="weekly-challenge" v-if="homeData?.weeklyChallenge" @click="goToWeeklyChallenge">
      <div class="weekly-badge">📖 本周墨章</div>
      <div class="weekly-title">{{ homeData.weeklyChallenge.title }}</div>
      <div class="weekly-theme">主题: {{ homeData.weeklyChallenge.theme }}</div>
      <div class="weekly-reward">+{{ homeData.weeklyChallenge.xp_reward }} XP</div>
      <el-icon class="weekly-arrow"><ArrowRight /></el-icon>
    </div>

    <!-- 即将解锁的成就 -->
    <div class="next-achievements" v-if="homeData?.nextAchievements?.length">
      <div class="section-header">
        <h3>即将解锁</h3>
        <router-link to="/mojing/achievements" class="view-all">全部成就 →</router-link>
      </div>
      <div class="achievements-list">
        <div 
          v-for="achievement in homeData.nextAchievements" 
          :key="achievement.id"
          class="achievement-item"
        >
          <span class="achievement-icon">{{ achievement.icon }}</span>
          <div class="achievement-info">
            <div class="achievement-name">{{ achievement.name }}</div>
            <el-progress 
              :percentage="achievement.progress" 
              :stroke-width="4"
              :show-text="false"
            />
            <div class="achievement-progress">{{ achievement.current }}/{{ achievement.target }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部快捷入口 -->
    <div class="quick-actions">
      <router-link to="/mojing/profile" class="action-btn">
        <span class="action-icon">👤</span>
        <span class="action-label">我的档案</span>
      </router-link>
      <router-link to="/mojing/achievements" class="action-btn">
        <span class="action-icon">🏆</span>
        <span class="action-label">成就墙</span>
      </router-link>
      <router-link to="/mojing/history" class="action-btn">
        <span class="action-icon">📊</span>
        <span class="action-label">成长记录</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Check, ArrowRight } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { 
  getHomeData, 
  triggerTaskGeneration,
  ATTR_MAP, 
  TASK_TYPE_MAP, 
  DIFFICULTY_MAP,
  formatXP 
} from '@/api/mojing';

const router = useRouter();
const loading = ref(false);
const refreshing = ref(false);
const homeData = ref(null);
const profile = computed(() => homeData.value?.profile);
const currentTab = ref('all');
const radarChart = ref(null);
let chartInstance = null;

const taskTabs = [
  { label: '全部', value: 'all', icon: '📋' },
  { label: '墨点', value: 'inkdot', icon: '🔵' },
  { label: '墨线', value: 'inkline', icon: '📝' }
];

const filteredTasks = computed(() => {
  if (!homeData.value?.today?.tasks) return [];
  if (currentTab.value === 'all') return homeData.value.today.tasks;
  return homeData.value.today.tasks.filter(t => t.task_type === currentTab.value);
});

// 获取属性名称
function getAttrName(attrType) {
  return ATTR_MAP[attrType]?.name || attrType;
}

// 获取属性颜色
function getAttrColor(attrType) {
  return ATTR_MAP[attrType]?.color || '#666';
}

// 获取任务类型图标
function getTaskTypeIcon(taskType) {
  return TASK_TYPE_MAP[taskType]?.icon || '📝';
}

// 获取难度名称
function getDifficultyName(difficulty) {
  return DIFFICULTY_MAP[difficulty]?.name || difficulty;
}

// 加载首页数据
async function loadHomeData() {
  loading.value = true;
  try {
    const res = await getHomeData();
    console.log('墨境首页数据:', res);
    // request.js 的响应拦截器已经返回 response.data，所以 res 就是 { success, data }
    if (res.success) {
      homeData.value = res.data;
      // 更新雷达图
      if (chartInstance) {
        updateRadarChart();
      }
    } else {
      console.error('API返回错误:', res);
    }
  } catch (error) {
    console.error('加载首页数据失败:', error);
    ElMessage.error('加载失败，请刷新重试');
  } finally {
    loading.value = false;
  }
}

// 刷新任务
async function refreshTasks() {
  refreshing.value = true;
  try {
    await triggerTaskGeneration({ preset: true });
    await loadHomeData();
    ElMessage.success('任务已刷新');
  } catch (error) {
    console.error('刷新任务失败:', error);
    ElMessage.error('刷新失败');
  } finally {
    refreshing.value = false;
  }
}

// 跳转到任务详情
function goToTask(task) {
  router.push(`/mojing/task/${task.id}`);
}

// 跳转到周挑战
function goToWeeklyChallenge() {
  router.push('/mojing/weekly');
}

// 初始化雷达图
function initRadarChart() {
  if (!radarChart.value) return;
  
  chartInstance = echarts.init(radarChart.value);
  updateRadarChart();
  
  // 响应式
  window.addEventListener('resize', () => {
    chartInstance?.resize();
  });
}

// 更新雷达图数据
function updateRadarChart() {
  if (!chartInstance || !profile.value) return;
  
  const attrs = profile.value.attributes;
  const indicator = Object.keys(ATTR_MAP).map(key => ({
    name: ATTR_MAP[key].name,
    max: 100
  }));
  
  const values = Object.keys(ATTR_MAP).map(key => attrs?.[key]?.value || 10);
  
  chartInstance.setOption({
    radar: {
      indicator,
      radius: '65%',
      axisName: {
        color: '#666',
        fontSize: 11
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(102, 126, 234, 0.05)', 'rgba(102, 126, 234, 0.1)']
        }
      }
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '当前属性',
        areaStyle: {
          color: 'rgba(102, 126, 234, 0.3)'
        },
        lineStyle: {
          color: '#667eea'
        },
        itemStyle: {
          color: '#667eea'
        }
      }]
    }]
  });
}

onMounted(() => {
  loadHomeData();
  setTimeout(initRadarChart, 100);
});

onUnmounted(() => {
  chartInstance?.dispose();
});

// 监听 profile 变化更新雷达图
watch(() => profile.value, () => {
  if (chartInstance) {
    updateRadarChart();
  }
}, { deep: true });
</script>

<style scoped>
.mojing-container {
  padding: 16px;
  padding-bottom: 80px;
  background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

/* 用户信息卡 */
.profile-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.avatar-section {
  position: relative;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  color: white;
  font-size: 24px;
  font-weight: bold;
}

.level-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #ffd700;
  color: #333;
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 8px;
  border: 2px solid white;
}

.profile-info {
  flex: 1;
}

.nickname {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.title {
  font-size: 14px;
  color: #667eea;
  margin: 4px 0;
}

.stage-tag {
  display: inline-block;
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 10px;
}

.streak-info {
  text-align: center;
  background: linear-gradient(135deg, #ff6b6b, #ffa502);
  padding: 8px 12px;
  border-radius: 12px;
  color: white;
}

.streak-icon {
  font-size: 20px;
}

.streak-count {
  font-size: 20px;
  font-weight: bold;
  display: block;
}

.streak-label {
  font-size: 10px;
}

.xp-section {
  margin-top: 12px;
}

.xp-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
}

.xp-current {
  color: #667eea;
  font-weight: bold;
}

.xp-next {
  color: #999;
}

/* 六维属性卡 */
.attributes-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.view-detail {
  font-size: 12px;
  color: #667eea;
  text-decoration: none;
}

.radar-chart {
  width: 100%;
  height: 200px;
}

/* 今日进度 */
.today-progress {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.today-xp {
  color: #27ae60;
  font-weight: bold;
}

.progress-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #667eea;
}

.stat-label {
  font-size: 12px;
  color: #999;
  display: block;
}

.stat-divider {
  font-size: 24px;
  color: #ddd;
}

/* 每日挑战 */
.daily-challenge {
  background: linear-gradient(135deg, #fff9e6, #fff3cd);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid #ffe082;
}

.challenge-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.challenge-icon {
  font-size: 20px;
}

.challenge-title {
  flex: 1;
  font-weight: bold;
  color: #333;
}

.challenge-reward {
  color: #f39c12;
  font-weight: bold;
  font-size: 14px;
}

.challenge-desc {
  font-size: 14px;
  color: #666;
  margin-bottom: 12px;
}

.challenge-progress-text {
  font-size: 12px;
  color: #666;
  text-align: right;
  margin-top: 4px;
}

.completed-badge {
  color: #27ae60;
  margin-left: 8px;
}

/* 任务区域 */
.tasks-section {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.view-all {
  font-size: 12px;
  color: #667eea;
  text-decoration: none;
}

.task-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-item {
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item.active {
  background: #667eea;
  color: white;
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.task-card:hover {
  background: #f0f0f0;
}

.task-card.completed {
  opacity: 0.6;
}

.task-type-badge {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
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
  font-weight: bold;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 6px;
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
  padding: 2px 6px;
  border-radius: 8px;
}

.xp-tag {
  font-size: 10px;
  color: #f39c12;
  background: #fff9e6;
  padding: 2px 6px;
  border-radius: 8px;
}

.difficulty-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 8px;
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

.task-status {
  color: #999;
}

.completed-icon {
  color: #27ae60;
  font-size: 20px;
}

.arrow-icon {
  font-size: 16px;
}

.empty-tasks {
  text-align: center;
  padding: 24px;
  color: #999;
}

/* 周挑战 */
.weekly-challenge {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
  color: white;
  position: relative;
  cursor: pointer;
}

.weekly-badge {
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
  display: inline-block;
  padding: 4px 8px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.weekly-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 4px;
}

.weekly-theme {
  font-size: 13px;
  opacity: 0.9;
  margin-bottom: 4px;
}

.weekly-reward {
  font-size: 14px;
  font-weight: bold;
  color: #ffd700;
}

.weekly-arrow {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 20px;
  opacity: 0.7;
}

/* 即将解锁成就 */
.next-achievements {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.achievement-icon {
  font-size: 28px;
}

.achievement-info {
  flex: 1;
}

.achievement-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.achievement-progress {
  font-size: 11px;
  color: #999;
  text-align: right;
  margin-top: 2px;
}

/* 快捷入口 */
.quick-actions {
  display: flex;
  justify-content: space-around;
  background: white;
  border-radius: 16px;
  padding: 16px;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: #333;
}

.action-icon {
  font-size: 24px;
}

.action-label {
  font-size: 12px;
  color: #666;
}
</style>
