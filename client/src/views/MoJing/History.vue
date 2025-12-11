<template>
  <div class="history-container">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="nav-title">成长记录</span>
      <div class="nav-spacer"></div>
    </div>

    <div class="history-content" v-loading="loading">
      <!-- 统计概览 -->
      <div class="stats-card">
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalTasks }}</span>
          <span class="stat-label">完成任务</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalXP }}</span>
          <span class="stat-label">获得XP</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.avgScore || '-' }}</span>
          <span class="stat-label">平均分</span>
        </div>
      </div>

      <!-- 时间筛选 -->
      <div class="filter-section">
        <div class="filter-tabs">
          <div 
            v-for="f in filters" 
            :key="f.value"
            class="filter-tab"
            :class="{ active: currentFilter === f.value }"
            @click="currentFilter = f.value"
          >
            {{ f.label }}
          </div>
        </div>
      </div>

      <!-- XP历史列表 -->
      <div class="history-list">
        <div 
          v-for="record in xpHistory" 
          :key="record.id"
          class="history-item"
        >
          <div class="history-icon" :class="getSourceClass(record.source_type)">
            {{ getSourceIcon(record.source_type) }}
          </div>
          <div class="history-info">
            <div class="history-title">{{ getSourceName(record.source_type) }}</div>
            <div class="history-desc" v-if="record.description">{{ record.description }}</div>
            <div class="history-time">{{ formatTime(record.created_at) }}</div>
          </div>
          <div class="history-xp">
            <span class="xp-value">+{{ record.xp_amount }}</span>
            <span class="xp-label">XP</span>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="empty-state" v-if="xpHistory.length === 0 && !loading">
          <span class="empty-icon">📜</span>
          <p>暂无记录</p>
          <p class="empty-tip">完成任务后会在这里显示成长记录</p>
        </div>

        <!-- 加载更多 -->
        <div class="load-more" v-if="hasMore">
          <el-button @click="loadMore" :loading="loadingMore">加载更多</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import { getXPHistory, getTaskStats } from '@/api/mojing';

const router = useRouter();

const loading = ref(false);
const loadingMore = ref(false);
const xpHistory = ref([]);
const stats = ref({
  totalTasks: 0,
  totalXP: 0,
  avgScore: null
});
const currentFilter = ref('all');
const page = ref(1);
const pageSize = 20;
const hasMore = ref(false);

const filters = [
  { label: '全部', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' }
];

// XP来源配置
const sourceConfig = {
  inkdot_complete: { name: '墨点任务', icon: '🔵', class: 'inkdot' },
  inkline_complete: { name: '墨线任务', icon: '📝', class: 'inkline' },
  inkchapter_complete: { name: '墨章挑战', icon: '📖', class: 'inkchapter' },
  practice_submit: { name: '写作练习', icon: '✍️', class: 'practice' },
  practice_evaluated: { name: '练习评审', icon: '⭐', class: 'evaluated' },
  skill_practice: { name: '技巧练习', icon: '📚', class: 'skill' },
  freewrite: { name: '随心写', icon: '🌊', class: 'freewrite' },
  typing_practice: { name: '抄书练习', icon: '⌨️', class: 'typing' },
  daily_challenge: { name: '每日挑战', icon: '🎯', class: 'challenge' },
  streak_bonus: { name: '连续打卡', icon: '🔥', class: 'streak' },
  achievement_unlock: { name: '成就解锁', icon: '🏆', class: 'achievement' }
};

function getSourceIcon(sourceType) {
  return sourceConfig[sourceType]?.icon || '📝';
}

function getSourceName(sourceType) {
  return sourceConfig[sourceType]?.name || sourceType;
}

function getSourceClass(sourceType) {
  return sourceConfig[sourceType]?.class || 'default';
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
  return date.toLocaleDateString('zh-CN');
}

async function loadHistory(reset = false) {
  if (reset) {
    page.value = 1;
    xpHistory.value = [];
  }
  
  loading.value = reset;
  loadingMore.value = !reset;
  
  try {
    const params = {
      page: page.value,
      pageSize,
      filter: currentFilter.value
    };
    
    const res = await getXPHistory(params);
    if (res.success) {
      if (reset) {
        xpHistory.value = res.data.records || [];
      } else {
        xpHistory.value.push(...(res.data.records || []));
      }
      hasMore.value = res.data.hasMore || false;
    }
  } catch (error) {
    console.error('加载历史记录失败:', error);
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

async function loadStats() {
  try {
    const res = await getTaskStats();
    if (res.success) {
      stats.value = {
        totalTasks: res.data.totalCompleted || 0,
        totalXP: res.data.totalXP || 0,
        avgScore: res.data.avgScore || null
      };
    }
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

function loadMore() {
  page.value++;
  loadHistory(false);
}

function goBack() {
  router.push('/mojing');
}

watch(currentFilter, () => {
  loadHistory(true);
});

onMounted(() => {
  loadHistory(true);
  loadStats();
});
</script>

<style scoped>
.history-container {
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

.history-content {
  padding: 16px;
}

/* 统计卡 */
.stats-card {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: white;
}

.stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(255, 255, 255, 0.3);
}

/* 筛选 */
.filter-section {
  margin-bottom: 16px;
}

.filter-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.filter-tabs::-webkit-scrollbar {
  display: none;
}

.filter-tab {
  flex-shrink: 0;
  padding: 8px 16px;
  background: white;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-tab.active {
  background: #667eea;
  color: white;
}

/* 历史列表 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 16px;
}

.history-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.history-icon.inkdot { background: linear-gradient(135deg, #667eea, #764ba2); }
.history-icon.inkline { background: linear-gradient(135deg, #11998e, #38ef7d); }
.history-icon.inkchapter { background: linear-gradient(135deg, #f093fb, #f5576c); }
.history-icon.practice { background: linear-gradient(135deg, #4facfe, #00f2fe); }
.history-icon.evaluated { background: linear-gradient(135deg, #f39c12, #e74c3c); }
.history-icon.skill { background: linear-gradient(135deg, #a8edea, #fed6e3); }
.history-icon.freewrite { background: linear-gradient(135deg, #667eea, #764ba2); }
.history-icon.typing { background: linear-gradient(135deg, #89f7fe, #66a6ff); }
.history-icon.challenge { background: linear-gradient(135deg, #ffd700, #ffaa00); }
.history-icon.streak { background: linear-gradient(135deg, #ff9a9e, #fecfef); }
.history-icon.achievement { background: linear-gradient(135deg, #ffd700, #ffaa00); }
.history-icon.default { background: #f5f7fa; }

.history-info {
  flex: 1;
  min-width: 0;
}

.history-title {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  margin-bottom: 2px;
}

.history-desc {
  font-size: 12px;
  color: #666;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-time {
  font-size: 11px;
  color: #999;
}

.history-xp {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.xp-value {
  font-size: 18px;
  font-weight: bold;
  color: #f39c12;
}

.xp-label {
  font-size: 11px;
  color: #999;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #999;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.empty-state p {
  margin: 0 0 8px 0;
  font-size: 14px;
}

.empty-tip {
  font-size: 12px;
  color: #bbb;
}

/* 加载更多 */
.load-more {
  text-align: center;
  padding: 16px;
}
</style>
