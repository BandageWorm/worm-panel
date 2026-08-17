<template>
  <div class="firewall-manager" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
      <!-- Status Card -->
      <el-card class="status-card" shadow="never">
        <div class="status-row">
          <span>防火墙状态：</span>
          <template v-if="!status.available">
            <el-tag type="danger">ufw 未安装</el-tag>
          </template>
          <template v-else>
            <el-tag :type="status.enabled ? 'success' : 'info'">
              {{ status.enabled ? '已启用' : '已关闭' }}
            </el-tag>
            <span v-if="status.enabled" style="margin-left:12px;color:#888;font-size:13px">
              默认策略: {{ status.defaultPolicy || '--' }}
            </span>
            <el-button
              v-if="status.enabled"
              size="small"
              type="danger"
              plain
              @click="handleToggle(false)"
              :loading="toggling"
              style="margin-left:16px"
            >关闭防火墙</el-button>
            <el-button
              v-else
              size="small"
              type="success"
              @click="handleToggle(true)"
              :loading="toggling"
              style="margin-left:16px"
            >启用防火墙</el-button>
          </template>
        </div>
      </el-card>

      <!-- Rules Table -->
      <el-card shadow="never" v-if="status.available && status.enabled">
        <template #header>
          <div class="card-header">
            <span>防火墙规则</span>
            <el-button size="small" type="primary" @click="showAddDialog = true">添加规则</el-button>
          </div>
        </template>

        <el-table :data="rules" stripe size="small">
          <el-table-column prop="to" label="端口" min-width="100" />
          <el-table-column prop="protocol" label="协议" width="80" />
          <el-table-column label="动作" width="90">
            <template #default="{ row }">
              <el-tag :type="actionTagType(row.action)" size="small">
                {{ row.action.toUpperCase() }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源" min-width="120">
            <template #default="{ row }">{{ row.from === '*' ? 'Anywhere' : row.from }}</template>
          </el-table-column>
          <el-table-column label="IPv6" width="60">
            <template #default="{ row }">
              <span v-if="row.v6" style="color:#999">v6</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="90" :fixed="isMobile ? false : 'right'">
            <template #default="{ row }">
              <el-button
                v-if="row.locked"
                size="small"
                type="info"
                plain
                disabled
              >
                <el-icon><Lock /></el-icon>
              </el-button>
              <el-button
                v-else
                size="small"
                type="danger"
                plain
                @click="handleDelete(row)"
                :loading="deleting === row.id"
              >删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="rules.length === 0" description="暂无规则" />
      </el-card>

      <!-- Add Rule Dialog -->
      <el-dialog v-model="showAddDialog" title="添加防火墙规则" width="460px">
        <el-form :model="addForm" label-width="70px">
          <el-form-item label="端口">
            <el-input v-model="addForm.port" placeholder="如 80、443 或 8000:8100" />
          </el-form-item>
          <el-form-item label="协议">
            <el-radio-group v-model="addForm.protocol">
              <el-radio value="">全部</el-radio>
              <el-radio value="tcp">TCP</el-radio>
              <el-radio value="udp">UDP</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="IP版本">
            <el-radio-group v-model="addForm.ipVersion">
              <el-radio value="">默认</el-radio>
              <el-radio value="v4">IPv4</el-radio>
              <el-radio value="v6">IPv6</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="动作">
            <el-radio-group v-model="addForm.action">
              <el-radio value="allow">允许</el-radio>
              <el-radio value="deny">拒绝</el-radio>
              <el-radio value="limit">限速</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="来源">
            <el-input v-model="addForm.from" placeholder="留空表示 Anywhere" />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showAddDialog = false">取消</el-button>
          <el-button type="primary" @click="handleAdd" :loading="adding">添加</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { get, post, del } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Lock } from '@element-plus/icons-vue'
import { useMobile } from '../composables/useMobile'

const { isMobile } = useMobile()
const loading = ref(true)
const status = ref({ available: false, enabled: false, defaultPolicy: null })
const rules = ref([])
const toggling = ref(false)
const deleting = ref(null)
const adding = ref(false)
const showAddDialog = ref(false)

const addForm = ref({
  port: '',
  protocol: '',
  action: 'allow',
  from: '',
  ipVersion: ''
})

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  try {
    status.value = await get('/firewall/status')
    if (status.value.available && status.value.enabled) {
      rules.value = await get('/firewall/rules')
    }
  } catch (e) {
    ElMessage.error('加载防火墙信息失败: ' + e.message)
  } finally {
    loading.value = false
  }
}

function actionTagType(action) {
  if (action === 'allow') return 'success'
  if (action === 'deny' || action === 'reject') return 'danger'
  if (action === 'limit') return 'warning'
  return 'info'
}

async function handleToggle(enable) {
  const msg = enable ? '确定启用防火墙？' : '确定关闭防火墙？关闭后所有端口将不受防火墙保护。'
  try {
    await ElMessageBox.confirm(msg, '确认', { type: 'warning' })
  } catch { return }

  toggling.value = true
  try {
    await post(enable ? '/firewall/enable' : '/firewall/disable')
    ElMessage.success(enable ? '防火墙已启用' : '防火墙已关闭')
    await loadData()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    toggling.value = false
  }
}

async function handleAdd() {
  if (!addForm.value.port) {
    ElMessage.warning('请输入端口')
    return
  }

  adding.value = true
  try {
    const body = { ...addForm.value }
    if (!body.from) delete body.from
    if (!body.protocol) delete body.protocol
    if (!body.ipVersion) delete body.ipVersion

    await post('/firewall/rules', body)
    ElMessage.success('规则已添加')
    showAddDialog.value = false
    addForm.value = { port: '', protocol: '', action: 'allow', from: '', ipVersion: '' }
    await loadData()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    adding.value = false
  }
}

async function handleDelete(row) {
  // SSH 端口二次确认
  const isSSH = row.to === '22' || row.to === '22/tcp'
  const msg = isSSH
    ? '删除 SSH (22) 端口规则可能导致无法远程连接服务器，确定删除？'
    : `确定删除规则 #${row.id}？`

  try {
    await ElMessageBox.confirm(msg, '确认删除', {
      type: isSSH ? 'error' : 'warning',
      confirmButtonText: isSSH ? '仍然删除' : '确定'
    })
  } catch { return }

  deleting.value = row.id
  try {
    await del(`/firewall/rules/${row.id}`)
    ElMessage.success('规则已删除')
    await loadData()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    deleting.value = null
  }
}
</script>

<style scoped>
.firewall-manager {
  max-width: 900px;
}
.status-card {
  margin-bottom: 16px;
}
.status-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
