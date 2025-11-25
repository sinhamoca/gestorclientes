/* ========================================
   SIGMA CONTROLLER - ATUALIZADO COM CLOUDFLARE BYPASS
   Gerenciamento de credenciais, pacotes e clientes Sigma
   VERSÃO COMPLETA - Substituir o arquivo original
   ======================================== */

import SigmaRenewalService from '../services/sigma-renewal.js';
import * as db from '../database.js';

// ============= FUNÇÕES AUXILIARES =============

/**
 * Fazer login no Sigma usando CloudflareBypass
 */
async function loginSigma(domain, username, password) {
  console.log(`🔑 [SIGMA] Fazendo login em ${domain}...`);
  
  // Usar a nova classe com bypass de Cloudflare
  // useProxy = true para usar proxychains
  const service = new SigmaRenewalService(domain, username, password, true);
  
  // Fazer login
  await service.login();
  
  console.log('✅ [SIGMA] Login realizado com sucesso!');
  
  return { service, authToken: service.authToken };
}

/**
 * Capturar todos os servidores e pacotes
 */
async function capturePackages(service) {
  console.log('📥 [SIGMA] Capturando servidores e pacotes...');
  
  // Usar método request da classe ao invés de axios
  const response = await service.request('GET', '/api/servers', null, {
    'Accept': 'application/json'
  });
  
  let servers = [];
  if (response.data && Array.isArray(response.data)) {
    servers = response.data;
  } else if (Array.isArray(response)) {
    servers = response;
  }
  
  console.log(`✅ [SIGMA] ${servers.length} servidores encontrados`);
  
  const allPackages = [];
  
  for (const server of servers) {
    const packages = server.packages || [];
    
    for (const pkg of packages) {
      allPackages.push({
        id: pkg.id,
        nome: pkg.name,
        servidor_id: server.id,
        servidor_nome: server.name,
        status: pkg.status,
        preco: pkg.plan_price || 0,
        creditos: pkg.credits || 0,
        duracao: pkg.duration || 1,
        duracao_tipo: pkg.duration_in || 'MONTHS',
        conexoes: pkg.connections || 1,
        is_teste: pkg.is_trial || 'NO',
        is_mag: pkg.is_mag || 'NO',
        is_restreamer: pkg.is_restreamer || 'NO'
      });
    }
  }
  
  console.log(`✅ [SIGMA] ${allPackages.length} pacotes capturados`);
  
  return allPackages;
}

/**
 * Capturar clientes de um domínio Sigma
 */
async function captureClients(service, domain) {
  console.log('📥 [SIGMA] Capturando clientes...');
  
  let allClients = [];
  let currentPage = 1;
  let hasMorePages = true;
  
  while (hasMorePages) {
    console.log(`   Página ${currentPage}...`);
    
    // Buscar página atual
    const response = await service.request('GET', `/api/customers?page=${currentPage}&perPage=100`, null, {
      'Accept': 'application/json'
    });
    
    let customers = [];
    if (response.data && Array.isArray(response.data)) {
      customers = response.data;
    } else if (Array.isArray(response)) {
      customers = response;
    }
    
    if (customers.length === 0) {
      hasMorePages = false;
    } else {
      allClients.push(...customers);
      currentPage++;
      
      // Limitar a 10 páginas para evitar loop infinito
      if (currentPage > 10) {
        console.log('   ⚠️ Limite de páginas atingido (10)');
        hasMorePages = false;
      }
    }
  }
  
  console.log(`✅ [SIGMA] ${allClients.length} clientes capturados`);
  
  return allClients;
}

// ============= ENDPOINTS - CREDENCIAIS =============

/**
 * Salvar credencial Sigma
 * POST /api/sigma/credentials
 */
export async function saveCredential(req, res) {
  try {
    const userId = req.user.id;
    const { domain, username, password } = req.body;
    
    if (!domain || !username || !password) {
      return res.status(400).json({ error: 'Domínio, usuário e senha são obrigatórios' });
    }
    
    // Validar formato do domínio
    if (!domain.startsWith('http://') && !domain.startsWith('https://')) {
      return res.status(400).json({ error: 'Domínio deve começar com http:// ou https://' });
    }
    
    console.log(`💾 [SIGMA] Salvando credencial para ${domain}`);
    
    db.saveSigmaCredential(userId, domain, username, password);
    
    res.json({
      success: true,
      message: 'Credencial salva com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao salvar credencial:', error);
    res.status(500).json({ error: 'Erro ao salvar credencial' });
  }
}

/**
 * Listar credenciais Sigma
 * GET /api/sigma/credentials
 */
export async function listCredentials(req, res) {
  try {
    const userId = req.user.id;
    
    const credentials = db.getSigmaCredentials(userId);
    
    // Não retornar senha completa
    const sanitized = credentials.map(cred => ({
      id: cred.id,
      domain: cred.domain,
      username: cred.username,
      password: '***',
      created_at: cred.created_at
    }));
    
    res.json({
      success: true,
      credentials: sanitized
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar credenciais:', error);
    res.status(500).json({ error: 'Erro ao listar credenciais' });
  }
}

/**
 * Deletar credencial Sigma
 * DELETE /api/sigma/credentials/:domain
 */
export async function deleteCredential(req, res) {
  try {
    const userId = req.user.id;
    const { domain } = req.params;
    
    console.log(`🗑️ [SIGMA] Deletando credencial de ${domain}`);
    
    db.deleteSigmaCredential(userId, decodeURIComponent(domain));
    
    res.json({
      success: true,
      message: 'Credencial deletada com sucesso'
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao deletar credencial:', error);
    res.status(500).json({ error: 'Erro ao deletar credencial' });
  }
}

// ============= ENDPOINTS - PACOTES =============

/**
 * Buscar pacotes de um domínio Sigma
 * POST /api/sigma/fetch-packages
 */
export async function fetchPackages(req, res) {
  try {
    const userId = req.user.id;
    const { domain } = req.body;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domínio é obrigatório' });
    }
    
    console.log(`📦 [SIGMA] Buscando pacotes de ${domain}`);
    
    // Buscar credenciais
    const credential = db.getSigmaCredentialByDomain(userId, domain);
    
    if (!credential) {
      return res.status(404).json({ error: 'Credenciais não encontradas para este domínio' });
    }
    
    // Login usando CloudflareBypass
    const { service } = await loginSigma(domain, credential.username, credential.password);
    
    // Capturar pacotes
    const packages = await capturePackages(service);
    
    // Salvar no banco
    db.saveSigmaPackages(userId, domain, packages);
    
    console.log(`✅ [SIGMA] ${packages.length} pacotes salvos no banco`);
    
    res.json({
      success: true,
      message: `${packages.length} pacotes capturados com sucesso`,
      total: packages.length
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao buscar pacotes:', error);
    res.status(500).json({ 
      error: 'Erro ao buscar pacotes',
      details: error.message 
    });
  }
}

/**
 * Listar pacotes de um domínio
 * GET /api/sigma/packages/:domain OU GET /api/sigma/packages?domain=xxx
 */
export async function listPackages(req, res) {
  try {
    const userId = req.user.id;
    // Aceita domain via params OU query string
    const domain = req.params.domain || req.query.domain;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain é obrigatório' });
    }
    
    const decodedDomain = decodeURIComponent(domain);
    const packages = db.getSigmaPackages(userId, decodedDomain);
    const stats = db.getSigmaPackageStats(userId, decodedDomain);
    
    res.json({
      success: true,
      domain: decodedDomain,
      stats: stats || { total: 0, active: 0, trial: 0 },
      packages: packages
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar pacotes:', error);
    res.status(500).json({ error: 'Erro ao listar pacotes' });
  }
}

/**
 * Listar domínios com pacotes capturados
 * GET /api/sigma/domains
 */
export async function listDomains(req, res) {
  try {
    const userId = req.user.id;
    
    const domains = db.getSigmaDomainsWithPackages(userId);
    
    res.json({
      success: true,
      domains: domains
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar domínios:', error);
    res.status(500).json({ error: 'Erro ao listar domínios' });
  }
}

// ============= ENDPOINTS - CLIENTES =============

/**
 * Capturar clientes de um domínio Sigma
 * POST /api/sigma/capture-clients
 */
export async function captureClientsEndpoint(req, res) {
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
      return res.status(404).json({ 
        error: 'Credenciais não encontradas para este domínio. Cadastre as credenciais primeiro.' 
      });
    }
    
    // Login usando CloudflareBypass
    const { service } = await loginSigma(domain, credential.username, credential.password);
    
    // Capturar clientes
    const clients = await captureClients(service, domain);
    
    // Salvar no banco (assumindo que existe uma função para isso)
    if (db.saveSigmaClients) {
      db.saveSigmaClients(userId, domain, clients);
    }
    
    console.log(`✅ [SIGMA-CLIENTS] ${clients.length} clientes salvos no banco`);
    
    res.json({
      success: true,
      message: `${clients.length} clientes capturados com sucesso`,
      total: clients.length
    });
    
  } catch (error) {
    console.error('❌ [SIGMA-CLIENTS] Erro ao capturar clientes:', error);
    res.status(500).json({ 
      error: 'Erro ao capturar clientes',
      details: error.message 
    });
  }
}

// Exportar também como captureClients para manter compatibilidade
export { captureClientsEndpoint as captureClients };

/**
 * Listar clientes capturados
 * GET /api/sigma/clients?domain=xxx
 */
export async function listClients(req, res) {
  try {
    const userId = req.user.id;
    const { domain } = req.query;
    
    if (!domain) {
      return res.status(400).json({ error: 'Domain é obrigatório' });
    }
    
    const decodedDomain = decodeURIComponent(domain);
    
    // Buscar clientes do banco (assumindo que existe uma função para isso)
    let clients = [];
    if (db.getSigmaClients) {
      clients = db.getSigmaClients(userId, decodedDomain);
    }
    
    res.json({
      success: true,
      domain: decodedDomain,
      total: clients.length,
      clients: clients
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar clientes:', error);
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
    
    // Buscar domínios com clientes (assumindo que existe uma função para isso)
    let domains = [];
    if (db.getSigmaDomainsWithClients) {
      domains = db.getSigmaDomainsWithClients(userId);
    }
    
    res.json({
      success: true,
      domains: domains
    });
    
  } catch (error) {
    console.error('❌ [SIGMA] Erro ao listar domínios com clientes:', error);
    res.status(500).json({ error: 'Erro ao listar domínios com clientes' });
  }
}