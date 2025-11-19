import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

// Verificação crítica na inicialização
if (!JWT_SECRET) {
  console.error('❌❌❌ ERRO FATAL: JWT_SECRET não configurado! ❌❌❌');
  console.error('Configure JWT_SECRET no arquivo .env antes de iniciar o sistema.');
  process.exit(1); // Para o sistema imediatamente
}

if (JWT_SECRET.length < 32) {
  console.error('❌❌❌ ERRO FATAL: JWT_SECRET muito curto! ❌❌❌');
  console.error('Use um secret de pelo menos 32 caracteres (recomendado 64).');
  process.exit(1);
}

console.log('✅ JWT_SECRET configurado corretamente');

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role 
    },
    JWT_SECRET,
    {
      expiresIn: '24h',  // 24 horas é mais seguro
      issuer: 'gestao-clientes',
      audience: 'api'
    }
  );
}

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
  next();
}
