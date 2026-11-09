<template>
  <div class="log-viewer">
    <div class="toolbar">
      <el-select v-model="sourceId" size="small" style="width:150px" @change="onSourceChange">
        <el-option
          v-for="s in sources"
          :key="s.id"
          :label="s.label"
          :value="s.id"
          :disabled="!s.available"
        />
      </el-select>

      <el-select
        v-if="isFileSource"
        v-model="fileId"
        size="small"
        style="width:200px"
        placeholder="选择日志文件"
        @change="load"
      >
        <el-option v-for="f in currentFiles" :key="f.id" :label="f.label" :value="f.id" />
      </el-select>

      <el-select v-model="lineCount" size="small" style="width:110px" @change="load">
        <el-option :value="100" label="100 行" />
        <el-option :value="200" label="200 行" />
        <el-option :value="500" label="500 行" />
        <el-option :value="1000" label="1000 行" />
        <el-option :value="2000" label="2000 行" />
      </el-select>

      <el-input
        v-model="keyword"
        size="small"
        clearable
        placeholder="关键字过滤（按回车生效）"
        style="width:220px"
        @keyup.enter="load"
      />
      <el-button size="small" type="primary" @click="load">查询</el-button>

      <div class="toolbar-right">
        <el-switch v-model="autoRefresh" size="small" active-text="自动刷新" />
        <el-button size="small" :loading="loading" @click="load">刷新</el-button>
      </div>
    </div>

    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="log-alert" />

    <div class="log-meta">
      <span v-if="!error">
        显示 {{ lines.length }} 行
        <template v-if="keyword">（共匹配 {{ matched }} / {{ total }} 行）</template>
        · {{ readAt || '--' }}
      </span>
      <span v-if="autoRefresh && !scrolledUp" class="tail-hint">追尾中</span>
      <span v-else-if="scrolledUp" class="tail-hint">已暂停追尾（回到底部恢复）</span>
    </div>

    <div ref="viewRef" class="log-view" @scroll="onScroll">
      <div v-for="(line, index) in lines" :key="index" class="log-line" v-html="highlight(line)"></div>
      <div v-if="!lines.length && !error" class="empty-hint">暂无日志内容</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { get } from '../api'

const sources = ref([])
const sourceId = ref('panel')
const fileId = ref('')
const lineCount = ref(200)
const keyword = ref('')

const lines = ref([])
const matched = ref(0)
const total = ref(0)
const readAt = ref('')
const error = ref('')
const loading = ref(false)
const autoRefresh = ref(false)
const scrolledUp = ref(false)

const viewRef = ref(null)
let timer = null

const currentSource = computed(() => sources.value.find(s => s.id === sourceId.value) || null)
const currentFiles = computed(() => currentSource.value?.files || [])
const isFileSource = computed(() => currentSource.value?.type === 'file')

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlight(line) {
  const escaped = escapeHtml(line)
  const kw = keyword.value.trim()
  if (!kw) return escaped
  const escapedKw = escapeHtml(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    return escaped.replace(new RegExp(escapedKw, 'gi'), m => `<mark>${m}</mark>`)
  } catch {
    return escaped
  }
}

async function loadSources() {
  try {
    const res = await get('/logs/sources')
    sources.value = res.sources || []
    const firstAvailable = sources.value.find(s => s.available)
    if (firstAvailable && !sources.value.some(s => s.id === sourceId.value && s.available)) {
      sourceId.value = firstAvailable.id
    }
    syncFile()
  } catch (e) {
    error.value = '加载日志源失败：' + e.message
  }
}

function syncFile() {
  const files = currentFiles.value
  if (files.length === 0) {
    fileId.value = ''
    return
  }
  if (!files.some(f => f.id === fileId.value)) {
    fileId.value = files[0].id
  }
}

function onSourceChange() {
  keyword.value = ''
  fileId.value = ''
  scrolledUp.value = false
  syncFile()
  load()
}

async function load() {
  if (isFileSource.value && !fileId.value) {
    lines.value = []
    error.value = currentFiles.value.length ? '请选择日志文件' : '该日志源下没有可用文件'
    return
  }

  loading.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      source: sourceId.value,
      lines: String(lineCount.value)
    })
    if (isFileSource.value && fileId.value) params.set('file', fileId.value)
    if (keyword.value.trim()) params.set('keyword', keyword.value.trim())

    const res = await get(`/logs?${params.toString()}`)
    const stickToBottom = !scrolledUp.value
    lines.value = res.lines || []
    matched.value = res.matched || 0
    total.value = res.total || 0
    readAt.value = res.readAt ? new Date(res.readAt).toLocaleTimeString('zh-CN') : ''

    if (stickToBottom) {
      await nextTick()
      scrollToBottom()
    }
  } catch (e) {
    lines.value = []
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function scrollToBottom() {
  const el = viewRef.value
  if (el) el.scrollTop = el.scrollHeight
}

function onScroll() {
  const el = viewRef.value
  if (!el) return
  const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  scrolledUp.value = !nearBottom
}

function startTimer() {
  stopTimer()
  if (autoRefresh.value) {
    timer = setInterval(load, 3000)
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

watch(autoRefresh, startTimer)

onMounted(async () => {
  await loadSources()
  await load()
})

onUnmounted(stopTimer)
</script>

<style scoped>
.log-viewer {
  width: 100%;
}
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
  align-items: center;
}
.toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.log-alert {
  margin-bottom: 12px;
}
.log-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.tail-hint {
  color: #409eff;
}
.log-view {
  height: calc(100vh - 300px);
  min-height: 320px;
  overflow: auto;
  background: #1e1e1e;
  border-radius: 6px;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}
.log-line {
  color: #d4d4d4;
  white-space: pre-wrap;
  word-break: break-all;
}
.log-line :deep(mark) {
  background: #7a5c00;
  color: #ffe08a;
  border-radius: 2px;
  padding: 0 1px;
}
.empty-hint {
  padding: 16px 0;
  font-size: 13px;
  color: #909399;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar :deep(.el-select),
  .toolbar :deep(.el-input) {
    width: 100% !important;
  }
  .toolbar-right {
    margin-left: 0;
    justify-content: flex-end;
  }
  .log-view {
    height: calc(100vh - 420px);
  }
}
</style>
