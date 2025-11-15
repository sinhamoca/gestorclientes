// ==========================================
// AUTH MIDDLEWARE
// ==========================================

const logger = require('./logger');

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    logger.warn('❌ Tentativa de acesso sem API Key');
    return res.status(401).json({
      success: false,
      error: 'API Key não fornecida'
    });
  }

  if (apiKey !== process.env.API_KEY) {
    logger.warn(`❌ API Key inválida: ${apiKey.substring(0, 10)}...`);
    return res.status(403).json({
      success: false,
      error: 'API Key inválida'
    });
  }

  next();
};

module.exports = authMiddleware;
