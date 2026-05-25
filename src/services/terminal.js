const { verifyToken } = require('../utils/crypto');

function createTerminal(ws, req) {
  // Verify JWT from query parameter
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(4001, '未提供认证 token');
    return;
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    ws.close(4001, 'token 无效或已过期');
    return;
  }

  if (!payload) {
    ws.close(4001, '认证失败');
    return;
  }

  let ptyProcess = null;
  let buf = '';

  try {
    const os = require('os');
    const shell = os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash';
    const pty = require('node-pty');

    const term = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || '/root',
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        PS1: '$ '
      }
    });

    // Handle window size message before setting up data handler
    const resizePty = (cols, rows) => {
      try { term.resize(cols, rows); } catch {}
    };

    let isReconnectMessage = false;

    term.onData((data) => {
      try {
        if (ws.readyState === 1) { // OPEN
          ws.send(JSON.stringify({ type: 'output', data }));
        }
      } catch {}
    });

    term.onExit(() => {
      try {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({ type: 'exit' }));
        }
      } catch {}
    });

    ptyProcess = term;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'input') {
          term.write(msg.data);
        } else if (msg.type === 'resize') {
          resizePty(msg.cols, msg.rows);
        }
      } catch {
        // If not JSON, treat as raw input
        if (ptyProcess) {
          try { ptyProcess.write(raw.toString()); } catch {}
        }
      }
    });

    ws.on('close', () => {
      try { term.kill(); } catch {}
      ptyProcess = null;
    });

  } catch (err) {
    // node-pty not available or failed to spawn
    ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[31m终端启动失败: ${err.message}\x1b[0m\r\n` }));
    ws.close();
    return;
  }

  // Handle unexpected close
  const cleanup = () => {
    if (ptyProcess) {
      try { ptyProcess.kill(); } catch {}
      ptyProcess = null;
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
}

module.exports = { createTerminal };
