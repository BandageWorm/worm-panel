function ts() {
  return new Date().toISOString().replace('T', ' ').replace('Z', '');
}

function write(level, tag, text) {
  console.error(`[${ts()}] [${level}] [${tag}] ${text}`);
}

module.exports = {
  info(tag, msg) {
    write('INFO', tag, msg);
  },
  warn(tag, msg) {
    write('WARN', tag, msg);
  },
  error(tag, msg, err) {
    let text = msg;
    if (err) {
      text += ' → ' + (err.message || err);
      if (err.stack) {
        text += '\n' + err.stack;
      }
    }
    write('ERROR', tag, text);
  }
};
