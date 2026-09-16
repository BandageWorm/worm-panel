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
      { path: 'directlink', component: () => import('../views/DirectLinkManager.vue'), meta: { title: '文件直链' } },
      { path: 'terminal', component: () => import('../views/TerminalPage.vue'), meta: { title: '终端' } },
      { path: 'firewall', component: () => import('../views/FirewallManager.vue'), meta: { title: '防火墙' } },
      { path: 'nginx', component: () => import('../views/NginxManager.vue'), meta: { title: 'Nginx 管理' } },
      { path: 'ssl', component: () => import('../views/SslManager.vue'), meta: { title: 'SSL 证书' } },
      { path: 'cron', component: () => import('../views/CronManager.vue'), meta: { title: '计划任务' } },
      { path: 'notes', component: () => import('../views/NotesManager.vue'), meta: { title: '记事本' } },
      { path: 'sync', component: () => import('../views/Sync.vue'), meta: { title: '云备份' } },
      { path: 'pm2', component: () => import('../views/Pm2Manager.vue'), meta: { title: 'PM2 管理' } },
      { path: 'systemd', component: () => import('../views/SystemdManager.vue'), meta: { title: 'Systemd 管理' } },
      { path: 'xui', component: () => import('../views/XuiManager.vue'), meta: { title: '3X-UI' } },
      { path: 'settings', component: () => import('../views/Settings.vue'), meta: { title: '系统设置' } }
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
