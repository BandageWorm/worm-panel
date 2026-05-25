const { verifyToken } = require('../utils/crypto');

module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  try {
    const payload = verifyToken(header.slice(7));
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
};
