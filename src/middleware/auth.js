const { verifyToken } = require('../utils/crypto');

// 仅这两个下载端点允许用 ?ticket= 鉴权：
// 浏览器原生下载（a[href]）无法设置请求头，用短时效票据替代 Bearer token。
const TICKET_ENDPOINTS = new Set(['/api/drive/download', '/api/files/download']);

function readTicket(req) {
  if (!TICKET_ENDPOINTS.has(req.originalUrl.split('?')[0])) return null;
  const ticket = req.query.ticket;
  return typeof ticket === 'string' && ticket ? ticket : null;
}

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  const ticket = bearer ? null : readTicket(req);

  if (!bearer && !ticket) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const payload = verifyToken(bearer || ticket);
    // 票据必须是一次下载用途，且只能下载签发时指定的那一个路径
    if (ticket && (payload.scope !== 'download' || payload.p !== req.query.path)) {
      return res.status(401).json({ error: '下载票据无效' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
};
