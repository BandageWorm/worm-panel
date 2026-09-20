<template>
  <div class="file-manager">
    <el-card shadow="never">
      <template #header>
        <span class="card-title"><el-icon><Folder /></el-icon> 文件管理</span>
      </template>
      <FileBrowser />
    </el-card>
  </div>
</template>

<script setup>
import FileBrowser from '../components/FileBrowser.vue'
</script>

<style scoped>
.file-manager {
  width: 100%;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
}
</style>
