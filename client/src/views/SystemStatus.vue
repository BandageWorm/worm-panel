<template>
  <div class="system-status">
    <el-tabs v-model="activeTab" @tab-change="syncQuery">
      <el-tab-pane label="Systemd 服务" name="systemd">
        <SystemdManager v-if="activeTab === 'systemd'" />
      </el-tab-pane>
      <el-tab-pane label="端口与进程" name="ports">
        <PortManager v-if="activeTab === 'ports'" />
      </el-tab-pane>
      <el-tab-pane label="计划任务" name="cron">
        <CronManager v-if="activeTab === 'cron'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SystemdManager from './SystemdManager.vue'
import PortManager from './PortManager.vue'
import CronManager from './CronManager.vue'

const TABS = ['systemd', 'ports', 'cron']

const route = useRoute()
const router = useRouter()

const initial = TABS.includes(route.query.tab) ? route.query.tab : 'systemd'
const activeTab = ref(initial)

function syncQuery(name) {
  if (route.query.tab === name) return
  router.replace({ path: '/system', query: { tab: name } })
}

watch(() => route.query.tab, (val) => {
  if (TABS.includes(val) && val !== activeTab.value) activeTab.value = val
})

onMounted(() => {
  if (route.query.tab !== activeTab.value) syncQuery(activeTab.value)
})
</script>

<style scoped>
.system-status {
  max-width: 1280px;
}
.system-status :deep(.el-tabs__content) {
  padding-top: 4px;
}

@media (max-width: 768px) {
  .system-status {
    max-width: 100%;
  }
}
</style>
