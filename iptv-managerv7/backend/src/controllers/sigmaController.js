/* ========================================
   SIGMA CONTROLLER - COMPLETO
   Gerenciamento de credenciais, pacotes E clientes Sigma
   ======================================== */

import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as db from '../database.js';
import SigmaClientCaptureService from '../services/sigmaClientCaptureService.js';
import fs from 'fs';
import path from 'path';

// ============= CONFIGURAÇÃO DE PROXY =============

/**
 * Seleciona um proxy aleatório da lista
 */
function getRandomProxy() {
  const proxyList = process.env.SIGMA_PROXY_LIST;
  
  if (!proxyList) {
    throw new Error('SIGMA_PROXY_LIST não configurado no .env');
  }
  
  const proxies = proxyList.split(',').map(p => p.trim());
  const randomProxy = proxies[Math.floor(Math.random() * proxies.length)];
  const [username, password] = randomProxy.split(':');
  
  return {
    host: process.env.SIGMA_PROXY_HOST,
    port: parseInt(process.env.SIGMA_PROXY_PORT),
    username,
    password
  };
}

/**
 * Cria cliente axios com proxy SOCKS5
 */
function createProxiedClient(domain) {
  const proxy = getRandomProxy();
  
  console.log(`🔐 [SIGMA] Usando proxy: ${proxy.username.substring(0, 20)}...`);
  
  // Construir URL SOCKS5 no formato correto
  const proxyUrl = `socks5://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
  const agent = new SocksProxyAgent(proxyUrl);
  
  return axios.create({
    baseURL: domain,
    timeout: 30000,
    httpAgent: agent,
    httpsAgent: agent,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
      'Accept': 'application/json',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br'
    }
  });
}

// ============= LÓGICA SIGMA - PACOTES =============

/**
 * Fazer login no Sigma
 */
async function loginSigma(domain, username, password) {
  const client = createProxiedClient(domain);
  
  console.log(`🔑 [SIGMA] Fazendo login em ${domain}...`);
  
  // Carregar página inicial
  const homeResponse = await client.get('/', { validateStatus: () => true });
  if (homeResponse.status !== 200) {
    throw new Error(`Erro ao carregar página inicial: ${homeResponse.status}`);
  }
  
  // Configurar cookies
  const cookies = homeResponse.headers['set-cookie'];
  if (cookies) {
    const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    client.defaults.headers['Cookie'] = cookieString;
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Configurar headers para API
  client.defaults.headers['Content-Type'] = 'application/json';
  client.defaults.headers['Origin'] = domain;
  client.defaults.headers['Referer'] = domain + '/';
  
  // Fazer login
  const loginResponse = await client.post('/api/auth/login', {
    captcha: "not-a-robot",
    captchaChecked: true,
    username: username,
    password: password,
    twofactor_code: "",
    twofactor_recovery_code: "",
    twofactor_trusted_device_id: ""
  }, { validateStatus: () => true });
  
  if (loginResponse.status === 200) {
    const userData = loginResponse.data;
    const authToken = userData.token;
    client.defaults.headers['Authorization'] = `Bearer ${authToken}`;
    console.log('✅ [SIGMA] Login realizado com sucesso!');
    return { client, authToken };
  } else {
    throw new Error(`Falha no login: ${loginResponse.status}`);
  }
}

/**
 * Capturar todos os servidores e pacotes
 */
async function capturePackages(client) {
  console.log('📥 [SIGMA] Capturando servidores e pacotes...');
  
  const response = await client.get('/api/servers', {
    validateStatus: () => true
  });
  
  if (response.status !== 200) {
    throw new Error(`Erro ao buscar servidores: ${response.status}`);
  }
  
  let servers = [];
  if (response.data.data && Array.isArray(response.data.data)) {
    servers = response.data.data;
  } else if (Array.isArray(response.data)) {
    servers = response.data;
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
    
    // Login e captura
    const { client } = await loginSigma(domain, credential.username, credential.password);
    const packages = await capturePackages(client);
    
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

// ============= ENDPOINTS - CLIENTES (NOVO!) =============

/**
 * Capturar clientes de um domínio Sigma
 * POST /api/sigma/capture-clients
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

// ============= EXPORT DEFAULT =============

export default {
  saveCredential,
  listCredentials,
  deleteCredential,
  fetchPackages,
  listPackages,
  listDomains,
  captureClients,
  listClients,
  listDomainsWithClients
};