<template>
  <div class="settings-page">
    <!-- Basic Settings -->
    <el-card shadow="never" class="settings-card">
      <template #header>
        <div class="card-header">
          <el-icon><Setting /></el-icon>
          <span>基本设置</span>
        </div>
      </template>
      <el-form :model="form" label-position="top" class="settings-form">
        <el-form-item label="面板端口">
          <el-input-number
            v-model="form.port"
            :min="1024"
            :max="65535"
            style="width:200px"
          />
          <div class="form-tip">修改后需重启面板生效</div>
        </el-form-item>

        <el-form-item label="面板模式">
          <el-radio-group v-model="form.mode">
            <el-radio value="standalone">
              <div class="radio-option">
                <span class="radio-label">Standalone</span>
                <span class="radio-desc">面板直接监听端口，自签 HTTPS</span>
              </div>
            </el-radio>
            <el-radio value="proxy">
              <div class="radio-option">
                <span class="radio-label">Proxy</span>
                <span class="radio-desc">面板监听 127.0.0.1，由 Nginx 反代提供 HTTPS</span>
              </div>
            </el-radio>
          </el-radio-group>
          <div class="form-tip">切换模式后需重启面板生效</div>
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get, put, post } from '../api'

const saving = ref(false)
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
})

async function handleSave() {
  // Validate password
  if (passwordForm.password || passwordForm.confirm) {
    if (passwordForm.password !== passwordForm.confirm) {
      ElMessage.error('两次密码输入不一致')
      return
    }
    if (passwordForm.password.length < 6) {
      ElMessage.error('密码至少 6 位')
      return
    }
  }

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
    if (passwordForm.password) {
      body.password = passwordForm.password
    }

    const res = await put('/settings', body)
    ElMessage.success(res.message)

    // Clear password fields after save
    passwordForm.password = ''
    passwordForm.confirm = ''

    if (res.needsRestart) {
      ElMessage.warning('已修改端口或模式，请重启面板使设置生效', 5000)
    }
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
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
}
.settings-card {
  margin-bottom: 16px;
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
  margin-top: 4px;
}
.radio-option {
  display: flex;
  flex-direction: column;
}
.radio-label {
  font-size: 14px;
  font-weight: 500;
}
.radio-desc {
  font-size: 12px;
  color: #909399;
}
.actions-bar {
  display: flex;
  gap: 12px;
  padding-top: 8px;
}
</style>
