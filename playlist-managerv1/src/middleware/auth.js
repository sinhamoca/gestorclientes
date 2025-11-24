const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'Token não fornecido',
        message: 'Faça login no sistema principal primeiro' 
      });
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2) {
      return res.status(401).json({ 
        error: 'Token malformatado' 
      });
    }

    const [scheme, token] = parts;

    if (!/^Bearer$/i.test(scheme)) {
      return res.status(401).json({ 
        error: 'Token malformatado' 
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ 
          error: 'Token inválido',
          message: 'Sua sessão expirou. Faça login novamente.' 
        });
      }

      // Adiciona informações do usuário na requisição
      req.userId = decoded.userId || decoded.id;
      req.userEmail = decoded.email;
      
      return next();
    });
  } catch (error) {
    return res.status(401).json({ 
      error: 'Erro na autenticação',
      message: error.message 
    });
  }
};

module.exports = authMiddleware;
