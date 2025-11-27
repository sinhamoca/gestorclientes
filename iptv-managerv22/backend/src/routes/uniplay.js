import express from 'express';
import * as db from '../database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * GET /api/uniplay/credentials
 * Buscar credencial Uniplay do usuário
 */
router.get('/credentials', (req, res) => {
  try {
    const credentials = db.getUniplayCredentials(req.user.id);
    
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
    console.error('Erro ao buscar credenciais Uniplay:', error);
    res.status(500).json({ error: 'Erro ao buscar credenciais' });
  }
});

/**
 * POST /api/uniplay/credentials
 * Salvar credencial Uniplay
 */
router.post('/credentials', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    db.saveUniplayCredential(req.user.id, username, password);
    
    res.json({ 
      success: true,
      message: 'Credencial Uniplay salva com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao salvar credencial Uniplay:', error);
    res.status(500).json({ error: 'Erro ao salvar credencial' });
  }
});

/**
 * PUT /api/uniplay/credentials
 * Atualizar credencial Uniplay
 */
router.put('/credentials', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }
    
    db.updateUniplayCredential(req.user.id, username, password);
    
    res.json({ 
      success: true,
      message: 'Credencial Uniplay atualizada com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao atualizar credencial Uniplay:', error);
    res.status(500).json({ error: 'Erro ao atualizar credencial' });
  }
});

/**
 * DELETE /api/uniplay/credentials
 * Deletar credencial Uniplay
 */
router.delete('/credentials', (req, res) => {
  try {
    db.deleteUniplayCredential(req.user.id);
    
    res.json({ 
      success: true,
      message: 'Credencial Uniplay removida com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao deletar credencial Uniplay:', error);
    res.status(500).json({ error: 'Erro ao deletar credencial' });
  }
});

export default router;
