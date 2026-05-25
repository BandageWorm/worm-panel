<template>
  <div class="file-browser">
    <!-- Toolbar -->
    <div class="fb-toolbar">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item v-for="(seg, i) in breadcrumbs" :key="i">
          <a href="#" @click.prevent="navigateTo(seg.path)">{{ seg.name }}</a>
        </el-breadcrumb-item>
      </el-breadcrumb>
      <div class="fb-actions">
        <el-button size="small" @click="showUpload = true" :disabled="!currentPath">
          <el-icon><Upload /></el-icon> 上传
        </el-button>
        <el-button size="small" @click="showMkdir = true" :disabled="!currentPath">
          <el-icon><FolderAdd /></el-icon> 新建目录
        </el-button>
        <el-button size="small" @click="refresh" :loading="loading" :icon="Refresh">
          刷新
        </el-button>
      </div>
    </div>

    <!-- File Table -->
    <el-table :data="files" stripe v-loading="loading" size="small" highlight-current-row
      @row-dblclick="handleRowDblclick" style="width:100%">
      <el-table-column label="名称" min-width="300">
        <template #default="{ row }">
          <div class="file-cell">
            <el-icon v-if="row.type === 'dir'" class="dir-icon"><Folder /></el-icon>
            <el-icon v-else class="file-icon"><Document /></el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="120">
        <template #default="{ row }">
          <span v-if="row.type === 'file'">{{ formatSize(row.size) }}</span>
          <span v-else style="color:#909399">--</span>
        </template>
      </el-table-column>
      <el-table-column label="修改时间" width="180">
        <template #default="{ row }">
          {{ formatTime(row.modifiedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="权限" width="80">
        <template #default="{ row }">
          <code style="font-size:12px">{{ row.mode }}</code>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.type === 'file'" text size="small" @click="handleDownload(row)">下载</el-button>
          <el-button text size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!loading && files.length === 0" description="空目录" :image-size="60" />

    <!-- Upload Dialog -->
    <el-dialog v-model="showUpload" title="上传文件" width="400px">
      <el-upload
        drag
        :action="uploadUrl"
        :headers="uploadHeaders"
        :data="uploadData"
        :on-success="handleUploadSuccess"
        :on-error="handleUploadError"
        multiple
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">将文件拖到此处，或<em>点击选择</em></div>
      </el-upload>
    </el-dialog>

    <!-- Mkdir Dialog -->
    <el-dialog v-model="showMkdir" title="新建目录" width="400px">
      <el-form @submit.prevent="handleMkdir">
        <el-form-item label="目录名">
          <el-input v-model="newDirName" placeholder="输入目录名称" @keyup.enter="handleMkdir" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMkdir = false">取消</el-button>
        <el-button type="primary" @click="handleMkdir" :loading="mkdirLoading">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, FolderAdd, Refresh, Folder, Document, UploadFilled } from '@element-plus/icons-vue'
import { get, del, post } from '../api'

const loading = ref(false)
const files = ref([])
const currentPath = ref('/')

// Upload
const showUpload = ref(false)
// Mkdir
const showMkdir = ref(false)
const newDirName = ref('')
const mkdirLoading = ref(false)

const breadcrumbs = computed(() => {
  const parts = currentPath.value.split('/').filter(Boolean)
  const crumbs = [{ name: '根目录 /', path: '/' }]
  let accumulated = ''
  for (const part of parts) {
    accumulated += '/' + part
    crumbs.push({ name: part, path: accumulated })
  }
  return crumbs
})

const uploadUrl = computed(() => {
  return `/api/files/upload?path=${encodeURIComponent(currentPath.value)}`
})

const uploadHeaders = computed(() => {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
})

const uploadData = computed(() => ({}))

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

async function fetchFiles() {
  loading.value = true
  try {
    files.value = await get(`/files?path=${encodeURIComponent(currentPath.value)}`)
  } catch (e) {
    ElMessage.error(e.message)
  }
  loading.value = false
}

function navigateTo(path) {
  currentPath.value = path
  fetchFiles()
}

function handleRowDblclick(row) {
  if (row.type === 'dir') {
    navigateTo(currentPath.value === '/' ? `/${row.name}` : `${currentPath.value}/${row.name}`)
  }
}

async function refresh() {
  await fetchFiles()
}

async function handleDownload(row) {
  const token = localStorage.getItem('token')
  const url = `/api/files/download?path=${encodeURIComponent(currentPath.value === '/' ? `/${row.name}` : `${currentPath.value}/${row.name}`)}`
  // Fetch with auth header for download
  try {
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || '下载失败')
    }
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = row.name
    a.click()
    URL.revokeObjectURL(blobUrl)
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleDelete(row) {
  const itemPath = currentPath.value === '/' ? `/${row.name}` : `${currentPath.value}/${row.name}`
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.name}？`, '确认删除', { type: 'warning' })
    await del(`/files?path=${encodeURIComponent(itemPath)}`)
    ElMessage.success('已删除')
    await fetchFiles()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message)
  }
}

async function handleMkdir() {
  if (!newDirName.value) return
  const dirPath = currentPath.value === '/' ? `/${newDirName.value}` : `${currentPath.value}/${newDirName.value}`
  mkdirLoading.value = true
  try {
    await post('/files/mkdir', { path: dirPath })
    ElMessage.success('目录已创建')
    showMkdir.value = false
    newDirName.value = ''
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  mkdirLoading.value = false
}

function handleUploadSuccess(res) {
  if (res.success) {
    ElMessage.success(`已上传: ${res.name}`)
    fetchFiles()
  } else {
    ElMessage.error(res.error || '上传失败')
  }
}

function handleUploadError(err) {
  ElMessage.error('上传失败: ' + (err.message || '未知错误'))
}

onMounted(() => {
  fetchFiles()
})
</script>

<style scoped>
.file-browser {
  margin-top: 4px;
}
.fb-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
.fb-actions {
  display: flex;
  gap: 6px;
}
.file-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dir-icon {
  color: #e6a23c;
  font-size: 18px;
}
.file-icon {
  color: #409eff;
  font-size: 18px;
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
</style>
