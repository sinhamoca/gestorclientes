require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar rotas
const authRoutes = require('./routes/auth.routes');
const clientsRoutes = require('./routes/clients.routes');
const playersRoutes = require('./routes/players.routes');

// Importar configuração do banco
const pool = require('./config/database');

// Inicializar Express
const app = express();
const PORT = process.env.PORT || 3005;

// Trust proxy - necessário quando atrás do Nginx
app.set('trust proxy', 1);

// ========== CONFIGURAÇÕES DE SEGURANÇA ==========

// Helmet - Segurança de headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.GESTAO_CLIENTES_URL, process.env.FRONTEND_URL],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configurado
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGINS 
      ? process.env.CORS_ORIGINS.split(',') 
      : ['http://localhost:3000', 'http://localhost:4000'];
    
    // Permitir requisições sem origin (ex: Postman, mobile apps)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Não permitido pelo CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // 10 minutos
};

app.use(cors(corsOptions));

// Rate Limiting - Prevenir abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Rate limiting mais restritivo para login (captcha é caro!)
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 logins por hora
  message: 'Muitas tentativas de login, tente novamente mais tarde.',
});

app.use('/api/players/*/login', loginLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// ========== ROTAS ==========

// Health check (sem autenticação)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'IPTV Playlist Manager'
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/players', playersRoutes);

// Rota raiz serve o frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ========== TRATAMENTO DE ERROS ==========

// Rota não encontrada
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.path 
  });
});

// Handler de erros global
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err);
  
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ========== INICIALIZAÇÃO DO SERVIDOR ==========

async function startServer() {
  try {
    // Testar conexão com o banco
    await pool.query('SELECT NOW()');
    console.log('✅ Conexão com PostgreSQL estabelecida');

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log('║     IPTV Playlist Manager - Servidor Ativo      ║');
      console.log('╠══════════════════════════════════════════════════╣');
      console.log(`║  Porta:        ${PORT}                              ║`);
      console.log(`║  Ambiente:     ${process.env.NODE_ENV}                ║`);
      console.log(`║  URL:          http://localhost:${PORT}              ║`);
      console.log('╚══════════════════════════════════════════════════╝');
      console.log('');
      console.log('📋 Endpoints disponíveis:');
      console.log('   GET  /health');
      console.log('   GET  /api/clients');
      console.log('   POST /api/players/iboplayer/login');
      console.log('   POST /api/players/ibopro/login');
      console.log('   POST /api/players/vuplayer/login');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Tratamento de sinais de encerramento
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando servidor...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Encerrando servidor...');
  await pool.end();
  process.exit(0);
});

// Iniciar
startServer();
