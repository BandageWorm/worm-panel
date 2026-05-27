<template>
  <div class="nginx-manager" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
    <!-- Status Bar -->
    <div class="status-bar">
      <el-tag :type="nginxRunning ? 'success' : 'danger'" size="small">
        Nginx {{ nginxRunning ? '运行中' : '异常' }}
      </el-tag>
      <span class="status-msg">{{ statusMsg || '获取状态中...' }}</span>
      <div class="status-actions">
        <el-button size="small" plain @click="handleValidate">校验配置</el-button>
        <el-button size="small" plain type="warning" @click="handleReload" :loading="reloading">重载</el-button>
      </div>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab">
      <el-tab-pane label="站点列表" name="sites">
        <!-- Add Site Button -->
        <div class="toolbar">
          <el-button type="primary" size="small" @click="showAddDialog = true">添加反代站点</el-button>
        </div>

        <!-- Sites Table -->
        <el-table :data="sites" stripe v-loading="loading" size="small" @row-click="openEditor">
          <el-table-column prop="name" label="文件名" min-width="180" />
          <el-table-column prop="serverName" label="域名" min-width="160" />
          <el-table-column prop="proxyPass" label="反代目标" min-width="200" />
          <el-table-column prop="listen" label="监听端口" width="110" />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.isSelfManaged" size="small" type="info">只读</el-tag>
              <el-tag v-else size="small" type="success">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" :fixed="isMobile ? false : 'right'">
            <template #default="{ row }">
              <div class="actions-wrap">
              <el-button
                size="small" plain type="danger"
                :disabled="row.isSelfManaged"
                @click.stop="confirmDelete(row)"
              >删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="配置备份" name="backups">
        <el-table :data="backups" stripe v-loading="loadingBackups" size="small">
          <el-table-column prop="name" label="文件名" min-width="300" />
          <el-table-column prop="size" label="大小" width="100">
            <template #default="{ row }">{{ formatBytes(row.size) }}</template>
          </el-table-column>
          <el-table-column prop="updatedAt" label="备份时间" width="180" />
          <el-table-column label="操作" width="80">
            <template #default="{ row }">
              <div class="actions-wrap">
              <el-button size="small" plain type="primary" @click="viewBackup(row)">查看</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- Add Site Dialog -->
    <el-dialog v-model="showAddDialog" title="添加反代站点" width="500px">
      <el-form :model="addForm" label-position="top">
        <el-form-item label="域名">
          <el-input v-model="addForm.domain" placeholder="例如: api.example.com" />
        </el-form-item>
        <el-form-item label="目标端口">
          <el-input-number v-model="addForm.targetPort" :min="1" :max="65535" style="width:100%" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="addForm.ssl">启用 SSL（要求证书已存在）</el-checkbox>
        </el-form-item>
        <el-form-item v-if="addForm.ssl">
          <el-checkbox v-model="addForm.sslRedirect">HTTP 自动跳转 HTTPS</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAdd">创建</el-button>
      </template>
    </el-dialog>

    <!-- Config Editor Dialog -->
    <el-dialog v-model="showEditor" :title="editingSite" width="800px" top="5vh">
      <div class="editor-tip" v-if="isReadonly">
        <el-alert title="面板自身配置，只读不可编辑" type="info" :closable="false" show-icon />
      </div>
      <el-input
        v-model="editorContent"
        type="textarea"
        :rows="20"
        :disabled="isReadonly"
        class="config-editor"
      />
      <template #footer>
        <el-button @click="showEditor = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="isReadonly"
          @click="handleSave"
        >保存</el-button>
      </template>
    </el-dialog>

    <!-- Backup View Dialog -->
    <el-dialog v-model="showBackup" :title="backupName" width="800px" top="5vh">
      <el-input
        v-model="backupContent"
        type="textarea"
        :rows="20"
        readonly
        class="config-editor"
      />
    </el-dialog>
  </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post, put, del } from '../api'
import { useMobile } from '../composables/useMobile'

const { isMobile } = useMobile()

const loading = ref(true)
const reloading = ref(false)
const nginxRunning = ref(false)
const statusMsg = ref('')
const sites = ref([])
const backups = ref([])
const loadingBackups = ref(true)
const activeTab = ref('sites')

// Add
const showAddDialog = ref(false)
const adding = ref(false)
const addForm = ref({ domain: '', targetPort: 3000, ssl: false, sslRedirect: true })

// Editor
const showEditor = ref(false)
const editingSite = ref('')
const editorContent = ref('')
const isReadonly = ref(false)
const saving = ref(false)

// Backup viewer
const showBackup = ref(false)
const backupName = ref('')
const backupContent = ref('')

onMounted(async () => {
  await Promise.all([fetchStatus(), fetchSites()])
  loading.value = false
  fetchBackups()
})

async function fetchStatus() {
  try {
    const res = await get('/nginx/status')
    nginxRunning.value = res.running
    statusMsg.value = res.message || (res.running ? '运行正常' : '未运行')
  } catch {
    statusMsg.value = '无法获取 nginx 状态'
  }
}

async function fetchSites() {
  try {
    sites.value = await get('/nginx/sites')
  } catch {}
}

async function fetchBackups() {
  try {
    backups.value = await get('/nginx/backups')
  } catch {}
  loadingBackups.value = false
}

async function handleValidate() {
  try {
    const res = await post('/nginx/validate')
    ElMessage[res.valid ? 'success' : 'error'](res.message)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleReload() {
  reloading.value = true
  try {
    const res = await post('/nginx/reload')
    ElMessage[res.success ? 'success' : 'error'](res.message)
    fetchStatus()
  } catch (e) {
    ElMessage.error(e.message)
  }
  reloading.value = false
}

async function handleAdd() {
  if (!addForm.value.domain || !addForm.value.targetPort) return
  adding.value = true
  try {
    const res = await post('/nginx/sites', addForm.value)
    ElMessage.success(`站点 ${res.fileName} 创建成功`)
    showAddDialog.value = false
    addForm.value = { domain: '', targetPort: 3000, ssl: false, sslRedirect: true }
    fetchSites()
    fetchStatus()
  } catch (e) {
    ElMessage.error(e.message)
  }
  adding.value = false
}

async function confirmDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.name}？操作前会自动备份。`, '确认删除', {
      type: 'warning'
    })
    await del(`/nginx/sites/${row.name}`)
    ElMessage.success('已删除')
    fetchSites()
    fetchStatus()
  } catch {}
}

async function openEditor(row) {
  editingSite.value = row.name
  isReadonly.value = row.isSelfManaged
  try {
    const res = await get(`/nginx/sites/${row.name}`)
    editorContent.value = res.content
    showEditor.value = true
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleSave() {
  saving.value = true
  try {
    await put(`/nginx/sites/${editingSite.value}`, { content: editorContent.value })
    ElMessage.success('保存成功，Nginx 已重载')
    showEditor.value = false
    fetchSites()
    fetchStatus()
  } catch (e) {
    ElMessage.error('配置校验失败: ' + e.message)
  }
  saving.value = false
}

async function viewBackup(row) {
  backupName.value = row.name
  try {
    const res = await get(`/nginx/backups/${row.name}`)
    backupContent.value = res.content
    showBackup.value = true
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}
</script>


<style scoped>
.nginx-manager {
  max-width: 1200px;
}
.status-bar {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.status-msg {
  flex: 1;
  font-size: 13px;
  color: #909399;
}
.status-actions {
  display: flex;
  gap: 8px;
}
.toolbar {
  margin-bottom: 12px;
}
.config-editor {
  font-family: Consolas, 'Source Code Pro', monospace;
  font-size: 13px;
  line-height: 1.5;
}
.editor-tip {
  margin-bottom: 12px;
}
.actions-wrap {
  display: flex;
  gap: 4px;
  white-space: nowrap;
}
.actions-wrap .el-button--small {
  padding-left: 4px;
  padding-right: 4px;
}

@media (max-width: 768px) {
  .status-bar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .status-msg {
    width: 100%;
    order: 1;
  }
  .status-actions {
    width: 100%;
  }
  .status-actions .el-button {
    flex: 1;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  .toolbar .el-button {
    width: 100%;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  :deep(.el-dialog) {
    width: 92% !important;
  }
  :deep(.el-table .el-table__cell:nth-child(1)) {
    min-width: 100px;
    max-width: 120px;
  }
  :deep(.el-table .el-table__cell:nth-child(2)) {
    min-width: 0;
    max-width: 100px;
  }
  :deep(.el-table .el-table__cell:nth-child(3)) {
    min-width: 0;
    max-width: 120px;
  }
  :deep(.el-table .el-table__cell) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :deep(.el-table) {
    font-size: 12px;
  }
}
</style>
