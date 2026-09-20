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
        <el-input v-model="searchKeyword" size="small" clearable placeholder="搜索文件名" class="fb-search"
          :prefix-icon="Search" />
        <el-button size="small" @click="showUpload = true" :disabled="!currentPath">
          <el-icon><Upload /></el-icon> 上传
        </el-button>
        <el-button size="small" @click="showMkdir = true" :disabled="!currentPath">
          <el-icon><FolderAdd /></el-icon> 新建目录
        </el-button>
        <el-button size="small" @click="openNewFile" :disabled="!currentPath">
          <el-icon><DocumentAdd /></el-icon> 新建文件
        </el-button>
        <el-button size="small" @click="refresh" :loading="loading" :icon="Refresh">
          刷新
        </el-button>
      </div>
    </div>

    <!-- Batch action bar -->
    <div v-if="selectedRows.length > 0" class="fb-batch-bar">
      <span class="fb-batch-count">已选 {{ selectedRows.length }} 项</span>
      <el-button size="small" type="danger" plain @click="handleBatchDelete">
        <el-icon><Delete /></el-icon> 批量删除
      </el-button>
      <el-button size="small" plain @click="openBatchMove">
        <el-icon><Rank /></el-icon> 批量移动
      </el-button>
      <el-button size="small" plain @click="openBatchCompress">
        <el-icon><Box /></el-icon> 批量压缩
      </el-button>
      <el-button size="small" text @click="clearSelection">取消选择</el-button>
    </div>

    <!-- File Table -->
    <div class="fb-table-wrapper">
    <el-table ref="tableRef" :data="sortedFiles" stripe v-loading="loading" size="small" highlight-current-row
      @row-dblclick="handleRowDblclick" @sort-change="handleSortChange" @selection-change="handleSelectionChange"
      row-key="name" style="width:100%">
      <el-table-column type="selection" width="40" :selectable="() => true" />
      <el-table-column label="名称" min-width="240" sortable="custom">
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
          <el-button size="small" text class="perm-btn" @click="openChmod(row)" title="修改权限">
            <span class="perm-text">{{ row.mode }}</span>
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" class-name="actions-col">
        <template #default="{ row }">
          <div class="actions-wrap">
            <el-button v-if="row.type === 'file' && isEditableFile(row.name)" size="small" plain type="primary" @click="handleEdit(row)" title="编辑">
              <el-icon><EditPen /></el-icon>
            </el-button>
            <el-button v-if="row.type === 'file'" size="small" plain @click="handleDownload(row)" title="下载">
              <el-icon><Download /></el-icon>
            </el-button>
            <el-dropdown trigger="click" @command="cmd => handleRowCommand(cmd, row)">
              <el-button size="small" plain title="更多">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename"><el-icon><EditPen /></el-icon> 重命名</el-dropdown-item>
                  <el-dropdown-item command="move"><el-icon><Rank /></el-icon> 移动</el-dropdown-item>
                  <el-dropdown-item command="copy"><el-icon><CopyDocument /></el-icon> 复制</el-dropdown-item>
                  <el-dropdown-item command="compress"><el-icon><Box /></el-icon> 压缩</el-dropdown-item>
                  <el-dropdown-item v-if="isArchive(row.name)" command="extract"><el-icon><FolderOpened /></el-icon> 解压</el-dropdown-item>
                  <el-dropdown-item command="chmod"><el-icon><Lock /></el-icon> 权限</el-dropdown-item>
                  <el-dropdown-item command="delete" divided><span style="color:#f56c6c">删除</span></el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-empty v-if="!loading && sortedFiles.length === 0" description="空目录" :image-size="60" />

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
          <el-input v-model="newDirName" placeholder="输入目录名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMkdir = false">取消</el-button>
        <el-button type="primary" @click="handleMkdir" :loading="mkdirLoading">创建</el-button>
      </template>
    </el-dialog>

    <!-- New File Dialog -->
    <el-dialog v-model="showNewFile" title="新建文件" width="400px">
      <el-form @submit.prevent="handleNewFile">
        <el-form-item label="文件名">
          <el-input v-model="newFileName" placeholder="输入文件名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewFile = false">取消</el-button>
        <el-button type="primary" @click="handleNewFile" :loading="opLoading">创建</el-button>
      </template>
    </el-dialog>

    <!-- Rename Dialog -->
    <el-dialog v-model="showRename" title="重命名" width="400px">
      <el-form @submit.prevent="handleRename">
        <el-form-item label="新名称">
          <el-input v-model="renameValue" placeholder="输入新名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRename = false">取消</el-button>
        <el-button type="primary" @click="handleRename" :loading="opLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- Move / Copy Dialog -->
    <el-dialog v-model="showTransfer" :title="transferMode === 'move' ? '移动到' : '复制到'" width="460px">
      <el-form @submit.prevent="handleTransfer">
        <el-form-item label="目标路径">
          <el-input v-model="transferDest" placeholder="输入目标目录（不存在会自动创建）" />
        </el-form-item>
        <div class="fb-hint">默认填当前目录，可修改为其它绝对路径</div>
      </el-form>
      <template #footer>
        <el-button @click="showTransfer = false">取消</el-button>
        <el-button type="primary" @click="handleTransfer" :loading="opLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- Compress Dialog -->
    <el-dialog v-model="showCompress" title="压缩" width="400px">
      <el-form @submit.prevent="handleCompress">
        <el-form-item label="格式">
          <el-radio-group v-model="compressFormat">
            <el-radio label="tar.gz">tar.gz</el-radio>
            <el-radio label="zip">zip</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCompress = false">取消</el-button>
        <el-button type="primary" @click="handleCompress" :loading="opLoading">压缩</el-button>
      </template>
    </el-dialog>

    <!-- Extract Dialog -->
    <el-dialog v-model="showExtract" title="解压" width="460px">
      <el-form @submit.prevent="handleExtract">
        <el-form-item label="解压到">
          <el-input v-model="extractDest" placeholder="目标目录，默认压缩包所在目录" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showExtract = false">取消</el-button>
        <el-button type="primary" @click="handleExtract" :loading="opLoading">解压</el-button>
      </template>
    </el-dialog>

    <!-- Chmod Dialog -->
    <el-dialog v-model="showChmod" title="修改权限" width="400px">
      <el-form @submit.prevent="handleChmod">
        <el-form-item label="权限值">
          <el-input v-model="chmodValue" placeholder="如 755" maxlength="4" />
        </el-form-item>
        <div class="fb-hint">三位或四位八进制，如 644、755、4755</div>
      </el-form>
      <template #footer>
        <el-button @click="showChmod = false">取消</el-button>
        <el-button type="primary" @click="handleChmod" :loading="opLoading">确定</el-button>
      </template>
    </el-dialog>

    <!-- Batch Move Dialog -->
    <el-dialog v-model="showBatchMove" title="批量移动到" width="460px">
      <el-form @submit.prevent="handleBatchMove">
        <el-form-item label="目标目录">
          <el-input v-model="batchMoveDest" placeholder="输入目标目录（不存在会自动创建）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showBatchMove = false">取消</el-button>
        <el-button type="primary" @click="handleBatchMove" :loading="opLoading">移动</el-button>
      </template>
    </el-dialog>

    <!-- Batch Compress Dialog -->
    <el-dialog v-model="showBatchCompress" title="批量压缩" width="400px">
      <el-form @submit.prevent="handleBatchCompress">
        <el-form-item label="格式">
          <el-radio-group v-model="batchCompressFormat">
            <el-radio label="tar.gz">tar.gz</el-radio>
            <el-radio label="zip">zip</el-radio>
          </el-radio-group>
        </el-form-item>
        <div class="fb-hint">将选中的 {{ selectedRows.length }} 项打包为一个压缩包（默认 archive.{{ batchCompressFormat }}）</div>
      </el-form>
      <template #footer>
        <el-button @click="showBatchCompress = false">取消</el-button>
        <el-button type="primary" @click="handleBatchCompress" :loading="opLoading">压缩</el-button>
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
import { Upload, FolderAdd, Refresh, Folder, Document, UploadFilled, EditPen, Download, Delete, CopyDocument,
  Search, DocumentAdd, MoreFilled, Rank, Box, FolderOpened, Lock } from '@element-plus/icons-vue'
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

const ARCHIVE_SUFFIXES = ['.tar', '.tar.gz', '.tgz', '.zip']

function isEditableFile(filename) {
  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx === -1) return true // no extension, treat as text
  const ext = filename.slice(dotIdx).toLowerCase()
  return ext in EDITABLE_EXTENSIONS
}

function isArchive(filename) {
  const lower = filename.toLowerCase()
  return ARCHIVE_SUFFIXES.some(s => lower.endsWith(s))
}

function getLanguageExt(filename) {
  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx === -1) return null
  const ext = filename.slice(dotIdx).toLowerCase()
  return EDITABLE_EXTENSIONS[ext] || null
}

const loading = ref(false)
const opLoading = ref(false)
const files = ref([])
const currentPath = ref('/')
const searchKeyword = ref('')

// Upload
const showUpload = ref(false)
// Mkdir
const showMkdir = ref(false)
const newDirName = ref('')
const mkdirLoading = ref(false)
// New file
const showNewFile = ref(false)
const newFileName = ref('')
// Rename
const showRename = ref(false)
const renameValue = ref('')
const activeRow = ref(null)
// Move / Copy
const showTransfer = ref(false)
const transferMode = ref('move')
const transferDest = ref('')
// Compress
const showCompress = ref(false)
const compressFormat = ref('tar.gz')
// Extract
const showExtract = ref(false)
const extractDest = ref('')
// Chmod
const showChmod = ref(false)
const chmodValue = ref('')
// Batch
const selectedRows = ref([])
const showBatchMove = ref(false)
const batchMoveDest = ref('')
const showBatchCompress = ref(false)
const batchCompressFormat = ref('tar.gz')
const tableRef = ref(null)
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
  const kw = searchKeyword.value.trim().toLowerCase()
  const filtered = kw
    ? files.value.filter(f => f.name.toLowerCase().includes(kw))
    : files.value
  const dirs = filtered.filter(f => f.type === 'dir')
  const fileItems = filtered.filter(f => f.type === 'file')
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

function joinPath(name) {
  return currentPath.value === '/' ? `/${name}` : `${currentPath.value}/${name}`
}

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
    clearSelection()
  } catch (e) {
    ElMessage.error(e.message)
  }
  loading.value = false
}

function navigateTo(path) {
  currentPath.value = path
  searchKeyword.value = ''
  fetchFiles()
}

function handleRowDblclick(row) {
  if (row.type === 'dir') {
    navigateTo(joinPath(row.name))
  } else if (row.type === 'file' && isEditableFile(row.name)) {
    handleEdit(row)
  }
}

async function refresh() {
  await fetchFiles()
}

async function handleDownload(row) {
  const token = localStorage.getItem('token')
  const url = `/api/files/download?path=${encodeURIComponent(joinPath(row.name))}`
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

// 单行删除，非空目录二次确认后递归
async function handleDelete(row) {
  const itemPath = joinPath(row.name)
  const isDir = row.type === 'dir'
  try {
    await ElMessageBox.confirm(
      isDir ? `确定删除目录 ${row.name}？若非空将递归删除其全部内容` : `确定要删除 ${row.name}？`,
      '确认删除', { type: 'warning' }
    )
    let query = `path=${encodeURIComponent(itemPath)}`
    if (isDir) query += '&recursive=true'
    await del(`/files?${query}`)
    ElMessage.success('已删除')
    await fetchFiles()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message)
  }
}

function handleRowCommand(cmd, row) {
  activeRow.value = row
  if (cmd === 'rename') { renameValue.value = row.name; showRename.value = true }
  else if (cmd === 'move') { transferMode.value = 'move'; transferDest.value = currentPath.value; showTransfer.value = true }
  else if (cmd === 'copy') { transferMode.value = 'copy'; transferDest.value = currentPath.value; showTransfer.value = true }
  else if (cmd === 'compress') { compressFormat.value = 'tar.gz'; showCompress.value = true }
  else if (cmd === 'extract') { extractDest.value = currentPath.value; showExtract.value = true }
  else if (cmd === 'chmod') { openChmod(row) }
  else if (cmd === 'delete') { handleDelete(row) }
}

async function handleMkdir() {
  if (!newDirName.value) return
  mkdirLoading.value = true
  try {
    await post('/files/mkdir', { path: joinPath(newDirName.value) })
    ElMessage.success('目录已创建')
    showMkdir.value = false
    newDirName.value = ''
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  mkdirLoading.value = false
}

function openNewFile() {
  newFileName.value = ''
  showNewFile.value = true
}

async function handleNewFile() {
  if (!newFileName.value) return
  opLoading.value = true
  try {
    await post('/files/newfile', { path: joinPath(newFileName.value) })
    ElMessage.success('文件已创建')
    showNewFile.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

async function handleRename() {
  if (opLoading.value || !renameValue.value || !activeRow.value) return
  opLoading.value = true
  try {
    await post('/files/rename', { path: joinPath(activeRow.value.name), newName: renameValue.value })
    ElMessage.success('已重命名')
    showRename.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

async function handleTransfer() {
  if (!transferDest.value || !activeRow.value) return
  opLoading.value = true
  try {
    const endpoint = transferMode.value === 'move' ? '/files/move' : '/files/copy'
    await post(endpoint, { src: joinPath(activeRow.value.name), dest: transferDest.value })
    ElMessage.success(transferMode.value === 'move' ? '已移动' : '已复制')
    showTransfer.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

async function handleCompress() {
  if (!activeRow.value) return
  opLoading.value = true
  try {
    await post('/files/compress', { path: joinPath(activeRow.value.name), format: compressFormat.value })
    ElMessage.success('已压缩')
    showCompress.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

async function handleExtract() {
  if (!activeRow.value) return
  opLoading.value = true
  try {
    await post('/files/extract', { path: joinPath(activeRow.value.name), dest: extractDest.value || undefined })
    ElMessage.success('已解压')
    showExtract.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

function openChmod(row) {
  activeRow.value = row
  chmodValue.value = row.mode || ''
  showChmod.value = true
}

async function handleChmod() {
  if (!chmodValue.value || !activeRow.value) return
  opLoading.value = true
  try {
    await post('/files/chmod', { path: joinPath(activeRow.value.name), mode: chmodValue.value })
    ElMessage.success('权限已修改')
    showChmod.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

// Batch
function handleSelectionChange(rows) {
  selectedRows.value = rows
}

function clearSelection() {
  selectedRows.value = []
  tableRef.value?.clearSelection?.()
}

async function handleBatchDelete() {
  if (selectedRows.value.length === 0) return
  const paths = selectedRows.value.map(r => joinPath(r.name))
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${paths.length} 项？目录将递归删除`, '确认批量删除', { type: 'warning' })
    const res = await post('/files/batch-delete', { paths })
    reportBatch(res.results, '删除')
    await fetchFiles()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message)
  }
}

function openBatchMove() {
  batchMoveDest.value = currentPath.value
  showBatchMove.value = true
}

async function handleBatchMove() {
  if (!batchMoveDest.value || selectedRows.value.length === 0) return
  const paths = selectedRows.value.map(r => joinPath(r.name))
  opLoading.value = true
  try {
    const res = await post('/files/batch-move', { paths, dest: batchMoveDest.value })
    reportBatch(res.results, '移动')
    showBatchMove.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

function openBatchCompress() {
  batchCompressFormat.value = 'tar.gz'
  showBatchCompress.value = true
}

async function handleBatchCompress() {
  if (opLoading.value || selectedRows.value.length === 0) return
  const paths = selectedRows.value.map(r => joinPath(r.name))
  opLoading.value = true
  try {
    const res = await post('/files/batch-compress', { paths, format: batchCompressFormat.value })
    ElMessage.success(`已压缩为 ${res.path.split('/').pop()}`)
    showBatchCompress.value = false
    await fetchFiles()
  } catch (e) {
    ElMessage.error(e.message)
  }
  opLoading.value = false
}

function reportBatch(results, action) {
  const failed = (results || []).filter(r => !r.success)
  if (failed.length === 0) {
    ElMessage.success(`批量${action}完成`)
  } else {
    ElMessage.warning(`批量${action}完成，${failed.length} 项失败：${failed.map(f => f.error).join('；')}`)
  }
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
  const filePath = joinPath(row.name)
  editorPath.value = filePath
  editorContent.value = ''
  editorError.value = ''
  editorLoading.value = true
  showEditor.value = true

  try {
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
  gap: 8px;
  align-items: center;
}
/* 清除 element 相邻按钮默认 margin，统一由 gap 控制，避免间距不均 */
.fb-actions :deep(.el-button) {
  margin: 0;
}
.fb-search {
  width: 160px;
}
.fb-batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  background: #f4f4f5;
  border-radius: 4px;
  flex-wrap: wrap;
}
.fb-batch-bar :deep(.el-button) {
  margin: 0;
}
.fb-batch-count {
  font-size: 13px;
  color: #606266;
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
.perm-btn {
  padding: 0;
  height: auto;
}
.perm-text {
  font-size: 12px;
  font-family: Consolas, Monaco, monospace;
}
.fb-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
/* Mobile responsive table wrapper */
.fb-table-wrapper {
  overflow-x: auto;
}

.actions-wrap {
  display: flex;
  gap: 6px;
  white-space: nowrap;
  justify-content: flex-start;
}
/* 清除 element 相邻按钮默认 margin，避免与 flex gap 叠加导致间距不均 */
.actions-wrap :deep(.el-button) {
  margin: 0;
}
.actions-wrap :deep(.el-button--small) {
  padding-left: 7px;
  padding-right: 7px;
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
  gap: 8px;
  flex-shrink: 0;
}
.fb-breadcrumb-actions :deep(.el-button) {
  margin: 0;
}

@media (max-width: 768px) {
  .fb-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .fb-actions {
    justify-content: stretch;
    flex-wrap: wrap;
  }
  .fb-search {
    width: 100%;
    order: -1;
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
    width: 40px;
  }
  :deep(.el-table .el-table__cell:nth-child(2)) {
    min-width: 90px !important;
    max-width: 130px;
  }
  :deep(colgroup col:nth-child(2)) {
    min-width: 90px !important;
    width: auto !important;
  }
  :deep(.el-table .el-table__cell:nth-child(3)) {
    width: 56px;
  }
  :deep(.el-table .el-table__cell:nth-child(4)) {
    width: 96px;
  }
  :deep(.el-table .el-table__cell:nth-child(5)) {
    width: 48px;
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
