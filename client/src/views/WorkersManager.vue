<template>
  <div class="workers-manager">
    <!-- Wrangler Status -->
    <el-card class="status-card" shadow="never">
      <div class="status-row">
        <span>Wrangler 状态：</span>
        <el-tag v-if="wranglerStatus.installed" type="success">已安装 {{ wranglerStatus.version }}</el-tag>
        <el-tag v-else type="danger">未安装</el-tag>
      </div>
    </el-card>

    <!-- Projects -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>Workers 项目</span>
          <el-button size="small" type="primary" @click="showAddDialog = true">添加项目</el-button>
        </div>
      </template>

      <el-table :data="projects" stripe v-loading="loading" size="small">
        <el-table-column prop="name" label="项目名" min-width="140" />
        <el-table-column prop="repo" label="仓库" min-width="220" />
        <el-table-column prop="branch" label="分支" width="80" />
        <el-table-column prop="lastDeploy" label="最近部署" width="170">
          <template #default="{ row }">{{ row.lastDeploy ? formatTime(row.lastDeploy) : '未部署' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button text size="small" type="primary" :loading="deploying === row.name" @click="handleDeploy(row)">
              部署
            </el-button>
            <el-button text size="small" @click="viewLog(row)">日志</el-button>
            <el-button text size="small" type="danger" @click="handleRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && projects.length === 0" description="暂无项目" />
    </el-card>

    <!-- Deploy Log Dialog -->
    <el-dialog v-model="showLog" title="部署日志" width="800px" top="5vh">
      <pre class="log-output">{{ deployLog }}</pre>
      <template #footer>
        <el-button @click="showLog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- Add Project Dialog -->
    <el-dialog v-model="showAddDialog" title="添加 Workers 项目" width="500px">
      <el-form :model="addForm" label-position="top">
        <el-form-item label="项目名称">
          <el-input v-model="addForm.name" placeholder="my-api" />
        </el-form-item>
        <el-form-item label="GitHub 仓库地址">
          <el-input v-model="addForm.repo" placeholder="https://github.com/user/my-api.git" />
        </el-form-item>
        <el-form-item label="分支（默认 main）">
          <el-input v-model="addForm.branch" placeholder="main" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="adding" @click="handleAdd">添加并克隆</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post, del } from '../api'

const wranglerStatus = ref({})
const projects = ref([])
const loading = ref(false)
const deploying = ref('')
const showAddDialog = ref(false)
const adding = ref(false)
const addForm = ref({ name: '', repo: '', branch: 'main' })
const showLog = ref(false)
const deployLog = ref('')

onMounted(() => {
  fetchStatus()
  fetchProjects()
})

async function fetchStatus() {
  try {
    wranglerStatus.value = await get('/workers/status')
  } catch {}
}

async function fetchProjects() {
  loading.value = true
  try {
    projects.value = await get('/workers/projects')
  } catch {}
  loading.value = false
}

async function handleAdd() {
  if (!addForm.value.name || !addForm.value.repo) return
  adding.value = true
  try {
    await post('/workers/projects', addForm.value)
    ElMessage.success('项目添加成功')
    showAddDialog.value = false
    addForm.value = { name: '', repo: '', branch: 'main' }
    fetchProjects()
  } catch (e) {
    ElMessage.error(e.message)
  }
  adding.value = false
}

async function handleDeploy(row) {
  deploying.value = row.name
  try {
    const res = await post(`/workers/deploy/${row.name}`)
    deployLog.value = res.output
    showLog.value = true
    ElMessage.success(res.success ? '部署完成' : '部署可能有错误，请查看日志')
    fetchProjects()
  } catch (e) {
    ElMessage.error(e.message)
  }
  deploying.value = ''
}

async function viewLog(row) {
  try {
    const res = await get(`/workers/deploy/${row.name}/log`)
    deployLog.value = res.log || '暂无日志'
    showLog.value = true
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleRemove(row) {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.name}？本地代码将被移除。`, '确认删除', { type: 'warning' })
    await del(`/workers/projects/${row.name}`)
    ElMessage.success('已删除')
    fetchProjects()
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
.workers-manager {
  max-width: 1200px;
}
.status-card {
  margin-bottom: 16px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.log-output {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1.5;
  max-height: 500px;
  overflow-y: auto;
  font-family: 'Courier New', Consolas, monospace;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  :deep(.el-dialog) {
    width: 92% !important;
  }
  :deep(.el-table) {
    font-size: 12px;
  }
}
</style>
