<template>
  <div class="pm2-manager">
    <el-tabs v-model="activeTab">
      <el-tab-pane label="进程列表" name="processes">
        <el-table :data="processes" stripe v-loading="loading" size="small">
          <el-table-column prop="name" label="名称" min-width="160" />
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="row.status === 'online' ? 'success' : 'danger'" size="small">
                {{ row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="pid" label="PID" width="80" />
          <el-table-column label="CPU" width="80">
            <template #default="{ row }">{{ row.cpu?.toFixed(1) }}%</template>
          </el-table-column>
          <el-table-column label="内存" width="100">
            <template #default="{ row }">{{ formatBytes(row.memory) }}</template>
          </el-table-column>
          <el-table-column label="运行时间" width="120">
            <template #default="{ row }">{{ formatUptime(row.uptime) }}</template>
          </el-table-column>
          <el-table-column prop="restarts" label="重启次数" width="80" />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button text size="small" type="primary" @click="handleRestart(row)">重启</el-button>
              <el-button text size="small" @click="handleReload(row)">重载</el-button>
              <el-button text size="small" type="danger" @click="handleStop(row)">停止</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="refresh-bar">
          <el-button size="small" @click="fetchProcesses" :loading="loading">刷新</el-button>
          <span class="auto-refresh" v-if="autoRefresh">每 5 秒自动刷新</span>
        </div>
      </el-tab-pane>

      <el-tab-pane label="日志" name="logs">
        <div class="logs-toolbar">
          <el-input v-model="logProcessName" placeholder="进程名称" size="small" style="width:200px" />
          <el-button size="small" type="primary" @click="fetchLogs">查看日志</el-button>
          <el-button size="small" @click="autoRefreshLogs = !autoRefreshLogs">
            {{ autoRefreshLogs ? '停止刷新' : '自动刷新' }}
          </el-button>
        </div>
        <pre class="log-output" v-if="logContent">{{ logContent }}</pre>
        <el-empty v-else description="输入进程名称查看日志" />
      </el-tab-pane>

      <el-tab-pane label="配置" name="config">
        <div class="config-toolbar">
          <el-button size="small" type="primary" :loading="savingConfig" @click="saveConfig">保存配置</el-button>
        </div>
        <el-input
          v-model="configContent"
          type="textarea"
          :rows="25"
          class="config-editor"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post, put } from '../api'

const loading = ref(false)
const processes = ref([])
const activeTab = ref('processes')
let refreshTimer = null

// Logs
const logProcessName = ref('')
const logContent = ref('')
const autoRefreshLogs = ref(false)
let logTimer = null

// Config
const configContent = ref('')
const savingConfig = ref(false)
const autoRefresh = ref(true)

onMounted(() => {
  fetchProcesses()
  fetchConfig()
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) fetchProcesses(true)
  }, 5000)
})

onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(logTimer)
})

async function fetchProcesses(silent = false) {
  if (!silent) loading.value = true
  try {
    processes.value = await get('/pm2/processes')
  } catch {}
  if (!silent) loading.value = false
}

async function handleRestart(row) {
  try {
    await ElMessageBox.confirm(`确定重启 ${row.name}？`, '确认')
    await post(`/pm2/restart/${row.name}`)
    ElMessage.success('已重启')
    fetchProcesses()
  } catch {}
}

async function handleReload(row) {
  try {
    await ElMessageBox.confirm(`确定重载 ${row.name}？`, '确认')
    await post(`/pm2/reload/${row.name}`)
    ElMessage.success('已重载')
    fetchProcesses()
  } catch {}
}

async function handleStop(row) {
  try {
    await ElMessageBox.confirm(`确定停止 ${row.name}？`, '确认', { type: 'warning' })
    await post(`/pm2/stop/${row.name}`)
    ElMessage.success('已停止')
    fetchProcesses()
  } catch {}
}

async function fetchLogs() {
  if (!logProcessName.value) return
  try {
    const res = await get(`/pm2/logs/${logProcessName.value}`)
    logContent.value = res.logs
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function fetchConfig() {
  try {
    const res = await get('/pm2/config')
    configContent.value = res.content
  } catch {}
}

async function saveConfig() {
  savingConfig.value = true
  try {
    await put('/pm2/config', { content: configContent.value })
    ElMessage.success('配置已保存')
  } catch (e) {
    ElMessage.error(e.message)
  }
  savingConfig.value = false
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

function formatUptime(seconds) {
  if (!seconds) return '--'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}
</script>

<style scoped>
.pm2-manager {
  max-width: 1200px;
}
.refresh-bar {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.auto-refresh {
  font-size: 12px;
  color: #909399;
}
.logs-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  align-items: center;
}
.log-output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  max-height: 600px;
  overflow-y: auto;
  font-family: 'Courier New', Consolas, monospace;
  white-space: pre-wrap;
}
.config-toolbar {
  margin-bottom: 12px;
}
.config-editor {
  font-family: 'Courier New', Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}
</style>
