<template>
  <div class="placeholder">
    <el-card shadow="never">
      <div class="placeholder-body">
        <el-icon class="placeholder-icon"><Tools /></el-icon>
        <h2>{{ title }}</h2>
        <p>此功能正在开发中...</p>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
const title = route.meta?.title || '功能'
</script>

<style scoped>
.placeholder-body {
  text-align: center;
  padding: 60px 0;
  color: #909399;
}
.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
  color: #c0c4cc;
}
.placeholder-body h2 {
  font-size: 20px;
  margin-bottom: 8px;
  color: #303133;
}
</style>
