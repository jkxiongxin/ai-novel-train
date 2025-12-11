<template>
  <div class="profile-container">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="nav-title">我的墨境</span>
      <div class="nav-spacer"></div>
    </div>

    <div class="profile-content" v-loading="loading">
      <!-- 头像和等级卡 -->
      <div class="hero-card">
        <div class="hero-avatar">
          <span class="avatar-icon">{{ getLevelTitle(profile?.level || 1).slice(0, 1) }}</span>
        </div>
        <div class="hero-info">
          <h2 class="hero-title">{{ getLevelTitle(profile?.level || 1) }}</h2>
          <div class="hero-level">Lv.{{ profile?.level || 1 }}</div>
        </div>
        <div class="xp-section">
          <div class="xp-bar">
            <div class="xp-fill" :style="{ width: xpProgress + '%' }"></div>
          </div>
          <div class="xp-text">
            {{ profile?.current_xp || 0 }} / {{ profile?.next_level_xp || 100 }} XP
          </div>
        </div>
      </div>

      <!-- 统计卡片 -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ profile?.total_xp || 0 }}</span>
          <span class="stat-label">总经验</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ profile?.current_streak || 0 }}</span>
          <span class="stat-label">连续天数</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ profile?.total_tasks || 0 }}</span>
          <span class="stat-label">完成任务</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ achievementCount }}</span>
          <span class="stat-label">已获成就</span>
        </div>
      </div>

      <!-- 六维属性雷达图 -->
      <div class="attributes-card">
        <div class="card-header">
          <h3>六维属性</h3>
          <span class="total-power">总力量: {{ totalPower }}</span>
        </div>
        <div ref="radarChart" class="radar-chart"></div>
        <div class="attr-list">
          <div v-for="attr in attributeList" :key="attr.key" class="attr-item">
            <span class="attr-icon" :style="{ color: attr.color }">●</span>
            <span class="attr-name">{{ attr.name }}</span>
            <span class="attr-value">{{ attr.value }}</span>
            <el-progress 
              :percentage="Math.min(100, attr.value)" 
              :stroke-width="4" 
              :show-text="false"
              :color="attr.color"
            />
          </div>
        </div>
      </div>

      <!-- 连续签到奖励 -->
      <div class="streak-card">
        <div class="card-header">
          <h3>🔥 连续学习奖励</h3>
          <span class="streak-days">已连续 {{ profile?.current_streak || 0 }} 天</span>
        </div>
        <div class="streak-progress">
          <div 
            v-for="(reward, index) in streakRewards" 
            :key="index"
            class="streak-node"
            :class="{ 
              achieved: profile?.current_streak >= reward.day,
              current: profile?.current_streak === reward.day - 1
            }"
          >
            <div class="node-dot">
              <span v-if="profile?.current_streak >= reward.day">✓</span>
              <span v-else>{{ reward.day }}</span>
            </div>
            <div class="node-label">{{ reward.label }}</div>
          </div>
        </div>
      </div>

      <!-- 最长连续记录 -->
      <div class="record-card">
        <div class="record-item">
          <span class="record-label">最长连续天数</span>
          <span class="record-value">{{ profile?.max_streak || 0 }} 天</span>
        </div>
        <div class="record-item">
          <span class="record-label">今日已获XP</span>
          <span class="record-value">{{ profile?.today_xp || 0 }}</span>
        </div>
        <div class="record-item">
          <span class="record-label">本周已获XP</span>
          <span class="record-value">{{ profile?.week_xp || 0 }}</span>
        </div>
      </div>

      <!-- 近期成就 -->
      <div class="recent-achievements" v-if="recentAchievements.length">
        <div class="card-header">
          <h3>🏆 近期成就</h3>
          <el-button text type="primary" @click="goToAchievements">
            查看全部
          </el-button>
        </div>
        <div class="achievement-scroll">
          <div 
            v-for="a in recentAchievements" 
            :key="a.id" 
            class="achievement-item"
          >
            <span class="a-icon">{{ a.icon }}</span>
            <div class="a-info">
              <span class="a-name">{{ a.name }}</span>
              <span class="a-time">{{ formatTime(a.unlocked_at) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 快捷入口 -->
      <div class="quick-links">
        <div class="link-item" @click="goToAchievements">
          <span class="link-icon">🏆</span>
          <span class="link-text">成就墙</span>
          <span class="link-arrow">→</span>
        </div>
        <div class="link-item" @click="goToHistory">
          <span class="link-icon">📜</span>
          <span class="link-text">练习记录</span>
          <span class="link-arrow">→</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import * as echarts from 'echarts';
import { getProfile, getAchievements, ATTR_MAP } from '@/api/mojing';

const router = useRouter();

const loading = ref(false);
const profile = ref(null);
const achievements = ref([]);

let radarChart = ref(null);
let chartInstance = null;

// 等级称号
const levelTitles = [
  '初入墨道',      // 1-5
  '笔墨新秀',      // 6-10
  '文采初显',      // 11-15
  '字里行间',      // 16-20
  '妙笔生花',      // 21-25
  '笔走龙蛇',      // 26-30
  '文思泉涌',      // 31-35
  '出口成章',      // 36-40
  '下笔如神',      // 41-45
  '墨林宗师'       // 46-50
];

// 连续学习奖励节点
const streakRewards = [
  { day: 3, label: '3天' },
  { day: 7, label: '7天' },
  { day: 14, label: '14天' },
  { day: 30, label: '30天' },
  { day: 60, label: '60天' },
  { day: 100, label: '100天' }
];

// 计算属性
const xpProgress = computed(() => {
  if (!profile.value) return 0;
  const total = profile.value.next_level_xp || 100;
  const current = profile.value.current_xp || 0;
  return Math.min(100, (current / total) * 100);
});

const totalPower = computed(() => {
  if (!profile.value) return 0;
  const attrs = ['character', 'conflict', 'scene', 'dialogue', 'rhythm', 'style'];
  return attrs.reduce((sum, attr) => sum + (profile.value[attr] || 0), 0);
});

const attributeList = computed(() => {
  const attrs = ['character', 'conflict', 'scene', 'dialogue', 'rhythm', 'style'];
  return attrs.map(key => ({
    key,
    name: ATTR_MAP[key]?.name || key,
    color: ATTR_MAP[key]?.color || '#666',
    value: profile.value?.[key] || 0
  }));
});

const achievementCount = computed(() => {
  return achievements.value.filter(a => a.unlocked).length;
});

const recentAchievements = computed(() => {
  return achievements.value
    .filter(a => a.unlocked)
    .sort((a, b) => new Date(b.unlocked_at) - new Date(a.unlocked_at))
    .slice(0, 5);
});

// 获取等级称号
function getLevelTitle(level) {
  const index = Math.min(Math.floor((level - 1) / 5), levelTitles.length - 1);
  return levelTitles[index];
}

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return date.toLocaleDateString();
}

// 初始化雷达图
function initRadarChart() {
  if (!radarChart.value) return;
  
  if (chartInstance) {
    chartInstance.dispose();
  }
  
  chartInstance = echarts.init(radarChart.value);
  
  const indicator = Object.entries(ATTR_MAP).map(([key, info]) => ({
    name: info.name,
    max: 100,
    color: info.color
  }));
  
  const values = ['character', 'conflict', 'scene', 'dialogue', 'rhythm', 'style'].map(
    key => profile.value?.[key] || 0
  );
  
  const option = {
    radar: {
      indicator,
      radius: '65%',
      center: ['50%', '50%'],
      splitNumber: 4,
      axisName: {
        color: '#666',
        fontSize: 11
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(102, 126, 234, 0.1)', 'rgba(102, 126, 234, 0.2)', 
                  'rgba(102, 126, 234, 0.3)', 'rgba(102, 126, 234, 0.4)']
        }
      },
      axisLine: {
        lineStyle: { color: 'rgba(102, 126, 234, 0.3)' }
      },
      splitLine: {
        lineStyle: { color: 'rgba(102, 126, 234, 0.3)' }
      }
    },
    series: [{
      type: 'radar',
      data: [{
        value: values,
        name: '属性值',
        areaStyle: {
          color: 'rgba(102, 126, 234, 0.4)'
        },
        lineStyle: {
          color: '#667eea',
          width: 2
        },
        itemStyle: {
          color: '#667eea'
        }
      }]
    }]
  };
  
  chartInstance.setOption(option);
}

// 加载数据
async function loadData() {
  loading.value = true;
  try {
    const [profileRes, achievementsRes] = await Promise.all([
      getProfile(),
      getAchievements()
    ]);
    
    if (profileRes.success) {
      profile.value = profileRes.data;
    }
    
    if (achievementsRes.success) {
      achievements.value = achievementsRes.data;
    }
    
    await nextTick();
    initRadarChart();
  } catch (error) {
    console.error('加载数据失败:', error);
  } finally {
    loading.value = false;
  }
}

// 导航
function goBack() {
  router.push('/mojing');
}

function goToAchievements() {
  router.push('/mojing/achievements');
}

function goToHistory() {
  router.push('/history');
}

onMounted(() => {
  loadData();
  
  window.addEventListener('resize', () => {
    chartInstance?.resize();
  });
});
</script>

<style scoped>
.profile-container {
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

.nav-spacer {
  width: 60px;
}

.profile-content {
  padding: 16px;
}

/* 英雄卡 */
.hero-card {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 20px;
  padding: 24px;
  text-align: center;
  margin-bottom: 16px;
  color: white;
}

.hero-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.avatar-icon {
  font-size: 36px;
}

.hero-title {
  font-size: 22px;
  margin: 0 0 4px 0;
}

.hero-level {
  font-size: 14px;
  opacity: 0.9;
}

.xp-section {
  margin-top: 20px;
}

.xp-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.xp-fill {
  height: 100%;
  background: #ffd700;
  border-radius: 4px;
  transition: width 0.3s;
}

.xp-text {
  font-size: 12px;
  margin-top: 8px;
  opacity: 0.9;
}

/* 统计网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 16px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #667eea;
}

.stat-label {
  font-size: 11px;
  color: #999;
}

/* 属性卡 */
.attributes-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.total-power {
  font-size: 13px;
  color: #667eea;
  font-weight: bold;
}

.radar-chart {
  height: 220px;
  margin-bottom: 16px;
}

.attr-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attr-item {
  display: grid;
  grid-template-columns: 16px 60px 40px 1fr;
  align-items: center;
  gap: 8px;
}

.attr-icon {
  font-size: 10px;
}

.attr-name {
  font-size: 13px;
  color: #666;
}

.attr-value {
  font-size: 13px;
  font-weight: bold;
  color: #333;
  text-align: right;
}

/* 连续签到卡 */
.streak-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.streak-days {
  font-size: 13px;
  color: #f39c12;
  font-weight: bold;
}

.streak-progress {
  display: flex;
  justify-content: space-between;
  position: relative;
  padding: 0 8px;
}

.streak-progress::before {
  content: '';
  position: absolute;
  top: 15px;
  left: 24px;
  right: 24px;
  height: 3px;
  background: #e0e0e0;
  z-index: 0;
}

.streak-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  position: relative;
  z-index: 1;
}

.node-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #999;
  border: 2px solid #e0e0e0;
}

.streak-node.achieved .node-dot {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: white;
  border-color: #ffd700;
}

.streak-node.current .node-dot {
  border-color: #667eea;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(102, 126, 234, 0); }
  100% { box-shadow: 0 0 0 0 rgba(102, 126, 234, 0); }
}

.node-label {
  font-size: 11px;
  color: #999;
}

.streak-node.achieved .node-label {
  color: #f39c12;
  font-weight: bold;
}

/* 记录卡 */
.record-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 16px;
}

.record-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.record-item:not(:last-child) {
  border-bottom: 1px solid #f0f0f0;
}

.record-label {
  font-size: 13px;
  color: #666;
}

.record-value {
  font-size: 15px;
  font-weight: bold;
  color: #333;
}

/* 近期成就 */
.recent-achievements {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.achievement-scroll {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.achievement-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: #f9f9f9;
  border-radius: 10px;
}

.a-icon {
  font-size: 24px;
}

.a-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.a-name {
  font-size: 14px;
  font-weight: bold;
  color: #333;
}

.a-time {
  font-size: 11px;
  color: #999;
}

/* 快捷入口 */
.quick-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.link-item:active {
  transform: scale(0.98);
}

.link-icon {
  font-size: 20px;
}

.link-text {
  flex: 1;
  font-size: 15px;
  color: #333;
}

.link-arrow {
  color: #999;
}
</style>
