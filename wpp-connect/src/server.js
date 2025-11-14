/* ==========================================
   WHATSAPP SERVICE - Servidor Principal
   ========================================== */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import whatsappRoutes from './routes/whatsapp.js';
import wppService from './wppService.js';
import logger from './utils/logger.js';

// Carregar variáveis de ambiente
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;
const API_KEY = process.env.API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Middleware de autenticação
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['apikey'];
  
  if (!apiKey) {
    return res.status(401).json({ 
      success: false, 
      error: 'API Key não fornecida' 
    });
  }
  
  if (apiKey !== API_KEY) {
    return res.status(403).json({ 
      success: false, 
      error: 'API Key inválida' 
    });
  }
  
  next();
};

// Logging de requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ========== ROTAS ==========

// Health check (sem autenticação)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'whatsapp-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Rotas do WhatsApp (com autenticação)
app.use('/api', authMiddleware, whatsappRoutes);

// Rota 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Rota não encontrada' 
  });
});

// Error handler global
app.use((error, req, res, next) => {
  logger.error('❌ Erro não tratado:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Erro interno do servidor' 
  });
});

// ========== INICIALIZAÇÃO ==========

// Cleanup ao desligar
process.on('SIGINT', async () => {
  logger.info('📴 Recebido SIGINT, desligando...');
  await wppService.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('📴 Recebido SIGTERM, desligando...');
  await wppService.closeAll();
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  logger.info('='.repeat(50));
  logger.info('🚀 WhatsApp Service ONLINE');
  logger.info(`📍 Porta: ${PORT}`);
  logger.info(`🔐 API Key: ${API_KEY ? '✅ Configurada' : '❌ NÃO CONFIGURADA'}`);
  logger.info(`📊 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  logger.info(`🖥️  Headless: ${process.env.HEADLESS === 'true' ? 'Sim' : 'Não'}`);
  logger.info('='.repeat(50));
  
  if (!API_KEY) {
    logger.warn('⚠️  ATENÇÃO: API_KEY não configurada! Configure no arquivo .env');
  }
});

export default app;
