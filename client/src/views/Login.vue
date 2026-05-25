<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>Worm Panel</h1>
        <p>服务器管理面板</p>
      </div>
      <el-form @submit.prevent="handleLogin" :model="form">
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            placeholder="管理员密码"
            size="large"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" style="width:100%" :loading="loading" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
      <div v-if="error" class="login-error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { post, get } from '../api'

const router = useRouter()
const form = ref({ password: '' })
const loading = ref(false)
const error = ref('')

onMounted(async () => {
  const token = localStorage.getItem('token')
  if (token) {
    router.push('/')
    return
  }
  const status = await get('/setup/status')
  if (!status.initialized) {
    router.push('/setup')
  }
})

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const res = await post('/auth/login', { password: form.value.password })
    localStorage.setItem('token', res.token)
    router.push('/')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1a1a2e;
}
.login-card {
  background: #fff;
  border-radius: 12px;
  padding: 40px;
  width: 380px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.login-header {
  text-align: center;
  margin-bottom: 32px;
}
.login-header h1 {
  font-size: 28px;
  color: #1a1a2e;
  margin-bottom: 8px;
}
.login-header p {
  color: #909399;
  font-size: 14px;
}
.login-error {
  color: #f56c6c;
  text-align: center;
  font-size: 14px;
  margin-top: 12px;
}
</style>
