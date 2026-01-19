/* ==========================================
   WHATSAPP ROUTES - API Endpoints
   ========================================== */

import express from 'express';
import wppService from '../wppService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /session/create
 * Criar ou reconectar sessão
 */
router.post('/session/create', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId é obrigatório' 
      });
    }

    logger.info(`📱 Request: criar sessão ${sessionId}`);
    
    const result = await wppService.createSession(sessionId);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro em POST /session/create:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /session/status/:sessionId
 * Verificar status e informações da sessão
 */
router.get('/session/status/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`📊 Request: status da sessão ${sessionId}`);
    
    const info = await wppService.getSessionInfo(sessionId);
    
    res.json(info);

  } catch (error) {
    logger.error('❌ Erro em GET /session/status:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /session/disconnect
 * Desconectar sessão
 */
router.post('/session/disconnect', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId é obrigatório' 
      });
    }

    logger.info(`🔌 Request: desconectar sessão ${sessionId}`);
    
    const result = await wppService.disconnect(sessionId);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro em POST /session/disconnect:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * DELETE /session/:sessionId
 * Excluir sessão e tokens
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`🗑️  Request: excluir sessão ${sessionId}`);
    
    const result = await wppService.deleteSession(sessionId);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro em DELETE /session:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /sessions
 * Listar todas as sessões ativas
 */
router.get('/sessions', (req, res) => {
  try {
    logger.info(`📋 Request: listar sessões`);
    
    const sessions = wppService.listSessions();
    
    res.json({ 
      success: true, 
      sessions 
    });

  } catch (error) {
    logger.error('❌ Erro em GET /sessions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /message/send
 * Enviar mensagem de texto
 */
router.post('/message/send', async (req, res) => {
  try {
    const { sessionId, phoneNumber, message } = req.body;
    
    if (!sessionId || !phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId, phoneNumber e message são obrigatórios' 
      });
    }

    logger.info(`📤 Request: enviar mensagem via ${sessionId} para ${phoneNumber}`);
    
    const result = await wppService.sendMessage(sessionId, phoneNumber, message);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro em POST /message/send:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /number/check
 * Verificar se número existe no WhatsApp
 */
router.post('/number/check', async (req, res) => {
  try {
    const { sessionId, phoneNumber } = req.body;
    
    if (!sessionId || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId e phoneNumber são obrigatórios' 
      });
    }

    logger.info(`🔍 Request: verificar número ${phoneNumber} via ${sessionId}`);
    
    const result = await wppService.checkNumberStatus(sessionId, phoneNumber);
    
    res.json(result);

  } catch (error) {
    logger.error('❌ Erro em POST /number/check:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /session/reconnect
 * Reconectar sessão sem precisar de QR Code
 * (usa tokens salvos)
 */
router.post('/session/reconnect', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ 
        success: false, 
        error: 'sessionId é obrigatório' 
      });
    }

    logger.info(`🔄 Request: reconectar sessão ${sessionId}`);
    
    const result = await wppService.reconnect(sessionId);
    
    res.json({
      success: true,
      message: 'Reconexão iniciada',
      ...result
    });

  } catch (error) {
    logger.error('❌ Erro em POST /session/reconnect:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /health
 * Status do serviço e sessões
 */
router.get('/health', async (req, res) => {
  try {
    const sessions = wppService.listSessions();
    const sessionStatuses = [];
    
    for (const session of sessions) {
      try {
        const info = await wppService.getSessionInfo(session.sessionId);
        sessionStatuses.push({
          sessionId: session.sessionId,
          source: session.source,
          ...info
        });
      } catch (error) {
        sessionStatuses.push({
          sessionId: session.sessionId,
          source: session.source,
          connected: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      service: 'whatsapp-service',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      sessions: {
        total: sessions.length,
        connected: sessionStatuses.filter(s => s.connected).length,
        disconnected: sessionStatuses.filter(s => !s.connected).length,
        details: sessionStatuses
      }
    });

  } catch (error) {
    logger.error('❌ Erro em GET /health:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /session/cleanup
 * Limpar sessões travadas (matar Chrome órfão)
 */
router.post('/session/cleanup', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    logger.info(`🧹 Request: cleanup de ${sessionId || 'todas as sessões'}`);
    
    if (sessionId) {
      // Cleanup de sessão específica
      await wppService._forceCloseSession(sessionId);
      res.json({ 
        success: true, 
        message: `Sessão ${sessionId} limpa com sucesso` 
      });
    } else {
      // Cleanup geral de Chrome órfãos
      await wppService._cleanupOrphanedChrome();
      res.json({ 
        success: true, 
        message: 'Cleanup geral realizado' 
      });
    }

  } catch (error) {
    logger.error('❌ Erro em POST /session/cleanup:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /session/:sessionId/config
 * Atualizar configurações da sessão (rejectCalls, alwaysOnline)
 */
router.post('/session/:sessionId/config', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rejectCalls, rejectCallMessage, alwaysOnline } = req.body;
    
    logger.info(`⚙️ Request: atualizar config de ${sessionId}`);
    logger.info(`   rejectCalls: ${rejectCalls}`);
    logger.info(`   alwaysOnline: ${alwaysOnline}`);
    
    // Salvar configurações no serviço
    wppService.setSessionConfig(sessionId, {
      rejectCalls: rejectCalls || false,
      rejectCallMessage: rejectCallMessage || 'Desculpe, não recebo chamadas por aqui. Me envie uma mensagem! 📱',
      alwaysOnline: alwaysOnline || false
    });

    // Se a sessão já existe, aplicar configurações imediatamente
    const sessionExists = wppService.sessions.has(sessionId);
    if (sessionExists) {
      await wppService.applySessionConfig(sessionId);
      logger.info(`   ✅ Configurações aplicadas na sessão ativa`);
    } else {
      logger.info(`   ℹ️ Sessão não está ativa, configs serão aplicadas na próxima conexão`);
    }
    
    res.json({ 
      success: true, 
      message: 'Configurações atualizadas com sucesso',
      applied: sessionExists,
      config: wppService.getSessionConfig(sessionId)
    });

  } catch (error) {
    logger.error('❌ Erro em POST /session/:sessionId/config:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /session/:sessionId/config
 * Obter configurações da sessão
 */
router.get('/session/:sessionId/config', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.info(`⚙️ Request: obter config de ${sessionId}`);
    
    const config = wppService.getSessionConfig(sessionId);
    
    res.json({ 
      success: true, 
      config 
    });

  } catch (error) {
    logger.error('❌ Erro em GET /session/:sessionId/config:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;