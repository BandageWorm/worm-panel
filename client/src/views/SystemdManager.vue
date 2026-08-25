<template>
  <div class="systemd-manager" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
      <!-- 工具栏 -->
      <div class="toolbar">
        <el-input
          v-model="searchText"
          placeholder="搜索服务名或描述..."
          clearable
          size="small"
          style="width: 240px"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="statusFilter" size="small" style="width: 140px" clearable placeholder="全部状态">
          <el-option label="运行中" value="active" />
          <el-option label="已停止" value="inactive" />
          <el-option label="失败" value="failed" />
        </el-select>
        <el-button size="small" @click="fetchServices" :loading="refreshing">刷新</el-button>
      </div>

      <!-- 服务列表 -->
      <el-table :data="filteredServices" stripe size="small" @row-click="handleRowClick" row-class-name="clickable-row">
        <el-table-column prop="name" label="服务名" min-width="200">
          <template #default="{ row }">
            <span class="service-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="stateTagType(row.active_state)" size="small">
              {{ row.sub_state }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="开机自启" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled === 'enabled'"
              size="small"
              :disabled="isProtected(row.name) && row.enabled === 'enabled'"
              @change="(val) => handleToggleEnabled(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="描述" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="service-desc">{{ row.description }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="actions-wrap">
              <template v-if="row.active_state === 'active'">
                <el-button size="small" plain type="primary" @click.stop="handleAction(row, 'restart')">重启</el-button>
                <el-button size="small" plain type="warning" @click.stop="handleAction(row, 'reload')">重载</el-button>
                <el-button size="small" plain type="danger" @click.stop="handleAction(row, 'stop')" :disabled="isProtected(row.name)">停止</el-button>
              </template>
              <template v-else>
                <el-button size="small" plain type="success" @click.stop="handleAction(row, 'start')">启动</el-button>
              </template>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <span class="count-info">共 {{ filteredServices.length }} 个服务</span>
      </div>

      <!-- 服务详情抽屉 -->
      <el-drawer v-model="detailVisible" :title="detailService?.name || ''" size="500px" direction="rtl">
        <div v-if="detailLoading" v-loading="true" style="height: 200px"></div>
        <div v-else-if="detailData" class="detail-content">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="描述">{{ detailData.description }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="stateTagType(detailData.activeState)" size="small">
                {{ detailData.activeState }} ({{ detailData.subState }})
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="主 PID">{{ detailData.mainPID || '-' }}</el-descriptions-item>
            <el-descriptions-item label="内存占用">{{ formatBytes(detailData.memoryCurrent) }}</el-descriptions-item>
            <el-descriptions-item label="任务数">{{ detailData.tasks || '-' }}</el-descriptions-item>
            <el-descriptions-item label="启动时间">{{ detailData.activeEnterTimestamp || '-' }}</el-descriptions-item>
            <el-descriptions-item label="服务类型">{{ detailData.type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="开机自启">{{ detailData.unitFileState }}</el-descriptions-item>
            <el-descriptions-item label="Unit 文件">
              <span class="unit-path">{{ detailData.fragmentPath || '-' }}</span>
            </el-descriptions-item>
          </el-descriptions>

          <div class="logs-section">
            <div class="logs-header">
              <span class="logs-title">最近日志</span>
              <el-button size="small" @click="fetchLogs" :loading="logsLoading">刷新日志</el-button>
            </div>
            <pre class="log-output" v-if="logsContent">{{ logsContent }}</pre>
            <el-empty v-else description="暂无日志" :image-size="60" />
          </div>
        </div>
      </el-drawer>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { get, post } from '../api'
import { useMobile } from '../composables/useMobile'

const { isMobile } = useMobile()

const loading = ref(true)
const refreshing = ref(false)
const services = ref([])
const searchText = ref('')
const statusFilter = ref('')

// 详情
const detailVisible = ref(false)
const detailService = ref(null)
const detailData = ref(null)
const detailLoading = ref(false)

// 日志
const logsContent = ref('')
const logsLoading = ref(false)

const PROTECTED_NAMES = ['worm-panel.service', 'worm-panel']

function isProtected(name) {
  return PROTECTED_NAMES.includes(name)
}

function stateTagType(state) {
  if (state === 'active') return 'success'
  if (state === 'failed') return 'danger'
  return 'info'
}

const filteredServices = computed(() => {
  let list = services.value
  if (statusFilter.value) {
    list = list.filter(s => s.active_state === statusFilter.value)
  }
  if (searchText.value) {
    const kw = searchText.value.toLowerCase()
    list = list.filter(s =>
      s.name.toLowerCase().includes(kw) ||
      (s.description || '').toLowerCase().includes(kw)
    )
  }
  return list
})

onMounted(async () => {
  await fetchServices()
  loading.value = false
})

async function fetchServices() {
  refreshing.value = true
  try {
    services.value = await get('/systemd/services')
  } catch (e) {
    ElMessage.error('获取服务列表失败: ' + e.message)
  }
  refreshing.value = false
}

async function handleAction(row, action) {
  const actionNames = {
    start: '启动', stop: '停止', restart: '重启', reload: '重载'
  }

  // worm-panel 重启需要二次确认
  if (isProtected(row.name) && action === 'restart') {
    try {
      await ElMessageBox.confirm(
        '重启面板服务后连接将断开，需要重新登录。确定继续？',
        '确认重启面板',
        { type: 'warning', confirmButtonText: '确定重启', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }

  try {
    await post(`/systemd/services/${row.name}/${action}`)
    ElMessage.success(`${actionNames[action]} ${row.name} 成功`)
    await fetchServices()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleToggleEnabled(row, enabled) {
  const action = enabled ? 'enable' : 'disable'
  const label = enabled ? '启用' : '禁用'

  if (isProtected(row.name) && action === 'disable') {
    ElMessage.warning('面板自身服务不允许禁用')
    return
  }

  try {
    await post(`/systemd/services/${row.name}/${action}`)
    ElMessage.success(`已${label} ${row.name} 开机自启`)
    await fetchServices()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleRowClick(row) {
  detailService.value = row
  detailVisible.value = true
  detailLoading.value = true
  logsContent.value = ''

  try {
    detailData.value = await get(`/systemd/services/${row.name}`)
  } catch (e) {
    ElMessage.error('获取详情失败: ' + e.message)
    detailData.value = null
  }
  detailLoading.value = false

  // 自动加载日志
  fetchLogs()
}

async function fetchLogs() {
  if (!detailService.value) return
  logsLoading.value = true
  try {
    const res = await get(`/systemd/services/${detailService.value.name}/logs?lines=100`)
    logsContent.value = res.logs || ''
  } catch (e) {
    logsContent.value = '获取日志失败: ' + e.message
  }
  logsLoading.value = false
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}
</script>

<style scoped>
.systemd-manager {
  max-width: 1200px;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.clickable-row {
  cursor: pointer;
}
.service-name {
  font-family: Consolas, 'Source Code Pro', monospace;
  font-size: 13px;
}
.service-desc {
  color: #909399;
  font-size: 12px;
}
.actions-wrap {
  display: flex;
  gap: 4px;
}
.actions-wrap .el-button--small {
  padding: 2px 6px !important;
  font-size: 12px;
  min-width: 0;
  margin: 0;
}
.table-footer {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
.count-info {
  font-size: 12px;
  color: #909399;
}
.detail-content {
  padding: 0 4px;
}
.unit-path {
  font-family: Consolas, 'Source Code Pro', monospace;
  font-size: 12px;
  word-break: break-all;
}
.logs-section {
  margin-top: 24px;
}
.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.logs-title {
  font-size: 14px;
  font-weight: 600;
}
.log-output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.5;
  max-height: 400px;
  overflow-y: auto;
  font-family: Consolas, 'Source Code Pro', monospace;
  white-space: pre-wrap;
  word-break: break-all;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar .el-input,
  .toolbar .el-select {
    width: 100% !important;
  }
  .actions-wrap .el-button--small {
    font-size: 11px;
    padding: 2px 4px !important;
  }
  .log-output {
    font-size: 11px;
    padding: 12px;
    max-height: 300px;
  }
}
</style>
