<template>
  <div class="terminal-wrapper" :class="{ collapsed: isCollapsed }">
    <div class="terminal-header" @click="toggleCollapse">
      <span class="terminal-title">
        <el-icon><Monitor /></el-icon>
        终端
      </span>
      <div class="terminal-controls">
        <el-tag v-if="connected" size="small" type="success">已连接</el-tag>
        <el-tag v-else size="small" type="danger">未连接</el-tag>
        <el-button text size="small" @click.stop="toggleCollapse">
          <el-icon v-if="isCollapsed"><ArrowDown /></el-icon>
          <el-icon v-else><ArrowUp /></el-icon>
        </el-button>
      </div>
    </div>
    <div class="terminal-body" ref="terminalRef"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Monitor, ArrowDown, ArrowUp } from '@element-plus/icons-vue'

import 'xterm/css/xterm.css'

const terminalRef = ref(null)
const isCollapsed = ref(false)
const connected = ref(false)

let term = null
let fitAddon = null
let ws = null
let reconnectTimer = null

function getWsUrl() {
  const token = localStorage.getItem('token')
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/terminal?token=${token}`
}

function sendResize() {
  if (!fitAddon || !ws || ws.readyState !== WebSocket.OPEN) return
  try {
    fitAddon.fit()
    const dims = fitAddon.proposeDimensions()
    if (dims && dims.cols > 5 && dims.rows > 5) {
      ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
    }
  } catch {}
}

function connect() {
  if (ws && ws.readyState === WebSocket.OPEN) return
  try {
    ws = new WebSocket(getWsUrl())
    ws.onopen = () => {
      connected.value = true
      sendResize()
    }
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'output' && term) {
          term.write(msg.data)
        } else if (msg.type === 'exit') {
          connected.value = false
        }
      } catch {
        if (term) term.write(event.data)
      }
    }
    ws.onclose = () => {
      connected.value = false
      scheduleReconnect()
    }
    ws.onerror = () => {
      connected.value = false
    }
  } catch {
    connected.value = false
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!connected.value) connect()
  }, 3000)
}

function initTerminal() {
  if (!terminalRef.value) return

  term = new Terminal({
    cursorBlink: true,
    cursorStyle: 'bar',
      fontFamily: "Consolas, menlo, monospace",
    letterSpacing: 0,
    lineHeight: 1,

    fontSize: window.innerWidth < 768 ? 10 : 14,
    theme: {
      background: '#1a1a2e',
      foreground: '#e0e0e0',
      cursor: '#409eff'
    }
  })

  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)

  term.onData((data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }))
    }
  })

  // 关键：等字体加载完再打开终端，否则字符宽度会算错
  term.open(terminalRef.value)
  sendResize()
  connect()
}

onMounted(() => {
  // 等待所有字体加载完成后再初始化终端
  document.fonts.ready.then(() => {
    initTerminal()
  })
})

onUnmounted(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (ws) {
    ws.onclose = null
    ws.close()
  }
  if (term) {
    term.dispose()
    term = null
  }
})
</script>

<style>
/* 防止外部 CSS 污染终端内部的字符间距 */
.terminal-body * {
  letter-spacing: normal !important;
  word-spacing: normal !important;
}
.xterm {
  padding: 0 !important;
}
.xterm-viewport {
  scrollbar-width: thin !important;
}
</style>

<style scoped>
.terminal-wrapper {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
  background: #1a1a2e;
}
.terminal-wrapper.collapsed .terminal-body {
  display: none;
}
.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  cursor: pointer;
  user-select: none;
}
.terminal-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}
.terminal-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.terminal-body {
  height: 600px;
  position: relative;
  overflow: hidden;
}

@media (max-width: 768px) {
  .terminal-body {
    height: 400px;
  }
}
</style>
