<template>
  <div class="settings-page" v-loading="loading" element-loading-text="加载中...">
    <template v-if="!loading">
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
  domain: ''
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
      domain: form.domain || undefined
    }

    const res = await put('/settings', body)
    ElMessage.success(res.message)

    if (res.needsRestart) {
      ElMessage.warning('已修改端口或模式，请重启面板使设置生效', 5000)
    }
  } catch (e) {
    ElMessage.error(e.message)
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
  max-width: 720px;
  margin: 0 auto;
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
