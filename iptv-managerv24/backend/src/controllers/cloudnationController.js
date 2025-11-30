/* ========================================
   CLOUDNATION CONTROLLER
   Gerencia credenciais e importação
   ======================================== */

import CloudNationService from '../services/cloudnation.js';
import * as db from '../database.js';
import fs from 'fs';

const CAPTCHA_API_KEY = process.env.CAPTCHA_2CAPTCHA_API_KEY;

/**
 * Salvar credenciais do CloudNation
 * POST /api/cloudnation/credentials
 */
export async function saveCredentials(req, res) {
  try {
    const { username, password } = req.body;
    const userId = req.user.id;

    console.log(`💾 [CN-CTRL] Salvando credenciais para user ${userId}`);
    console.log(`📝 [CN-CTRL] Body recebido:`, { 
      username: username || 'VAZIO', 
      password: password ? '***' : 'VAZIO',
      bodyKeys: Object.keys(req.body)
    });

    if (!username || !password) {
      console.log(`❌ [CN-CTRL] Validação falhou: username=${!!username}, password=${!!password}`);
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    console.log(`✅ [CN-CTRL] Validação OK, salvando...`);

    // Salvar senha em base64 (simples encoding, não é criptografia forte)
    const encodedPassword = Buffer.from(password).toString('base64');

    // Salvar no banco
    db.saveCredentials(userId, username, encodedPassword);

    console.log(`✅ [CN-CTRL] Credenciais salvas`);

    res.json({ 
      success: true, 
      message: 'Credenciais salvas com sucesso' 
    });

  } catch (error) {
    console.error('❌ [CN-CTRL] Erro ao salvar credenciais:', error);
    res.status(500).json({ error: 'Erro ao salvar credenciais' });
  }
}

/**
 * Buscar credenciais do CloudNation (sem retornar senha)
 * GET /api/cloudnation/credentials
 */
export async function getCredentials(req, res) {
  try {
    const userId = req.user.id;

    console.log(`🔍 [CN-CTRL] Buscando credenciais do user ${userId}`);

    const credentials = db.getCredentials(userId);

    if (!credentials) {
      return res.json({ 
        hasCredentials: false,
        message: 'Nenhuma credencial cadastrada' 
      });
    }

    // Não retornar a senha
    const { password, ...credentialsWithoutPassword } = credentials;

    res.json({
      hasCredentials: true,
      credentials: credentialsWithoutPassword
    });

  } catch (error) {
    console.error('❌ [CN-CTRL] Erro ao buscar credenciais:', error);
    res.status(500).json({ error: 'Erro ao buscar credenciais' });
  }
}

/**
 * Importar clientes do CloudNation
 * POST /api/cloudnation/import-clients
 */
export async function importClients(req, res) {
  try {
    const userId = req.user.id;

    console.log(`📥 [CN-CTRL] Iniciando importação para user ${userId}`);

    // Verificar se tem credenciais
    const credentials = db.getCredentials(userId);
    
    if (!credentials) {
      return res.status(400).json({ 
        error: 'Você precisa cadastrar suas credenciais primeiro' 
      });
    }

    // Verificar se tem API key do 2Captcha
    if (!CAPTCHA_API_KEY || CAPTCHA_API_KEY === 'SUA_CHAVE_2CAPTCHA_AQUI') {
      return res.status(500).json({ 
        error: 'API Key do 2Captcha não configurada no servidor' 
      });
    }

    // Decodificar senha
    const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');
    
    console.log('🔐 [CN-CTRL] Iniciando CloudNation Service...');
    
    const service = new CloudNationService(
      credentials.username,
      decodedPassword,
      CAPTCHA_API_KEY
    );

    // Fazer login
    console.log('🔑 [CN-CTRL] Fazendo login no CloudNation...');
    await service.login();

    // Importar clientes
    console.log('📥 [CN-CTRL] Importando clientes...');
    const clientes = await service.importarClientes();

    // Salvar no banco SQLite
    console.log('💾 [CN-CTRL] Salvando clientes no banco SQLite...');
    db.saveClients(userId, clientes);

    // Salvar em JSON para sincronização
    console.log('💾 [CN-CTRL] Salvando clientes em JSON...');
    const jsonPath = `/app/data/cloudnation-clients-${userId}.json`;
    const jsonData = {
      user_id: userId,
      total_clients: clientes.length,
      imported_at: new Date().toISOString(),
      clients: clientes
    };
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log(`✅ [CN-CTRL] JSON salvo em: ${jsonPath}`);

    console.log(`✅ [CN-CTRL] Importação concluída: ${clientes.length} clientes`);

    res.json({
      success: true,
      message: `${clientes.length} clientes importados com sucesso`,
      total: clientes.length,
      clientes: clientes.map(c => ({
        id: c.id,
        nome: c.nome,
        dataVencimento: c.dataVencimento
      }))
    });

  } catch (error) {
    console.error('❌ [CN-CTRL] Erro ao importar clientes:', error);
    res.status(500).json({ 
      error: 'Erro ao importar clientes: ' + error.message 
    });
  }
}

/**
 * Listar clientes importados do JSON
 * GET /api/cloudnation/clients
 */
export async function listClients(req, res) {
  try {
    const userId = req.user.id;

    console.log(`📋 [CN-CTRL] Listando clientes do user ${userId} (do JSON)`);

    const jsonPath = `/app/data/cloudnation-clients-${userId}.json`;
    
    // Verificar se arquivo existe
    if (!fs.existsSync(jsonPath)) {
      console.log(`⚠️ [CN-CTRL] JSON não encontrado: ${jsonPath}`);
      return res.json({
        success: true,
        stats: {
          total: 0,
          active: 0,
          lastImport: null
        },
        clients: []
      });
    }

    // Ler JSON
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    
    console.log(`✅ [CN-CTRL] ${jsonData.clients?.length || 0} clientes encontrados no JSON`);

    res.json({
      success: true,
      stats: {
        total: jsonData.total_clients || 0,
        active: jsonData.clients?.filter(c => c.isActive).length || 0,
        lastImport: jsonData.imported_at
      },
      clients: jsonData.clients || []
    });

  } catch (error) {
    console.error('❌ [CN-CTRL] Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

/**
 * Deletar credenciais e dados
 * DELETE /api/cloudnation/credentials
 */
export async function deleteCredentials(req, res) {
  try {
    const userId = req.user.id;

    console.log(`🗑️  [CN-CTRL] Deletando dados do user ${userId}`);

    db.deleteUserData(userId);

    console.log(`✅ [CN-CTRL] Dados deletados`);

    res.json({ 
      success: true, 
      message: 'Credenciais e dados deletados com sucesso' 
    });

  } catch (error) {
    console.error('❌ [CN-CTRL] Erro ao deletar dados:', error);
    res.status(500).json({ error: 'Erro ao deletar dados' });
  }
}

export default {
  saveCredentials,
  getCredentials,
  importClients,
  listClients,
  deleteCredentials
};