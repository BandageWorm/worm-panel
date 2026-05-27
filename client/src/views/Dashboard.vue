<template>
  <div class="dashboard" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
    <!-- Server Overview -->
    <el-card class="overview-card" shadow="never">
      <template #header>
        <span class="card-title">服务器概况</span>
      </template>
      <div class="overview-grid">
        <div class="overview-item">
          <span class="label">操作系统</span>
          <span class="value">{{ info.system?.os || '--' }}</span>
        </div>
        <div class="overview-item">
          <span class="label">内核</span>
          <span class="value">{{ info.system?.kernel || '--' }}</span>
        </div>
        <div class="overview-item">
          <span class="label">主机名</span>
          <span class="value">{{ info.system?.hostname || '--' }}</span>
        </div>
        <div class="overview-item">
          <span class="label">IP 地址</span>
          <span class="value">{{ info.system?.ip || '--' }}</span>
        </div>
        <div class="overview-item">
          <span class="label">运行时间</span>
          <span class="value">{{ formatUptime(info.system?.uptime) }}</span>
        </div>
        <div class="overview-item">
          <span class="label">面板运行</span>
          <span class="value">{{ formatUptime(info.panel?.uptime) }}</span>
        </div>
        <div class="overview-item">
          <span class="label">面板版本</span>
          <span class="value">{{ info.panel?.version || '--' }}</span>
        </div>
        <div class="overview-item">
          <span class="label">面板模式</span>
          <span class="value">{{ modeLabel }}</span>
        </div>
      </div>
    </el-card>

    <!-- Resource Usage -->
    <div class="resource-grid">
      <el-card shadow="never">
        <template #header>
          <span class="card-title"><el-icon><Cpu /></el-icon> CPU</span>
        </template>
        <div class="resource-body">
          <el-progress type="dashboard" :percentage="cpuPercent" :color="cpuColor" />
          <div class="resource-info">{{ info.cpu?.model || '--' }}</div>
          <div class="resource-detail">{{ info.cpu?.cores || '--' }} 核心</div>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="card-title"><el-icon><Coin /></el-icon> 内存</span>
        </template>
        <div class="resource-body">
          <el-progress type="dashboard" :percentage="memPercent" :color="memColor" />
          <div class="resource-info">{{ formatBytes(info.memory?.used) }} / {{ formatBytes(info.memory?.total) }}</div>
          <div class="resource-detail">已用 {{ info.memory?.percent || 0 }}%</div>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="card-title"><el-icon><DataBoard /></el-icon> 磁盘</span>
        </template>
        <div class="resource-body">
          <el-progress type="dashboard" :percentage="diskPercent" :color="diskColor" />
          <div class="resource-info">{{ formatBytes(info.disk?.used) }} / {{ formatBytes(info.disk?.total) }}</div>
          <div class="resource-detail">挂载 {{ info.disk?.mount || '/' }}</div>
        </div>
      </el-card>

      <el-card shadow="never">
        <template #header>
          <span class="card-title"><el-icon><Connection /></el-icon> 网络</span>
        </template>
        <div class="resource-body">
          <div class="network-item">
            <span class="network-label">下载</span>
            <span class="network-value">{{ formatSpeed(info.network?.rxSpeed) }}/s</span>
          </div>
          <div class="network-item">
            <span class="network-label">上传</span>
            <span class="network-value">{{ formatSpeed(info.network?.txSpeed) }}/s</span>
          </div>
          <div class="network-total">
            总计: {{ formatBytes(info.network?.rxBytes) }} / {{ formatBytes(info.network?.txBytes) }}
          </div>
        </div>
      </el-card>
    </div>

  </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { get } from '../api'

const info = ref({})
const loading = ref(true)
let timer = null

const cpuPercent = computed(() => Math.round(info.value.cpu?.usage ?? 0))
const memPercent = computed(() => Math.round(info.value.memory?.percent ?? 0))
const diskPercent = computed(() => Math.round(info.value.disk?.percent ?? 0))

const cpuColor = computed(() => cpuPercent.value > 80 ? '#f56c6c' : cpuPercent.value > 60 ? '#e6a23c' : '#67c23a')
const memColor = computed(() => memPercent.value > 80 ? '#f56c6c' : memPercent.value > 60 ? '#e6a23c' : '#67c23a')
const diskColor = computed(() => diskPercent.value > 85 ? '#f56c6c' : diskPercent.value > 70 ? '#e6a23c' : '#67c23a')

const modeLabel = computed(() => {
  if (!info.value.panel) return '--'
  return info.value.panel.mode === 'proxy'
    ? `反代模式 :${info.value.panel.port}`
    : `独立模式 :${info.value.panel.port}`
})

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B'
  return formatBytes(bytesPerSec)
}

function formatUptime(seconds) {
  if (!seconds) return '--'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts = []
  if (d > 0) parts.push(d + ' 天')
  if (h > 0) parts.push(h + ' 小时')
  parts.push(m + ' 分钟')
  return parts.join(' ')
}

async function fetchData() {
  try {
    info.value = await get('/dashboard')
  } catch {
    // offline
  }
  loading.value = false
}

onMounted(() => {
  fetchData()
  timer = setInterval(fetchData, 5000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
}
.overview-card {
  margin-bottom: 20px;
}
.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.overview-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.overview-item .label {
  font-size: 13px;
  color: #909399;
}
.overview-item .value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.resource-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.resource-body {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.resource-info {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.resource-detail {
  font-size: 13px;
  color: #909399;
}
.network-item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}
.network-label {
  color: #909399;
}
.network-value {
  font-weight: 500;
  color: #303133;
}
.network-total {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}
.quick-card {
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .resource-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .resource-grid {
    grid-template-columns: 1fr;
  }
  .overview-item {
    padding: 4px 0;
  }
}
</style>
