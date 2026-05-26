const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pm2 = require('pm2');
const logger = require('../utils/logger');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const WORKERS_FILE = path.join(DATA_DIR, 'workers.json');
const WORKERS_CODE_DIR = path.join(DATA_DIR, 'workers');
const DEPLOY_TIMEOUT = 120000;

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

async function deploy({ repo, name, entry, branch, port }) {
  const projects = getProjects();
  if (projects.find(p => p.name === name)) {
    throw new Error(`项目 "${name}" 已存在`);
  }

  const projectPath = path.join(WORKERS_CODE_DIR, name);
  if (!fs.existsSync(WORKERS_CODE_DIR)) fs.mkdirSync(WORKERS_CODE_DIR, { recursive: true });
  if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });

  // 1. git clone
  logger.info('GitWorker', `Cloning ${repo} branch ${branch || 'main'}...`);
  const branchFlag = branch && !['main', 'master'].includes(branch) ? `--branch ${branch}` : '';
  execSync(`git clone ${branchFlag} --depth 1 ${repo} "${projectPath}"`, {
    stdio: 'pipe',
    timeout: DEPLOY_TIMEOUT,
    env: { ...process.env, PATH: buildPath() }
  });

  // 2. npm install
  logger.info('GitWorker', 'Running npm install...');
  try {
    execSync('npm install', {
      cwd: projectPath,
      stdio: 'pipe',
      timeout: DEPLOY_TIMEOUT,
      env: { ...process.env, PATH: buildPath() }
    });
  } catch (e) {
    logger.warn('GitWorker', `npm install failed (non-fatal): ${e.message}`);
  }

  // 3. pm2 start wrangler dev (local miniflare)
  logger.info('GitWorker', `Starting pm2 with wrangler dev on port ${port || 8787}...`);

  // Resolve full npx path (PM2 resolves script as file path, not from PATH)
  let npxBin = 'npx';
  try {
    npxBin = execSync('command -v npx', { encoding: 'utf8', env: { ...process.env, PATH: buildPath() } }).trim().split('\n')[0];
  } catch {}

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
  const projects = getProjects();
  if (projects.find(p => p.name === name)) {
    throw new Error(`项目 "${name}" 已存在`);
  }

  const projectPath = path.join(WORKERS_CODE_DIR, name);
  if (!fs.existsSync(WORKERS_CODE_DIR)) fs.mkdirSync(WORKERS_CODE_DIR, { recursive: true });
  if (fs.existsSync(projectPath)) fs.rmSync(projectPath, { recursive: true, force: true });

  // 1. git clone
  logger.info('GitWorker', `Cloning ${repo} branch ${branch || 'main'}...`);
  const branchFlag = branch && !['main', 'master'].includes(branch) ? `--branch ${branch}` : '';
  execSync(`git clone ${branchFlag} --depth 1 ${repo} "${projectPath}"`, {
    stdio: 'pipe',
    timeout: DEPLOY_TIMEOUT,
    env: { ...process.env, PATH: buildPath() }
  });

  // 2. npm install
  logger.info('GitWorker', 'Running npm install...');
  try {
    execSync('npm install', {
      cwd: projectPath,
      stdio: 'pipe',
      timeout: DEPLOY_TIMEOUT,
      env: { ...process.env, PATH: buildPath() }
    });
  } catch (e) {
    logger.warn('GitWorker', `npm install failed (non-fatal): ${e.message}`);
  }

  // 3. Resolve command to script + args
  const cmd = command || 'npm start';
  const parts = cmd.trim().split(/\s+/);
  let scriptBin = parts[0];
  const scriptArgs = parts.slice(1);

  // Resolve full path for known commands
  try {
    scriptBin = execSync(`command -v ${parts[0]}`, { encoding: 'utf8', env: { ...process.env, PATH: buildPath() } }).trim().split('\n')[0];
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
