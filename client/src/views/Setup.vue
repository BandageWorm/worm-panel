<template>
  <div class="setup-container">
    <div class="setup-card">
      <div class="setup-header">
        <h1>初始化面板</h1>
        <p>首次使用，请完成初始设置</p>
      </div>
      <el-form @submit.prevent="handleSetup" :model="form" label-position="top">
        <el-form-item label="设置 Token">
          <el-input v-model="form.token" placeholder="启动时打印在控制台的 Token" size="large" />
        </el-form-item>
        <el-form-item label="管理员密码">
          <el-input v-model="form.password" type="password" placeholder="至少6位" size="large" show-password />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirmPassword" type="password" placeholder="再次输入密码" size="large" show-password />
        </el-form-item>
        <el-divider>可选配置</el-divider>
        <el-form-item label="面板端口（默认 4567）">
          <el-input-number v-model="form.port" :min="1024" :max="65535" size="large" style="width:100%" />
        </el-form-item>
        <el-form-item label="绑定域名（可选）">
          <el-input v-model="form.domain" placeholder="panel.example.com" size="large" />
          <div class="form-tip">填写后将自动切换为 Nginx 反代模式</div>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="handleSetup">
            完成设置
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="error" class="setup-error">{{ error }}</div>
      <div v-if="success" class="setup-success">{{ success }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { get, post } from '../api'

const router = useRouter()
const form = ref({ token: '', password: '', confirmPassword: '', port: 4567, domain: '' })
const loading = ref(false)
const error = ref('')
const success = ref('')

onMounted(async () => {
  const status = await get('/setup/status')
  if (status.initialized) {
    router.push('/login')
  }
})

async function handleSetup() {
  error.value = ''
  success.value = ''
  if (form.value.password !== form.value.confirmPassword) {
    error.value = '两次密码输入不一致'
    return
  }
  if (form.value.password.length < 6) {
    error.value = '密码至少6位'
    return
  }
  loading.value = true
  try {
    const res = await post('/setup/setup', {
      token: form.value.token,
      password: form.value.password,
      port: form.value.port,
      domain: form.value.domain || undefined
    })
    success.value = res.message
    setTimeout(() => router.push('/login'), 3000)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.setup-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
  padding: 40px;
}
.setup-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  width: 480px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.setup-header {
  text-align: center;
  margin-bottom: 32px;
}
.setup-header h1 {
  font-size: 28px;
  color: #1a1a2e;
  margin-bottom: 8px;
}
.setup-header p {
  color: #909399;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.setup-error {
  color: #f56c6c;
  text-align: center;
  margin-top: 12px;
}
.setup-success {
  color: #67c23a;
  text-align: center;
  margin-top: 12px;
}
</style>
