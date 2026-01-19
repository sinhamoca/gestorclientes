/* ========================================
   SERVER - IPTV MANAGER BACKEND
   VERSÃO CORRIGIDA
   ======================================== */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { apiLimiter, webhookLimiter } from './middleware/rateLimiter.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webhookRoutes from './routes/webhook.js';
import kofficeFactory from './services/koffice/KofficeRenewalFactory.js';
import cloudnationFactory from './services/cloudnation/CloudNationRenewalFactory.js';
import ghostCleaner from './workers/ghostSessionsCleaner.js';

// Importar rotas cloudnation
import cloudnationRoutes from './routes/cloudnation.js';
import clientsRoutes from './routes/clients.js';
import { authenticateToken } from './middleware/auth.js';

// Importar rotas sigma
import sigmaRoutes from './routes/sigma.js';
import kofficeRoutes from './routes/koffice.js';

// importar rota uniplay
import uniplayRoutes from './routes/uniplay.js';

//rotas painelfoda
import painelfodaRoutes from './routes/painelfoda.js';

//rotas rush
import rushRoutes from './routes/rush.js';

// importar rota club
import clubRoutes from './routes/club.js';

// Importar databases (para inicializar)
import './database.js'; // SQLite
import './postgres.js';  // PostgreSQL

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../../.env') });

const app = express();
app.use(helmet());
const PORT = process.env.BACKEND_PORT || 5001;

// ============= MIDDLEWARES =============

app.use(cors({
  origin: [
    'http://localhost:5000',           // Dev local
    'https://iptv.comprarecarga.shop', // Produção HTTPS
    'http://iptv.comprarecarga.shop',  // Produção HTTP (se necessário)
    'https://comprarecarga.shop'       // Sistema principal (se necessário)
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

console.log('✅ [IPTV] Helmet.js e CORS configurados');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== RATE LIMITING ==========
app.use('/api/', apiLimiter);
app.use('/api/webhooks/', webhookLimiter);

console.log('✅ Rate limiting configurado');

// Logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// ============= ROTAS =============

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'IPTV Manager Backend',
    timestamp: new Date().toISOString() 
  });
});

// Rotas da API
app.use('/api/clients', clientsRoutes);
app.use('/api/cloudnation', cloudnationRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/sigma', sigmaRoutes);
app.use('/api/koffice', kofficeRoutes);
app.use('/api/uniplay', uniplayRoutes);
app.use('/api/club', clubRoutes);
app.use('/api/painelfoda', painelfodaRoutes);
app.use('/api/rush', rushRoutes);

// Endpoint para ver status dos session keepers
app.get('/api/admin/keeper-status', authenticateToken, (req, res) => {
  try {
    const status = {
      cloudnation: cloudnationFactory.getStatus(),
      koffice: kofficeFactory.getStatus(),
      ghostCleaner: ghostCleaner.getStatus(),
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para executar limpeza de sessões fantasmas manualmente
app.post('/api/admin/cleanup-ghost-sessions', authenticateToken, async (req, res) => {
  try {
    console.log('🧹 [ADMIN] Limpeza manual de sessões fantasmas solicitada');
    const removed = await ghostCleaner.runNow();
    
    res.json({
      success: true,
      message: `Limpeza concluída: ${removed} sessão(ões) removida(s)`,
      removed: removed,
      status: ghostCleaner.getStatus()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint não encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ [SERVER] Erro:', err);
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============= INICIALIZAÇÃO =============

// Criar diretório de dados se não existir
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('📁 [SERVER] Diretório de dados criado:', dataDir);
}

// ========== INICIALIZAR FACTORIES (UNIFICADO) ==========
async function initializeFactories() {
  console.log('\n🔧 [SERVER] Inicializando Session Keepers...');
  
  try {
    // Inicializar Koffice Factory
    await kofficeFactory.initialize();
    console.log('✅ [SERVER] Koffice Factory inicializado');
  } catch (error) {
    console.error('⚠️ [SERVER] Erro ao inicializar Koffice Factory:', error.message);
    console.error('   O sistema continuará funcionando, sessões serão criadas sob demanda');
  }
  
  try {
    // Inicializar CloudNation Factory
    await cloudnationFactory.initialize();
    console.log('✅ [SERVER] CloudNation Factory inicializado');
  } catch (error) {
    console.error('⚠️ [SERVER] Erro ao inicializar CloudNation Factory:', error.message);
    console.error('   O sistema continuará funcionando, sessões serão criadas sob demanda');
  }
  
  console.log('🔧 [SERVER] Session Keepers prontos!\n');
  
  // Iniciar Ghost Sessions Cleaner
  ghostCleaner.start();
  console.log('🧹 [SERVER] Ghost Sessions Cleaner iniciado');
}

// ========== GRACEFUL SHUTDOWN (UNIFICADO) ==========
async function gracefulShutdown(signal) {
  console.log(`\n🛑 Recebido ${signal}, salvando sessões...`);
  
  // Parar Ghost Cleaner
  ghostCleaner.stop();
  console.log('✅ Ghost Cleaner parado');
  
  try {
    await kofficeFactory.shutdown();
    console.log('✅ Koffice sessões salvas');
  } catch (error) {
    console.error('⚠️ Erro ao salvar sessões Koffice:', error.message);
  }
  
  try {
    await cloudnationFactory.shutdown();
    console.log('✅ CloudNation sessões salvas');
  } catch (error) {
    console.error('⚠️ Erro ao salvar sessões CloudNation:', error.message);
  }
  
  console.log('✅ Encerrando...');
  process.exit(0);
}

// Registrar handlers de shutdown (APENAS UMA VEZ!)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ========== INICIAR SERVIDOR ==========
(async () => {
  // Inicializar factories ANTES de iniciar o servidor
  await initializeFactories();
  
  // Iniciar servidor HTTP
  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('📺 IPTV MANAGER BACKEND');
    console.log('='.repeat(50));
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API Base URL: http://localhost:${PORT}/api`);
    console.log(`🔐 2Captcha: ${process.env.CAPTCHA_2CAPTCHA_API_KEY ? '✅ Configurado' : '❌ NÃO configurado'}`);
    console.log(`🔑 JWT Secret: ${process.env.JWT_SECRET ? '✅ Configurado' : '❌ NÃO configurado'}`);
    console.log(`🗄️  PostgreSQL: ${process.env.POSTGRES_PASSWORD ? '✅ Configurado' : '❌ NÃO configurado'}`);
    console.log(`💾 SQLite: ✅ Local`);
    console.log(`☁️  CloudNation Mode: ${process.env.CLOUDNATION_RENEWAL_MODE || 'legacy'}`);
    console.log(`🔑 Koffice Mode: ${process.env.KOFFICE_RENEWAL_MODE || 'legacy'}`);
    console.log('='.repeat(50));
    console.log('');
  });
})();

export default app;