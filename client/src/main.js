import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.config.errorHandler = (err, instance, info) => {
  console.error('=== Vue Error ===')
  console.error('Message:', err?.message || err)
  console.error('Component:', instance?.$options?.name || instance?.type?.name || 'unknown')
  console.error('Info:', info)
  console.error('Stack:', err?.stack)
}

// Catch errors outside Vue (unhandled rejections, event errors)
window.addEventListener('error', (e) => {
  console.error('=== Window Error ===')
  console.error('Message:', e.message)
  console.error('Source:', e.filename, 'Line:', e.lineno, 'Col:', e.colno)
  console.error('Stack:', e.error?.stack)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('=== Unhandled Rejection ===')
  console.error('Reason:', e.reason?.message || e.reason)
  console.error('Stack:', e.reason?.stack)
})

app.use(ElementPlus)
app.use(router)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
