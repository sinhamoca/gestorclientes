/* ========================================
   CLUB CONTROLLER
   Endpoints para gerenciar credenciais e clientes Club
   ======================================== */

import * as db from '../database.js';
import ClubService from '../services/clubService.js';

/**
 * Salvar credenciais Club
 * POST /api/club/credentials
 * Body: { username, password }
 */
export async function saveCredentials(req, res) {
  try {
    const userId = req.user.id;
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password são obrigatórios' });
    }

    console.log(`\n💾 [CLUB] Salvando credenciais para user ${userId}`);
    console.log(`   Username: ${username}`);

    // Codificar senha em base64 (mesma estratégia dos outros sistemas)
    const encodedPassword = Buffer.from(password).toString('base64');

    // Salvar no banco
    db.saveClubCredentials(userId, username, encodedPassword);

    console.log('✅ [CLUB] Credenciais salvas com sucesso!\n');

    res.json({ 
      success: true, 
      message: 'Credenciais salvas com sucesso',
      hasCredentials: true
    });

  } catch (error) {
    console.error('❌ [CLUB] Erro ao salvar credenciais:', error);
    res.status(500).json({ error: 'Erro ao salvar credenciais' });
  }
}

/**
 * Buscar credenciais Club
 * GET /api/club/credentials
 */
export async function getCredentials(req, res) {
  try {
    const userId = req.user.id;

    const credentials = db.getClubCredentials(userId);

    if (!credentials) {
      return res.json({ 
        success: true,
        hasCredentials: false 
      });
    }

    // Retornar sem a senha (apenas confirmar que existe)
    res.json({
      success: true,
      hasCredentials: true,
      username: credentials.username
    });

  } catch (error) {
    console.error('❌ [CLUB] Erro ao buscar credenciais:', error);
    res.status(500).json({ error: 'Erro ao buscar credenciais' });
  }
}

/**
 * Deletar credenciais Club
 * DELETE /api/club/credentials
 */
export async function deleteCredentials(req, res) {
  try {
    const userId = req.user.id;

    console.log(`\n🗑️  [CLUB] Deletando credenciais do user ${userId}`);

    db.deleteClubCredentials(userId);

    console.log('✅ [CLUB] Credenciais deletadas com sucesso!\n');

    res.json({ 
      success: true, 
      message: 'Credenciais deletadas com sucesso' 
    });

  } catch (error) {
    console.error('❌ [CLUB] Erro ao deletar credenciais:', error);
    res.status(500).json({ error: 'Erro ao deletar credenciais' });
  }
}

/**
 * Capturar clientes do painel Club
 * POST /api/club/capture-clients
 */
export async function captureClients(req, res) {
  try {
    const userId = req.user.id;

    console.log(`\n📥 [CLUB] Iniciando captura de clientes (user ${userId})`);

    // Buscar credenciais
    const credentials = db.getClubCredentials(userId);

    if (!credentials) {
      return res.status(404).json({ 
        error: 'Credenciais não encontradas. Cadastre suas credenciais primeiro.' 
      });
    }

    // Decodificar senha
    const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');

    // Criar serviço Club
    const service = new ClubService(
      credentials.username,
      decodedPassword,
      process.env.CLUB_ANTICAPTCHA_KEY
    );

    // Fazer login
    console.log('🔑 [CLUB] Fazendo login...');
    await service.login();

    // Listar clientes
    console.log('📋 [CLUB] Buscando clientes...');
    const result = await service.listarClientes();

    if (!result.success) {
      throw new Error('Falha ao listar clientes');
    }

    // Salvar clientes no banco
    console.log(`💾 [CLUB] Salvando ${result.clientes.length} clientes no banco...`);
    db.saveClubClients(userId, result.clientes);

    console.log('✅ [CLUB] Captura concluída com sucesso!\n');

    res.json({
      success: true,
      message: `${result.clientes.length} clientes capturados com sucesso`,
      total: result.total,
      captured: result.clientes.length
    });

  } catch (error) {
    console.error('❌ [CLUB] Erro ao capturar clientes:', error);
    res.status(500).json({ 
      error: 'Erro ao capturar clientes',
      message: error.message 
    });
  }
}

/**
 * Listar clientes capturados
 * GET /api/club/clients
 */
export async function listClients(req, res) {
  try {
    const userId = req.user.id;

    const clients = db.getClubClients(userId);

    res.json({
      success: true,
      total: clients.length,
      clients: clients
    });

  } catch (error) {
    console.error('❌ [CLUB] Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}