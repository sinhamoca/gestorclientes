/* ========================================
   MIDDLEWARE - AUTENTICAÇÃO JWT
   Valida tokens do sistema principal
   ======================================== */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware para validar JWT
 * Extrai token do header Authorization e valida
 */
export function authenticateToken(req, res, next) {
  try {
    // Extrair token do header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.warn('⚠️  [AUTH] Token não fornecido');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Verificar token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error('❌ [AUTH] Token inválido:', err.message);
        return res.status(403).json({ error: 'Token inválido ou expirado' });
      }

      // Adiciona dados do usuário na request
      req.user = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        name: decoded.name
      };

      console.log(`✅ [AUTH] Usuário autenticado: ${req.user.name} (ID: ${req.user.id})`);
      next();
    });
  } catch (error) {
    console.error('❌ [AUTH] Erro ao validar token:', error);
    res.status(500).json({ error: 'Erro ao validar token' });
  }
}

/**
 * Middleware opcional - não bloqueia se não tiver token
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) {
        req.user = {
          id: decoded.id || decoded.userId,
          email: decoded.email,
          name: decoded.name
        };
      }
    });
  }

  next();
}

export default { authenticateToken, optionalAuth };
