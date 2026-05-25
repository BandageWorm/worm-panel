<template>
  <div class="ssl-manager">
    <!-- acme.sh Status -->
    <el-card class="status-card" shadow="never">
      <div class="status-row">
        <span>acme.sh 状态：</span>
        <el-tag v-if="acmeInstalled" type="success">已安装</el-tag>
        <el-tag v-else type="danger">未安装</el-tag>
        <el-button v-if="!acmeInstalled" size="small" type="primary" style="margin-left:12px" @click="handleInstall" :loading="installing">
          安装 acme.sh
        </el-button>
      </div>
    </el-card>

    <!-- Certs List -->
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>已签发证书</span>
          <el-button size="small" type="primary" @click="showIssueDialog = true" :disabled="!acmeInstalled">
            申请新证书
          </el-button>
        </div>
      </template>

      <el-table :data="certs" stripe v-loading="loading" size="small">
        <el-table-column prop="domain" label="域名" min-width="200" />
        <el-table-column prop="issuedDate" label="签发日期" width="180" />
        <el-table-column label="到期时间" width="180">
          <template #default="{ row }">{{ row.expireDate || '--' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="isExpiringSoon(row.expireDate)" size="small" type="warning">即将到期</el-tag>
            <el-tag v-else size="small" type="success">有效</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button text size="small" @click="handleRenew(row)">续期</el-button>
            <el-button text size="small" type="primary" @click="showApplyDialog(row)">配置 Nginx</el-button>
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

    <!-- Apply to Nginx Dialog -->
    <el-dialog v-model="showApplyDialogBox" title="配置 Nginx SSL" width="500px">
      <el-form :model="applyForm" label-position="top">
        <el-form-item label="域名">
          <el-input v-model="applyForm.domain" disabled />
        </el-form-item>
        <el-form-item label="反代目标端口">
          <el-input-number v-model="applyForm.targetPort" :min="1" :max="65535" style="width:100%" />
          <div class="form-tip">该域名反代到的后端端口</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showApplyDialogBox = false">取消</el-button>
        <el-button type="primary" :loading="applying" @click="handleApply">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post } from '../api'

const acmeInstalled = ref(false)
const installing = ref(false)
const loading = ref(false)
const certs = ref([])

// Issue
const showIssueDialog = ref(false)
const issuing = ref(false)
const issueForm = ref({ domain: '' })

// Apply to nginx
const showApplyDialogBox = ref(false)
const applying = ref(false)
const applyForm = ref({ domain: '', targetPort: 3000 })

onMounted(() => {
  fetchStatus()
  fetchCerts()
})

async function fetchStatus() {
  try {
    const res = await get('/ssl/status')
    acmeInstalled.value = res.installed
  } catch {}
}

async function fetchCerts() {
  loading.value = true
  try {
    certs.value = await get('/ssl/certs')
  } catch {}
  loading.value = false
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

function showApplyDialog(row) {
  applyForm.value = { domain: row.domain, targetPort: 3000 }
  showApplyDialogBox.value = true
}

async function handleApply() {
  applying.value = true
  try {
    const res = await post('/ssl/apply-to-nginx', applyForm.value)
    ElMessage.success(res.message)
    showApplyDialogBox.value = false
  } catch (e) {
    ElMessage.error(e.message)
  }
  applying.value = false
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
</style>
