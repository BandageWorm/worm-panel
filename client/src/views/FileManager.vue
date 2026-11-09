<template>
  <div class="file-manager">
    <el-card shadow="never">
      <el-tabs v-model="activeTab" @tab-change="syncQuery">
        <el-tab-pane label="文件浏览" name="browse">
          <FileBrowser v-if="activeTab === 'browse'" />
        </el-tab-pane>
        <el-tab-pane label="文件直链" name="directlink">
          <DirectLinkManager v-if="activeTab === 'directlink'" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FileBrowser from '../components/FileBrowser.vue'
import DirectLinkManager from './DirectLinkManager.vue'

const TABS = ['browse', 'directlink']

const route = useRoute()
const router = useRouter()

const initial = TABS.includes(route.query.tab) ? route.query.tab : 'browse'
const activeTab = ref(initial)

function syncQuery(name) {
  if (route.query.tab === name) return
  router.replace({ path: '/files', query: { tab: name } })
}

watch(() => route.query.tab, (val) => {
  if (TABS.includes(val) && val !== activeTab.value) activeTab.value = val
})

onMounted(() => {
  if (route.query.tab !== activeTab.value) syncQuery(activeTab.value)
})
</script>

<style scoped>
.file-manager {
  width: 100%;
}
.file-manager :deep(.el-tabs__content) {
  padding-top: 4px;
}
</style>
