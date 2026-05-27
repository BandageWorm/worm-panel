<template>
  <div class="file-browser">
    <!-- Toolbar -->
    <div class="fb-toolbar">
      <div class="fb-breadcrumb-area">
        <el-breadcrumb v-if="!pathInputMode" separator="/" class="fb-breadcrumb">
          <el-breadcrumb-item v-for="(seg, i) in breadcrumbs" :key="i">
            <a href="#" @click.prevent="navigateTo(seg.path)">{{ seg.name }}</a>
          </el-breadcrumb-item>
        </el-breadcrumb>
        <el-input v-else v-model="pathInputValue" size="small" class="fb-path-input"
          placeholder="输入路径" @keyup.enter="handlePathInputEnter" ref="pathInputRef" />
        <div class="fb-breadcrumb-actions">
          <el-button size="small" plain @click="togglePathInput" :title="pathInputMode ? '返回导航' : '编辑路径'">
            <el-icon><EditPen /></el-icon>
          </el-button>
          <el-button size="small" plain @click="copyPath" title="复制路径">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </div>
      </div>
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
    <div class="fb-table-wrapper">
    <el-table :data="sortedFiles" stripe v-loading="loading" size="small" highlight-current-row
      @row-dblclick="handleRowDblclick" @sort-change="handleSortChange" style="width:100%">
      <el-table-column label="名称" min-width="150" sortable="custom">
        <template #default="{ row }">
          <div class="file-cell">
            <el-icon v-if="row.type === 'dir'" class="dir-icon"><Folder /></el-icon>
            <el-icon v-else class="file-icon"><Document /></el-icon>
            <span>{{ row.name }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="size" label="大小" width="80" sortable="custom">
        <template #default="{ row }">
          <span v-if="row.type === 'file'">{{ formatSize(row.size) }}</span>
          <span v-else style="color:#909399">--</span>
        </template>
      </el-table-column>
      <el-table-column label="修改时间" width="150" sortable="custom">
        <template #default="{ row }">
          {{ formatTime(row.modifiedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="权限" width="80">
        <template #default="{ row }">
          <code style="font-size:12px">{{ row.mode }}</code>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" class-name="actions-col">
        <template #default="{ row }">
          <div class="actions-wrap">
            <el-button v-if="row.type === 'file' && isEditableFile(row.name)" size="small" plain type="primary" @click="handleEdit(row)">
              <el-icon><EditPen /></el-icon>
            </el-button>
            <el-button v-if="row.type === 'file'" size="small" plain @click="handleDownload(row)">
              <el-icon><Download /></el-icon>
            </el-button>
            <el-button size="small" plain type="danger" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    </div>

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

    <!-- Editor Dialog -->
    <el-dialog v-model="showEditor" :title="'编辑文件: ' + editorPath" width="90%" top="2vh"
      :close-on-click-modal="false" @close="handleEditorClose">
      <div v-if="editorLoading" style="text-align:center;padding:40px">
        <el-icon class="is-loading" :size="24"><Refresh /></el-icon>
        <p style="margin-top:12px;color:#909399">正在加载文件...</p>
      </div>
      <div v-else-if="editorError" style="text-align:center;padding:40px">
        <el-result icon="error" title="读取失败" :sub-title="editorError" />
      </div>
      <div v-else>
        <Codemirror
          v-model="editorContent"
          :extensions="editorExtensions"
          :style="{ height: '65vh' }"
          :autofocus="true"
          :disabled="false"
          :indent-with-tab="true"
          :tab-size="2"
        />
      </div>
      <template #footer>
        <el-button @click="showEditor = false">取消</el-button>
        <el-button type="primary" @click="handleEditorSave" :loading="editorSaving" :disabled="!!editorError">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Upload, FolderAdd, Refresh, Folder, Document, UploadFilled, EditPen, Download, Delete, CopyDocument } from '@element-plus/icons-vue'
import { get, del, post, put } from '../api'
import { Codemirror } from 'vue-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { xml } from '@codemirror/lang-xml'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'

const EDITABLE_EXTENSIONS = {
  '.txt': null,
  '.md': markdown,
  '.markdown': markdown,
  '.json': javascript,
  '.js': javascript,
  '.jsx': javascript,
  '.ts': javascript,
  '.tsx': javascript,
  '.cjs': javascript,
  '.mjs': javascript,
  '.vue': javascript,
  '.html': html,
  '.htm': html,
  '.css': css,
  '.scss': css,
  '.less': css,
  '.yml': yaml,
  '.yaml': yaml,
  '.xml': xml,
  '.svg': xml,
  '.sql': sql,
  '.conf': null,
  '.cfg': null,
  '.ini': null,
  '.sh': null,
  '.bash': null,
  '.zsh': null,
  '.env': null,
  '.log': null,
  '.gitignore': null,
  '.dockerignore': null,
  '.editorconfig': null,
  '.npmrc': null
}

function isEditableFile(filename) {
  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx === -1) return true // no extension, treat as text
  const ext = filename.slice(dotIdx).toLowerCase()
  return ext in EDITABLE_EXTENSIONS
}

function getLanguageExt(filename) {
  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx === -1) return null
  const ext = filename.slice(dotIdx).toLowerCase()
  return EDITABLE_EXTENSIONS[ext] || null
}

const loading = ref(false)
const files = ref([])
const currentPath = ref('/')

// Upload
const showUpload = ref(false)
// Mkdir
const showMkdir = ref(false)
const newDirName = ref('')
const mkdirLoading = ref(false)
// Editor
const showEditor = ref(false)
const editorLoading = ref(false)
const editorSaving = ref(false)
const editorPath = ref('')
const editorContent = ref('')
const editorError = ref('')
const editorExtensions = shallowRef([])

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

// Sort state
const sortProp = ref('')
const sortOrder = ref('')

const sortedFiles = computed(() => {
  const dirs = files.value.filter(f => f.type === 'dir')
  const fileItems = files.value.filter(f => f.type === 'file')
  if (!sortProp.value || !sortOrder.value) return [...dirs, ...fileItems]
  const compare = (a, b) => {
    const getVal = item => {
      if (sortProp.value === 'name') return (item.name || '').toLowerCase()
      if (sortProp.value === 'size') return item.size || 0
      if (sortProp.value === 'modifiedAt') return item.modifiedAt ? new Date(item.modifiedAt).getTime() : 0
      return item.name
    }
    const va = getVal(a)
    const vb = getVal(b)
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb
    return sortOrder.value === 'descending' ? -cmp : cmp
  }
  return [...dirs.sort(compare), ...fileItems.sort(compare)]
})

// Path input mode
const pathInputMode = ref(false)
const pathInputValue = ref('')
const pathInputRef = ref(null)

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
  } else if (row.type === 'file' && isEditableFile(row.name)) {
    handleEdit(row)
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

async function handleEdit(row) {
  const filePath = currentPath.value === '/' ? `/${row.name}` : `${currentPath.value}/${row.name}`
  editorPath.value = filePath
  editorContent.value = ''
  editorError.value = ''
  editorLoading.value = true
  showEditor.value = true

  try {
    // Set language extensions
    const lang = getLanguageExt(row.name)
    editorExtensions.value = lang ? [lang(), oneDark] : [oneDark]

    const result = await get(`/files/read?path=${encodeURIComponent(filePath)}`)
    editorContent.value = result.content
  } catch (e) {
    editorError.value = e.message
  } finally {
    editorLoading.value = false
  }
}

async function handleEditorSave() {
  editorSaving.value = true
  try {
    await put('/files/write', { path: editorPath.value, content: editorContent.value })
    ElMessage.success('已保存')
    showEditor.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  editorSaving.value = false
}

function handleEditorClose() {
  showEditor.value = false
  editorContent.value = ''
  editorError.value = ''
}

function handleSortChange({ prop, order }) {
  sortProp.value = prop || ''
  sortOrder.value = order || ''
}

function togglePathInput() {
  if (pathInputMode.value) {
    pathInputMode.value = false
  } else {
    pathInputValue.value = currentPath.value
    pathInputMode.value = true
    nextTick(() => pathInputRef.value?.focus())
  }
}

async function handlePathInputEnter() {
  const path = pathInputValue.value.trim()
  if (!path) return
  try {
    // Verify path exists before navigating
    await get(`/files?path=${encodeURIComponent(path)}`)
    currentPath.value = path
    await fetchFiles()
    pathInputMode.value = false
  } catch (e) {
    ElMessage.error('路径不存在')
  }
}

async function copyPath() {
  try {
    await navigator.clipboard.writeText(currentPath.value)
    ElMessage.success('路径已复制')
  } catch (e) {
    ElMessage.error('复制失败')
  }
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
/* Mobile responsive table wrapper */
.fb-table-wrapper {
  overflow-x: auto;
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

.fb-breadcrumb-area {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.fb-breadcrumb {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fb-path-input {
  flex: 1;
  min-width: 0;
}
.fb-breadcrumb-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .fb-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .fb-actions {
    justify-content: stretch;
  }
  .fb-actions .el-button {
    flex: 1;
  }
  :deep(.el-table .el-table__cell) {
    max-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :deep(.el-table .el-table__cell:nth-child(1)) {
    min-width: 100px !important;
    max-width: 140px;
  }
  :deep(colgroup col:nth-child(1)) {
    min-width: 100px !important;
    width: auto !important;
  }
  :deep(.el-table .el-table__cell:nth-child(2)) {
    width: 60px;
  }
  :deep(.el-table .el-table__cell:nth-child(3)) {
    width: 100px;
  }
  :deep(.el-table .el-table__cell:nth-child(4)) {
    width: 50px;
  }
  :deep(.el-table .el-table__cell:nth-child(5)) {
    width: 80px;
  }
  .actions-wrap {
    flex-wrap: nowrap;
  }
  :deep(.el-dialog) {
    width: 92% !important;
  }
  :deep(.el-dialog__title) {
    font-size: 14px;
  }
  :deep(.el-table) {
    font-size: 12px;
  }
  :deep(.cm-editor) {
    font-size: 10px;
  }
}
</style>
