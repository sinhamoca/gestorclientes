// ==========================================
// WHATSAPP-WEB.JS SERVICE - SERVER
// ==========================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const logger = require('./logger');
const wwebService = require('./wwebService');
const authMiddleware = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 9100;

// Middlewares
app.use(cors());
app.use(express.json());

// ==========================================
// ROTAS PÚBLICAS
// ==========================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'whatsapp-web.js',
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// ROTAS PROTEGIDAS (requerem API Key)
// ==========================================

// Criar sessão
app.post('/api/session/create', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'sessionId é obrigatório'
      });
    }

    logger.info(`📥 Requisição para criar sessão: ${sessionId}`);

    const result = await wwebService.createSession(sessionId);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro ao criar sessão:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obter status da sessão
app.get('/api/session/status/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const status = await wwebService.getSessionStatus(sessionId);
    
    res.json({
      success: true,
      sessionId,
      ...status
    });

  } catch (error) {
    logger.error('❌ Erro ao obter status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Obter QR Code
app.get('/api/session/qr/:sessionId', authMiddleware, (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const qr = wwebService.getQRCode(sessionId);
    
    if (!qr) {
      return res.status(404).json({
        success: false,
        error: 'QR Code não disponível para esta sessão'
      });
    }

    res.json({
      success: true,
      sessionId,
      qr
    });

  } catch (error) {
    logger.error('❌ Erro ao obter QR Code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Desconectar sessão
app.delete('/api/session/disconnect/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`📥 Requisição para desconectar: ${sessionId}`);
    
    const result = await wwebService.disconnectSession(sessionId);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro ao desconectar:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Listar sessões
app.get('/api/session/list', authMiddleware, (req, res) => {
  try {
    const sessions = wwebService.listSessions();
    
    res.json({
      success: true,
      sessions
    });

  } catch (error) {
    logger.error('❌ Erro ao listar sessões:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enviar mensagem
app.post('/api/message/send', authMiddleware, async (req, res) => {
  try {
    const { sessionId, to, message } = req.body;

    if (!sessionId || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId, to e message são obrigatórios'
      });
    }

    logger.info(`📥 Requisição para enviar mensagem de ${sessionId} para ${to}`);

    const result = await wwebService.sendMessage(sessionId, to, message);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro ao enviar mensagem:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// TRATAMENTO DE ERROS
// ==========================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Rota não encontrada'
  });
});

app.use((err, req, res, next) => {
  logger.error('❌ Erro interno:', err);
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor'
  });
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info('==========================================');
  logger.info('🚀 WHATSAPP-WEB.JS SERVICE');
  logger.info('==========================================');
  logger.info(`📡 Servidor rodando na porta ${PORT}`);
  logger.info(`🔐 API Key configurada: ${process.env.API_KEY ? '✅' : '❌'}`);
  logger.info(`📁 Sessões: ${wwebService.sessionsPath}`);
  logger.info('==========================================');
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('🛑 Desligando servidor...');
  
  server.close(async () => {
    await wwebService.cleanup();
    process.exit(0);
  });

  // Forçar saída após 10s
  setTimeout(() => {
    logger.error('⏰ Timeout no shutdown, forçando saída...');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
