<template>
  <div class="main-layout">
    <!-- Sidebar -->
    <div class="sidebar">
      <div class="logo">
        <span class="logo-icon">◇</span>
        <span class="logo-text">Worm Panel</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        background-color="#1a1a2e"
        text-color="#a0a0b8"
        active-text-color="#fff"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><Monitor /></el-icon>
          <span>仪表盘</span>
        </el-menu-item>
        <el-menu-item index="/nginx">
          <el-icon><Connection /></el-icon>
          <span>Nginx</span>
        </el-menu-item>
        <el-menu-item index="/ssl">
          <el-icon><Lock /></el-icon>
          <span>SSL 证书</span>
        </el-menu-item>
        <el-menu-item index="/notes">
          <el-icon><Edit /></el-icon>
          <span>记事本</span>
        </el-menu-item>
        <el-menu-item index="/pm2">
          <el-icon><Cpu /></el-icon>
          <span>PM2</span>
        </el-menu-item>
        <el-menu-item index="/workers">
          <el-icon><Cloudy /></el-icon>
          <span>Workers</span>
        </el-menu-item>
        <el-menu-item index="/xui">
          <el-icon><Grid /></el-icon>
          <span>3X-UI</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </div>

    <!-- Main area -->
    <div class="main-area">
      <!-- TopBar -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-title">{{ currentTitle }}</span>
        </div>
        <div class="topbar-right">
          <span class="topbar-item" v-if="serverInfo">
            <el-icon><Cpu /></el-icon>
            CPU {{ serverInfo.cpu?.usage ?? '--' }}%
          </span>
          <span class="topbar-item" v-if="serverInfo">
            <el-icon><Coin /></el-icon>
            内存 {{ formatPercent(serverInfo.memory?.percent) }}
          </span>
          <span class="topbar-item" v-if="serverInfo">
            <el-icon><DataBoard /></el-icon>
            磁盘 {{ formatPercent(serverInfo.disk?.percent) }}
          </span>
          <span class="topbar-item">{{ now }}</span>
          <el-button text size="small" @click="logout">退出</el-button>
        </div>
      </header>

      <!-- Content -->
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { get } from '../api'

const route = useRoute()
const router = useRouter()
const now = ref('')
const serverInfo = ref(null)
let timer = null
let infoTimer = null

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => route.meta?.title || '仪表盘')

function formatPercent(p) {
  return p ? p + '%' : '--'
}

function updateTime() {
  const d = new Date()
  now.value = d.toLocaleString('zh-CN', { hour12: false })
}

async function fetchServerInfo() {
  try {
    serverInfo.value = await get('/dashboard')
  } catch {
    // ignore
  }
}

function logout() {
  localStorage.removeItem('token')
  router.push('/login')
}

onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
  fetchServerInfo()
  infoTimer = setInterval(fetchServerInfo, 5000)
})

onUnmounted(() => {
  clearInterval(timer)
  clearInterval(infoTimer)
})
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  background: #f5f6fa;
}
.sidebar {
  width: 220px;
  background: #1a1a2e;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.logo {
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: #fff;
  font-size: 18px;
  gap: 8px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.logo-icon {
  font-size: 24px;
  color: #409eff;
}
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.topbar {
  height: 50px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
}
.topbar-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #606266;
}
.topbar-item {
  display: flex;
  align-items: center;
  gap: 4px;
}
.content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}
</style>
