function ts() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function log(level, tag, msg, err) {
  const extra = err ? (err.stack ? '\n' + err.stack : '') : '';
  process.stderr.write(`[${ts()}] [${level}] [${tag}] ${msg}${extra}\n`);
}

module.exports = {
  info(tag, msg) {
    log('INFO', tag, msg);
  },
  warn(tag, msg) {
    log('WARN', tag, msg);
  },
  error(tag, msg, err) {
    log('ERROR', tag, msg, err || null);
  }
};
