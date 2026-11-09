<template>
  <div class="network-page">
    <el-tabs v-model="activeTab" @tab-change="syncQuery">
      <el-tab-pane label="Nginx" name="nginx">
        <NginxManager v-if="activeTab === 'nginx'" />
      </el-tab-pane>
      <el-tab-pane label="SSL 证书" name="ssl">
        <SslManager v-if="activeTab === 'ssl'" />
      </el-tab-pane>
      <el-tab-pane label="防火墙" name="firewall">
        <FirewallManager v-if="activeTab === 'firewall'" />
      </el-tab-pane>
      <el-tab-pane label="3X-UI" name="xui">
        <XuiManager v-if="activeTab === 'xui'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import NginxManager from './NginxManager.vue'
import SslManager from './SslManager.vue'
import FirewallManager from './FirewallManager.vue'
import XuiManager from './XuiManager.vue'

const TABS = ['nginx', 'ssl', 'firewall', 'xui']

const route = useRoute()
const router = useRouter()

const initial = TABS.includes(route.query.tab) ? route.query.tab : 'nginx'
const activeTab = ref(initial)

function syncQuery(name) {
  if (route.query.tab === name) return
  router.replace({ path: '/network', query: { tab: name } })
}

watch(() => route.query.tab, (val) => {
  if (TABS.includes(val) && val !== activeTab.value) activeTab.value = val
})

onMounted(() => {
  if (route.query.tab !== activeTab.value) syncQuery(activeTab.value)
})
</script>

<style scoped>
.network-page {
  max-width: 1280px;
}
.network-page :deep(.el-tabs__content) {
  padding-top: 4px;
}

@media (max-width: 768px) {
  .network-page {
    max-width: 100%;
  }
}
</style>
