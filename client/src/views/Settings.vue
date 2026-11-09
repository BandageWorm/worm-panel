<template>
  <div class="settings-page">
    <LoadingBlock v-if="loading" />
    <template v-else>
    <!-- Basic Settings -->
    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>基本设置</span>
        </div>
      </template>
      <el-form :model="form" label-position="top" class="settings-form">
        <el-form-item>
          <template #label>
            <span class="label-with-tip">面板端口 <span class="form-tip-inline">（修改后需重启面板生效）</span></span>
          </template>
          <el-input
            v-model.number="form.port"
            type="number"
            :min="1024"
            :max="65535"
            style="width:200px"
          />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">面板模式 <span class="form-tip-inline">（切换模式后需重启面板生效）</span></span>
          </template>
          <el-radio-group v-model="form.mode">
            <el-radio value="standalone">
              端口模式
              <el-tooltip content="面板直接监听端口，自签 HTTPS" placement="right">
                <el-icon class="mode-tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </el-radio>
            <el-radio value="proxy">
              反代模式
              <el-tooltip content="面板监听 127.0.0.1，由 Nginx 反代提供 HTTPS" placement="right">
                <el-icon class="mode-tip-icon"><QuestionFilled /></el-icon>
              </el-tooltip>
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="绑定域名" v-if="form.mode === 'proxy'">
          <el-input
            v-model="form.domain"
            placeholder="panel.example.com"
            style="width:360px"
            :disabled="form.mode !== 'proxy'"
          />
          <div class="form-tip">Proxy 模式下设置域名后会自动生成 Nginx 面板配置</div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Feature Settings -->
    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Odometer /></el-icon>
          <span>功能设置</span>
        </div>
      </template>
      <el-form :model="form.settings" label-position="top" class="settings-form">
        <el-form-item>
          <template #label>
            <span class="label-with-tip">仪表盘刷新间隔 <span class="form-tip-inline">（秒）</span></span>
          </template>
          <el-input-number v-model="form.settings.dashboardRefresh" :min="2" :max="300" :step="1" controls-position="right" style="width:200px" />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">云备份自动同步周期 <span class="form-tip-inline">（小时，0 = 关闭；未连接 WebDAV 时不生效）</span></span>
          </template>
          <el-input-number v-model="form.settings.syncInterval" :min="0" :max="168" :step="1" controls-position="right" style="width:200px" />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">在线编辑文件上限 <span class="form-tip-inline">（MB，超过则不允许在浏览器内编辑）</span></span>
          </template>
          <el-input-number v-model="form.settings.editMaxSize" :min="1" :max="50" :step="1" controls-position="right" style="width:200px" />
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">上传 / 直链大小上限 <span class="form-tip-inline">（MB）</span></span>
          </template>
          <el-input-number v-model="form.settings.uploadMaxSize" :min="1" :max="20480" :step="50" controls-position="right" style="width:200px" />
          <div class="form-tip">修改后会同步更新面板反代的 nginx client_max_body_size，无需重启</div>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">指标保留天数 <span class="form-tip-inline">（天，1 小时明细固定保留）</span></span>
          </template>
          <el-input-number v-model="form.settings.metricsRetentionDays" :min="1" :max="30" :step="1" controls-position="right" style="width:200px" />
          <div class="form-tip">决定趋势图可回看的分钟级数据时长</div>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">流量统计网卡 <span class="form-tip-inline">（多个用英文逗号分隔，留空自动选择）</span></span>
          </template>
          <el-input v-model="form.settings.trafficIfaces" placeholder="留空则使用默认路由网卡" style="width:280px" />
          <div class="form-tip">建议只填写承载业务的物理网卡，避免容器虚拟网卡虚增流量</div>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">月流量配额 <span class="form-tip-inline">（GB，0 = 不设配额）</span></span>
          </template>
          <el-input-number v-model="form.settings.trafficQuotaGB" :min="0" :max="102400" :step="100" controls-position="right" style="width:200px" />
          <div class="form-tip">设置后仪表盘会展示配额进度，并在接近上限时加入体检提示</div>
        </el-form-item>

        <el-form-item>
          <template #label>
            <span class="label-with-tip">流量重置日 <span class="form-tip-inline">（每月 1-28 日）</span></span>
          </template>
          <el-input-number v-model="form.settings.trafficResetDay" :min="1" :max="28" :step="1" controls-position="right" style="width:200px" />
          <div class="form-tip">按套餐账单周期填写；不按自然月计费的套餐请改成实际起算日</div>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Actions -->
    <div class="actions-bar">
      <el-button type="primary" size="large" :loading="saving" @click="handleSave">
        保存设置
      </el-button>
      <el-button size="large" type="danger" plain :loading="restarting" @click="confirmRestart">
        <el-icon><Refresh /></el-icon>
        重启面板
      </el-button>
    </div>

    <!-- Security Settings -->
    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Lock /></el-icon>
          <span>安全设置</span>
        </div>
      </template>
      <el-form :model="passwordForm" label-position="top" class="settings-form">
        <el-form-item label="新密码">
          <el-input
            v-model="passwordForm.password"
            type="password"
            placeholder="至少 6 位"
            show-password
            style="width:360px"
          />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input
            v-model="passwordForm.confirm"
            type="password"
            placeholder="再次输入新密码"
            show-password
            style="width:360px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="changingPwd" @click="handleChangePassword">
            修改密码
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </template>
  </div>
</template>

<script setup>
import LoadingBlock from '../components/LoadingBlock.vue'
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put, post } from '../api'
import { QuestionFilled } from '@element-plus/icons-vue'

const loading = ref(true)
const saving = ref(false)
const changingPwd = ref(false)
const restarting = ref(false)

const form = reactive({
  port: 4567,
  mode: 'standalone',
  domain: '',
  settings: {
    dashboardRefresh: 5,
    syncInterval: 12,
    editMaxSize: 1,
    uploadMaxSize: 500,
    metricsRetentionDays: 7,
    trafficIfaces: '',
    trafficQuotaGB: 0,
    trafficResetDay: 1
  }
})

const passwordForm = reactive({
  password: '',
  confirm: ''
})

onMounted(async () => {
  try {
    const res = await get('/settings')
    form.port = res.port
    form.mode = res.mode
    form.domain = res.domain || ''
    if (res.settings) Object.assign(form.settings, res.settings)
  } catch (e) {
    ElMessage.error('加载设置失败: ' + e.message)
  }
  loading.value = false
})

async function handleSave() {
  // Validate domain in proxy mode
  if (form.mode === 'proxy' && !form.domain) {
    ElMessage.error('Proxy 模式需要填写绑定域名')
    return
  }

  saving.value = true
  try {
    const body = {
      port: form.port,
      mode: form.mode,
      domain: form.domain || undefined,
      settings: { ...form.settings }
    }

    const res = await put('/settings', body)
    try { ElMessage.success(res.message) } catch { alert(res.message) }

    if (res.nginxSynced && res.nginxSynced.error) {
      ElMessage.warning('nginx 上传上限同步失败：' + res.nginxSynced.error + '（请手动调整 client_max_body_size）', 6000)
    }

    if (res.needsRestart) {
      try { ElMessage.warning('已修改端口或模式，请重启面板使设置生效', 5000) } catch { alert('已修改端口或模式，请重启面板使设置生效') }
    }
  } catch (e) {
    console.error('=== Settings Save Error ===')
    console.error('Error:', e)
    console.error('Stack:', e?.stack)
    try { ElMessage.error(e?.message || '保存失败') } catch { alert(e?.message || '保存失败') }
  } finally {
    saving.value = false
  }
}

async function handleChangePassword() {
  if (passwordForm.password !== passwordForm.confirm) {
    ElMessage.error('两次密码输入不一致')
    return
  }
  if (passwordForm.password.length < 6) {
    ElMessage.error('密码至少 6 位')
    return
  }

  changingPwd.value = true
  try {
    const res = await put('/settings/password', { password: passwordForm.password })
    ElMessage.success(res.message)
    passwordForm.password = ''
    passwordForm.confirm = ''
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    changingPwd.value = false
  }
}

async function confirmRestart() {
  try {
    await ElMessageBox.confirm(
      '确定要重启面板吗？面板将短暂不可用（约 3-5 秒）。',
      '重启确认',
      {
        confirmButtonText: '确定重启',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    restarting.value = true
    await post('/settings/restart')
    ElMessage.success('面板正在重启，请稍后刷新页面...')
    setTimeout(() => {
      window.location.reload()
    }, 5000)
  } catch {
    // cancelled
  } finally {
    restarting.value = false
  }
}
</script>

<style scoped>
.settings-page {
  /* 与其他页面一致：左对齐，仅限制最大宽度（原来 margin: 0 auto 导致整页居中） */
  max-width: 720px;
}
.settings-card {
  margin-bottom: 20px;
  border-radius: 10px;
  transition: box-shadow 0.2s;
}
.settings-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.settings-form {
  max-width: 520px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.4;
}
.mode-tip-icon {
  color: #909399;
  font-size: 14px;
  cursor: help;
  margin-left: 4px;
  vertical-align: middle;
}
.label-with-tip {
  font-size: 15px;
  font-weight: 600;
}
.form-tip-inline {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  margin-left: 6px;
}
.radio-label-text {
  vertical-align: middle;
}

.actions-bar {
  display: flex;
  gap: 12px;
  padding-top: 4px;
  margin-bottom: 20px;
}

@media (max-width: 768px) {
  .settings-page {
    max-width: 100%;
  }
  .settings-form {
    max-width: 100%;
  }
  .settings-form :deep(.el-input),
  .settings-form :deep(.el-input-number) {
    width: 100% !important;
  }
  .actions-bar {
    flex-direction: row;
  }
  .actions-bar .el-button {
    flex: 1;
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
}
</style>
