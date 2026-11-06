<template>
  <el-card shadow="never" class="loading-card">
    <div class="loading-box" :style="{ minHeight: minHeight + 'px' }">
      <el-icon class="is-loading" :size="26"><Loading /></el-icon>
      <span>{{ text }}</span>
    </div>
  </el-card>
</template>

<script setup>
import { Loading } from '@element-plus/icons-vue'

// 统一的页面级加载占位：卡片内居中「加载圈 + 文案」，
// 各模块首屏统一用它，避免默认 v-loading 遮罩样式简陋、页面空白。
defineProps({
  text: { type: String, default: '加载中…' },
  minHeight: { type: Number, default: 200 }
})
</script>

<style scoped>
.loading-card {
  margin-bottom: 16px;
  border-radius: 10px;
}
.loading-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #909399;
  font-size: 14px;
}
</style>
