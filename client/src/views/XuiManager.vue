<template>
  <div class="xui-manager">
    <!-- Status Cards -->
    <el-row :gutter="16">
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="never">
          <div class="stat-item">
            <div class="stat-label">安装状态</div>
            <div class="stat-value">
              <el-tag :type="status.installed ? 'success' : 'danger'" size="large">
                {{ status.installed ? '已安装' : '未安装' }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="never">
          <div class="stat-item">
            <div class="stat-label">运行状态</div>
            <div class="stat-value">
              <el-tag :type="status.running ? 'success' : 'danger'" size="large">
                {{ status.running ? '运行中' : '已停止' }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="never">
          <div class="stat-item">
            <div class="stat-label">管理端口</div>
            <div class="stat-value">{{ status.port || '--' }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <el-card shadow="never">
          <div class="stat-item">
            <div class="stat-label">安装路径</div>
            <div class="stat-value" style="font-size:14px">{{ status.installPath || '--' }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Direct Access -->
    <el-card shadow="never" class="section-card" v-if="status.directUrl">
      <template #header>
        <div class="card-header">
          <el-icon><Link /></el-icon>
          <span>直接访问</span>
        </div>
      </template>
      <div class="direct-access">
        <el-alert
          title="3X-UI 面板已就绪，点击下方按钮直接访问"
          type="success"
          :closable="false"
          show-icon
          class="access-alert"
        />
        <el-button type="primary" size="large" @click="openDirectUrl">
          <el-icon><Open /></el-icon>
          打开 3X-UI 面板
        </el-button>
        <div class="access-info">
          <span class="info-label">地址:</span>
          <code class="info-value">{{ status.directUrl }}</code>
          <el-tag size="small" type="info" class="info-tag">端口 {{ status.port }}</el-tag>
          <el-tag size="small" type="info" v-if="status.webPath">路径 {{ status.webPath }}</el-tag>
        </div>
      </div>
    </el-card>

    <el-card shadow="never" class="section-card" v-else-if="status.running">
      <template #header>
        <div class="card-header">
          <el-icon><Warning /></el-icon>
          <span>直接访问</span>
        </div>
      </template>
      <el-alert title="无法获取服务器 IP，请检查网络配置" type="warning" :closable="false" show-icon />
    </el-card>

    <!-- Nginx Proxy (optional) -->
    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <el-icon><Connection /></el-icon>
          <span>Nginx 反代（可选）</span>
        </div>
      </template>

      <div v-if="status.proxyUrl">
        <el-alert title="已配置反代入口" type="success" :closable="false" show-icon style="margin-bottom:12px" />
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="入口地址">
            <a :href="status.proxyUrl" target="_blank" class="proxy-link">{{ status.proxyUrl }}</a>
          </el-descriptions-item>
          <el-descriptions-item label="反代域名">{{ status.proxyDomain }}</el-descriptions-item>
        </el-descriptions>
        <el-button type="danger" size="small" style="margin-top:12px" @click="handleRemoveProxy" :loading="removing">
          移除反代
        </el-button>
      </div>

      <div v-else>
        <p class="proxy-empty">通过域名反代访问 3X-UI（可选，不配置也可通过上方直接访问）</p>
        <div class="proxy-form">
          <el-input v-model="proxyDomain" placeholder="输入子域名，如 xui.example.com" style="width:300px" size="small" />
          <el-button type="primary" size="small" @click="handleSetProxy" :loading="setting" :disabled="!status.installed">
            配置反代
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, post, del } from '../api'

const status = reactive({
  installed: false, running: false, version: null, port: null,
  memory: null, cpu: null, uptime: null, installPath: null,
  webPath: null, directUrl: null, serverIP: null,
  proxyUrl: null, proxyDomain: null
})
const proxyDomain = ref('')
const setting = ref(false)
const removing = ref(false)

onMounted(fetchStatus)

async function fetchStatus() {
  try {
    const res = await get('/xui/status')
    Object.assign(status, res)
  } catch {}
}

function openDirectUrl() {
  if (status.directUrl) {
    window.open(status.directUrl, '_blank')
  }
}

async function handleSetProxy() {
  if (!proxyDomain.value) return
  setting.value = true
  try {
    const res = await post('/xui/proxy', { domain: proxyDomain.value })
    ElMessage.success(`反代已配置: ${res.url}`)
    proxyDomain.value = ''
    fetchStatus()
  } catch (e) {
    ElMessage.error(e.message)
  }
  setting.value = false
}

async function handleRemoveProxy() {
  try {
    await ElMessageBox.confirm('确定移除 3X-UI 反代入口？', '确认')
    removing.value = true
    await del('/xui/proxy')
    ElMessage.success('已移除')
    fetchStatus()
  } catch {}
  removing.value = false
}
</script>

<style scoped>
.xui-manager {
  max-width: 1200px;
}
.stat-item {
  text-align: center;
  padding: 8px 0;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.section-card {
  margin-top: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.direct-access {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
}
.access-alert {
  width: 100%;
}
.access-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}
.info-label {
  color: #909399;
}
.info-value {
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}
.proxy-empty {
  color: #909399;
  margin-bottom: 12px;
  font-size: 13px;
}
.proxy-form {
  display: flex;
  gap: 8px;
  align-items: center;
}
.proxy-link {
  color: #409eff;
  text-decoration: none;
  font-weight: 500;
}
.proxy-link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .proxy-form {
    flex-wrap: wrap;
  }
  .proxy-form .el-input {
    width: 100% !important;
  }
  .access-info {
    flex-wrap: wrap;
  }
}
</style>
