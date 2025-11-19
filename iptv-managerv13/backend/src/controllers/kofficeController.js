/* ========================================
   KOFFICE CONTROLLER
   Gerencia credenciais e captura de clientes
   ======================================== */

import KofficeService from '../services/kofficeService.js';
import * as db from '../database.js';
import fs from 'fs';
import path from 'path';

/**
 * Salvar credencial Koffice
 * POST /api/koffice/credentials
 * 
 * Body: {
 *   domain: "https://daily3.news",
 *   username: "admin",
 *   password: "senha123",
 *   reseller_id: "8186"
 * }
 */
export async function saveCredential(req, res) {
  try {
    const userId = req.user.id;
    const { domain, username, password, reseller_id } = req.body;
    
    // Validação
    if (!domain || !username || !password || !reseller_id) {
      return res.status(400).json({ 
        error: 'Todos os campos são obrigatórios',
        required: ['domain', 'username', 'password', 'reseller_id']
      });
    }
    
    // Validar formato do domínio
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      return res.status(400).json({ 
        error: 'Domínio deve começar com http:// ou https://' 
      });
    }
    
    console.log(`💾 [KOFFICE] Salvando credencial para ${domain}`);
    
    // Salvar no banco
    db.saveKofficeCredential(userId, domain, username, password, reseller_id);
    
    console.log(`✅ [KOFFICE] Credencial salva: ${domain} (Reseller: ${reseller_id})`);
    
    res.json({
      success: true,
      message: 'Credencial Koffice salva com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao salvar credencial:', error);
    res.status(500).json({ 
      error: 'Erro ao salvar credencial',
      details: error.message 
    });
  }
}

/**
 * Listar credenciais Koffice
 * GET /api/koffice/credentials
 */
export async function listCredentials(req, res) {
  try {
    const userId = req.user.id;
    
    const credentials = db.getKofficeCredentials(userId);
    
    // Não retornar senha completa
    const sanitized = credentials.map(cred => ({
      id: cred.id,
      domain: cred.domain,
      username: cred.username,
      reseller_id: cred.reseller_id,
      password: '***',
      created_at: cred.created_at,
      updated_at: cred.updated_at
    }));
    
    res.json({
      success: true,
      credentials: sanitized
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao listar credenciais:', error);
    res.status(500).json({ 
      error: 'Erro ao listar credenciais' 
    });
  }
}

/**
 * Atualizar credencial Koffice
 * PUT /api/koffice/credentials/:id
 * 
 * Body: {
 *   username: "novo_usuario",
 *   password: "nova_senha",
 *   reseller_id: "9999"
 * }
 */
export async function updateCredential(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { username, password, reseller_id } = req.body;
    
    console.log(`🔄 [KOFFICE] Atualizando credencial ID ${id}`);
    
    // Buscar credencial existente
    const existing = db.getKofficeCredentialById(userId, id);
    
    if (!existing) {
      return res.status(404).json({ 
        error: 'Credencial não encontrada' 
      });
    }
    
    // Atualizar
    db.updateKofficeCredential(
      userId, 
      id, 
      username || existing.username,
      password || existing.password,
      reseller_id || existing.reseller_id
    );
    
    console.log(`✅ [KOFFICE] Credencial ${id} atualizada`);
    
    res.json({
      success: true,
      message: 'Credencial atualizada com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao atualizar credencial:', error);
    res.status(500).json({ 
      error: 'Erro ao atualizar credencial' 
    });
  }
}

/**
 * Deletar credencial Koffice
 * DELETE /api/koffice/credentials/:id
 */
export async function deleteCredential(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    console.log(`🗑️ [KOFFICE] Deletando credencial ID ${id}`);
    
    db.deleteKofficeCredential(userId, id);
    
    console.log(`✅ [KOFFICE] Credencial ${id} deletada`);
    
    res.json({
      success: true,
      message: 'Credencial deletada com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao deletar credencial:', error);
    res.status(500).json({ 
      error: 'Erro ao deletar credencial' 
    });
  }
}

/**
 * Capturar clientes de um domínio Koffice
 * POST /api/koffice/capture-clients
 * 
 * Body: {
 *   domain: "https://daily3.news"
 * }
 */
export async function captureClients(req, res) {
  try {
    const userId = req.user.id;
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ 
        error: 'Domínio é obrigatório' 
      });
    }
    
    console.log(`📥 [KOFFICE] Iniciando captura de clientes de ${domain}`);
    
    // Buscar credenciais do domínio
    const credential = db.getKofficeCredentialByDomain(userId, domain);
    
    if (!credential) {
      return res.status(404).json({ 
        error: 'Credenciais não encontradas para este domínio',
        message: 'Cadastre as credenciais primeiro'
      });
    }
    
    console.log(`✅ [KOFFICE] Credenciais encontradas (Reseller: ${credential.reseller_id})`);
    
    // Criar serviço Koffice
    const service = new KofficeService(
      domain,
      credential.username,
      credential.password,
      credential.reseller_id
    );
    
    // Fazer login
    console.log(`🔑 [KOFFICE] Fazendo login em ${domain}...`);
    await service.login();
    console.log(`✅ [KOFFICE] Login realizado com sucesso!`);
    
    // Capturar clientes
    console.log(`📥 [KOFFICE] Capturando clientes do revendedor ${credential.reseller_id}...`);
    const clients = await service.fetchAllClients(credential.reseller_id);
    
    // Salvar no SQLite
    console.log(`💾 [KOFFICE] Salvando ${clients.length} clientes no banco SQLite...`);
    db.saveKofficeClients(userId, domain, credential.reseller_id, clients);
    
    // Salvar JSON para backup
    const jsonDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    const jsonPath = path.join(jsonDir, `koffice-clients-${userId}-${Date.now()}.json`);
    const jsonData = {
      user_id: userId,
      domain: domain,
      reseller_id: credential.reseller_id,
      data_captura: new Date().toISOString(),
      total_clientes: clients.length,
      clientes: clients
    };
    
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`✅ [KOFFICE] JSON backup salvo em: ${jsonPath}`);
    
    // Estatísticas
    const hoje = new Date();
    const ativos = clients.filter(c => {
      const expiry = new Date(c.expiry_date);
      return expiry >= hoje;
    }).length;
    const inativos = clients.length - ativos;
    
    console.log(`✅ [KOFFICE] Captura concluída!`);
    console.log(`   📊 Total: ${clients.length}`);
    console.log(`   ✅ Ativos: ${ativos}`);
    console.log(`   ❌ Inativos: ${inativos}`);
    
    res.json({
      success: true,
      message: `${clients.length} clientes capturados com sucesso`,
      total: clients.length,
      ativos: ativos,
      inativos: inativos,
      domain: domain,
      reseller_id: credential.reseller_id
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao capturar clientes:', error);
    res.status(500).json({ 
      error: 'Erro ao capturar clientes',
      details: error.message 
    });
  }
}

/**
 * Listar clientes capturados de um domínio
 * GET /api/koffice/clients?domain=xxx
 */
export async function listClients(req, res) {
  try {
    const userId = req.user.id;
    const domain = req.query.domain;
    
    if (!domain) {
      return res.status(400).json({ 
        error: 'Domain é obrigatório' 
      });
    }
    
    const decodedDomain = decodeURIComponent(domain);
    const clients = db.getKofficeClients(userId, decodedDomain);
    const stats = db.getKofficeClientStats(userId, decodedDomain);
    
    res.json({
      success: true,
      domain: decodedDomain,
      stats: stats || { total: 0, active: 0, inactive: 0 },
      clients: clients
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao listar clientes:', error);
    res.status(500).json({ 
      error: 'Erro ao listar clientes' 
    });
  }
}

/**
 * Listar domínios com clientes capturados
 * GET /api/koffice/domains
 */
export async function listDomainsWithClients(req, res) {
  try {
    const userId = req.user.id;
    
    const domains = db.getKofficeDomainsWithClients(userId);
    
    res.json({
      success: true,
      domains: domains
    });
    
  } catch (error) {
    console.error('❌ [KOFFICE] Erro ao listar domínios:', error);
    res.status(500).json({ 
      error: 'Erro ao listar domínios' 
    });
  }
}

export default {
  saveCredential,
  listCredentials,
  updateCredential,
  deleteCredential,
  captureClients,
  listClients,
  listDomainsWithClients
};
