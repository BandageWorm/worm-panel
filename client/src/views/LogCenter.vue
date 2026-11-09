<template>
  <div class="logs-page">
    <el-tabs v-model="activeTab" @tab-change="syncQuery">
      <el-tab-pane label="运行日志" name="logs">
        <LogViewer v-if="activeTab === 'logs'" />
      </el-tab-pane>
      <el-tab-pane label="告警" name="alerts">
        <AlertManager v-if="activeTab === 'alerts'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LogViewer from '../components/LogViewer.vue'
import AlertManager from './AlertManager.vue'

const TABS = ['logs', 'alerts']

const route = useRoute()
const router = useRouter()

const initial = TABS.includes(route.query.tab) ? route.query.tab : 'logs'
const activeTab = ref(initial)

function syncQuery(name) {
  if (route.query.tab === name) return
  router.replace({ path: '/logs', query: { tab: name } })
}

watch(() => route.query.tab, (val) => {
  if (TABS.includes(val) && val !== activeTab.value) activeTab.value = val
})

onMounted(() => {
  if (route.query.tab !== activeTab.value) syncQuery(activeTab.value)
})
</script>

<style scoped>
.logs-page {
  max-width: 1280px;
}
.logs-page :deep(.el-tabs__content) {
  padding-top: 4px;
}

@media (max-width: 768px) {
  .logs-page {
    max-width: 100%;
  }
}
</style>
