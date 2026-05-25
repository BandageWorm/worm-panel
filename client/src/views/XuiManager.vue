<template>
  <div class="xui-manager">
    <!-- Status Card -->
    <el-row :gutter="16">
      <el-col :span="6">
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
      <el-col :span="6">
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
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-item">
            <div class="stat-label">管理端口</div>
            <div class="stat-value">{{ status.port || '--' }}</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="never">
          <div class="stat-item">
            <div class="stat-label">版本</div>
            <div class="stat-value">{{ status.version || '--' }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- Detail Info -->
    <el-card class="detail-card" shadow="never">
      <template #header>
        <span>详细信息</span>
      </template>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="安装路径">{{ status.installPath || '--' }}</el-descriptions-item>
        <el-descriptions-item label="运行时长">{{ formatUptime(status.uptime) }}</el-descriptions-item>
        <el-descriptions-item label="CPU 占用">{{ status.cpu !== null ? status.cpu + '%' : '--' }}</el-descriptions-item>
        <el-descriptions-item label="内存占用">{{ status.memory !== null ? status.memory + '%' : '--' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Nginx Proxy -->
    <el-card shadow="never">
      <template #header>
        <span>Nginx 反代入口</span>
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
        <p class="proxy-empty">未配置反代入口</p>
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

function formatUptime(seconds) {
  if (!seconds) return '--'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
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
  font-size: 20px;
  font-weight: 600;
  color: #303133;
}
.detail-card {
  margin: 16px 0;
}
.proxy-empty {
  color: #909399;
  margin-bottom: 12px;
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
</style>
