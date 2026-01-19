/* ========================================
   KOFFICE SESSION - SESSÃO INDIVIDUAL
   Gerencia login e sessão de um único painel Koffice
   
   Baseado no projeto Telegram de Isaac
   Adaptado para multi-tenant (múltiplos usuários)
   
   LOCALIZAÇÃO: backend/src/services/koffice/KofficeSession.js
   ======================================== */

import axios from 'axios';
import * as cheerio from 'cheerio';

class KofficeSession {
  constructor(config) {
    this.domain = config.domain.replace(/\/$/, '');
    this.username = config.username;
    this.password = config.password;
    this.anticaptchaKey = config.anticaptchaKey || process.env.KOFFICE_ANTICAPTCHA_KEY;
    this.userId = config.userId;
    
    // Estado da sessão
    this.cookies = {};
    this.loggedIn = false;
    this.loginCount = 0;
    this.sessionStartTime = null;
    this.lastCheckTime = null;
    this.lastActivity = null;
    
    // Cliente HTTP
    this.client = axios.create({
      timeout: 30000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    
    // Callback para logs externos
    this.onLog = null;
    this.onSessionExpired = null;
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [KOFFICE-SESSION] [User:${this.userId}] [${this.domain}]`;
    const logLine = `${prefix} [${type}] ${message}`;
    console.log(logLine);
    if (this.onLog) this.onLog(logLine, type);
  }

  // ========================================
  // UTILITÁRIOS
  // ========================================
  async delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  getCookieString() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  saveCookies(response) {
    if (response.headers['set-cookie']) {
      response.headers['set-cookie'].forEach(cookie => {
        const match = cookie.match(/^([^=]+)=([^;]+)/);
        if (match) {
          this.cookies[match[1]] = match[2];
        }
      });
    }
  }

  // ========================================
  // INFORMAÇÕES DA SESSÃO
  // ========================================
  getSessionInfo() {
    const now = Date.now();
    const duration = this.sessionStartTime 
      ? Math.floor((now - this.sessionStartTime.getTime()) / 1000 / 60)
      : 0;
    
    const lastActivityMinutes = this.lastActivity
      ? Math.floor((now - this.lastActivity.getTime()) / 1000 / 60)
      : null;
    
    return {
      userId: this.userId,
      domain: this.domain,
      loggedIn: this.loggedIn,
      durationMinutes: duration,
      loginCount: this.loginCount,
      sessionStart: this.sessionStartTime,
      lastCheck: this.lastCheckTime,
      lastActivity: this.lastActivity,
      lastActivityMinutes,
      cookiesCount: Object.keys(this.cookies).length
    };
  }

  // ========================================
  // EXPORTAR/IMPORTAR COOKIES (para persistência)
  // ========================================
  exportCookies() {
    return JSON.stringify({
      cookies: this.cookies,
      loggedIn: this.loggedIn,
      loginCount: this.loginCount,
      sessionStartTime: this.sessionStartTime?.toISOString(),
      lastCheckTime: this.lastCheckTime?.toISOString()
    });
  }

  importCookies(cookiesJson) {
    try {
      const data = JSON.parse(cookiesJson);
      this.cookies = data.cookies || {};
      this.loggedIn = data.loggedIn || false;
      this.loginCount = data.loginCount || 0;
      this.sessionStartTime = data.sessionStartTime ? new Date(data.sessionStartTime) : null;
      this.lastCheckTime = data.lastCheckTime ? new Date(data.lastCheckTime) : null;
      this.log(`Cookies importados (${Object.keys(this.cookies).length} cookies)`, 'INFO');
      return true;
    } catch (error) {
      this.log(`Erro ao importar cookies: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // ========================================
  // OBTER CSRF TOKEN
  // ========================================
  async getCsrfToken() {
    this.log('Acessando página de login para obter CSRF token...', 'INFO');
    
    const response = await this.client.get(`${this.domain}/login/`);
    this.saveCookies(response);
    
    if (response.status !== 200) {
      throw new Error(`Falha ao acessar página de login: Status ${response.status}`);
    }
    
    const $ = cheerio.load(response.data);
    const csrfToken = $('input[name="csrf_token"]').val();
    const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || $('[data-sitekey]').attr('data-sitekey');
    
    if (!csrfToken) {
      throw new Error('CSRF Token não encontrado na página de login');
    }
    
    this.log(`CSRF Token obtido. hCaptcha: ${hcaptchaSiteKey ? 'SIM' : 'NÃO'}`, 'SUCCESS');
    
    return { 
      csrfToken, 
      hasHCaptcha: !!hcaptchaSiteKey, 
      hcaptchaSiteKey 
    };
  }

  // ========================================
  // RESOLVER HCAPTCHA
  // ========================================
  async solveHCaptcha(siteKey) {
    if (!this.anticaptchaKey) {
      throw new Error('Anti-Captcha API Key não configurada. Configure KOFFICE_ANTICAPTCHA_KEY no .env');
    }
    
    this.log('Resolvendo hCaptcha via Anti-Captcha...', 'INFO');
    
    try {
      // Criar tarefa no Anti-Captcha
      const createTask = await axios.post('https://api.anti-captcha.com/createTask', {
        clientKey: this.anticaptchaKey,
        task: { 
          type: 'HCaptchaTaskProxyless', 
          websiteURL: `${this.domain}/login/`, 
          websiteKey: siteKey 
        }
      }, { timeout: 30000 });

      if (createTask.data.errorId !== 0) {
        throw new Error(`Anti-Captcha: ${createTask.data.errorDescription}`);
      }
      
      const taskId = createTask.data.taskId;
      this.log(`Task Anti-Captcha criada: ${taskId}`, 'INFO');

      // Aguardar resolução (máximo 3 minutos)
      for (let i = 0; i < 60; i++) {
        await this.delay(3);
        
        const result = await axios.post('https://api.anti-captcha.com/getTaskResult', {
          clientKey: this.anticaptchaKey, 
          taskId
        }, { timeout: 30000 });
        
        if ((i + 1) % 10 === 0) {
          this.log(`Aguardando captcha... ${(i + 1) * 3}s`, 'INFO');
        }
        
        if (result.data.status === 'ready') {
          this.log(`hCaptcha resolvido em ${(i + 1) * 3}s!`, 'SUCCESS');
          return result.data.solution.gRecaptchaResponse;
        }
        
        if (result.data.errorId !== 0) {
          throw new Error(`Anti-Captcha: ${result.data.errorDescription}`);
        }
      }
      
      throw new Error('Timeout resolvendo captcha (3 minutos)');
      
    } catch (error) {
      this.log(`Erro ao resolver hCaptcha: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // ========================================
  // FAZER LOGIN
  // ========================================
  async login() {
    this.log('Iniciando login...', 'INFO');
    const startTime = Date.now();
    
    try {
      // 1. Obter CSRF + detectar captcha
      const { csrfToken, hasHCaptcha, hcaptchaSiteKey } = await this.getCsrfToken();
      
      // 2. Resolver captcha se necessário
      let captchaToken = null;
      if (hasHCaptcha) {
        captchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
      }
      
      // 3. Montar payload de login
      const payload = new URLSearchParams({
        try_login: '1',
        csrf_token: csrfToken,
        username: this.username,
        password: this.password
      });
      
      if (captchaToken) {
        payload.append('g-recaptcha-response', captchaToken);
        payload.append('h-captcha-response', captchaToken);
      }
      
      // 4. Fazer requisição de login
      const loginResponse = await this.client.post(`${this.domain}/login/`, payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': this.getCookieString(),
          'Referer': `${this.domain}/login/`,
          'Origin': this.domain
        },
        maxRedirects: 0
      });
      
      this.saveCookies(loginResponse);
      
      // 5. Seguir redirects manualmente
      let currentResponse = loginResponse;
      let redirectCount = 0;
      
      while ((currentResponse.status === 302 || currentResponse.status === 301) && redirectCount < 5) {
        const location = currentResponse.headers.location;
        
        if (!location || location.includes('login')) {
          throw new Error('Credenciais inválidas ou captcha incorreto');
        }
        
        redirectCount++;
        const fullUrl = location.startsWith('http') ? location : `${this.domain}${location}`;
        
        currentResponse = await this.client.get(fullUrl, {
          headers: { 'Cookie': this.getCookieString() },
          maxRedirects: 0
        });
        
        this.saveCookies(currentResponse);
      }
      
      // 6. Verificar se login foi bem-sucedido
      const html = currentResponse.data.toString();
      
      if (html.includes('logout') || html.includes('sair') || html.includes('dashboard')) {
        this.loggedIn = true;
        this.loginCount++;
        this.sessionStartTime = new Date();
        this.lastCheckTime = new Date();
        this.lastActivity = new Date();
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.log(`LOGIN #${this.loginCount} realizado com sucesso em ${elapsed}s`, 'SUCCESS');
        
        return true;
      }
      
      throw new Error('Não foi possível validar login - página não contém indicadores de sessão ativa');
      
    } catch (error) {
      this.log(`Erro no login: ${error.message}`, 'ERROR');
      this.loggedIn = false;
      throw error;
    }
  }

  // ========================================
  // VERIFICAR SESSÃO (HEARTBEAT)
  // ========================================
  async checkSession() {
    try {
      const response = await this.client.get(`${this.domain}/clients/`, {
        headers: { 'Cookie': this.getCookieString() },
        maxRedirects: 5
      });
      
      this.saveCookies(response);
      this.lastCheckTime = new Date();
      
      const html = response.data.toString();
      const finalUrl = response.request?.res?.responseUrl || response.config.url;
      
      // Verificar se foi redirecionado para login
      const hasLoginForm = html.includes('csrf_token') && html.includes('try_login');
      
      if (finalUrl.includes('login') || hasLoginForm) {
        this.log('Sessão expirou (redirecionado para login)', 'WARNING');
        this.loggedIn = false;
        
        if (this.onSessionExpired) {
          this.onSessionExpired(this);
        }
        
        return false;
      }
      
      // Sessão ativa se tem indicadores de logout
      if (html.includes('logout') || html.includes('sair')) {
        this.lastActivity = new Date();
        return true;
      }
      
      // Fallback: status 200 sem form de login
      return response.status === 200 && !hasLoginForm;
      
    } catch (error) {
      this.log(`Erro ao verificar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // ========================================
  // GARANTIR SESSÃO ATIVA
  // ========================================
  async ensureLoggedIn() {
    // Se nunca logou ou não tem cookies, fazer login
    if (!this.loggedIn || Object.keys(this.cookies).length === 0) {
      this.log('Sessão não iniciada, fazendo login...', 'INFO');
      await this.login();
      return;
    }
    
    // Verificar se sessão ainda está ativa
    const isActive = await this.checkSession();
    
    if (!isActive) {
      this.log('Sessão expirou, re-logando...', 'WARNING');
      await this.login();
    }
  }

  // ========================================
  // RENOVAR CLIENTE
  // ========================================
  async renewClient(clientId, months) {
    await this.ensureLoggedIn();
    
    this.log(`Renovando cliente ${clientId} por ${months} mês(es)...`, 'INFO');
    
    try {
      const apiUrl = `${this.domain}/clients/api/?renew_client_plus&client_id=${clientId}&months=${months}`;
      
      const response = await this.client.post(apiUrl, '', {
        headers: {
          'Cookie': this.getCookieString(),
          'Referer': `${this.domain}/clients/`,
          'Origin': this.domain,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      
      this.saveCookies(response);
      this.lastActivity = new Date();
      
      // Verificar se sessão expirou durante a operação
      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.log('Sessão expirou durante renovação, re-logando...', 'WARNING');
        this.loggedIn = false;
        await this.login();
        return await this.renewClient(clientId, months);
      }
      
      // Validar resposta
      if (response.status === 200) {
        // Resposta JSON
        if (response.data && typeof response.data === 'object') {
          if (response.data.result === 'success') {
            this.log(`Cliente ${clientId} renovado com sucesso!`, 'SUCCESS');
            return {
              success: true,
              clientId,
              months,
              data: response.data,
              mode: 'keeper',
              timestamp: new Date().toISOString()
            };
          } else if (response.data.result === 'failed') {
            throw new Error(response.data.msg || 'Falha na renovação (result: failed)');
          }
        }
        
        // Resposta string
        if (typeof response.data === 'string') {
          const lower = response.data.toLowerCase();
          if (lower.includes('success') || lower === 'ok') {
            this.log(`Cliente ${clientId} renovado com sucesso!`, 'SUCCESS');
            return { 
              success: true, 
              clientId, 
              months,
              mode: 'keeper',
              timestamp: new Date().toISOString()
            };
          }
        }
      }
      
      throw new Error(`Resposta inesperada: ${JSON.stringify(response.data)}`);
      
    } catch (error) {
      this.log(`Erro ao renovar cliente ${clientId}: ${error.message}`, 'ERROR');
      return {
        success: false,
        error: error.message,
        clientId,
        months,
        mode: 'keeper'
      };
    }
  }

  // ========================================
  // BUSCAR CLIENTES
  // ========================================
  async searchClients(searchTerm, limit = 10) {
    await this.ensureLoggedIn();
    
    this.log(`Buscando clientes: "${searchTerm}"`, 'INFO');
    
    try {
      const payload = new URLSearchParams();
      payload.append('get_clients', '');
      payload.append('draw', '1');
      payload.append('start', '0');
      payload.append('length', limit.toString());
      payload.append('search[value]', searchTerm);
      payload.append('search[regex]', 'false');
      payload.append('order[0][column]', '0');
      payload.append('order[0][dir]', 'desc');
      payload.append('filter_value', '#');
      payload.append('reseller_id', '-1');
      
      for (let i = 0; i < 10; i++) {
        payload.append(`columns[${i}][data]`, i.toString());
        payload.append(`columns[${i}][searchable]`, 'true');
        payload.append(`columns[${i}][orderable]`, 'true');
      }
      
      const response = await this.client.post(
        `${this.domain}/clients/api/?get_clients`,
        payload.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': this.getCookieString(),
            'Referer': `${this.domain}/clients/`,
            'X-Requested-With': 'XMLHttpRequest'
          }
        }
      );
      
      this.saveCookies(response);
      this.lastActivity = new Date();
      
      if (typeof response.data === 'string' && response.data.includes('login')) {
        this.loggedIn = false;
        await this.login();
        return await this.searchClients(searchTerm, limit);
      }
      
      if (!response.data?.data || !Array.isArray(response.data.data)) {
        throw new Error('Resposta inválida da API');
      }
      
      const clients = response.data.data.map(row => this.parseClientRow(row));
      
      this.log(`Encontrados ${clients.length} clientes`, 'SUCCESS');
      
      return {
        success: true,
        total: response.data.recordsFiltered,
        clients
      };
      
    } catch (error) {
      this.log(`Erro ao buscar clientes: ${error.message}`, 'ERROR');
      return { success: false, error: error.message, clients: [] };
    }
  }

  parseClientRow(row) {
    const stripHtml = (str) => str ? str.replace(/<[^>]+>/g, '').trim() : '';
    
    let name = row[7] || '';
    const nameMatch = name.match(/data-original-title="([^"]+)"/);
    name = nameMatch ? nameMatch[1] : stripHtml(name);
    
    let status = row[8] || '';
    if (status.includes('badge-success')) status = 'Ativo';
    else if (status.includes('badge-danger')) status = 'Bloqueado';
    else if (status.includes('badge-warning')) status = 'Expirado';
    else status = stripHtml(status) || 'Desconhecido';
    
    return {
      id: row[0],
      username: stripHtml(row[1]),
      password: row[2],
      createdAt: row[3],
      expiresAt: row[4],
      reseller: row[5],
      screens: row[6],
      name,
      status
    };
  }

  // ========================================
  // FECHAR SESSÃO
  // ========================================
  close() {
    this.log('Fechando sessão...', 'INFO');
    this.cookies = {};
    this.loggedIn = false;
    this.sessionStartTime = null;
    this.lastCheckTime = null;
    this.lastActivity = null;
  }
}

export default KofficeSession;
