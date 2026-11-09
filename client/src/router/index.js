import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/setup', component: () => import('../views/Setup.vue') },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'files', component: () => import('../views/FileManager.vue'), meta: { title: '文件管理' } },
      { path: 'terminal', component: () => import('../views/TerminalPage.vue'), meta: { title: '终端' } },
      { path: 'network', component: () => import('../views/NetworkManage.vue'), meta: { title: '网络' } },
      { path: 'notes', component: () => import('../views/NotesManager.vue'), meta: { title: '记事本' } },
      { path: 'sync', component: () => import('../views/Sync.vue'), meta: { title: '云备份' } },
      { path: 'logs', component: () => import('../views/LogCenter.vue'), meta: { title: '日志中心' } },
      { path: 'pm2', component: () => import('../views/Pm2Manager.vue'), meta: { title: 'PM2 管理' } },
      { path: 'system', component: () => import('../views/SystemStatus.vue'), meta: { title: '系统状态' } },
      { path: 'settings', component: () => import('../views/Settings.vue'), meta: { title: '系统设置' } },

      // 旧入口保留重定向，避免书签与健康卡跳转失效
      { path: 'directlink', redirect: { path: '/files', query: { tab: 'directlink' } } },
      { path: 'ports', redirect: { path: '/system', query: { tab: 'ports' } } },
      { path: 'cron', redirect: { path: '/system', query: { tab: 'cron' } } },
      { path: 'systemd', redirect: { path: '/system', query: { tab: 'systemd' } } },
      { path: 'nginx', redirect: { path: '/network', query: { tab: 'nginx' } } },
      { path: 'ssl', redirect: { path: '/network', query: { tab: 'ssl' } } },
      { path: 'firewall', redirect: { path: '/network', query: { tab: 'firewall' } } },
      { path: 'xui', redirect: { path: '/network', query: { tab: 'xui' } } },
      { path: 'alerts', redirect: { path: '/logs', query: { tab: 'alerts' } } }
    ]
  }
]

const router = createRouter({ history: createWebHashHistory(), routes })

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('token')
  if (to.path !== '/login' && to.path !== '/setup' && !token) {
    next('/login')
  } else {
    next()
  }
})

export default router
