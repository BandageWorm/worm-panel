<template>
  <div class="notes-manager">
    <div class="notes-sidebar">
      <div class="sidebar-header">
        <el-button size="small" type="primary" style="width:100%" @click="handleNew">新建笔记</el-button>
      </div>
      <div class="notes-list" v-loading="loading">
        <div
          v-for="note in notes"
          :key="note.name"
          class="note-item"
          :class="{ active: currentNote === note.name }"
          @click="openNote(note)"
        >
          <div class="note-name">{{ note.name.replace(/\.md$/, '') }}</div>
          <div class="note-time">{{ formatTime(note.updatedAt) }}</div>
        </div>
        <el-empty v-if="notes.length === 0" description="暂无笔记" :image-size="60" />
      </div>
    </div>

    <div class="notes-editor" v-if="currentNote">
      <div class="editor-toolbar">
        <span class="editor-title">{{ currentNote.replace(/\.md$/, '') }}</span>
        <div class="toolbar-actions">
          <el-button size="small" @click="previewMode = !previewMode">
            {{ previewMode ? '编辑' : '预览' }}
          </el-button>
          <el-button size="small" type="primary" :loading="saving" @click="handleSave">保存</el-button>
          <el-button size="small" type="danger" @click="handleDelete">删除</el-button>
        </div>
      </div>
      <div class="editor-body" v-if="!previewMode">
        <el-input
          v-model="editorContent"
          type="textarea"
          :rows="30"
          class="note-textarea"
          placeholder="支持 Markdown 语法..."
        />
      </div>
      <div class="preview-body markdown-preview" v-else v-html="renderedContent"></div>
    </div>

    <div class="notes-empty" v-else>
      <el-icon class="empty-icon"><Edit /></el-icon>
      <p>选择或新建一篇笔记</p>
    </div>

    <!-- New Note Dialog -->
    <el-dialog v-model="showNewDialog" title="新建笔记" width="400px">
      <el-form @submit.prevent="confirmNew">
        <el-form-item label="笔记名称">
          <el-input v-model="newNoteName" placeholder="输入笔记名称" @keyup.enter="confirmNew" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showNewDialog = false">取消</el-button>
        <el-button type="primary" @click="confirmNew">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MarkdownIt from 'markdown-it'
import { get, post, put, del } from '../api'

const md = new MarkdownIt({ html: true, linkify: true })

const loading = ref(false)
const notes = ref([])
const currentNote = ref('')
const editorContent = ref('')
const saving = ref(false)
const previewMode = ref(false)
const showNewDialog = ref(false)
const newNoteName = ref('')

const renderedContent = computed(() => md.render(editorContent.value || ''))

onMounted(() => fetchNotes())

async function fetchNotes() {
  loading.value = true
  try {
    notes.value = await get('/notes')
  } catch {}
  loading.value = false
}

async function openNote(note) {
  currentNote.value = note.name
  previewMode.value = false
  try {
    const res = await get(`/notes/${note.name}`)
    editorContent.value = res.content
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function handleNew() {
  newNoteName.value = ''
  showNewDialog.value = true
}

async function confirmNew() {
  if (!newNoteName.value) return
  const name = newNoteName.value.endsWith('.md') ? newNoteName.value : newNoteName.value + '.md'
  try {
    await post('/notes', { name, content: `# ${newNoteName.value}\n\n` })
    showNewDialog.value = false
    ElMessage.success('笔记已创建')
    await fetchNotes()
    openNote({ name })
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleSave() {
  saving.value = true
  try {
    await put(`/notes/${currentNote.value}`, { content: editorContent.value })
    ElMessage.success('已保存')
    await fetchNotes()
  } catch (e) {
    ElMessage.error(e.message)
  }
  saving.value = false
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(`确定要删除 ${currentNote.value}？`, '确认删除', { type: 'warning' })
    await del(`/notes/${currentNote.value}`)
    ElMessage.success('已删除')
    currentNote.value = ''
    editorContent.value = ''
    await fetchNotes()
  } catch {}
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
</script>

<style scoped>
.notes-manager {
  display: flex;
  height: calc(100vh - 110px);
  gap: 16px;
}
.notes-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.sidebar-header {
  padding: 12px;
  border-bottom: 1px solid #e4e7ed;
}
.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.note-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: background 0.15s;
}
.note-item:hover {
  background: #f5f7fa;
}
.note-item.active {
  background: #ecf5ff;
  border-left: 3px solid #409eff;
}
.note-name {
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.note-time {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 2px;
}
.notes-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid #e4e7ed;
  background: #fafafa;
}
.editor-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.toolbar-actions {
  display: flex;
  gap: 8px;
}
.editor-body {
  flex: 1;
  overflow: hidden;
}
.note-textarea {
  height: 100%;
}
.note-textarea :deep(.el-textarea__inner) {
  height: 100% !important;
  border: none;
  border-radius: 0;
  font-family: Consolas, 'Source Code Pro', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
}
.preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
.notes-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}
.empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
}
</style>

<style>
.markdown-preview {
  line-height: 1.7;
  color: #303133;
}
.markdown-preview h1, .markdown-preview h2, .markdown-preview h3 {
  margin-top: 24px;
  margin-bottom: 12px;
}
.markdown-preview p {
  margin-bottom: 12px;
}
.markdown-preview code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}
.markdown-preview pre code {
  display: block;
  padding: 12px;
  overflow-x: auto;
}
.markdown-preview ul, .markdown-preview ol {
  padding-left: 24px;
  margin-bottom: 12px;
}
.markdown-preview blockquote {
  border-left: 4px solid #409eff;
  padding-left: 12px;
  color: #606266;
  margin-bottom: 12px;
}
.markdown-preview table {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 12px;
}
.markdown-preview th, .markdown-preview td {
  border: 1px solid #dcdfe6;
  padding: 8px 12px;
  text-align: left;
}
.markdown-preview th {
  background: #f5f7fa;
}
</style>
