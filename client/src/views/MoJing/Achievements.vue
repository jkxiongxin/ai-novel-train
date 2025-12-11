<template>
  <div class="achievements-container">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="nav-title">成就墙</span>
      <div class="nav-spacer"></div>
    </div>

    <div class="achievements-content" v-loading="loading">
      <!-- 统计概览 -->
      <div class="stats-card">
        <div class="stat-item">
          <span class="stat-value">{{ unlockedCount }}</span>
          <span class="stat-label">已解锁</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ totalCount }}</span>
          <span class="stat-label">总成就</span>
        </div>
        <div class="stat-divider"></div>
        <div class="stat-item">
          <span class="stat-value">{{ progressPercent }}%</span>
          <span class="stat-label">完成度</span>
        </div>
      </div>

      <!-- 分类标签 -->
      <div class="category-tabs">
        <div 
          v-for="cat in categories" 
          :key="cat.key"
          class="category-tab"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >
          {{ cat.name }}
          <span class="tab-count">{{ getCategoryCount(cat.key) }}</span>
        </div>
      </div>

      <!-- 成就卡片网格 -->
      <div class="achievement-grid">
        <div 
          v-for="achievement in filteredAchievements" 
          :key="achievement.id"
          class="achievement-card"
          :class="{ 
            unlocked: achievement.unlocked,
            secret: achievement.is_hidden && !achievement.unlocked,
            ['category-' + achievement.category]: true
          }"
        >
          <div class="card-top">
            <div class="achievement-icon">
              <span v-if="achievement.unlocked || !achievement.is_hidden">
                {{ achievement.icon }}
              </span>
              <span v-else class="secret-icon">❓</span>
            </div>
            <div class="achievement-info">
              <h4 class="achievement-name">
                {{ achievement.name }}
              </h4>
              <p class="achievement-desc">
                {{ achievement.unlocked || !achievement.is_hidden ? achievement.description : '继续探索以解锁...' }}
              </p>
            </div>
          </div>

          <div class="card-bottom">
            <p class="achievement-req" v-if="achievement.requirement_type">
              达成条件：{{ formatRequirement(achievement) }}
            </p>

            <div class="achievement-progress" v-if="!achievement.unlocked && achievement.progress">
              <el-progress 
                :percentage="achievement.progress.percent"
                :stroke-width="4"
                :show-text="false"
              />
              <span class="progress-text">
                {{ achievement.progress.current }} / {{ achievement.progress.target }}
              </span>
            </div>

            <div class="unlock-time" v-if="achievement.unlocked">
              <span class="time-icon">🎉</span>
              <span>{{ formatTime(achievement.unlocked_at) }} 解锁</span>
            </div>

            <div class="achievement-reward" v-if="achievement.unlocked || !achievement.is_hidden">
              <span class="reward-xp" v-if="achievement.xp_reward">
                +{{ achievement.xp_reward }} XP
              </span>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div class="empty-state" v-if="filteredAchievements.length === 0">
          <span class="empty-icon">🏆</span>
          <p>暂无成就</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft } from '@element-plus/icons-vue';
import { getAchievements } from '@/api/mojing';

const router = useRouter();

const loading = ref(false);
const achievements = ref([]);
const activeCategory = ref('all');

// 分类列表
const categories = [
  { key: 'all', name: '全部' },
  { key: 'milestone', name: '里程碑' },
  { key: 'streak', name: '坚持' },
  { key: 'quality', name: '品质' },
  { key: 'skill', name: '属性' },
  { key: 'volume', name: '产量' },
  { key: 'special', name: '特殊' }
];

// 计算属性
const totalCount = computed(() => achievements.value.length);

const unlockedCount = computed(() => {
  return achievements.value.filter(a => a.unlocked).length;
});

const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((unlockedCount.value / totalCount.value) * 100);
});

const filteredAchievements = computed(() => {
  let list = [...achievements.value];
  
  // 按分类筛选
  if (activeCategory.value !== 'all') {
    list = list.filter(a => a.category === activeCategory.value);
  }
  
  // 排序：已解锁的在前，按解锁时间倒序；未解锁的按ID排序
  list.sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    if (a.unlocked && b.unlocked) {
      return new Date(b.unlocked_at) - new Date(a.unlocked_at);
    }
    return a.id - b.id;
  });
  
  return list;
});

// 获取分类计数
function getCategoryCount(category) {
  if (category === 'all') {
    return `${unlockedCount.value}/${totalCount.value}`;
  }
  const catAchievements = achievements.value.filter(a => a.category === category);
  const catUnlocked = catAchievements.filter(a => a.unlocked).length;
  return `${catUnlocked}/${catAchievements.length}`;
}

// 格式化时间
function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// 加载成就数据
async function loadAchievements() {
  loading.value = true;
  try {
    const res = await getAchievements();
      if (res.success) {
        const data = res.data || {};
        const list = data.achievements || [];

        achievements.value = list.map(a => ({
          ...a,
          unlocked: a.is_unlocked === 1 || !!a.unlocked_at,
          is_hidden: !!a.is_hidden,
          progress: calculateProgress(a)
        }));
      }
  } catch (error) {
    console.error('加载成就失败:', error);
  } finally {
    loading.value = false;
  }
}

// 计算成就进度
function calculateProgress(achievement) {
  if (achievement.unlocked) return null;
  // 根据成就的 requirement_type 和 requirement_value 计算进度（示意）
  const type = achievement.requirement_type;
  const target = achievement.requirement_value || 0;

  switch (type) {
    case 'task_complete':
    case 'inkline_complete':
    case 'inkchapter_complete':
      return {
        current: achievement.user_task_count || 0,
        target,
        percent: Math.min(100, ((achievement.user_task_count || 0) / target) * 100)
      };
    case 'streak_days':
      return {
        current: achievement.user_streak || 0,
        target,
        percent: Math.min(100, ((achievement.user_streak || 0) / target) * 100)
      };
    case 'words_count':
      return {
        current: achievement.user_words || 0,
        target,
        percent: Math.min(100, ((achievement.user_words || 0) / target) * 100)
      };
    case 'grade_s':
    case 'score_above':
    case 'score_streak':
      // 评分类通常是离散，不显示进度
      return null;
    default:
      return null;
  }
}

// 格式化达成条件 
function formatRequirement(achievement) {
  const t = achievement.requirement_type;
  const v = achievement.requirement_value;
  switch (t) {
    case 'task_complete': return `完成 ${v} 个墨点任务`;
    case 'inkline_complete': return `完成 ${v} 个墨线任务`;
    case 'inkchapter_complete': return `完成 ${v} 个墨章挑战`;
    case 'streak_days': return `连续打卡 ${v} 天`;
    case 'words_count': return `累计写作 ${v} 字`;
    case 'score_above': return `单次评分 ≥ ${v}`;
    case 'score_streak': return `连续 ${v} 次评分 ≥ 80`;
    case 'grade_s': return `获取 ${v} 个 S 级评价`;
    case 'level_reach': return `达到等级 ${v}`;
    case 'attr_character': return `人物力达到 ${v}`;
    case 'attr_conflict': return `冲突力达到 ${v}`;
    case 'attr_scene': return `场景力达到 ${v}`;
    case 'attr_dialogue': return `对话力达到 ${v}`;
    case 'attr_rhythm': return `节奏力达到 ${v}`;
    case 'attr_style': return `风格力达到 ${v}`;
    case 'all_attr': return `所有属性达到 ${v}`;
    case 'special_trigger': return `触发特殊事件 ${v} 次`;
    default: return achievement.description || '';
  }
}

// 返回
// 返回
function goBack() {
  router.push('/mojing');
}

onMounted(() => {
  loadAchievements();
});
</script>

<style scoped>
.achievements-container {
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

.achievements-content {
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
  font-size: 28px;
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

/* 分类标签 */
.category-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 16px;
  -webkit-overflow-scrolling: touch;
}

.category-tabs::-webkit-scrollbar {
  display: none;
}

.category-tab {
  flex-shrink: 0;
  padding: 8px 16px;
  background: white;
  border-radius: 20px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.category-tab.active {
  background: #667eea;
  color: white;
}

.tab-count {
  font-size: 11px;
  opacity: 0.7;
}

/* 成就卡片网格 */
.achievement-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.achievement-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  background: white;
  border-radius: 12px;
  padding: 14px;
  transition: all 0.18s ease;
  border: 1px solid rgba(0,0,0,0.04);
  box-shadow: 0 1px 3px rgba(16,24,40,0.04);
  min-height: 140px;
}

.achievement-card.unlocked {
  background: linear-gradient(135deg, #fffbeb, #fef3c7);
  border-color: #fcd34d;
}

.achievement-card.secret {
  background: #f5f5f5;
  opacity: 0.7;
}

.achievement-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.achievement-card.unlocked .achievement-icon {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
}

.secret-icon {
  font-size: 20px;
  color: #999;
}

.achievement-info {
  flex: 1;
  min-width: 0;
}

.card-top {
  display: flex;
  gap: 12px;
  align-items: center;
}

.card-bottom {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
}

.achievement-name {
  font-size: 15px;
  font-weight: bold;
  color: #333;
  margin: 0 0 4px 0;
}

.achievement-card.secret .achievement-name {
  color: #999;
}

.achievement-desc {
  font-size: 12px;
  color: #666;
  margin: 0;
  line-height: 1.5;
}

.achievement-card.secret .achievement-desc {
  color: #999;
  font-style: italic;
}

.achievement-progress {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.achievement-progress .el-progress {
  flex: 1;
}

.progress-text {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
}

.unlock-time {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: #f39c12;
}

.time-icon {
  font-size: 12px;
}

.achievement-reward {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

/* 分类色 */
.category-milestone { border-color: #60a5fa; }
.category-streak { border-color: #fb923c; }
.category-quality { border-color: #f472b6; }
.category-skill { border-color: #34d399; }
.category-volume { border-color: #facc15; }
.category-special { border-color: #a78bfa; }

.achievement-req {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #3b82f6;
}

.reward-xp {
  font-size: 12px;
  font-weight: bold;
  color: #f39c12;
  background: #fff9e6;
  padding: 4px 8px;
  border-radius: 8px;
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
  margin: 0;
  font-size: 14px;
}
</style>
