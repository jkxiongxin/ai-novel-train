<script setup>
/**
 * 移动端页面头部组件
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, More } from '@element-plus/icons-vue'

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  showBack: {
    type: Boolean,
    default: true
  },
  showMore: {
    type: Boolean,
    default: false
  },
  transparent: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['back', 'more'])

const route = useRoute()
const router = useRouter()

const pageTitle = computed(() => props.title || route.meta.title || '')

function handleBack() {
  if (emit('back')) return
  router.back()
}

function handleMore() {
  emit('more')
}
</script>

<template>
  <header class="mobile-header" :class="{ transparent }">
    <div class="header-left">
      <button v-if="showBack" class="header-btn" @click="handleBack">
        <el-icon><ArrowLeft /></el-icon>
      </button>
    </div>
    
    <h1 class="header-title">{{ pageTitle }}</h1>
    
    <div class="header-right">
      <button v-if="showMore" class="header-btn" @click="handleMore">
        <el-icon><More /></el-icon>
      </button>
      <slot name="right"></slot>
    </div>
  </header>
</template>

<style scoped>
.mobile-header {
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  height: calc(44px + env(safe-area-inset-top, 0px));
  padding-top: env(safe-area-inset-top, 0px);
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.mobile-header.transparent {
  background: transparent;
  border-bottom: none;
}

.header-left,
.header-right {
  width: 60px;
  display: flex;
  align-items: center;
}

.header-left {
  padding-left: 8px;
}

.header-right {
  padding-right: 8px;
  justify-content: flex-end;
}

.header-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 50%;
  color: #303133;
  font-size: 20px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.header-btn:active {
  background: rgba(0, 0, 0, 0.05);
}

.header-title {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: #303133;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
