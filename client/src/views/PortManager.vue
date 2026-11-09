<template>
  <div class="ports-page">
    <el-card shadow="never" class="ports-card">
      <template #header>
        <div class="card-header">
          <el-icon><Share /></el-icon>
          <span>端口与进程</span>
          <div class="header-actions">
            <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" />
            <el-button size="small" :loading="loading" @click="refresh">刷新</el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="tab">
        <el-tab-pane label="监听端口" name="ports">
          <div class="toolbar">
            <el-radio-group v-model="portSort" size="small">
              <el-radio-button value="port">按端口</el-radio-button>
              <el-radio-button value="process">按进程</el-radio-button>
            </el-radio-group>
            <span class="hint">共 {{ ports.length }} 条监听记录</span>
          </div>

          <el-table :data="sortedPorts" size="small" class="data-table" v-loading="loading">
            <el-table-column label="协议" width="70">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.protocol.toUpperCase() }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="address" label="监听地址" min-width="120" show-overflow-tooltip />
            <el-table-column prop="port" label="端口" width="80" />
            <el-table-column prop="processText" label="归属进程" min-width="150" show-overflow-tooltip />
            <el-table-column label="标记" min-width="220">
              <template #default="{ row }">
                <div class="labels">
                  <el-tag
                    v-for="(label, idx) in row.labels"
                    :key="idx"
                    size="small"
                    :type="labelType(label.type)"
                    effect="light"
                  >
                    {{ label.text }}
                  </el-tag>
                  <span v-if="!row.labels || !row.labels.length" class="hint">—</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!loading && !ports.length" class="empty-hint">没有读取到监听端口</div>
        </el-tab-pane>

        <el-tab-pane label="进程" name="processes">
          <div class="toolbar">
            <el-radio-group v-model="procSort" size="small" @change="loadProcesses">
              <el-radio-button value="cpu">按 CPU</el-radio-button>
              <el-radio-button value="mem">按内存</el-radio-button>
            </el-radio-group>
            <el-select v-model="procLimit" size="small" style="width:120px" @change="loadProcesses">
              <el-option :value="20" label="20 条" />
              <el-option :value="50" label="50 条" />
              <el-option :value="100" label="100 条" />
              <el-option :value="200" label="200 条" />
            </el-select>
          </div>

          <el-table :data="processes" size="small" class="data-table" v-loading="loading">
            <el-table-column prop="pid" label="PID" width="80" />
            <el-table-column prop="user" label="用户" width="90" show-overflow-tooltip />
            <el-table-column label="CPU" width="80">
              <template #default="{ row }">{{ row.cpu.toFixed(1) }}%</template>
            </el-table-column>
            <el-table-column label="内存" width="80">
              <template #default="{ row }">{{ row.memPercent.toFixed(1) }}%</template>
            </el-table-column>
            <el-table-column label="驻留内存" width="100">
              <template #default="{ row }">{{ formatBytes(row.rss) }}</template>
            </el-table-column>
            <el-table-column prop="elapsed" label="运行时长" width="110" />
            <el-table-column label="命令" min-width="240">
              <template #default="{ row }">
                <span class="cmd" :title="row.commandFull">{{ row.command }}</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <template v-if="row.protected">
                  <el-tooltip :content="row.protectReason || '受保护进程'" placement="top">
                    <el-tag size="small" type="info" effect="plain">受保护</el-tag>
                  </el-tooltip>
                </template>
                <template v-else>
                  <el-button link type="danger" size="small" @click="confirmKill(row, 'SIGTERM')">终止</el-button>
                  <el-button link type="danger" size="small" @click="confirmKill(row, 'SIGKILL')">强杀</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!loading && !processes.length" class="empty-hint">没有读取到进程</div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post } from '../api'
import { formatBytes } from '../composables/useFormat'

const loading = ref(false)
const tab = ref('ports')
const autoRefresh = ref(true)
const portSort = ref('port')
const procSort = ref('cpu')
const procLimit = ref(50)

const ports = ref([])
const processes = ref([])

const REFRESH_MS = 5000
let timer = null

const sortedPorts = computed(() => {
  const list = [...ports.value]
  if (portSort.value === 'process') {
    return list.sort((a, b) => String(a.processText).localeCompare(String(b.processText)) || (a.port || 0) - (b.port || 0))
  }
  return list.sort((a, b) => (a.port || 0) - (b.port || 0))
})

function labelType(type) {
  if (type === 'panel') return 'primary'
  if (type === 'nginx') return 'success'
  if (type === 'pm2') return 'warning'
  if (type === 'firewall') return 'info'
  return 'info'
}

async function loadPorts() {
  try {
    const res = await get('/ports')
    ports.value = res.ports || []
  } catch (e) {
    ElMessage.error('加载端口失败: ' + e.message)
  }
}

async function loadProcesses() {
  try {
    const res = await get(`/ports/processes?limit=${procLimit.value}&sort=${procSort.value}`)
    processes.value = res.processes || []
  } catch (e) {
    ElMessage.error('加载进程失败: ' + e.message)
  }
}

async function refresh() {
  loading.value = true
  try {
    await Promise.all([loadPorts(), loadProcesses()])
  } finally {
    loading.value = false
  }
}

async function confirmKill(row, signal) {
  const action = signal === 'SIGKILL' ? '强制终止（SIGKILL）' : '终止（SIGTERM）'
  try {
    await ElMessageBox.confirm(
      `确定要${action}进程 ${row.pid} 吗？\n\n命令：${row.commandFull || row.command}`,
      '进程终止确认',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await post('/ports/kill', { pid: row.pid, signal })
    ElMessage.success('已发送终止信号')
    await refresh()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function startTimer() {
  stopTimer()
  if (autoRefresh.value) {
    timer = setInterval(refresh, REFRESH_MS)
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(autoRefresh, () => {
  startTimer()
})

onMounted(async () => {
  await refresh()
  startTimer()
})

onUnmounted(stopTimer)
</script>

<style scoped>
.ports-page {
  max-width: 1280px;
}
.ports-card {
  border-radius: 10px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.hint {
  font-size: 12px;
  color: #909399;
}
.labels {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cmd {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #606266;
}
.empty-hint {
  padding: 16px 0;
  font-size: 13px;
  color: #909399;
}

@media (max-width: 768px) {
  .ports-page {
    max-width: 100%;
  }
  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .data-table {
    font-size: 12px;
  }
}
</style>
