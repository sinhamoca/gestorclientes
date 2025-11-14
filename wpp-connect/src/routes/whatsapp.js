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

export default router;