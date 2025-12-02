/* ========================================
   PAINELFODA RENEWAL SERVICE - CORRIGIDO
   Serviço para renovação automática de clientes PainelFoda
   
   BASEADO NO zeus.js ORIGINAL FUNCIONAL
   
   CORREÇÃO: O método findPackages agora busca packages
   do endpoint /api/lines/{id}/renew em vez de tentar
   extrair dos dados dos clientes
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
    this.packages = [];
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

  async delay(seconds = 1) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  extractStatus(statusHtml) {
    if (!statusHtml) return 'Desconhecido';
    return statusHtml.replace(/<[^>]*>/g, '').trim();
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
        this.log('Token CSRF não encontrado', 'error');
        return null;
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
    
    // Preparar dados do login (padrão PainelFoda - igual ao zeus.js)
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
      
      // Atualizar cookies
      this.extractCookies(response);
      
      // Converter resposta para string se necessário
      const responseText = typeof response.data === 'string' 
        ? response.data 
        : JSON.stringify(response.data);
      
      // Verificar se login foi bem-sucedido
      if (response.status === 200) {
        // Verificar se não voltou para página de login (indicaria erro)
        if (responseText.includes('login') && responseText.includes('password')) {
          this.log('Login falhou - credenciais inválidas', 'error');
          throw new Error('Credenciais inválidas');
        }
        
        this.log('Login realizado com sucesso!', 'success');
        return true;
      }
      
      throw new Error('Login falhou - status inesperado');
      
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
      
      // Atualizar cookies
      this.extractCookies(response);
      
      const $ = cheerio.load(response.data);
      
      // Método direto: Procurar pelo select com name="member_id" e pegar o option selected
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
      
      // Método alternativo: Procurar pelo select#member_id
      $('select#member_id option').each((i, elem) => {
        const value = $(elem).attr('value');
        const text = $(elem).text().trim();
        
        if (value && value !== '' && $(elem).is(':selected')) {
          this.memberId = value;
          this.log(`Member ID capturado: ${this.memberId} (${text})`, 'success');
        }
      });
      
      if (this.memberId) {
        return this.memberId;
      }
      
      // Tentar pegar o primeiro option com valor
      $('select#member_id option, select[name="member_id"] option').each((i, elem) => {
        const value = $(elem).attr('value');
        const text = $(elem).text().trim();
        
        if (value && value !== '' && !this.memberId) {
          this.memberId = value;
          this.log(`Member ID capturado (primeiro disponível): ${this.memberId} (${text})`, 'success');
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
        
        if (page < totalPages) {
          await this.delay(1);
        }
      }
      
      // Filtrar apenas dados importantes
      const filteredClients = allClients.map(client => ({
        id: client.id,
        username: client.username,
        status: this.extractStatus(client.status),
        exp_date: client.exp_date,
        master: client.master,
        max_connections: client.max_connections,
        reseller_notes: client.reseller_notes,
        trial: client.trial
      }));
      
      this.clients = filteredClients;
      
      await this.delay(1);
      
      this.log(`Total de ${filteredClients.length} clientes carregados`, 'success');
      
      return {
        total: totalClients,
        pages: totalPages,
        clients: filteredClients
      };
      
    } catch (error) {
      this.log(`Erro ao listar clientes: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============= DESCOBRIR PACKAGES (CORRIGIDO!) =============
  
  /**
   * Busca os packages disponíveis acessando o modal de renovação
   * de qualquer cliente existente.
   * 
   * CORREÇÃO: Esta é a forma correta de obter packages!
   * Os packages NÃO estão nos dados dos clientes, eles estão
   * no HTML do modal de renovação.
   */
  async findPackages() {
    this.log('Descobrindo packages disponíveis...', 'loading');
    
    // Precisamos de pelo menos um cliente para acessar o modal
    if (!this.clients || this.clients.length === 0) {
      this.log('Nenhum cliente carregado. Carregando primeiro...', 'loading');
      await this.listClients(this.memberId);
    }
    
    if (!this.clients || this.clients.length === 0) {
      throw new Error('Nenhum cliente disponível para descobrir packages');
    }
    
    // Pegar o primeiro cliente como referência
    const sampleClient = this.clients[0];
    this.log(`Usando cliente de referência: ID ${sampleClient.id} (${sampleClient.reseller_notes || sampleClient.username})`, 'info');
    
    try {
      // Acessar modal de renovação para extrair packages
      const response = await this.client.get(`/api/lines/${sampleClient.id}/renew`, {
        headers: {
          'Cookie': this.getCookieString(),
          'Referer': `${this.baseURL}/lines/manage`,
          'X-Requested-With': 'XMLHttpRequest',
        }
      });
      
      if (!response.data || !response.data.html || !response.data.html['#myModal']) {
        this.log('Resposta inesperada da API de renovação', 'error');
        throw new Error('Resposta inesperada da API de renovação');
      }
      
      // Parsear o HTML do modal
      const modalHtml = response.data.html['#myModal'];
      const $ = cheerio.load(modalHtml);
      
      // Extrair packages do select
      const packages = [];
      $('select[name="package_id"] option').each((i, elem) => {
        const value = $(elem).attr('value');
        const credits = $(elem).attr('credits');
        const text = $(elem).text().trim();
        
        if (value) {
          packages.push({
            id: value,
            package_id: value,
            credits: credits,
            nome: text,
            description: text
          });
        }
      });
      
      if (packages.length === 0) {
        this.log('Nenhum package encontrado no modal', 'error');
        throw new Error('Nenhum package encontrado');
      }
      
      // Armazenar packages
      this.packages = packages;
      
      this.log(`${packages.length} packages encontrados`, 'success');
      
      return packages;
      
    } catch (error) {
      this.log(`Erro ao buscar packages: ${error.message}`, 'error');
      throw error;
    }
  }

  // ============= BUSCAR CLIENTE =============

  findClientByName(clientName) {
    this.log(`Buscando cliente: "${clientName}"`, 'loading');
    
    if (!this.clients || this.clients.length === 0) {
      this.log('Nenhum cliente carregado', 'error');
      return null;
    }
    
    const searchName = clientName.toLowerCase().trim();
    
    // Buscar match exato no campo reseller_notes
    const found = this.clients.find(c => {
      return c.reseller_notes?.toLowerCase().trim() === searchName;
    });
    
    if (found) {
      this.log(`Cliente encontrado: ${found.reseller_notes} (ID: ${found.id})`, 'success');
      return found;
    }
    
    // Tentar buscar por username
    const foundByUsername = this.clients.find(c => {
      return c.username?.toLowerCase().trim() === searchName;
    });
    
    if (foundByUsername) {
      this.log(`Cliente encontrado pelo username: ${foundByUsername.username} (ID: ${foundByUsername.id})`, 'success');
      return foundByUsername;
    }
    
    this.log(`Cliente "${clientName}" não encontrado`, 'error');
    return null;
  }

  // ============= RENOVAR CLIENTE =============

  async renewClient(clientId, packageId, connections = 1) {
    this.log(`Renovando cliente ID ${clientId}...`, 'loading');
    this.log(`Package: ${packageId}, Conexões: ${connections}`, 'info');
    
    try {
      const payload = new URLSearchParams({
        package_id: packageId.toString(),
        remaining_months: '0',
        original_max_connections: connections.toString(),
        max_connections: connections.toString()
      });
      
      const response = await this.client.post(`/api/lines/${clientId}/renew`, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
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
}

export default PainelFodaRenewalService;