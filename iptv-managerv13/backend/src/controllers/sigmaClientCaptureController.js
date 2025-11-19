/* ========================================
   SIGMA CLIENT CAPTURE CONTROLLER
   Captura clientes de um domínio Sigma
   ======================================== */

import SigmaClientCaptureService from '../services/sigmaClientCaptureService.js';
import * as db from '../database.js';
import fs from 'fs';
import path from 'path';

/**
 * Capturar clientes de um domínio Sigma
 * POST /api/sigma/capture-clients
 * 
 * Body: {
 *   domain: "https://dash.turbox.tv.br"
 * }
 */
export async function captureClients(req, res) {
  try {
    const userId = req.user.id;
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domínio é obrigatório' });
    }
    
    console.log(`📥 [SIGMA-CLIENTS] Iniciando captura de clientes de ${domain}`);
    
    // Buscar credenciais do domínio
    const credential = db.getSigmaCredentialByDomain(userId, domain);
    
    if (!credential) {
      return res.status(404).json({ error: 'Credenciais não encontradas para este domínio. Cadastre as credenciais primeiro.' });
    }
    
    // Criar serviço de captura
    const service = new SigmaClientCaptureService(
      domain,
      credential.username,
      credential.password
    );
    
    // Fazer login
    console.log(`🔑 [SIGMA-CLIENTS] Fazendo login...`);
    await service.login();
    
    if (!service.userId) {
      throw new Error('Não foi possível obter o ID do usuário logado');
    }
    
    // Capturar clientes
    console.log(`📥 [SIGMA-CLIENTS] Capturando clientes...`);
    const clients = await service.captureAllClients(service.userId);
    
    // Fazer logout
    await service.logout();
    
    // Salvar no SQLite
    console.log(`💾 [SIGMA-CLIENTS] Salvando ${clients.length} clientes no banco SQLite...`);
    db.saveSigmaClients(userId, domain, clients);
    
    // Salvar JSON para backup
    const jsonDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }
    
    const jsonPath = path.join(jsonDir, `sigma-clients-${userId}-${Date.now()}.json`);
    const jsonData = {
      user_id: userId,
      domain: domain,
      data_captura: new Date().toISOString(),
      total_clientes: clients.length,
      clientes: clients
    };
    
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`✅ [SIGMA-CLIENTS] JSON salvo em: ${jsonPath}`);
    
    // Estatísticas
    const ativos = clients.filter(c => c.status === 'ACTIVE').length;
    const inativos = clients.length - ativos;
    
    console.log(`✅ [SIGMA-CLIENTS] Captura concluída!`);
    console.log(`   📊 Total: ${clients.length}`);
    console.log(`   ✅ Ativos: ${ativos}`);
    console.log(`   ❌ Inativos: ${inativos}`);
    
    res.json({
      success: true,
      message: `${clients.length} clientes capturados com sucesso`,
      total: clients.length,
      ativos: ativos,
      inativos: inativos,
      domain: domain
    });
    
  } catch (error) {
    console.error('❌ [SIGMA-CLIENTS] Erro ao capturar clientes:', error);
    res.status(500).json({ 
      error: 'Erro ao capturar clientes',
      details: error.message 
    });
  }
}

/**
 * Listar clientes capturados de um domínio
 * GET /api/sigma/clients?domain=xxx
 */
export async function listClients(req, res) {
  try {
    const userId = req.user.id;
    const domain = req.query.domain;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain é obrigatório' });
    }
    
    const decodedDomain = decodeURIComponent(domain);
    const clients = db.getSigmaClients(userId, decodedDomain);
    const stats = db.getSigmaClientStats(userId, decodedDomain);
    
    res.json({
      success: true,
      domain: decodedDomain,
      stats: stats || { total: 0, active: 0, inactive: 0 },
      clients: clients
    });
    
  } catch (error) {
    console.error('❌ [SIGMA-CLIENTS] Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

/**
 * Listar domínios com clientes capturados
 * GET /api/sigma/domains-with-clients
 */
export async function listDomainsWithClients(req, res) {
  try {
    const userId = req.user.id;
    
    const domains = db.getSigmaDomainsWithClients(userId);
    
    res.json({
      success: true,
      domains: domains
    });
    
  } catch (error) {
    console.error('❌ [SIGMA-CLIENTS] Erro ao listar domínios:', error);
    res.status(500).json({ error: 'Erro ao listar domínios' });
  }
}

export default {
  captureClients,
  listClients,
  listDomainsWithClients
};
