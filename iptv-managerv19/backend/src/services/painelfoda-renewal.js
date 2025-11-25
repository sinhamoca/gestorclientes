/* ========================================
   PAINELFODA RENEWAL SERVICE
   Serviço para renovação automática de clientes PainelFoda
   
   Baseado no zeus.js com adaptações para o iptv-manager
   
   CARACTERÍSTICAS:
   - Login com CSRF token
   - Gerenciamento manual de cookies
   - Member ID capturado via scraping
   - Busca exata por reseller_notes
   - Suporte a múltiplas telas
   ======================================== */

import axios from 'axios';
import * as cheerio from 'cheerio';

class PainelFodaRenewalService {
  constructor(domain, username, password) {
    // Normalizar domínio
    this.baseURL = this.normalizeDomain(domain);
    this.username = username;
    this.password = password;
    
    // Criar instância do axios
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      withCredentials: true,
      maxRedirects: 5,
    });
    
    this.cookies = {};
    this.memberId = null;
    this.clients = [];
  }

  // ============= HELPERS =============

  normalizeDomain(domain) {
    let normalized = domain.trim();
    
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
  }

  extractCookies(response) {
    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      setCookieHeader.forEach(cookie => {
        const parts = cookie.split(';')[0].split('=');
        this.cookies[parts[0]] = parts[1];
      });
    }
  }

  getCookieString() {
    return Object.entries(this.cookies)
      .map(([key, value]) => `${key}=${value}`)
      .join('; ');
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '[PAINELFODA]',
      success: '[PAINELFODA ✓]',
      error: '[PAINELFODA ✗]',
      loading: '[PAINELFODA ...]'
    }[type] || '[PAINELFODA]';
    
    console.log(`${timestamp} ${prefix} ${message}`);
  }

  async delay(seconds = 2) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  // ============= LOGIN =============

  async getLoginPage() {
    this.log('Acessando página de login...', 'loading');
    
    try {
      const response = await this.client.get('/login');
      
      this.extractCookies(response);
      
      const $ = cheerio.load(response.data);
      
      const csrfToken = $('input[name="csrf"]').val() || 
                       $('input[name="_csrf"]').val() ||
                       $('input[name="csrf_token"]').val() ||
                       $('meta[name="csrf-token"]').attr('content');
      
      if (!csrfToken) {
        throw new Error('Token CSRF não encontrado');
      }
      
      this.log('Token CSRF obtido', 'success');
      return csrfToken;
      
    } catch (error) {
      this.log(`Erro ao acessar página de login: ${error.message}`, 'error');
      throw error;
    }
  }

  async login() {
    this.log('Iniciando processo de login...', 'loading');
    
    const csrfToken = await this.getLoginPage();
    
    if (!csrfToken) {
      throw new Error('Não foi possível obter o token CSRF');
    }
    
    const loginData = new URLSearchParams({
      csrf: csrfToken,
      username: this.username,
      password: this.password
    });
    
    this.log('Enviando credenciais de login...', 'loading');
    
    try {
      const response = await this.client.post('/login', loginData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': this.getCookieString(),
          'Referer': `${this.baseURL}/login`,
          'Origin': this.baseURL,
        }
      });
      
      this.extractCookies(response);
      
      const responseText = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
      
      if (response.status === 200) {
        if (responseText.includes('login') && responseText.includes('password')) {
          this.log('Login falhou - credenciais inválidas', 'error');
          throw new Error('Credenciais inválidas');
        }
        
        this.log('Login realizado com sucesso!', 'success');
        return true;
      }
      
      throw new Error('Login falhou');
      
    } catch (error) {
      this.log(`Erro ao fazer login: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============= MEMBER ID =============

  async getMemberId() {
    this.log('Capturando member_id...', 'loading');
    
    try {
      const response = await this.client.get('/lines/manage', {
        headers: {
          'Cookie': this.getCookieString(),
          'Referer': this.baseURL,
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Tentar com option selected
      const selectedOption = $('select[name="member_id"] option[selected]');
      
      if (selectedOption.length > 0) {
        const memberId = selectedOption.attr('value');
        const username = selectedOption.text().trim();
        
        if (memberId && memberId !== '') {
          this.memberId = memberId;
          this.log(`Member ID capturado: ${this.memberId} (${username})`, 'success');
          return this.memberId;
        }
      }
      
      // Fallback: primeiro option com valor
      const options = $('select[name="member_id"] option');
      
      options.each((i, elem) => {
        const value = $(elem).attr('value');
        const text = $(elem).text().trim();
        
        if (value && value !== '' && text !== '' && !this.memberId) {
          this.memberId = value;
          this.log(`Member ID capturado: ${this.memberId} (${text})`, 'success');
        }
      });
      
      if (this.memberId) {
        return this.memberId;
      }
      
      throw new Error('Member ID não encontrado');
      
    } catch (error) {
      this.log(`Erro ao capturar member_id: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============= LISTAR CLIENTES =============

  async listClients(memberId) {
    this.log(`Listando clientes do member_id: ${memberId}...`, 'loading');
    
    try {
      // Primeira requisição
      const firstPage = await this.client.get('/api/lines', {
        params: {
          username: '',
          status: '',
          others: 'clients',
          member_id: memberId,
          app_id: '',
          reseller_notes: ''
        },
        headers: {
          'Cookie': this.getCookieString(),
          'Referer': `${this.baseURL}/lines/manage`,
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
      if (!firstPage.data) {
        throw new Error('Nenhum dado retornado da API');
      }
      
      const totalPages = firstPage.data.pages;
      const totalClients = firstPage.data.count;
      
      this.log(`Total de clientes: ${totalClients}`, 'info');
      this.log(`Total de páginas: ${totalPages}`, 'info');
      
      let allClients = [];
      
      if (firstPage.data.results && Array.isArray(firstPage.data.results)) {
        allClients = allClients.concat(firstPage.data.results);
        this.log(`Página 1/${totalPages} carregada (${firstPage.data.results.length} clientes)`, 'info');
      }
      
      // Buscar páginas restantes
      for (let page = 2; page <= totalPages; page++) {
        this.log(`Carregando página ${page}/${totalPages}...`, 'loading');
        
        const response = await this.client.get(`/api/lines/${page}`, {
          params: {
            username: '',
            status: '',
            others: 'clients',
            member_id: memberId,
            app_id: '',
            reseller_notes: ''
          },
          headers: {
            'Cookie': this.getCookieString(),
            'Referer': `${this.baseURL}/lines/manage`,
            'X-Requested-With': 'XMLHttpRequest',
          }
        });
        
        if (response.data && response.data.results && Array.isArray(response.data.results)) {
          allClients = allClients.concat(response.data.results);
          this.log(`Página ${page}/${totalPages} carregada (${response.data.results.length} clientes)`, 'info');
        }
        
        await this.delay(1);
      }
      
      this.clients = allClients;
      this.log(`Total de ${allClients.length} clientes carregados`, 'success');
      
      return allClients;
      
    } catch (error) {
      this.log(`Erro ao listar clientes: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============= BUSCAR CLIENTE =============

  findClientByName(clientName) {
    this.log(`Buscando cliente: "${clientName}"`, 'loading');
    
    const client = this.clients.find(c => {
      return c.reseller_notes?.toLowerCase() === clientName.toLowerCase();
    });
    
    if (client) {
      this.log(`Cliente encontrado: ${client.username} (ID: ${client.id})`, 'success');
      return client;
    }
    
    this.log(`Cliente "${clientName}" não encontrado`, 'error');
    return null;
  }

  // ============= RENOVAR CLIENTE =============

  async renewClient(clientId, packageId, connections) {
    this.log(`Renovando cliente ID ${clientId}...`, 'loading');
    this.log(`Package: ${packageId}, Conexões: ${connections}`, 'info');
    
    try {
      const renewData = new URLSearchParams({
        id_line: clientId,
        package_id: packageId,
        connections: connections
      });
      
      const response = await this.client.post('/api/lines/renew', renewData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': this.getCookieString(),
          'Referer': `${this.baseURL}/lines/manage`,
          'Origin': this.baseURL,
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
      if (response.data && response.data.message) {
        const message = response.data.message.replace(/<[^>]*>/g, '').trim();
        
        if (message.toLowerCase().includes('sucesso')) {
          this.log('Renovação realizada com sucesso!', 'success');
          
          return {
            success: true,
            message: message,
            clientId: clientId,
            packageId: packageId
          };
        } else {
          this.log(`Resposta: ${message}`, 'error');
          return {
            success: false,
            message: message
          };
        }
      }
      
      return {
        success: false,
        message: 'Resposta inesperada do servidor'
      };
      
    } catch (error) {
      this.log(`Erro ao renovar cliente: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ============= DESCOBRIR PACKAGES =============

  async findPackages() {
    this.log('Descobrindo packages disponíveis...', 'loading');
    
    if (this.clients.length === 0) {
      throw new Error('Nenhum cliente carregado. Execute listClients primeiro.');
    }
    
    const packagesMap = new Map();
    
    // Analisar todos os clientes para encontrar packages
    this.clients.forEach(client => {
      if (client.package_id && client.package_name) {
        packagesMap.set(client.package_id, client.package_name);
      }
    });
    
    const packages = Array.from(packagesMap.entries()).map(([id, nome]) => ({
      id: id,
      nome: nome
    }));
    
    this.log(`${packages.length} packages encontrados`, 'success');
    
    return packages;
  }
}

export default PainelFodaRenewalService;