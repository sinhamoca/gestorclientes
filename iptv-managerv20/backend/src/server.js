/* ========================================
   SERVER - IPTV MANAGER BACKEND
   VERSÃO CORRIGIDA - Linha duplicada removida
   ======================================== */

import express from 'express';
import helmet from 'helmet';  // ← ADICIONAR
import cors from 'cors';
import { apiLimiter, webhookLimiter } from './middleware/rateLimiter.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import webhookRoutes from './routes/webhook.js';  


// Importar rotas cloudnation
import cloudnationRoutes from './routes/cloudnation.js';
import clientsRoutes from './routes/clients.js';
import { authenticateToken } from './middleware/auth.js';

// Importar rotas sigma
import sigmaRoutes from './routes/sigma.js';
import kofficeRoutes from './routes/koffice.js';

// importar rota uniplay
import uniplayRoutes from './routes/uniplay.js';  // ← ADICIONAR

import painelfodaRoutes from './routes/painelfoda.js';


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


// REMOVIDA: app.post('/api/sigma/sync', ...) - Já está dentro de sigmaRoutes

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

// Iniciar servidor
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
  console.log('='.repeat(50));
  console.log('');
});

export default app;
