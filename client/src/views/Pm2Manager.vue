<template>
  <div class="pm2-manager">
    <LoadingBlock v-if="loading" />
    <template v-else>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="进程列表" name="processes">
        <el-table :data="processes" stripe v-loading="loading" size="small">
          <el-table-column label="名称" min-width="160">
            <template #default="{ row }">
              <span class="proc-name">{{ row.name }}</span>
              <el-tag v-if="isDeployedWorker(row.name)" size="small" type="warning" effect="plain" class="worker-tag">Worker</el-tag>
            </template>
          </el-table-column>
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
          <el-table-column label="操作" width="280" :fixed="isMobile ? false : 'right'">
            <template #default="{ row }">
              <div class="actions-wrap">
              <el-button size="small" plain :type="row.status === 'online' ? 'primary' : 'success'" @click="handleStart(row)">{{ row.status === 'online' ? '重启' : '启动' }}</el-button>
              <el-button size="small" plain type="primary" @click="handleReload(row)">重载</el-button>
              <el-button size="small" plain type="warning" @click="handleEdit(row)">编辑</el-button>
              <el-button size="small" plain type="danger" @click="handleStop(row)">停止</el-button>
              <el-button size="small" plain type="danger" @click="handleDeleteProcess(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div class="refresh-bar">
          <el-button size="small" type="primary" @click="openWorkerDialog">从 GitHub 部署 Worker</el-button>
          <el-button size="small" type="success" @click="genericDialogVisible = true">从 GitHub 部署常规项目</el-button>
          <el-button size="small" @click="refreshAll" :loading="loading">刷新</el-button>
          <span class="auto-refresh" v-if="autoRefresh">每 5 秒自动刷新</span>
        </div>

        <!-- 通过 Git 部署的项目：与 PM2 进程状态关联展示 -->
        <div class="worker-bar" v-if="workerProjects.length">
          <span class="worker-bar-title">Git 部署项目：</span>
          <el-tooltip
            v-for="w in workerProjects"
            :key="w.name"
            :content="`${runtimeText(w)} · 端口 ${w.port}${runtimeSuffix(w)}`"
            placement="top"
          >
            <el-tag
              :type="runtimeTagType(w)"
              size="small"
              effect="plain"
              closable
              class="worker-chip"
              @close="handleRemoveWorker(w)"
            >
              {{ w.name }} · {{ runtimeLabel(w) }}
            </el-tag>
          </el-tooltip>
        </div>

        <!-- Deploy Worker Dialog -->
        <el-dialog v-model="deployDialogVisible" title="部署 Worker" width="500px" :close-on-click-modal="false">
          <el-form :model="deployForm" label-width="100px">
            <el-form-item label="仓库地址" required>
              <el-input v-model="deployForm.repo" placeholder="https://github.com/user/repo" />
            </el-form-item>
            <el-form-item label="项目名称" required>
              <el-input v-model="deployForm.name" placeholder="my-worker" />
            </el-form-item>
            <el-form-item label="入口文件">
              <el-input v-model="deployForm.entry" placeholder="index.js" />
            </el-form-item>
            <el-form-item label="分支">
              <el-input v-model="deployForm.branch" placeholder="main" />
            </el-form-item>
            <el-form-item label="端口">
              <el-input-number v-model="deployForm.port" :min="1024" :max="65535" controls-position="right" style="width:100%" />
            </el-form-item>
          </el-form>
          <div class="deploy-hint" v-if="deploying">{{ deployStage }}（{{ deployElapsed }}s）</div>
          <div class="deploy-hint" v-else>部署包含克隆仓库、安装依赖与启动进程，通常需要数十秒，请勿重复提交。</div>
          <template #footer>
            <el-button @click="deployDialogVisible = false" :disabled="deploying">取消</el-button>
            <el-button type="primary" :loading="deploying" @click="handleDeploy">部署</el-button>
          </template>
        </el-dialog>

        <!-- Deploy Generic Project Dialog -->
        <el-dialog v-model="genericDialogVisible" title="部署常规项目" width="500px" :close-on-click-modal="false">
          <el-form :model="genericForm" label-width="100px">
            <el-form-item label="仓库地址" required>
              <el-input v-model="genericForm.repo" placeholder="https://github.com/user/repo" />
            </el-form-item>
            <el-form-item label="项目名称" required>
              <el-input v-model="genericForm.name" placeholder="my-app" />
            </el-form-item>
            <el-form-item label="启动命令">
              <el-input v-model="genericForm.command" placeholder="npm start" />
            </el-form-item>
            <el-form-item label="分支">
              <el-input v-model="genericForm.branch" placeholder="main" />
            </el-form-item>
            <el-form-item label="端口">
              <el-input-number v-model="genericForm.port" :min="1024" :max="65535" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="genericDialogVisible = false">取消</el-button>
            <el-button type="success" :loading="deployingGeneric" @click="handleDeployGeneric">部署</el-button>
          </template>
        </el-dialog>

        <!-- Edit Process Dialog -->
        <el-dialog v-model="editDialogVisible" title="编辑进程" width="550px" :close-on-click-modal="false">
          <el-form :model="editForm" label-width="100px">
            <el-form-item label="进程名称">
              <el-input v-model="editForm.name" placeholder="process-name" />
            </el-form-item>
            <el-form-item label="启动命令" required>
              <el-input v-model="editForm.script" placeholder="如: /usr/bin/node 或 npx" />
            </el-form-item>
            <el-form-item label="启动参数">
              <el-input v-model="editForm.args" type="textarea" :rows="2" placeholder="wrangler pages dev public --ip 0.0.0.0 --port 9001" />
            </el-form-item>
            <el-form-item label="工作目录">
              <el-input v-model="editForm.cwd" placeholder="/opt/worm-panel/data/workers/my-app" />
            </el-form-item>
            <el-form-item label="端口">
              <el-input-number v-model="editForm.port" :min="1" :max="65535" :step="1" placeholder="不填则不设置" controls-position="right" style="width:100%" />
            </el-form-item>
            <el-form-item label="解释器">
              <el-select v-model="editForm.interpreter" clearable placeholder="自动检测" style="width:100%">
                <el-option label="node" value="node" />
                <el-option label="python3" value="python3" />
                <el-option label="python" value="python" />
                <el-option label="bash" value="bash" />
                <el-option label="sh" value="sh" />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="editDialogVisible = false">取消</el-button>
            <el-button type="primary" :loading="savingEdit" @click="handleSaveEdit">保存并重启</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane label="日志" name="logs">
        <div class="logs-toolbar">
          <el-input v-model="logProcessName" placeholder="进程名称" size="small" style="width:200px" />
          <el-button size="small" type="primary" @click="fetchLogs">查看日志</el-button>
          <el-button size="small" @click="autoRefreshLogs = !autoRefreshLogs">
            {{ autoRefreshLogs ? '停止刷新' : '自动刷新' }}
          </el-button>
          <el-button size="small" type="danger" @click="handleClearLogs" :disabled="!logContent">清空日志</el-button>
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
  </template>
  </div>
</template>

<script setup>
import LoadingBlock from '../components/LoadingBlock.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post, put, del, postWithTimeout } from '../api'
import { useMobile } from '../composables/useMobile'
import { formatBytes as formatBytesBase, BYTE_UNITS_NO_TB } from '../composables/useFormat'

// 该页历史上字节单位只到 GB，保持原有显示行为
const formatBytes = (bytes) => formatBytesBase(bytes, { units: BYTE_UNITS_NO_TB })

const { isMobile } = useMobile()

const loading = ref(true)
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

// Deploy Worker（后端已合并 PM2 运行状态）
const deployDialogVisible = ref(false)
const deploying = ref(false)
const deployElapsed = ref(0)
const workerProjects = ref([])
const deployForm = ref({
  repo: '',
  name: '',
  entry: 'index.js',
  branch: 'main',
  port: 8787
})
let deployTimer = null

const NAME_PATTERN = /^[a-zA-Z0-9._-]+$/
const REPO_PATTERN = /^(https?:\/\/[^\s;|&`$]+|git:\/\/[^\s;|&`$]+|git@[^\s;|&`$]+:[^\s;|&`$]+)$/

const deployStage = computed(() => {
  if (deployElapsed.value < 8) return '正在克隆仓库…'
  if (deployElapsed.value < 40) return '正在安装依赖…'
  if (deployElapsed.value < 90) return '正在启动进程…'
  return '仍在进行中，请耐心等待…'
})

// Deploy Generic
const genericDialogVisible = ref(false)
const deployingGeneric = ref(false)
const genericForm = ref({
  repo: '',
  name: '',
  command: 'npm start',
  branch: 'main',
  port: null
})

// Edit Process
const editDialogVisible = ref(false)
const savingEdit = ref(false)
const editingProcessName = ref('')
const editForm = ref({
  name: '',
  script: '',
  args: '',
  cwd: '',
  port: null,
  interpreter: ''
})

onMounted(async () => {
  await fetchProcesses()
  loading.value = false
  fetchConfig()
  fetchWorkerProjects()
  refreshTimer = setInterval(() => {
    if (autoRefresh.value) fetchProcesses(true)
  }, 5000)
})

onUnmounted(() => {
  clearInterval(refreshTimer)
  clearInterval(logTimer)
  clearInterval(deployTimer)
})

async function refreshAll() {
  await Promise.all([fetchProcesses(), fetchWorkerProjects()])
}

function isDeployedWorker(name) {
  return workerProjects.value.some(p => p.name === name)
}

async function fetchWorkerProjects() {
  try {
    const res = await get('/gitworker/projects')
    workerProjects.value = Array.isArray(res) ? res : []
  } catch {
    // Worker 列表失败不影响 PM2 主列表
  }
}

function runtimeStatus(project) {
  return project?.runtime?.status || 'unknown'
}

function runtimeLabel(project) {
  const status = runtimeStatus(project)
  if (status === 'online') return '运行中'
  if (status === 'stopped') return '已停止'
  if (status === 'errored') return '异常'
  if (status === 'missing') return '未运行'
  return '未知'
}

function runtimeTagType(project) {
  const status = runtimeStatus(project)
  if (status === 'online') return 'success'
  if (status === 'stopped') return 'warning'
  if (status === 'errored') return 'danger'
  return 'info'
}

function runtimeText(project) {
  const rt = project?.runtime || {}
  if (rt.pid) return `PID ${rt.pid} · 重启 ${rt.restarts ?? 0} 次`
  return 'PM2 中无对应进程'
}

function runtimeSuffix(project) {
  const rt = project?.runtime || {}
  return rt.pid ? ` · 重启 ${rt.restarts ?? 0}` : ''
}

function openWorkerDialog() {
  deployDialogVisible.value = true
}

async function handleDeploy() {
  const repo = String(deployForm.value.repo || '').trim()
  const name = String(deployForm.value.name || '').trim()
  const port = Number(deployForm.value.port)

  if (!repo || !name) {
    ElMessage.warning('请填写仓库地址和项目名称')
    return
  }
  if (!REPO_PATTERN.test(repo)) {
    ElMessage.warning('仓库地址格式不合法')
    return
  }
  if (!NAME_PATTERN.test(name)) {
    ElMessage.warning('项目名称只允许字母、数字、-、_、.')
    return
  }
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    ElMessage.warning('端口必须在 1024-65535 之间')
    return
  }

  deploying.value = true
  deployElapsed.value = 0
  const startAt = Date.now()
  deployTimer = setInterval(() => {
    deployElapsed.value = Math.floor((Date.now() - startAt) / 1000)
  }, 1000)

  try {
    await postWithTimeout('/gitworker/deploy', {
      repo,
      name,
      entry: String(deployForm.value.entry || '').trim() || 'index.js',
      branch: String(deployForm.value.branch || '').trim() || 'main',
      port
    })
    ElMessage.success('部署成功')
    deployDialogVisible.value = false
    deployForm.value = { repo: '', name: '', entry: 'index.js', branch: 'main', port: 8787 }
    await refreshAll()
  } catch (e) {
    ElMessage.error('部署失败: ' + e.message)
  } finally {
    clearInterval(deployTimer)
    deployTimer = null
    deploying.value = false
  }
}

async function handleRemoveWorker(project) {
  try {
    await ElMessageBox.confirm(
      `确定删除 Worker 项目「${project.name}」吗？将停止 PM2 进程并删除本地代码目录。`,
      '删除确认',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    )
  } catch {
    return
  }

  try {
    await del(`/gitworker/projects/${encodeURIComponent(project.name)}`)
    ElMessage.success('已删除')
    await refreshAll()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function fetchProcesses(silent = false) {
  try {
    processes.value = await get('/pm2/processes')
  } catch {}
}

async function handleDeployGeneric() {
  if (!genericForm.value.repo || !genericForm.value.name) {
    ElMessage.warning('请填写仓库地址和项目名称')
    return
  }
  deployingGeneric.value = true
  try {
    const payload = { ...genericForm.value }
    if (!payload.port) delete payload.port
    await post('/gitworker/deploy-generic', payload)
    ElMessage.success('部署成功')
    genericDialogVisible.value = false
    genericForm.value = { repo: '', name: '', command: 'npm start', branch: 'main', port: null }
    fetchProcesses()
    fetchWorkerProjects()
  } catch (e) {
    ElMessage.error(e.message)
  }
  deployingGeneric.value = false
}

async function handleEdit(row) {
  try {
    const data = await get(`/pm2/processes/${row.name}`)
    editingProcessName.value = row.name
    editForm.value = {
      name: data.name || row.name,
      script: data.script || '',
      args: data.args || '',
      cwd: data.cwd || '',
      port: data.port ? Number(data.port) : null,
      interpreter: data.interpreter || ''
    }
    editDialogVisible.value = true
  } catch (e) {
    ElMessage.error('获取进程详情失败: ' + e.message)
  }
}

async function handleSaveEdit() {
  if (!editForm.value.script) {
    ElMessage.warning('请填写启动命令')
    return
  }
  savingEdit.value = true
  try {
    const payload = { ...editForm.value }
    if (payload.port === null || payload.port === undefined) {
      delete payload.port
    }
    await put(`/pm2/processes/${editingProcessName.value}`, payload)
    ElMessage.success('进程已更新并重启')
    editDialogVisible.value = false
    fetchProcesses()
  } catch (e) {
    ElMessage.error(e.message)
  }
  savingEdit.value = false
}

async function handleDeleteProcess(row) {
  try {
    await ElMessageBox.confirm(`确定删除进程 "${row.name}"？将从 PM2 中移除。`, '确认删除', { type: 'warning' })
    await del(`/pm2/processes/${row.name}`)
    ElMessage.success('已删除')
    fetchProcesses()
    fetchWorkerProjects()
  } catch {}
}

async function handleStart(row) {
  try {
    const action = row.status === 'online' ? '重启' : '启动'
    await ElMessageBox.confirm(`确定${action} ${row.name}？`, '确认')
    await post(`/pm2/start/${row.name}`)
    ElMessage.success(`${action}成功`)
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

async function handleClearLogs() {
  if (!logProcessName.value) return
  try {
    await ElMessageBox.confirm(`确定清空 "${logProcessName.value}" 的日志？`, '确认', { type: 'warning' })
    await del(`/pm2/logs/${logProcessName.value}`)
    logContent.value = ''
    ElMessage.success('日志已清空')
  } catch {}
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
.proc-name {
  margin-right: 6px;
}
.worker-tag {
  transform: scale(0.9);
}
.worker-bar {
  margin-top: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #909399;
}
.worker-bar-title {
  flex: 0 0 auto;
}
.worker-chip {
  cursor: pointer;
}
.deploy-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
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
  font-family: Consolas, 'Source Code Pro', monospace;
  white-space: pre-wrap;
}
.config-toolbar {
  margin-bottom: 12px;
}
.config-editor {
  font-family: Consolas, 'Source Code Pro', monospace;
  font-size: 13px;
  line-height: 1.5;
}
.actions-wrap {
  display: flex;
  gap: 4px;
  white-space: nowrap;
}
.actions-wrap .el-button--small {
  padding: 2px 2px !important;
  font-size: 11px;
  min-width: 0;
  margin: 0;
}

@media (max-width: 768px) {
  .logs-toolbar {
    flex-wrap: wrap;
  }
  .logs-toolbar .el-input {
    width: 100% !important;
  }
  .logs-toolbar .el-button {
    flex: 1;
  }
  .refresh-bar {
    flex-wrap: wrap;
  }
  .refresh-bar .el-button {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .refresh-bar .el-button:nth-child(-n+2) {
    flex: 1;
  }
  .refresh-bar .el-button:nth-child(3) {
    width: 100%;
  }
  .config-toolbar .el-button {
    width: 100%;
  }
  :deep(.el-table) {
    font-size: 12px;
  }
  :deep(.el-table .el-table__cell) {
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :deep(.el-table .el-table__cell:nth-child(1)) {
    min-width: 80px;
  }
  :deep(.el-table .el-table__cell:nth-child(8)) {
    max-width: 170px;
  }
  .actions-wrap .el-button--small {
    font-size: 10px;
    padding: 2px 1px !important;
  }
  .log-output {
    font-size: 12px;
    padding: 12px;
  }
}
</style>
