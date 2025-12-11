<template>
  <div class="weekly-container">
    <!-- 顶部导航 -->
    <div class="nav-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <span class="nav-title">墨章挑战</span>
      <div class="nav-spacer"></div>
    </div>

    <div class="weekly-content" v-loading="loading">
      <!-- 本周挑战信息 -->
      <div class="challenge-card" v-if="challenge">
        <div class="challenge-badge">📖 本周墨章</div>
        <h2 class="challenge-title">{{ challenge.title }}</h2>
        <div class="challenge-theme">
          <span class="theme-label">主题</span>
          <span class="theme-value">{{ challenge.theme }}</span>
        </div>
        <p class="challenge-desc">{{ challenge.description }}</p>
        
        <div class="challenge-requirements" v-if="challenge.requirements">
          <span class="req-label">💡 要求</span>
          <p class="req-text">{{ challenge.requirements }}</p>
        </div>
        
        <div class="challenge-meta">
          <div class="meta-item">
            <span class="meta-icon">📝</span>
            <span class="meta-text">{{ challenge.word_limit_min }}-{{ challenge.word_limit_max }}字</span>
          </div>
          <div class="meta-item">
            <span class="meta-icon">⭐</span>
            <span class="meta-text">+{{ challenge.xp_reward }} XP</span>
          </div>
          <div class="meta-item">
            <span class="meta-icon">📅</span>
            <span class="meta-text">截止: {{ formatDate(challenge.week_end) }}</span>
          </div>
        </div>
        
        <div class="challenge-status" v-if="challenge.hasSubmission">
          <el-tag type="success" size="large">✓ 已提交</el-tag>
        </div>
      </div>

      <!-- 写作区域 -->
      <div class="writing-section" v-if="challenge && !challenge.isCompleted">
        <div class="writing-header">
          <h3>开始创作</h3>
          <div class="writing-stats">
            <span class="word-count" :class="{ warning: !isWordCountValid }">
              {{ wordCount }} 字
            </span>
          </div>
        </div>
        
        <el-input
          v-model="content"
          type="textarea"
          :rows="15"
          placeholder="在这里写下你的墨章作品..."
          :disabled="challenge.isCompleted"
        />
        
        <!-- 字数要求 -->
        <div class="word-requirement">
          <el-progress 
            :percentage="wordProgressPercent"
            :status="wordProgressStatus"
            :stroke-width="4"
          />
          <span class="word-req-text">
            {{ wordCount }} / {{ challenge.word_limit_min }}-{{ challenge.word_limit_max }} 字
          </span>
        </div>
        
        <!-- 操作按钮 -->
        <div class="action-buttons">
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
      </div>

      <!-- 已提交的作品 -->
      <div class="submission-section" v-if="submission">
        <div class="submission-header">
          <h3>我的作品</h3>
          <el-tag v-if="submission.score" :type="getScoreType(submission.score)">
            {{ submission.score }}分
          </el-tag>
        </div>
        
        <div class="submission-content">
          {{ submission.content }}
        </div>
        
        <!-- AI评审结果 -->
        <div class="feedback-section" v-if="feedback">
          <h4>📝 AI评审</h4>
          
          <div class="score-card">
            <div class="score-circle" :class="getGradeClass(feedback.score)">
              <span class="score-value">{{ feedback.score }}</span>
            </div>
          </div>
          
          <div class="feedback-highlights" v-if="feedback.highlights?.length">
            <h5>✨ 亮点</h5>
            <ul>
              <li v-for="(h, i) in feedback.highlights" :key="i">{{ h }}</li>
            </ul>
          </div>
          
          <div class="feedback-improvements" v-if="feedback.improvements?.length">
            <h5>💡 改进建议</h5>
            <ul>
              <li v-for="(imp, i) in feedback.improvements" :key="i">{{ imp }}</li>
            </ul>
          </div>
          
          <div class="feedback-overall" v-if="feedback.overall">
            <h5>📋 总评</h5>
            <p>{{ feedback.overall }}</p>
          </div>
        </div>
      </div>

      <!-- 无挑战状态 -->
      <div class="empty-state" v-if="!challenge && !loading">
        <span class="empty-icon">📖</span>
        <p>本周暂无墨章挑战</p>
        <p class="empty-tip">请稍后再来查看</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowLeft } from '@element-plus/icons-vue';
import { getWeeklyChallenge, submitWeeklyChallenge } from '@/api/mojing';

const router = useRouter();

const loading = ref(false);
const saving = ref(false);
const submitting = ref(false);
const challenge = ref(null);
const submission = ref(null);
const feedback = ref(null);
const content = ref('');

// 字数统计
const wordCount = computed(() => {
  return content.value.replace(/[\s\p{P}]/gu, '').length;
});

const isWordCountValid = computed(() => {
  if (!challenge.value) return true;
  const min = challenge.value.word_limit_min || 0;
  const max = challenge.value.word_limit_max || 9999;
  return wordCount.value >= min && wordCount.value <= max;
});

const canSubmit = computed(() => {
  if (!content.value || !challenge.value) return false;
  const min = challenge.value.word_limit_min || 0;
  return wordCount.value >= min;
});

const wordProgressPercent = computed(() => {
  if (!challenge.value?.word_limit_max) return 0;
  return Math.min(100, (wordCount.value / challenge.value.word_limit_max) * 100);
});

const wordProgressStatus = computed(() => {
  if (!challenge.value) return '';
  const min = challenge.value.word_limit_min || 0;
  const max = challenge.value.word_limit_max || 9999;
  
  if (wordCount.value < min) return 'exception';
  if (wordCount.value > max) return 'warning';
  return 'success';
});

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric'
  });
}

function getScoreType(score) {
  if (score >= 85) return 'success';
  if (score >= 70) return 'primary';
  if (score >= 60) return 'warning';
  return 'danger';
}

function getGradeClass(score) {
  if (score >= 95) return 'grade-s';
  if (score >= 85) return 'grade-a';
  if (score >= 75) return 'grade-b';
  if (score >= 60) return 'grade-c';
  return 'grade-d';
}

async function loadChallenge() {
  loading.value = true;
  try {
    const res = await getWeeklyChallenge();
    if (res.success && res.data) {
      challenge.value = res.data.challenge || res.data;
      submission.value = res.data.submission || null;
      
      if (submission.value?.content) {
        content.value = submission.value.content;
      }
      
      if (submission.value?.ai_feedback) {
        try {
          feedback.value = JSON.parse(submission.value.ai_feedback);
        } catch (e) {
          console.error('解析反馈失败', e);
        }
      }
    }
  } catch (error) {
    console.error('加载周挑战失败:', error);
  } finally {
    loading.value = false;
  }
}

async function saveDraft() {
  // TODO: 实现草稿保存
  ElMessage.success('草稿已保存（本地）');
  localStorage.setItem('weekly_draft_' + challenge.value?.id, content.value);
}

async function handleSubmit() {
  if (!canSubmit.value) {
    ElMessage.warning(`请至少写 ${challenge.value?.word_limit_min || 0} 字`);
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
  try {
    const res = await submitWeeklyChallenge(challenge.value.id, {
      content: content.value
    });
    
    if (res.success) {
      submission.value = res.data.submission;
      feedback.value = res.data.feedback;
      challenge.value.hasSubmission = true;
      challenge.value.isCompleted = true;
      
      ElMessage.success('提交成功！');
      
      // 清除草稿
      localStorage.removeItem('weekly_draft_' + challenge.value.id);
    }
  } catch (error) {
    console.error('提交失败:', error);
    ElMessage.error('提交失败，请重试');
  } finally {
    submitting.value = false;
  }
}

function goBack() {
  router.push('/mojing');
}

onMounted(() => {
  loadChallenge();
  
  // 尝试恢复草稿
  const challengeId = challenge.value?.id;
  if (challengeId) {
    const draft = localStorage.getItem('weekly_draft_' + challengeId);
    if (draft && !content.value) {
      content.value = draft;
    }
  }
});
</script>

<style scoped>
.weekly-container {
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

.weekly-content {
  padding: 16px;
}

/* 挑战卡 */
.challenge-card {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 16px;
  color: white;
}

.challenge-badge {
  display: inline-block;
  background: rgba(255, 215, 0, 0.2);
  color: #ffd700;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 12px;
}

.challenge-title {
  font-size: 22px;
  margin: 0 0 12px 0;
}

.challenge-theme {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.theme-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.theme-value {
  font-size: 14px;
  color: #ffd700;
  font-weight: bold;
}

.challenge-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.6;
  margin: 0 0 16px 0;
}

.challenge-requirements {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 16px;
}

.req-label {
  font-size: 12px;
  color: #ffd700;
}

.req-text {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  margin: 8px 0 0 0;
  line-height: 1.5;
}

.challenge-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.challenge-status {
  margin-top: 16px;
  text-align: center;
}

/* 写作区 */
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

.word-count {
  font-size: 14px;
  color: #667eea;
  font-weight: bold;
}

.word-count.warning {
  color: #e74c3c;
}

.word-requirement {
  margin-top: 12px;
}

.word-req-text {
  font-size: 12px;
  color: #999;
  text-align: right;
  display: block;
  margin-top: 4px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 16px;
}

.action-buttons .el-button {
  flex: 1;
  max-width: 160px;
}

/* 已提交作品 */
.submission-section {
  background: white;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.submission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.submission-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.submission-content {
  font-size: 14px;
  color: #666;
  line-height: 1.8;
  white-space: pre-wrap;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 12px;
  max-height: 300px;
  overflow-y: auto;
}

/* 评审结果 */
.feedback-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.feedback-section h4 {
  font-size: 15px;
  color: #333;
  margin: 0 0 16px 0;
}

.score-card {
  text-align: center;
  margin-bottom: 20px;
}

.score-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.score-value {
  font-size: 28px;
  font-weight: bold;
}

.grade-s .score-value { color: #ffd700; }
.grade-a .score-value { color: #27ae60; }
.grade-b .score-value { color: #3498db; }
.grade-c .score-value { color: #f39c12; }
.grade-d .score-value { color: #e74c3c; }

.feedback-highlights, .feedback-improvements, .feedback-overall {
  margin-bottom: 16px;
}

.feedback-highlights h5, .feedback-improvements h5, .feedback-overall h5 {
  font-size: 14px;
  color: #333;
  margin: 0 0 8px 0;
}

.feedback-highlights ul, .feedback-improvements ul {
  margin: 0;
  padding-left: 20px;
}

.feedback-highlights li, .feedback-improvements li {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin-bottom: 4px;
}

.feedback-overall p {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
  margin: 0;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty-icon {
  font-size: 64px;
  display: block;
  margin-bottom: 16px;
}

.empty-state p {
  margin: 0 0 8px 0;
  font-size: 16px;
}

.empty-tip {
  font-size: 13px;
  color: #bbb;
}
</style>
