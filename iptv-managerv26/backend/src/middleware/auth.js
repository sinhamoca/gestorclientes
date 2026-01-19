/* ========================================
   MIDDLEWARE - AUTENTICAÇÃO JWT
   Valida tokens do sistema principal
   ATUALIZADO: Suporte a issuer/audience
   ======================================== */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// ========== VALIDAÇÃO CRÍTICA ==========
if (!JWT_SECRET) {
  console.error('❌❌❌ ERRO FATAL: JWT_SECRET não configurado! ❌❌❌');
  process.exit(1);
}

if (JWT_SECRET.length < 32) {
  console.error('❌❌❌ ERRO FATAL: JWT_SECRET muito curto! ❌❌❌');
  process.exit(1);
}

console.log('✅ [IPTV-AUTH] JWT_SECRET configurado corretamente');

/**
 * Middleware para validar JWT
 * Extrai token do header Authorization e valida
 * SUPORTA tokens com e sem issuer/audience para compatibilidade
 */
export function authenticateToken(req, res, next) {
  try {
    // Extrair token do header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.warn('⚠️  [IPTV-AUTH] Token não fornecido');
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    // Verificar token
    // Primeiro tenta com issuer/audience (tokens novos)
    jwt.verify(token, JWT_SECRET, { 
      issuer: 'gestao-clientes',
      audience: 'api'
    }, (err, decoded) => {
      if (err) {
        // Se falhar, tenta sem issuer/audience (tokens antigos)
        jwt.verify(token, JWT_SECRET, (err2, decoded2) => {
          if (err2) {
            console.error('❌ [IPTV-AUTH] Token inválido:', err2.message);
            return res.status(403).json({ error: 'Token inválido ou expirado' });
          }

          // Token antigo válido
          req.user = {
            id: decoded2.id || decoded2.userId,
            email: decoded2.email,
            name: decoded2.name,
            role: decoded2.role
          };

          console.log(`✅ [IPTV-AUTH] Usuário autenticado (token antigo): ${req.user.name || req.user.email} (ID: ${req.user.id})`);
          next();
        });
      } else {
        // Token novo válido
        req.user = {
          id: decoded.id || decoded.userId,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role
        };

        console.log(`✅ [IPTV-AUTH] Usuário autenticado (token novo): ${req.user.name || req.user.email} (ID: ${req.user.id})`);
        next();
      }
    });
  } catch (error) {
    console.error('❌ [IPTV-AUTH] Erro ao validar token:', error);
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
    // Tenta com issuer/audience primeiro
    jwt.verify(token, JWT_SECRET, {
      issuer: 'gestao-clientes',
      audience: 'api'
    }, (err, decoded) => {
      if (err) {
        // Tenta sem issuer/audience
        jwt.verify(token, JWT_SECRET, (err2, decoded2) => {
          if (!err2) {
            req.user = {
              id: decoded2.id || decoded2.userId,
              email: decoded2.email,
              name: decoded2.name,
              role: decoded2.role
            };
          }
        });
      } else {
        req.user = {
          id: decoded.id || decoded.userId,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role
        };
      }
    });
  }

  next();
}

export default { authenticateToken, optionalAuth };