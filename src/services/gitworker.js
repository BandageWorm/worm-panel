const fs = require('fs');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { promisify } = require('util');
const pm2 = require('pm2');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const WORKERS_FILE = path.join(DATA_DIR, 'workers.json');
const WORKERS_CODE_DIR = path.join(DATA_DIR, 'workers');
const DEPLOY_TIMEOUT = 120000;

// 输入校验：只允许安全的 git repo URL
function validateRepo(repo) {
  if (!repo || typeof repo !== 'string') {
    throw new Error('repo 地址不能为空');
  }
  // 允许 https://、git://、git@host:path 格式
  const safePattern = /^(https?:\/\/[^\s;|&`$]+|git:\/\/[^\s;|&`$]+|git@[^\s;|&`$]+:[^\s;|&`$]+)$/;
  if (!safePattern.test(repo)) {
    throw new Error('repo 地址格式不合法');
  }
}

// 输入校验：分支名只允许合法字符
function validateBranch(branch) {
  if (!branch) return;
  // git 分支名：字母、数字、-、_、/、.
  const safePattern = /^[a-zA-Z0-9._\-\/]+$/;
  if (!safePattern.test(branch)) {
    throw new Error('分支名包含非法字符');
  }
}

// 输入校验：项目名只允许安全字符
function validateName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('项目名不能为空');
  }
  const safePattern = /^[a-zA-Z0-9._\-]+$/;
  if (!safePattern.test(name)) {
    throw new Error('项目名只允许字母、数字、-、_、.');
  }
}

function buildPath() {
  const paths = process.env.PATH ? process.env.PATH.split(path.delimiter) : [];
  const nvmDir = process.env.NVM_DIR || path.join(process.env.HOME || '/root', '.nvm');
  // Add nvm current node bin if resolvable
  try {
    const nvmNodePath = path.join(nvmDir, 'versions', 'node');
    if (fs.existsSync(nvmNodePath)) {
      const versions = fs.readdirSync(nvmNodePath);
      if (versions.length > 0) {
        const latest = versions.sort().reverse()[0];
        paths.unshift(path.join(nvmNodePath, latest, 'bin'));
      }
    }
  } catch {}
  paths.unshift(path.join(nvmDir, 'bin'));
  return paths.join(path.delimiter);
}

function getProjects() {
  if (!fs.existsSync(WORKERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(WORKERS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveProjects(projects) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(WORKERS_CODE_DIR)) fs.mkdirSync(WORKERS_CODE_DIR, { recursive: true });
  fs.writeFileSync(WORKERS_FILE, JSON.stringify(projects, null, 2), 'utf8');
}

// 解析 npx 完整路径
function resolveNpxBin() {
  try {
    return execFileSync('which', ['npx'], {
      encoding: 'utf8',
      env: { ...process.env, PATH: buildPath() }
    }).trim().split('\n')[0];
  } catch {
    return 'npx';
  }
}

async function deploy({ repo, name, entry, branch, port }) {
  // 输入校验
  validateRepo(repo);
  validateName(name);
  validateBranch(branch);

  const projects = getProjects();
  if (projects.find(p => p.name === name)) {
    throw new Error(`项目 "${name}" 已存在`);
  }

  const projectPath = path.join(WORKERS_CODE_DIR, name);
  if (!fs.existsSync(WORKERS_CODE_DIR)) fs.mkdirSync(WORKERS_CODE_DIR, { recursive: true });
  if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });

  // 1. git clone — 使用 execFileAsync 避免命令注入
  logger.info('GitWorker', `Cloning ${repo} branch ${branch || 'main'}...`);
  const cloneArgs = ['clone', '--depth', '1'];
  if (branch && !['main', 'master'].includes(branch)) {
    cloneArgs.push('--branch', branch);
  }
  cloneArgs.push(repo, projectPath);

  await execFileAsync('git', cloneArgs, {
    timeout: DEPLOY_TIMEOUT,
    env: { ...process.env, PATH: buildPath() }
  });

  // 2. npm install — 使用 execFileAsync
  logger.info('GitWorker', 'Running npm install...');
  try {
    await execFileAsync('npm', ['install'], {
      cwd: projectPath,
      timeout: DEPLOY_TIMEOUT,
      env: { ...process.env, PATH: buildPath() }
    });
  } catch (e) {
    logger.warn('GitWorker', `npm install failed (non-fatal): ${e.message}`);
  }

  // 3. pm2 start wrangler dev (local miniflare)
  logger.info('GitWorker', `Starting pm2 with wrangler dev on port ${port || 8787}...`);

  const npxBin = resolveNpxBin();

  await new Promise((resolve, reject) => {
    pm2.connect(err => {
      if (err && !err.message.includes('already connected')) {
        return reject(new Error('PM2 连接失败: ' + err.message));
      }
      pm2.start({
        script: npxBin,
        args: ['wrangler', 'dev', entry || 'index.js', '--port', String(port || 8787), '--ip', '0.0.0.0', '--compatibility-date', '2026-05-03'],
        cwd: projectPath,
        name,
        env: { PATH: buildPath() },
        error_file: path.join(DATA_DIR, 'logs', `${name}-error.log`),
        out_file: path.join(DATA_DIR, 'logs', `${name}-out.log`),
        merge_logs: true,
        log_date_format: 'MM-DD HH:mm:ss',
        max_restarts: 5,
        min_uptime: 10000
      }, (startErr) => {
        pm2.disconnect();
        if (startErr) {
          try { fs.rmSync(projectPath, { recursive: true, force: true }); } catch {}
          const msg = Array.isArray(startErr)
            ? startErr.map(e => e && e.message ? e.message : String(e)).join('; ')
            : (startErr && startErr.message ? startErr.message : JSON.stringify(startErr));
          return reject(new Error('PM2 启动失败: ' + msg));
        }
        resolve();
      });
    });
  });

  // 4. Save record
  const record = {
    name,
    repo,
    entry: entry || 'index.js',
    branch: branch || 'main',
    port: port || 8787,
    path: projectPath,
    createdAt: new Date().toISOString()
  };
  projects.push(record);
  saveProjects(projects);

  logger.info('GitWorker', `Deployed ${name} successfully`);
  return record;
}

async function removeProject(name) {
  validateName(name);

  const projects = getProjects();
  const idx = projects.findIndex(p => p.name === name);
  const projectPath = idx !== -1 ? (projects[idx].path || path.join(WORKERS_CODE_DIR, name)) : path.join(WORKERS_CODE_DIR, name);

  // Stop & delete pm2 process (tolerate if not found)
  await new Promise((resolve) => {
    pm2.connect(err => {
      if (err && !err.message.includes('already connected')) {
        pm2.disconnect();
        return resolve();
      }
      pm2.delete(name, () => {
        pm2.disconnect();
        resolve();
      });
    });
  });

  // Delete local files
  try { fs.rmSync(projectPath, { recursive: true, force: true }); } catch {}

  // Remove record if exists
  if (idx !== -1) {
    projects.splice(idx, 1);
    saveProjects(projects);
  }

  logger.info('GitWorker', `Removed ${name} successfully`);
}

async function deployGeneric({ repo, name, branch, command, port }) {
  // 输入校验
  validateRepo(repo);
  validateName(name);
  validateBranch(branch);

  const projects = getProjects();
  if (projects.find(p => p.name === name)) {
    throw new Error(`项目 "${name}" 已存在`);
  }

  const projectPath = path.join(WORKERS_CODE_DIR, name);
  if (!fs.existsSync(WORKERS_CODE_DIR)) fs.mkdirSync(WORKERS_CODE_DIR, { recursive: true });
  if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });

  // 1. git clone — 使用 execFileAsync 避免命令注入
  logger.info('GitWorker', `Cloning ${repo} branch ${branch || 'main'}...`);
  const cloneArgs = ['clone', '--depth', '1'];
  if (branch && !['main', 'master'].includes(branch)) {
    cloneArgs.push('--branch', branch);
  }
  cloneArgs.push(repo, projectPath);

  await execFileAsync('git', cloneArgs, {
    timeout: DEPLOY_TIMEOUT,
    env: { ...process.env, PATH: buildPath() }
  });

  // 2. npm install — 使用 execFileAsync
  logger.info('GitWorker', 'Running npm install...');
  try {
    await execFileAsync('npm', ['install'], {
      cwd: projectPath,
      timeout: DEPLOY_TIMEOUT,
      env: { ...process.env, PATH: buildPath() }
    });
  } catch (e) {
    logger.warn('GitWorker', `npm install failed (non-fatal): ${e.message}`);
  }

  // 3. 解析命令为 script + args（白名单方式）
  const cmd = command || 'npm start';
  const parts = cmd.trim().split(/\s+/);
  let scriptBin = parts[0];
  const scriptArgs = parts.slice(1);

  // 只允许已知安全的命令前缀
  const ALLOWED_COMMANDS = ['npm', 'npx', 'node', 'pnpm', 'yarn', 'bun'];
  if (!ALLOWED_COMMANDS.includes(scriptBin)) {
    throw new Error(`不允许的启动命令: ${scriptBin}，仅支持: ${ALLOWED_COMMANDS.join(', ')}`);
  }

  // 解析完整路径
  try {
    const resolved = execFileSync('which', [scriptBin], {
      encoding: 'utf8',
      env: { ...process.env, PATH: buildPath() }
    }).trim().split('\n')[0];
    if (resolved) scriptBin = resolved;
  } catch {}

  logger.info('GitWorker', `Starting pm2 with: ${scriptBin} ${scriptArgs.join(' ')}`);

  await new Promise((resolve, reject) => {
    pm2.connect(err => {
      if (err && !err.message.includes('already connected')) {
        return reject(new Error('PM2 连接失败: ' + err.message));
      }
      const env = { PATH: buildPath() };
      if (port) env.PORT = String(port);

      pm2.start({
        script: scriptBin,
        args: scriptArgs,
        cwd: projectPath,
        name,
        env,
        error_file: path.join(DATA_DIR, 'logs', `${name}-error.log`),
        out_file: path.join(DATA_DIR, 'logs', `${name}-out.log`),
        merge_logs: true,
        log_date_format: 'MM-DD HH:mm:ss',
        max_restarts: 5,
        min_uptime: 10000
      }, (startErr) => {
        pm2.disconnect();
        if (startErr) {
          try { fs.rmSync(projectPath, { recursive: true, force: true }); } catch {}
          const msg = Array.isArray(startErr)
            ? startErr.map(e => e && e.message ? e.message : String(e)).join('; ')
            : (startErr && startErr.message ? startErr.message : JSON.stringify(startErr));
          return reject(new Error('PM2 启动失败: ' + msg));
        }
        resolve();
      });
    });
  });

  // 4. Save record
  const record = { name, repo, command: cmd, branch: branch || 'main', port: port || null, type: 'generic', path: projectPath, createdAt: new Date().toISOString() };
  projects.push(record);
  saveProjects(projects);

  logger.info('GitWorker', `Deployed generic project ${name} successfully`);
  return record;
}

module.exports = { getProjects, saveProjects, deploy, deployGeneric, removeProject };
