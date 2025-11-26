/* ========================================
   RUSH ROUTES
   Rotas para credenciais Rush
   
   ARQUIVO: backend/src/routes/rush.js
   
   Padrão igual ao Uniplay:
   - 1 credencial por usuário
   - CRUD simples
   ======================================== */

import express from 'express';
import * as db from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * GET /api/rush/credentials
 * Buscar credencial Rush do usuário
 */
router.get('/credentials', (req, res) => {
  try {
    const credentials = db.getRushCredentials(req.user.id);
    
    if (!credentials) {
      return res.json({ has_credentials: false });
    }
    
    res.json({
      has_credentials: true,
      username: credentials.username,
      // NÃO enviar senha no GET
      created_at: credentials.created_at,
      updated_at: credentials.updated_at
    });
  } catch (error) {
    console.error('Erro ao buscar credenciais Rush:', error);
    res.status(500).json({ error: 'Erro ao buscar credenciais' });
  }
});

/**
 * POST /api/rush/credentials
 * Salvar credencial Rush
 */
router.post('/credentials', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    db.saveRushCredential(req.user.id, username, password);
    
    res.json({ 
      success: true,
      message: 'Credencial Rush salva com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao salvar credencial Rush:', error);
    res.status(500).json({ error: 'Erro ao salvar credencial' });
  }
});

/**
 * PUT /api/rush/credentials
 * Atualizar credencial Rush
 */
router.put('/credentials', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    db.updateRushCredential(req.user.id, username, password);
    
    res.json({ 
      success: true,
      message: 'Credencial Rush atualizada com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao atualizar credencial Rush:', error);
    res.status(500).json({ error: 'Erro ao atualizar credencial' });
  }
});

/**
 * DELETE /api/rush/credentials
 * Deletar credencial Rush
 */
router.delete('/credentials', (req, res) => {
  try {
    db.deleteRushCredential(req.user.id);
    
    res.json({ 
      success: true,
      message: 'Credencial Rush removida com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao deletar credencial Rush:', error);
    res.status(500).json({ error: 'Erro ao deletar credencial' });
  }
});

/**
 * POST /api/rush/test-connection
 * Testar conexão com as credenciais
 */
router.post('/test-connection', async (req, res) => {
  try {
    const credentials = db.getRushCredentials(req.user.id);
    
    if (!credentials) {
      return res.status(404).json({ 
        success: false,
        error: 'Credenciais não configuradas' 
      });
    }

    // Importar o service
    const RushRenewalService = (await import('../services/rush-renewal.js')).default;
    
    const service = new RushRenewalService(
      credentials.username,
      credentials.password
    );
    
    // Tentar login
    await service.login();
    
    // Se chegou aqui, login OK
    res.json({
      success: true,
      message: 'Conexão testada com sucesso!',
      user_data: service.userData
    });

  } catch (error) {
    console.error('Erro ao testar conexão Rush:', error);
    res.status(400).json({ 
      success: false,
      error: error.message || 'Falha na conexão'
    });
  }
});

export default router;
