<template>
  <div class="sync-page">
    <!-- ✅ Connected: Status card -->
    <template v-if="installed && connected">
      <el-card shadow="never" class="status-card">
        <template #header>
          <div class="card-header">
            <el-icon><Upload /></el-icon>
            <span>云备份 · WebDAV</span>
            <el-tag type="success" size="small" effect="dark">已连接</el-tag>
          </div>
        </template>
        <div class="status-grid">
          <div class="status-item">
            <span class="label">WebDAV 地址</span>
            <span class="value mono">{{ info.webdavUrl }}</span>
          </div>
          <div class="status-item">
            <span class="label">上次同步</span>
            <span class="value">{{ formatTime(info.lastSync) }}</span>
          </div>
          <div class="status-item">
            <span class="label">最近结果</span>
            <span class="value">
              <el-tag :type="info.lastStatus === 'ok' ? 'success' : 'danger'" size="small">
                {{ info.lastStatus === 'ok' ? '成功' : '失败' }}
              </el-tag>
            </span>
          </div>
          <div class="status-item">
            <span class="label">连接时间</span>
            <span class="value">{{ formatTime(info.connectedAt) }}</span>
          </div>
        </div>
        <div class="status-actions">
          <el-button type="primary" :loading="backingUp" @click="handleBackup" icon="Upload">
            立即备份
          </el-button>
          <el-button type="success" :loading="restoring" @click="handleRestore" icon="Download">
            从云端恢复
          </el-button>
          <el-button type="danger" @click="handleDisconnect" icon="Link">
            断开连接
          </el-button>
        </div>
      </el-card>

      <!-- 💾 Backup Drive -->
      <el-card shadow="never" class="drive-card">
        <template #header>
          <div class="card-header">
            <el-icon><FolderOpened /></el-icon>
            <span>备份盘</span>
            <el-tag v-if="!connected" size="small" effect="plain" type="warning">本地模式</el-tag>
            <el-tag v-if="connected" size="small" effect="plain" type="info">自动同步</el-tag>
          </div>
        </template>

        <!-- Upload area -->
        <div class="drive-upload-area" @dragenter.prevent="dragOver=true" @dragover.prevent="dragOver=true" @dragleave.prevent="dragOver=false" @drop.prevent="dragOver=false">
          <el-upload
            drag
            name="files"
            :action="uploadUrl"
            :headers="uploadHeaders"
            :data="{ path: drivePath }"
            multiple
            :show-file-list="false"
            :on-success="handleDriveUploadSuccess"
            :on-error="(e) => ElMessage.error('上传失败: ' + (e.message || e))"
            :before-upload="() => { uploading = true; return true; }"
          >
            <el-icon class="upload-icon" :class="{ 'is-dragover': dragOver }"><Upload /></el-icon>
            <div class="upload-text">
              <span>拖拽文件到此处，或<em>点击选择</em>上传</span>
            </div>
            <template #tip>
              <div class="upload-tip">单个文件不超过 500MB</div>
            </template>
          </el-upload>
        </div>

        <!-- Toolbar -->
        <div class="drive-toolbar">
          <el-button size="small" type="primary" plain @click="showNewFolderDialog">
            <el-icon><Plus /></el-icon>新建文件夹
          </el-button>
          <el-breadcrumb separator="/" class="drive-breadcrumb">
            <el-breadcrumb-item>
              <a href="#" @click.prevent="navigateToFolder('/')">备份盘</a>
            </el-breadcrumb-item>
            <el-breadcrumb-item v-for="(seg, i) in breadcrumbSegs" :key="i">
              <a href="#" @click.prevent="navigateToFolder(seg.path)">{{ seg.name }}</a>
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>

        <!-- File list -->
        <el-table :data="driveEntries" stripe v-loading="loadingDrive" empty-text="暂无文件">
          <el-table-column label="名称" min-width="200">
            <template #default="{ row }">
              <div class="drive-name-cell">
                <el-icon v-if="row.type === 'dir'" class="dir-icon"><FolderOpened /></el-icon>
                <el-icon v-else class="file-icon"><Document /></el-icon>
                <template v-if="editingName === row.name">
                  <el-input
                    ref="renameInput"
                    v-model="renameValue"
                    size="small"
                    class="rename-input"
                    @keyup.enter="submitRename(row.name)"
                    @blur="submitRename(row.name)"
                  />
                </template>
                <span v-else class="drive-name" :class="{ clickable: row.type === 'dir' }" @click="row.type === 'dir' && navigateToFolder(drivePath + '/' + row.name)">
                  {{ row.name }}
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="100" align="right">
            <template #default="{ row }">
              <span v-if="row.type === 'dir'">--</span>
              <span v-else>{{ formatBytes(row.size) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="修改时间" min-width="160">
            <template #default="{ row }">
              {{ formatTime(row.mtime) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120" :fixed="isMobile ? false : 'right'">
            <template #default="{ row }">
              <div class="actions-wrap">
              <el-button size="small" plain @click="handleDownload(row)" :disabled="row.type === 'dir'">
                <el-icon><Download /></el-icon>
              </el-button>
              <el-button size="small" plain @click="startRename(row)">
                <el-icon><EditPen /></el-icon>
              </el-button>
              <el-button size="small" plain type="danger" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- New folder dialog -->
      <el-dialog v-model="newFolderVisible" title="新建文件夹" width="360px">
        <el-form @submit.prevent="createFolder">
          <el-form-item label="文件夹名称">
            <el-input v-model="newFolderName" ref="newFolderInput" placeholder="输入文件夹名称" @keyup.enter="createFolder" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="newFolderVisible = false">取消</el-button>
          <el-button type="primary" :disabled="!newFolderName.trim()" @click="createFolder">创建</el-button>
        </template>
      </el-dialog>

      <!-- History table -->
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon><Timer /></el-icon>
            <span>备份历史</span>
          </div>
        </template>
        <el-table :data="history" stripe v-if="history.length > 0">
          <el-table-column label="时间" min-width="160">
            <template #default="{ row }">
              {{ formatTime(row.time) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'ok' ? 'success' : 'danger'" size="small">
                {{ row.status === 'ok' ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.source === 'drive'" size="small" type="warning" effect="plain">备份盘</el-tag>
              <el-tag v-else size="small" type="primary" effect="plain">笔记备份</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="文件数" prop="files" width="80" />
          <el-table-column label="大小" width="100">
            <template #default="{ row }">
              {{ formatBytes(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="错误信息" min-width="200">
            <template #default="{ row }">
              <span class="error-text" v-if="row.error">{{ row.error }}</span>
              <span v-else>--</span>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无备份记录" />
      </el-card>
    </template>

    <!-- ❌ rclone not installed -->
    <template v-else-if="!installed">
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon><WarningFilled /></el-icon>
            <span>缺少依赖</span>
          </div>
        </template>
        <el-alert
          title="rclone 未安装"
          type="warning"
          :closable="false"
          show-icon
          description="云备份功能需要 rclone 支持"
        />
        <div class="install-guide">
          <p>在服务器上运行以下命令安装 rclone：</p>
          <pre class="code-block">curl -fsSL https://rclone.org/install.sh | bash</pre>
          <p>安装完成后刷新此页面。</p>
        </div>
      </el-card>
    </template>

    <!-- 🔌 Not connected: setup guide + config form -->
    <template v-else>
      <el-card shadow="never" class="setup-card">
        <template #header>
          <div class="card-header">
            <el-icon><Link /></el-icon>
            <span>连接阿里云盘</span>
          </div>
        </template>

        <div class="setup-steps">
          <el-steps direction="vertical" :active="setupStep" space="large">
            <el-step title="安装 aliyundrive-webdav">
              <template #description>
                <p>在服务器上安装 aliyundrive-webdav：</p>
                <div class="cmd-wrapper">
                  <code class="cmd-line">pip install aliyundrive-webdav</code>
                  <el-button text size="small" @click="copyCmd('pip install aliyundrive-webdav')">
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
              </template>
            </el-step>
            <el-step title="扫码登录阿里云盘">
              <template #description>
                <p>在服务器上运行，用手机阿里云盘 App 扫码：</p>
                <div class="cmd-wrapper">
                  <code class="cmd-line">aliyundrive-webdav qr login</code>
                  <el-button text size="small" @click="copyCmd('aliyundrive-webdav qr login')">
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
                <p class="step-hint">扫码后 token 会自动保存到本地</p>
              </template>
            </el-step>
            <el-step title="启动 WebDAV 服务">
              <template #description>
                <p>启动服务（也可用 systemctl start aliyundrive-webdav）：</p>
                <div class="cmd-wrapper">
                  <code class="cmd-line">aliyundrive-webdav --port 8080 -U admin -W 你的密码</code>
                </div>
                <p class="step-hint">记住你设置的端口、用户名和密码，下面要用到</p>
              </template>
            </el-step>
          </el-steps>

          <el-divider />
          <p class="form-title">填入 WebDAV 连接信息</p>

          <el-form label-position="top" class="webdav-form" @submit.prevent="handleConnect">
            <el-form-item label="WebDAV 地址">
              <el-input v-model="webdavUrl" placeholder="http://localhost:8080" />
            </el-form-item>
            <el-form-item label="用户名（可选）">
              <el-input v-model="webdavUser" placeholder="admin" />
            </el-form-item>
            <el-form-item label="密码">
              <el-input v-model="webdavPassword" type="password" show-password placeholder="启动时设置的密码" />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="connecting"
                :disabled="!webdavUrl || !webdavPassword"
                @click="handleConnect"
              >
                测试并连接
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, Timer, WarningFilled, Link, CopyDocument, FolderOpened, Document, Download, Delete, EditPen, Plus } from '@element-plus/icons-vue'
import { get, post } from '../api'
import { useMobile } from '../composables/useMobile'

const { isMobile } = useMobile()

const installed = ref(true)
const connected = ref(false)
const info = ref({})
const history = ref([])
const backingUp = ref(false)
const restoring = ref(false)
const connecting = ref(false)
const setupStep = ref(0)

const webdavUrl = ref('')
const webdavUser = ref('')
const webdavPassword = ref('')

// ── Drive state ──
const driveEntries = ref([])
const drivePath = ref('/')
const loadingDrive = ref(false)
const uploading = ref(false)
const dragOver = ref(false)
const editingName = ref(null)
const renameValue = ref('')
const renameInput = ref(null)
const newFolderVisible = ref(false)
const newFolderName = ref('')
const newFolderInput = ref(null)

const uploadUrl = computed(() => '/api/drive/upload')
const uploadHeaders = computed(() => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: 'Bearer ' + token } : {}
})
const breadcrumbSegs = computed(() => {
  if (drivePath.value === '/' || !drivePath.value) return []
  const parts = drivePath.value.split('/').filter(Boolean)
  const segs = []
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    segs.push({ name: p, path: acc })
  }
  return segs
})

async function fetchStatus() {
  try {
    const res = await get('/sync/status')
    installed.value = res.installed
    connected.value = res.connected
    info.value = res
  } catch {
    // ignore
  }
}

async function fetchHistory() {
  try {
    history.value = await get('/sync/history')
  } catch {
    // ignore
  }
}

async function handleConnect() {
  connecting.value = true
  try {
    await post('/sync/auth-complete', {
      url: webdavUrl.value.trim(),
      user: webdavUser.value.trim(),
      password: webdavPassword.value
    })
    ElMessage.success('连接成功')
    webdavUrl.value = ''
    webdavUser.value = ''
    webdavPassword.value = ''
    await fetchStatus()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    connecting.value = false
  }
}

async function handleBackup() {
  backingUp.value = true
  try {
    const res = await post('/sync/backup')
    ElMessage.success(`备份完成: ${res.files} 个文件, ${formatBytes(res.size)}`)
    await fetchStatus()
    await fetchHistory()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    backingUp.value = false
  }
}

async function handleRestore() {
  try {
    await ElMessageBox.confirm(
      '从云端恢复将覆盖本地的所有笔记文件，确定继续？',
      '恢复确认',
      { confirmButtonText: '确定恢复', cancelButtonText: '取消', type: 'warning' }
    )
    restoring.value = true
    await post('/sync/restore')
    ElMessage.success('恢复完成')
  } catch {
    // cancelled
  } finally {
    restoring.value = false
  }
}

async function handleDisconnect() {
  try {
    await ElMessageBox.confirm(
      '断开连接后需要重新配置才能继续备份，确定断开？',
      '断开确认',
      { confirmButtonText: '确定断开', cancelButtonText: '取消', type: 'warning' }
    )
    await post('/sync/disconnect')
    ElMessage.success('已断开连接')
    connected.value = false
  } catch {
    // cancelled
  }
}

function copyCmd(text) {
  navigator.clipboard.writeText(text)
    .then(() => ElMessage.success('已复制'))
    .catch(() => ElMessage.error('复制失败'))
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes === 0) return '--'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

function formatTime(iso) {
  if (!iso) return '从未'
  try {
    return new Date(iso).toLocaleString('zh-CN', { hour12: false })
  } catch {
    return iso
  }
}

// ── Drive functions ──

async function fetchDriveList() {
  loadingDrive.value = true
  try {
    const res = await get(`/drive/list?path=${encodeURIComponent(drivePath.value)}`)
    driveEntries.value = res.entries
  } catch {
    ElMessage.error('获取文件列表失败')
  } finally {
    loadingDrive.value = false
  }
}

function handleDriveUploadSuccess() {
  ElMessage.success('上传完成')
  fetchDriveList()
  // 延迟刷新历史，等异步同步完成写入记录
  setTimeout(() => fetchHistory(), 1500)
}

async function handleDownload(row) {
  const path = drivePath.value === '/' ? '/' + row.name : drivePath.value + '/' + row.name
  const token = localStorage.getItem('token')
  try {
    const res = await fetch(`/api/drive/download?path=${encodeURIComponent(path)}`, {
      headers: token ? { Authorization: 'Bearer ' + token } : {}
    })
    if (!res.ok) throw new Error('下载失败')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleDelete(row) {
  try {
    const fullPath = drivePath.value === '/' ? '/' + row.name : drivePath.value + '/' + row.name
    const msg = row.type === 'dir' ? `确定删除文件夹「${row.name}」及其所有内容？` : `确定删除文件「${row.name}」？`
    await ElMessageBox.confirm(msg, '删除确认', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await fetch('/api/drive/', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ path: fullPath })
    })
    ElMessage.success('删除成功')
    fetchDriveList()
  } catch {
    // cancelled or error
  }
}

function startRename(row) {
  editingName.value = row.name
  renameValue.value = row.name
  nextTick(() => {
    const input = document.querySelector('.rename-input input')
    if (input) input.focus()
  })
}

async function submitRename(oldName) {
  const newName = renameValue.value.trim()
  if (!newName || newName === oldName) {
    editingName.value = null
    return
  }
  try {
    const fullPath = drivePath.value === '/' ? '/' + oldName : drivePath.value + '/' + oldName
    const res = await fetch('/api/drive/rename', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ path: fullPath, newName })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '重命名失败')
    }
    ElMessage.success('重命名成功')
    editingName.value = null
    fetchDriveList()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function showNewFolderDialog() {
  newFolderName.value = ''
  newFolderVisible.value = true
  nextTick(() => {
    const input = document.querySelector('.new-folder-input input')
    if (input) input.focus()
  })
}

async function createFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  try {
    const fullPath = drivePath.value === '/' ? '/' + name : drivePath.value + '/' + name
    const res = await fetch('/api/drive/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('token') || '') },
      body: JSON.stringify({ path: fullPath })
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error || '创建失败')
    }
    ElMessage.success('文件夹创建成功')
    newFolderVisible.value = false
    fetchDriveList()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function navigateToFolder(path) {
  drivePath.value = path
  fetchDriveList()
}

onMounted(() => {
  fetchStatus()
  fetchHistory()
  fetchDriveList()
})
</script>

<style scoped>
.sync-page {
  max-width: 900px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.card-header .el-tag {
  font-weight: 400;
}

/* Status card */
.status-card {
  margin-bottom: 16px;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}
.status-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.status-item .label {
  font-size: 13px;
  color: #909399;
}
.status-item .value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.status-item .mono {
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
}
.status-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.error-text {
  color: #f56c6c;
  font-size: 13px;
}

/* Setup */
.setup-card {
  margin-bottom: 16px;
}
.setup-steps {
  max-width: 640px;
}
.setup-steps p {
  font-size: 14px;
  color: #606266;
  margin: 6px 0;
}
.step-hint {
  font-size: 13px;
  color: #909399;
}
.cmd-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #1a1a2e;
  border-radius: 6px;
  padding: 10px 14px;
  margin: 8px 0;
}
.cmd-line {
  flex: 1;
  color: #67c23a;
  font-size: 14px;
  user-select: all;
  word-break: break-all;
}
.form-title {
  font-weight: 600;
  font-size: 15px;
  color: #303133;
  margin-bottom: 8px;
}
.webdav-form {
  max-width: 480px;
}

/* Install guide */
.install-guide {
  margin-top: 16px;
}
.install-guide p {
  font-size: 14px;
  color: #606266;
  margin: 8px 0;
}
.code-block {
  background: #1a1a2e;
  color: #e6e6e6;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  overflow-x: auto;
  margin: 8px 0;
}

/* Drive card */
.drive-card {
  margin-bottom: 16px;
}
.drive-upload-area {
  margin-bottom: 12px;
}
.drive-upload-area .el-upload {
  width: 100%;
}
.drive-upload-area .el-upload-dragger {
  width: 100%;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.upload-icon {
  font-size: 24px;
  color: #909399;
  flex-shrink: 0;
  transition: color 0.2s;
}
.upload-icon.is-dragover {
  color: #409eff;
}
.upload-text {
  font-size: 13px;
  color: #606266;
  margin-top: 0;
}
.upload-text em {
  color: #409eff;
  font-style: normal;
}
.upload-tip {
  font-size: 12px;
  color: #909399;
  margin-left: auto;
  white-space: nowrap;
}
.drive-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.drive-breadcrumb {
  flex: 1;
  min-width: 0;
}
.drive-breadcrumb .el-breadcrumb__inner a {
  font-size: 13px;
}
.drive-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dir-icon {
  color: #e6a23c;
  flex-shrink: 0;
}
.file-icon {
  color: #909399;
  flex-shrink: 0;
}
.drive-name {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drive-name.clickable {
  cursor: pointer;
  color: #409eff;
}
.drive-name.clickable:hover {
  text-decoration: underline;
}
.rename-input {
  width: 160px;
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

/* Responsive */
@media (max-width: 768px) {
  .sync-page {
    max-width: 100%;
  }
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .status-actions {
    flex-direction: column;
  }
  .status-actions .el-button {
    width: 100%;
    justify-content: center;
  }
  .setup-steps {
    max-width: 100%;
  }
  .webdav-form {
    max-width: 100%;
  }
  .card-header {
    flex-wrap: wrap;
  }
  .drive-upload-area .el-upload-dragger {
    padding: 8px 12px;
    flex-wrap: wrap;
  }
  .upload-tip {
    margin-left: 0;
    white-space: normal;
  }
  .drive-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .drive-breadcrumb {
    text-align: center;
  }
}
</style>
