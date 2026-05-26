const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');

const WORKERS_BASE = path.join(__dirname, '..', '..', 'data', 'workers');
const LOGS_DIR = path.join(__dirname, '..', '..', 'data', 'logs', 'workers');

function ensureDirs() {
  if (!fs.existsSync(WORKERS_BASE)) fs.mkdirSync(WORKERS_BASE, { recursive: true });
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function getProjects() {
  const cfg = config.load();
  return cfg.workers || [];
}

function saveProjects(projects) {
  const cfg = config.load();
  cfg.workers = projects;
  config.save(cfg);
}

function resolvePath() {
  const env = { ...process.env };
  const paths = (env.PATH || '').split(path.delimiter);

  const candidates = [
    process.env.NVM_BIN,
    process.env.NVM_DIR ? path.join(process.env.NVM_DIR, '..', 'versions', 'node', 'default', 'bin') : null,
    path.join(process.env.HOME || '/root', '.nvm', 'versions', 'node', 'default', 'bin'),
    path.join(process.env.HOME || '/root', '.nvm', 'versions', 'node', 'v20', 'bin'),
  ];

  candidates.push(path.dirname(process.execPath));

  for (const p of candidates) {
    if (p && fs.existsSync(p) && !paths.includes(p)) {
      paths.unshift(p);
    }
  }

  env.PATH = paths.join(path.delimiter);
  return env;
}

function checkWrangler() {
  try {
    const env = resolvePath();
    const out = execSync('npx wrangler --version 2>&1 || wrangler --version 2>&1', {
      env, encoding: 'utf8', timeout: 15000
    });
    const match = out.match(/\d+\.\d+\.\d+/);
    return { installed: true, version: match ? match[0] : out.trim() };
  } catch {
    return { installed: false, version: null };
  }
}

function addProject({ name, repo, branch }) {
  const projects = getProjects();
  if (projects.find(p => p.name === name)) {
    throw new Error('项目已存在');
  }

  const localPath = path.join(WORKERS_BASE, name);

  // Clone repo
  try {
    execSync(`git clone ${repo} "${localPath}" 2>&1`, {
      encoding: 'utf8',
      timeout: 60000
    });
  } catch (e) {
    throw new Error('克隆仓库失败: ' + (e.stderr || e.stdout || e.message).trim());
  }

  // Checkout branch if specified
  if (branch && branch !== 'main' && branch !== 'master') {
    try {
      execSync(`git checkout ${branch} 2>&1`, {
        cwd: localPath, encoding: 'utf8', timeout: 15000
      });
    } catch {}
  }

  const project = { name, repo, branch: branch || 'main', localPath, createdAt: new Date().toISOString(), lastDeploy: null };
  projects.push(project);
  saveProjects(projects);
  return project;
}

function removeProject(name) {
  const projects = getProjects();
  const idx = projects.findIndex(p => p.name === name);
  if (idx === -1) throw new Error('项目不存在');

  const project = projects[idx];

  // Remove local files
  if (fs.existsSync(project.localPath)) {
    fs.rmSync(project.localPath, { recursive: true, force: true });
  }

  // Remove log
  const logFile = path.join(LOGS_DIR, `${name}.log`);
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);

  projects.splice(idx, 1);
  saveProjects(projects);
}

function deploy(name) {
  const projects = getProjects();
  const project = projects.find(p => p.name === name);
  if (!project) throw new Error('项目不存在');

  const localPath = project.localPath;
  if (!fs.existsSync(localPath)) {
    throw new Error('本地代码不存在，请重新添加项目');
  }

  ensureDirs();
  const logFile = path.join(LOGS_DIR, `${name}.log`);

  // 收集日志
  const logs = [];

  // Step 1: git pull
  try {
    const out = execSync(`git pull origin ${project.branch} 2>&1`, {
      cwd: localPath, encoding: 'utf8', timeout: 30000
    });
    logs.push('=== Git Pull ===', out.trim());
  } catch (e) {
    const err = (e.stdout || e.stderr || '').trim() || 'Git pull 失败';
    logs.push('=== Git Pull ===', err);
    fs.writeFileSync(logFile, logs.join('\n'), 'utf8');
    throw new Error(err);
  }

  // Step 2: wrangler deploy
  const env = resolvePath();
  try {
    const out = execSync('npx wrangler deploy 2>&1', {
      cwd: localPath, env, encoding: 'utf8', timeout: 120000
    });
    logs.push('=== Wrangler Deploy ===', out.trim());
  } catch (e) {
    const err = (e.stdout || e.stderr || '').trim() || 'Wrangler deploy 失败';
    logs.push('=== Wrangler Deploy ===', err);
  }

  const fullLog = logs.join('\n');
  fs.writeFileSync(logFile, fullLog, 'utf8');

  // Update last deploy time
  project.lastDeploy = new Date().toISOString();
  saveProjects(getProjects());

  const hasError = fullLog.includes('✘') || fullLog.includes('Error') || fullLog.includes('FAILED');
  return { output: fullLog, success: !hasError };
}

function getDeployLog(name) {
  const logFile = path.join(LOGS_DIR, `${name}.log`);
  if (!fs.existsSync(logFile)) return '';
  return fs.readFileSync(logFile, 'utf8');
}

module.exports = { checkWrangler, getProjects, addProject, removeProject, deploy, getDeployLog };
