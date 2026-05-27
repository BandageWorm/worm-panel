<template>
  <div class="ssl-manager" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
    <!-- acme.sh Status -->
    <el-card class="status-card" shadow="never">
      <div class="status-row">
        <span>acme.sh 状态：</span>
        <el-tag v-if="acmeInstalled" type="success">已安装</el-tag>
        <el-tag v-else type="danger">未安装</el-tag>
        <el-button v-if="!acmeInstalled" size="small" type="primary" @click="handleInstall" :loading="installing">
          安装 acme.sh
        </el-button>
      </div>
    </el-card>

    <!-- Certs List -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>已签发证书</span>
          <div>
            <el-button size="small" @click="handleRenewAll" :loading="renewingAll" :disabled="!acmeInstalled || certs.length === 0" style="margin-right:8px">
              全部续期
            </el-button>
            <el-button size="small" type="primary" @click="showIssueDialog = true" :disabled="!acmeInstalled">
              申请新证书
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="certs" stripe v-loading="loading" size="small">
        <el-table-column prop="domain" label="域名" min-width="200" />
        <el-table-column label="签发日期" width="120">
          <template #default="{ row }">{{ row.issuedDate || '--' }}</template>
        </el-table-column>
        <el-table-column label="到期时间" width="180">
          <template #default="{ row }">{{ row.expireDate || '--' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="isExpiringSoon(row.expireDate)" size="small" type="warning">即将到期</el-tag>
            <el-tag v-else size="small" type="success">有效</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" :fixed="isMobile ? false : 'right'">
          <template #default="{ row }">
            <div class="actions-wrap">
            <el-button size="small" plain type="primary" @click="handleRenew(row)">续期</el-button>
            <el-button size="small" plain type="danger" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && certs.length === 0" description="暂无证书" />
    </el-card>

    <!-- Issue Dialog -->
    <el-dialog v-model="showIssueDialog" title="申请 SSL 证书" width="500px">
      <el-form :model="issueForm" label-position="top">
        <el-form-item label="域名">
          <el-input v-model="issueForm.domain" placeholder="例如: example.com" />
          <div class="form-tip">请确保域名已解析到本服务器且 80 端口可访问</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showIssueDialog = false">取消</el-button>
        <el-button type="primary" :loading="issuing" @click="handleIssue">申请</el-button>
      </template>
    </el-dialog>

  </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post, del } from '../api'
import { useMobile } from '../composables/useMobile'

const { isMobile } = useMobile()

const acmeInstalled = ref(false)
const installing = ref(false)
const loading = ref(true)
const renewingAll = ref(false)
const certs = ref([])

// Issue
const showIssueDialog = ref(false)
const issuing = ref(false)
const issueForm = ref({ domain: '' })

onMounted(async () => {
  await Promise.all([fetchStatus(), fetchCerts()])
  loading.value = false
})

async function fetchStatus() {
  try {
    const res = await get('/ssl/status')
    acmeInstalled.value = res.installed
  } catch {}
}

async function fetchCerts() {
  try {
    certs.value = await get('/ssl/certs')
  } catch {}
}

async function handleInstall() {
  installing.value = true
  try {
    const res = await post('/ssl/install')
    ElMessage.success(res.message)
    acmeInstalled.value = true
  } catch (e) {
    ElMessage.error(e.message)
  }
  installing.value = false
}

async function handleIssue() {
  if (!issueForm.value.domain) return
  issuing.value = true
  try {
    const res = await post('/ssl/issue', { domain: issueForm.value.domain })
    ElMessage.success('证书申请成功')
    showIssueDialog.value = false
    issueForm.value = { domain: '' }
    fetchCerts()
  } catch (e) {
    ElMessage.error(e.message)
  }
  issuing.value = false
}

async function handleRenewAll() {
  try {
    await ElMessageBox.confirm('确定要续期所有证书？', '确认续期')
    renewingAll.value = true
    const res = await post('/ssl/renew-all')
    ElMessage.success('全部续期成功')
    fetchCerts()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '续期失败')
  }
  renewingAll.value = false
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.domain} 的证书？`, '确认删除', { type: 'warning' })
    await del(`/ssl/cert/${row.domain}`)
    ElMessage.success('证书已删除')
    fetchCerts()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败')
  }
}

async function handleRenew(row) {
  try {
    await ElMessageBox.confirm(`确定要续期 ${row.domain} 的证书？`, '确认续期')
    const res = await post(`/ssl/renew/${row.domain}`)
    ElMessage.success('续期成功')
    fetchCerts()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '续期失败')
  }
}

function isExpiringSoon(dateStr) {
  if (!dateStr) return false
  const expire = new Date(dateStr)
  const now = new Date()
  const daysLeft = (expire - now) / (1000 * 60 * 60 * 24)
  return daysLeft < 30
}
</script>

<style scoped>
.ssl-manager {
  max-width: 1200px;
}
.status-card {
  margin-bottom: 16px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
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

@media (max-width: 768px) {
  .card-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  .status-row {
    flex-wrap: wrap;
  }
  :deep(.el-dialog) {
    width: 92% !important;
  }
  :deep(.el-table .el-table__cell:nth-child(1)) {
    min-width: 0;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :deep(.el-table .el-table__cell:nth-child(2)),
  :deep(.el-table .el-table__cell:nth-child(3)) {
    width: 100px;
  }
  :deep(.el-table .el-table__cell:nth-child(4)) {
    width: 70px;
  }
  :deep(.el-table .el-table__cell:nth-child(5)) {
    width: 90px;
  }
  :deep(.el-table) {
    font-size: 12px;
  }
}
</style>
