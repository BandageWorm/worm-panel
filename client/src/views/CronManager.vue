<template>
  <div class="cron-manager" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
      <!-- Jobs Table -->
      <el-card shadow="never">
        <template #header>
          <div class="card-header">
            <span>计划任务</span>
            <el-button size="small" type="primary" @click="openAdd">添加任务</el-button>
          </div>
        </template>

        <el-table :data="jobs" stripe size="small">
          <el-table-column label="状态" width="70">
            <template #default="{ row }">
              <el-switch
                v-if="row.managed"
                :model-value="row.enabled"
                size="small"
                @change="(val) => handleToggle(row, val)"
              />
              <el-tag v-else size="small" type="info">系统</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="120">
            <template #default="{ row }">
              {{ row.name || '--' }}
            </template>
          </el-table-column>
          <el-table-column label="周期" min-width="140">
            <template #default="{ row }">
              <span class="cron-schedule">{{ row.schedule }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="command" label="命令" min-width="200" show-overflow-tooltip />
          <el-table-column label="操作" width="180" :fixed="isMobile ? false : 'right'">
            <template #default="{ row }">
              <template v-if="row.managed">
                <el-button size="small" plain type="success" @click="handleRun(row)" :loading="running === row.id">
                  <el-icon><VideoPlay /></el-icon>
                </el-button>
                <el-button size="small" plain @click="openEdit(row)">
                  <el-icon><Edit /></el-icon>
                </el-button>
                <el-button size="small" plain type="info" @click="openHistory(row)">
                  <el-icon><Document /></el-icon>
                </el-button>
                <el-button size="small" plain type="danger" @click="handleDelete(row)">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </template>
              <span v-else style="color:#999;font-size:12px">只读</span>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="jobs.length === 0" description="暂无计划任务" />
      </el-card>

      <!-- Add/Edit Dialog -->
      <el-dialog v-model="showDialog" :title="editingJob ? '编辑任务' : '添加任务'" width="560px">
        <el-form :model="form" label-width="80px">
          <el-form-item label="任务名称">
            <el-input v-model="form.name" placeholder="如：清理日志" />
          </el-form-item>
          <el-form-item label="执行周期">
            <el-radio-group v-model="scheduleMode" style="margin-bottom:8px">
              <el-radio value="quick">快捷选择</el-radio>
              <el-radio value="advanced">Cron 表达式</el-radio>
            </el-radio-group>
            <div v-if="scheduleMode === 'quick'" class="quick-schedule">
              <el-select v-model="quickType" style="width:130px" @change="updateSchedule">
                <el-option label="每N分钟" value="minutes" />
                <el-option label="每小时" value="hourly" />
                <el-option label="每天" value="daily" />
                <el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
              </el-select>
              <template v-if="quickType === 'minutes'">
                <span style="margin:0 8px">每</span>
                <el-input-number v-model="quickMinutes" :min="1" :max="59" size="small" style="width:100px" @change="updateSchedule" />
                <span style="margin-left:8px">分钟</span>
              </template>
              <template v-if="quickType === 'daily' || quickType === 'weekly' || quickType === 'monthly'">
                <span style="margin:0 8px">时间</span>
                <el-input-number v-model="quickHour" :min="0" :max="23" size="small" style="width:70px" @change="updateSchedule" />
                <span style="margin:0 4px">:</span>
                <el-input-number v-model="quickMinute" :min="0" :max="59" size="small" style="width:70px" @change="updateSchedule" />
              </template>
              <template v-if="quickType === 'weekly'">
                <span style="margin:0 8px">星期</span>
                <el-select v-model="quickWeekday" style="width:90px" @change="updateSchedule">
                  <el-option v-for="d in weekdays" :key="d.value" :label="d.label" :value="d.value" />
                </el-select>
              </template>
              <template v-if="quickType === 'monthly'">
                <span style="margin:0 8px">日期</span>
                <el-input-number v-model="quickDay" :min="1" :max="28" size="small" style="width:80px" @change="updateSchedule" />
                <span style="margin-left:4px">号</span>
              </template>
            </div>
            <div v-else>
              <el-input v-model="form.schedule" placeholder="* * * * *  (分 时 日 月 周)" />
            </div>
            <div class="schedule-preview" v-if="form.schedule">
              <el-icon><Clock /></el-icon>
              <span>{{ form.schedule }}</span>
            </div>
          </el-form-item>
          <el-form-item label="执行命令">
            <el-input v-model="form.command" type="textarea" :rows="3" placeholder="如：find /tmp -mtime +7 -delete" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showDialog = false">取消</el-button>
          <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
        </template>
      </el-dialog>

      <!-- History Dialog -->
      <el-dialog v-model="showHistory" :title="`执行历史 - ${historyJob?.name || ''}`" width="650px">
        <el-table :data="history" stripe size="small" v-loading="historyLoading" max-height="400">
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ formatTime(row.time) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.timeout" size="small" type="warning">超时</el-tag>
              <el-tag v-else-if="row.exitCode === 0" size="small" type="success">成功</el-tag>
              <el-tag v-else size="small" type="danger">失败({{ row.exitCode }})</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="90">
            <template #default="{ row }">{{ formatDuration(row.duration) }}</template>
          </el-table-column>
          <el-table-column label="输出" min-width="100">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="expandedRow = expandedRow === row ? null : row">
                {{ expandedRow === row ? '收起' : '查看' }}
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="expandedRow" class="output-box">
          <div v-if="expandedRow.stdout" class="output-section">
            <div class="output-label">stdout:</div>
            <pre>{{ expandedRow.stdout }}</pre>
          </div>
          <div v-if="expandedRow.stderr" class="output-section">
            <div class="output-label">stderr:</div>
            <pre class="stderr">{{ expandedRow.stderr }}</pre>
          </div>
          <div v-if="!expandedRow.stdout && !expandedRow.stderr" style="color:#999;padding:8px">无输出</div>
        </div>
        <el-empty v-if="!historyLoading && history.length === 0" description="暂无执行记录" />
      </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { get, post, put, del } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useMobile } from '../composables/useMobile'

const { isMobile } = useMobile()
const loading = ref(true)
const jobs = ref([])
const running = ref(null)
const saving = ref(false)

// Dialog state
const showDialog = ref(false)
const editingJob = ref(null)
const form = ref({ name: '', schedule: '', command: '' })

// Schedule helpers
const scheduleMode = ref('quick')
const quickType = ref('daily')
const quickMinutes = ref(5)
const quickHour = ref(3)
const quickMinute = ref(0)
const quickWeekday = ref(1)
const quickDay = ref(1)
const weekdays = [
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
  { label: '周日', value: 0 }
]

// History state
const showHistory = ref(false)
const historyJob = ref(null)
const history = ref([])
const historyLoading = ref(false)
const expandedRow = ref(null)

onMounted(async () => {
  await loadJobs()
})

async function loadJobs() {
  loading.value = true
  try {
    jobs.value = await get('/cron/jobs')
  } catch (e) {
    ElMessage.error('加载任务列表失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

function updateSchedule() {
  switch (quickType.value) {
    case 'minutes':
      form.value.schedule = `*/${quickMinutes.value} * * * *`
      break
    case 'hourly':
      form.value.schedule = `0 * * * *`
      break
    case 'daily':
      form.value.schedule = `${quickMinute.value} ${quickHour.value} * * *`
      break
    case 'weekly':
      form.value.schedule = `${quickMinute.value} ${quickHour.value} * * ${quickWeekday.value}`
      break
    case 'monthly':
      form.value.schedule = `${quickMinute.value} ${quickHour.value} ${quickDay.value} * *`
      break
  }
}

function openAdd() {
  editingJob.value = null
  form.value = { name: '', schedule: '', command: '' }
  scheduleMode.value = 'quick'
  quickType.value = 'daily'
  quickHour.value = 3
  quickMinute.value = 0
  updateSchedule()
  showDialog.value = true
}

function openEdit(job) {
  editingJob.value = job
  form.value = { name: job.name, schedule: job.schedule, command: job.command }
  scheduleMode.value = 'advanced'
  showDialog.value = true
}

async function handleSave() {
  if (!form.value.name) { ElMessage.warning('请输入任务名称'); return }
  if (!form.value.schedule) { ElMessage.warning('请设置执行周期'); return }
  if (!form.value.command) { ElMessage.warning('请输入执行命令'); return }

  saving.value = true
  try {
    if (editingJob.value) {
      await put(`/cron/jobs/${editingJob.value.id}`, form.value)
      ElMessage.success('任务已更新')
    } else {
      await post('/cron/jobs', form.value)
      ElMessage.success('任务已创建')
    }
    showDialog.value = false
    await loadJobs()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function handleToggle(job, enabled) {
  try {
    await put(`/cron/jobs/${job.id}`, { enabled })
    ElMessage.success(enabled ? '任务已启用' : '任务已禁用')
    await loadJobs()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function handleRun(job) {
  running.value = job.id
  try {
    const result = await post(`/cron/jobs/${job.id}/run`)
    if (result.exitCode === 0) {
      ElMessage.success(`执行成功 (${formatDuration(result.duration)})`)
    } else if (result.timeout) {
      ElMessage.warning('执行超时 (60s)')
    } else {
      ElMessage.error(`执行失败 (exitCode: ${result.exitCode})`)
    }
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    running.value = null
  }
}

async function handleDelete(job) {
  try {
    await ElMessageBox.confirm(`确定删除任务「${job.name}」？历史记录也会一并删除。`, '确认删除', { type: 'warning' })
  } catch { return }

  try {
    await del(`/cron/jobs/${job.id}`)
    ElMessage.success('任务已删除')
    await loadJobs()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function openHistory(job) {
  historyJob.value = job
  history.value = []
  expandedRow.value = null
  showHistory.value = true
  historyLoading.value = true
  try {
    history.value = await get(`/cron/jobs/${job.id}/history`)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    historyLoading.value = false
  }
}

function formatTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { hour12: false })
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '--'
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
}
</script>

<style scoped>
.cron-manager {
  max-width: 1000px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cron-schedule {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 12px;
  color: #606266;
}
.quick-schedule {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.schedule-preview {
  margin-top: 8px;
  padding: 6px 12px;
  background: #f5f7fa;
  border-radius: 4px;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  font-size: 13px;
  color: #409eff;
  display: flex;
  align-items: center;
  gap: 6px;
}
.output-box {
  margin-top: 12px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  max-height: 300px;
  overflow: auto;
}
.output-section {
  padding: 8px 12px;
}
.output-section + .output-section {
  border-top: 1px solid #ebeef5;
}
.output-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}
.output-box pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  line-height: 1.5;
}
.output-box pre.stderr {
  color: #f56c6c;
}
</style>
