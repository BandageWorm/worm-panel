<template>
  <div class="directlink-manager">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span class="card-title"><el-icon><Link /></el-icon> 文件直链</span>
          <div class="header-actions">
            <el-button size="small" type="primary" @click="showUpload = true">
              <el-icon><UploadFilled /></el-icon> 上传文件
            </el-button>
            <el-button size="small" @click="fetchList" :loading="loading" :icon="Refresh">刷新</el-button>
          </div>
        </div>
      </template>

      <div class="dl-table-wrapper">
        <el-table :data="items" stripe v-loading="loading" size="small" style="width:100%">
          <el-table-column label="文件名" min-width="160">
            <template #default="{ row }">
              <div class="file-cell">
                <el-icon class="file-icon"><Document /></el-icon>
                <span class="file-name">{{ row.originalName }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="size" label="大小" width="90">
            <template #default="{ row }">{{ formatSize(row.size) }}</template>
          </el-table-column>
          <el-table-column label="创建时间" width="150">
            <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="过期时间" width="150">
            <template #default="{ row }">
              <span v-if="row.expiresAt" :class="{ 'expired-tag': isExpired(row) }">
                {{ formatTime(row.expiresAt) }}{{ isExpired(row) ? '（已过期）' : '' }}
              </span>
              <span v-else style="color:#909399">永久</span>
            </template>
          </el-table-column>
          <el-table-column label="MD5" min-width="160">
            <template #default="{ row }">
              <span v-if="row.md5" class="md5-text" @click="copyMd5(row.md5)" title="点击复制 MD5">{{ row.md5 }}</span>
              <span v-else style="color:#909399">--</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" class-name="actions-col">
            <template #default="{ row }">
              <div class="actions-wrap">
                <el-button size="small" plain type="primary" @click="copyLink(row.url)" title="复制直链">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
                <el-button size="small" plain @click="openLink(row.url)" title="打开">
                  <el-icon><Download /></el-icon>
                </el-button>
                <el-button size="small" plain type="danger" @click="handleDelete(row)" title="删除">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="!loading && items.length === 0" description="暂无直链，点击上传文件生成" :image-size="60" />
    </el-card>

    <!-- 上传弹窗 -->
    <el-dialog v-model="showUpload" title="上传文件生成直链" width="440px">
      <el-form label-width="80px">
        <el-form-item label="选择文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-exceed="handleExceed"
            :file-list="fileList"
            drag
          >
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-text">将文件拖到此处，或<em>点击选择</em></div>
            <template #tip>
              <div class="upload-tip">单文件上限 500MB</div>
            </template>
          </el-upload>
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker
            v-model="expiresAt"
            type="datetime"
            placeholder="不填则永久有效"
            style="width:100%"
            :disabled-date="disabledDate"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeUpload">取消</el-button>
        <el-button type="primary" :loading="uploading" :disabled="!selectedFile" @click="handleUpload">
          上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Link, UploadFilled, Refresh, Document, CopyDocument, Download, Delete } from '@element-plus/icons-vue'
import { listDirectLinks, uploadDirectLink, deleteDirectLink } from '../api'

const loading = ref(false)
const items = ref([])

const showUpload = ref(false)
const uploading = ref(false)
const selectedFile = ref(null)
const fileList = ref([])
const expiresAt = ref(null)

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i]
}

function formatTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function isExpired(row) {
  return row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()
}

function disabledDate(date) {
  return date.getTime() < Date.now() - 24 * 60 * 60 * 1000
}

async function fetchList() {
  loading.value = true
  try {
    items.value = await listDirectLinks()
  } catch (e) {
    ElMessage.error(e.message)
  }
  loading.value = false
}

function handleFileChange(file) {
  selectedFile.value = file.raw
  fileList.value = [file]
}

function handleExceed(files) {
  const file = files[0]
  selectedFile.value = file
  fileList.value = [{ name: file.name, raw: file }]
}

function closeUpload() {
  showUpload.value = false
  selectedFile.value = null
  fileList.value = []
  expiresAt.value = null
}

async function handleUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    const expIso = expiresAt.value ? new Date(expiresAt.value).toISOString() : null
    const res = await uploadDirectLink(selectedFile.value, expIso)
    ElMessage.success('已生成直链')
    await copyLink(res.url, true)
    closeUpload()
    await fetchList()
  } catch (e) {
    ElMessage.error(e.message)
  }
  uploading.value = false
}

async function copyLink(url, silent = false) {
  try {
    await navigator.clipboard.writeText(url)
    if (!silent) ElMessage.success('直链已复制')
    else ElMessage.success('直链已复制到剪贴板')
  } catch {
    if (!silent) ElMessage.warning('复制失败，请手动复制')
  }
}

function openLink(url) {
  window.open(url, '_blank')
}

async function copyMd5(md5) {
  try {
    await navigator.clipboard.writeText(md5)
    ElMessage.success('MD5 已复制')
  } catch {
    ElMessage.warning('复制失败，请手动复制')
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除直链「${row.originalName}」？删除后链接立即失效。`, '确认删除', { type: 'warning' })
    await deleteDirectLink(row.token)
    ElMessage.success('已删除')
    await fetchList()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message)
  }
}

onMounted(() => {
  fetchList()
})
</script>

<style scoped>
.directlink-manager {
  max-width: 1200px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.card-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
}
.header-actions {
  display: flex;
  gap: 6px;
}
.dl-table-wrapper {
  overflow-x: auto;
}
.file-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.file-icon {
  color: #409eff;
  font-size: 18px;
}
.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.md5-text {
  font-size: 12px;
  color: #606266;
  word-break: break-all;
  cursor: pointer;
}
.md5-text:hover {
  color: #409eff;
}
.expired-tag {
  color: #f56c6c;
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
.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 8px;
}
.upload-text {
  color: #606266;
  font-size: 14px;
}
.upload-text em {
  color: #409eff;
  font-style: normal;
}
.upload-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: stretch;
  }
  .header-actions {
    justify-content: stretch;
  }
  .header-actions .el-button {
    flex: 1;
  }
  :deep(.el-dialog) {
    width: 92% !important;
  }
  :deep(.el-table) {
    font-size: 12px;
  }
}
</style>
