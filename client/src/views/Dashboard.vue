<template>
  <div class="dashboard">
    <LoadingBlock v-if="loading" />
    <template v-else>
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
          <div class="resource-detail">
            已用 {{ info.memory?.percent || 0 }}%
            <template v-if="info.memory?.available"> · 可用 {{ formatBytes(info.memory.available) }}</template>
          </div>
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

      <el-card shadow="never" class="traffic-card" @click="trafficDrawer = true">
        <template #header>
          <span class="card-title"><el-icon><Histogram /></el-icon> 本月流量</span>
        </template>
        <div class="resource-body">
          <div class="traffic-total">{{ formatBytes(trafficUsed) }}</div>
          <el-progress
            v-if="trafficQuota > 0"
            :percentage="Math.min(100, trafficPercent || 0)"
            :color="trafficColor"
            :stroke-width="10"
          />
          <div class="resource-detail" v-if="trafficQuota > 0">
            配额 {{ formatBytes(trafficQuota) }} · 剩余 {{ formatBytes(trafficRemaining) }}
          </div>
          <div class="resource-detail" v-else>未设置配额</div>
          <div class="network-total">今日 {{ formatBytes(traffic?.today?.rx) }} ↓ / {{ formatBytes(traffic?.today?.tx) }} ↑</div>
        </div>
      </el-card>
    </div>

    <!-- 趋势 -->
    <el-card shadow="never" class="trend-card">
      <template #header>
        <div class="card-header-row">
          <span class="card-title"><el-icon><TrendCharts /></el-icon> 资源趋势</span>
          <el-radio-group v-model="range" size="small" @change="loadHistory">
            <el-radio-button value="1h">1 小时</el-radio-button>
            <el-radio-button value="24h">24 小时</el-radio-button>
            <el-radio-button value="7d">7 天</el-radio-button>
          </el-radio-group>
        </div>
      </template>
      <div class="trend-grid">
        <div class="trend-item">
          <div class="trend-title">CPU</div>
          <TrendChart :points="series('cpu')" color="#409eff" mode="percent" />
        </div>
        <div class="trend-item">
          <div class="trend-title">内存</div>
          <TrendChart :points="series('mem')" color="#67c23a" mode="percent" />
        </div>
        <div class="trend-item">
          <div class="trend-title">磁盘</div>
          <TrendChart :points="series('disk')" color="#e6a23c" mode="percent" />
        </div>
        <div class="trend-item">
          <div class="trend-title">下载速率</div>
          <TrendChart :points="series('rxSpeed')" color="#909399" mode="speed" />
        </div>
        <div class="trend-item">
          <div class="trend-title">上传速率</div>
          <TrendChart :points="series('txSpeed')" color="#b37feb" mode="speed" />
        </div>
      </div>
    </el-card>

    <!-- 流量详情 -->
    <el-drawer v-model="trafficDrawer" title="流量统计" size="420px">
      <div class="traffic-detail">
        <div class="traffic-detail-row">
          <span>计费周期</span>
          <span>{{ traffic?.period?.key || '--' }} 起（每月 {{ traffic?.resetDay || 1 }} 日重置）</span>
        </div>
        <div class="traffic-detail-row">
          <span>本月已用</span>
          <span>{{ formatBytes(trafficUsed) }}</span>
        </div>
        <div class="traffic-detail-row">
          <span>下行 / 上行</span>
          <span>{{ formatBytes(traffic?.period?.rx) }} / {{ formatBytes(traffic?.period?.tx) }}</span>
        </div>
        <div class="traffic-detail-row" v-if="trafficQuota > 0">
          <span>配额</span>
          <span>{{ formatBytes(trafficQuota) }}（{{ trafficPercent }}%）</span>
        </div>
        <div class="traffic-detail-row">
          <span>统计网卡</span>
          <span>{{ (traffic?.ifaces || []).join(', ') || '--' }}</span>
        </div>
        <div class="traffic-note">数值取自网卡计数器，为近似值，与云厂商计费口径可能存在差异。</div>

        <div class="traffic-days-title">最近 30 天</div>
        <div class="traffic-days">
          <div v-for="d in trafficDays" :key="d.date" class="traffic-day">
            <div class="day-bars">
              <div class="day-bar down" :style="{ height: barHeight(d.rx) }"></div>
              <div class="day-bar up" :style="{ height: barHeight(d.tx) }"></div>
            </div>
            <div class="day-label">{{ d.date.slice(5) }}</div>
          </div>
          <div v-if="!trafficDays.length" class="muted-hint">暂无数据</div>
        </div>
        <div class="traffic-legend">
          <span><i class="dot down"></i> 下行</span>
          <span><i class="dot up"></i> 上行</span>
        </div>
      </div>
    </el-drawer>
  </template>
  </div>
</template>

<script setup>
import LoadingBlock from '../components/LoadingBlock.vue'
import TrendChart from '../components/TrendChart.vue'
import { formatBytes } from '../composables/useFormat'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { get } from '../api'

const info = ref({})
const loading = ref(true)
const range = ref('1h')
const history = ref([])
const trafficDrawer = ref(false)

let timer = null
let historyTimer = null
let refreshSecs = 5

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

const traffic = computed(() => info.value.traffic || null)
const trafficDays = computed(() => (traffic.value?.days || []).slice(-30))
const trafficUsed = computed(() => {
  const p = traffic.value?.period
  return p ? (p.rx || 0) + (p.tx || 0) : 0
})
const trafficQuota = computed(() => traffic.value?.period?.quotaBytes || 0)
const trafficPercent = computed(() => traffic.value?.period?.percent ?? 0)
const trafficRemaining = computed(() => traffic.value?.period?.remaining ?? 0)
const trafficColor = computed(() => {
  const p = trafficPercent.value || 0
  return p >= 95 ? '#f56c6c' : p >= 80 ? '#e6a23c' : '#409eff'
})
const maxDayBytes = computed(() => {
  const list = trafficDays.value
  return Math.max(1, ...list.map(d => Math.max(d.rx || 0, d.tx || 0)))
})

function series(key) {
  return (history.value || []).map(p => ({ t: p.t, v: p[key] || 0 }))
}

function barHeight(value) {
  const ratio = (Number(value) || 0) / maxDayBytes.value
  return `${Math.max(2, Math.round(ratio * 60))}px`
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

async function loadHistory() {
  try {
    const res = await get(`/metrics/history?range=${range.value}`)
    history.value = res.points || []
  } catch {
    history.value = []
  }
}

onMounted(async () => {
  await fetchData()
  await loadHistory()

  // 刷新间隔由系统设置决定（秒）
  refreshSecs = Math.max(2, Number(info.value.panel?.dashboardRefresh) || 5)
  timer = setInterval(fetchData, refreshSecs * 1000)
  // 趋势图独立节奏，避免每 5 秒拉一次历史
  historyTimer = setInterval(loadHistory, 30000)
})

onUnmounted(() => {
  clearInterval(timer)
  clearInterval(historyTimer)
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
.card-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.muted-hint {
  font-size: 12px;
  color: #909399;
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
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
.traffic-card {
  cursor: pointer;
}
.traffic-total {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}

.trend-card {
  margin-bottom: 20px;
}
.trend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px 24px;
}
.trend-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}

.traffic-detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f2f5;
  font-size: 13px;
  color: #303133;
}
.traffic-detail-row span:first-child {
  color: #909399;
}
.traffic-note {
  margin-top: 12px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.traffic-days-title {
  margin-top: 20px;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
}
.traffic-days {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  margin-top: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.traffic-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 14px;
}
.day-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 64px;
}
.day-bar {
  width: 5px;
  border-radius: 2px 2px 0 0;
}
.day-bar.down {
  background: #409eff;
}
.day-bar.up {
  background: #b37feb;
}
.day-label {
  font-size: 9px;
  color: #909399;
  white-space: nowrap;
}
.traffic-legend {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
}
.traffic-legend .dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  margin-right: 4px;
}
.traffic-legend .dot.down {
  background: #409eff;
}
.traffic-legend .dot.up {
  background: #b37feb;
}

@media (max-width: 768px) {
  .overview-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .resource-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .trend-grid {
    grid-template-columns: 1fr;
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
