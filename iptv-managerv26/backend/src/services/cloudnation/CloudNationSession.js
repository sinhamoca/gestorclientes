/* ========================================
   CLOUDNATION SESSION
   Gerencia login e sessão individual do painel CloudNation
   
   IMPORTANTE: CSRF Token vem do COOKIE, não do HTML!
   
   Baseado no protótipo testado com sucesso (9+ horas de sessão)
   
   LOCALIZAÇÃO: backend/src/services/cloudnation/CloudNationSession.js
   ======================================== */

import axios from 'axios';
import * as db from '../../database.js';

class CloudNationSession {
  constructor(config) {
    this.userId = config.userId;
    this.domain = config.domain || 'https://painel.cloudnation.top';
    this.username = config.username;
    this.password = config.password;
    this.baseUrl = this.domain.replace(/\/$/, '');
    
    // Estado da sessão
    this.cookies = {};
    this.csrfToken = null;
    this.deviceId = null;
    this.loggedIn = false;
    this.loginCount = 0;
    this.sessionStartTime = null;
    this.lastCheckTime = null;
    this.lastActivity = null;
    
    // API Key 2Captcha para resolver Turnstile
    this.apiKey2captcha = process.env.CAPTCHA_2CAPTCHA_API_KEY;
    
    // Cliente HTTP
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Sec-Ch-Ua': '"Chromium";v="121", "Not A(Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      }
    });
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const sessionKey = `${this.userId}:${this.baseUrl.replace('https://', '')}`;
    const prefix = `[${timestamp}] [CN-SESSION:${sessionKey}] [${type}]`;
    console.log(`${prefix} ${message}`);
  }

  // ========================================
  // UTILITÁRIOS
  // ========================================
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateDeviceId() {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  getCookieString() {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // Extrair cookies do header set-cookie
  extractCookiesFromResponse(response) {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      setCookie.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const eqIndex = nameValue.indexOf('=');
        if (eqIndex > 0) {
          const name = nameValue.substring(0, eqIndex).trim();
          const value = nameValue.substring(eqIndex + 1).trim();
          if (value && value !== 'deleted') {
            this.cookies[name] = value;
          }
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
      ? Math.floor((now - new Date(this.sessionStartTime).getTime()) / 1000 / 60)
      : 0;
    
    return {
      userId: this.userId,
      domain: this.baseUrl,
      loggedIn: this.loggedIn,
      durationMinutes: duration,
      durationHours: (duration / 60).toFixed(1),
      loginCount: this.loginCount,
      sessionStart: this.sessionStartTime,
      lastCheck: this.lastCheckTime,
      lastActivity: this.lastActivity,
      cookiesCount: Object.keys(this.cookies).length,
      hasCsrfToken: !!this.csrfToken
    };
  }

  // ========================================
  // PERSISTÊNCIA NO BANCO DE DADOS
  // ========================================
  saveToDatabase() {
    const sessionData = {
      cookies: this.cookies,
      csrfToken: this.csrfToken,
      deviceId: this.deviceId,
      loggedIn: this.loggedIn,
      loginCount: this.loginCount,
      sessionStartTime: this.sessionStartTime,
      lastCheckTime: this.lastCheckTime,
      lastActivity: this.lastActivity
    };
    
    db.saveCloudNationSession(
      this.userId,
      this.baseUrl,
      JSON.stringify(sessionData)
    );
    
    this.log(`Sessão salva no banco`);
  }

  loadFromDatabase() {
    try {
      const saved = db.getCloudNationSession(this.userId, this.baseUrl);
      
      if (!saved) {
        this.log('Nenhuma sessão encontrada no banco', 'WARNING');
        return false;
      }
      
      const data = JSON.parse(saved.session_data);
      
      this.cookies = data.cookies || {};
      this.csrfToken = data.csrfToken || null;
      this.deviceId = data.deviceId || null;
      this.loggedIn = data.loggedIn || false;
      this.loginCount = data.loginCount || 0;
      this.sessionStartTime = data.sessionStartTime || null;
      this.lastCheckTime = data.lastCheckTime || null;
      this.lastActivity = data.lastActivity || null;
      
      this.log(`Sessão carregada do banco (${Object.keys(this.cookies).length} cookies)`);
      return true;
    } catch (error) {
      this.log(`Erro ao carregar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // ========================================
  // EXTRAIR TOKENS DO HTML
  // ========================================
  extractTokensFromHtml(html) {
    this.log('Extraindo tokens do HTML...');
    
    let tokenFields = '';
    let tokenUnlocked = '';
    
    // Buscar _Token[fields] com múltiplos padrões
    let match = html.match(/name=["']_Token\[fields\]["'][^>]*value=["']([^"']+)["']/i);
    if (!match) {
      match = html.match(/value=["']([^"']+)["'][^>]*name=["']_Token\[fields\]["']/i);
    }
    if (!match) {
      match = html.match(/_Token\[fields\][^>]+value=["']([^"']+)["']/i);
    }
    
    if (match) {
      tokenFields = match[1];
      this.log('_Token[fields] encontrado');
    } else {
      tokenFields = '3a8b9680acaf2e40786fd57433e6b74eaf1cf182:';
      this.log('_Token[fields] não encontrado, usando padrão', 'WARNING');
    }
    
    // Buscar _Token[unlocked]
    match = html.match(/name=["']_Token\[unlocked\]["'][^>]*value=["']([^"']*)["']/i);
    if (!match) {
      match = html.match(/value=["']([^"']*)["'][^>]*name=["']_Token\[unlocked\]["']/i);
    }
    if (!match) {
      match = html.match(/_Token\[unlocked\][^>]+value=["']([^"']*)["']/i);
    }
    
    if (match) {
      tokenUnlocked = match[1];
      this.log('_Token[unlocked] encontrado');
    } else {
      tokenUnlocked = 'cf-turnstile-response|g-recaptcha-response';
      this.log('_Token[unlocked] não encontrado, usando padrão', 'WARNING');
    }
    
    // Processar tokenFields
    if (tokenFields) {
      if (tokenFields.includes('%')) {
        tokenFields = decodeURIComponent(tokenFields);
      }
      if (!tokenFields.endsWith(':')) {
        tokenFields = tokenFields + ':';
      }
    }
    
    // Processar tokenUnlocked
    if (tokenUnlocked && tokenUnlocked.includes('%')) {
      tokenUnlocked = decodeURIComponent(tokenUnlocked);
    }
    
    return { tokenFields, tokenUnlocked };
  }

  // ========================================
  // RESOLVER TURNSTILE (CLOUDFLARE)
  // ========================================
  async solveTurnstile(pageUrl) {
    const sitekey = '0x4AAAAAABzciTXYJNKPGEVl';
    
    if (!this.apiKey2captcha) {
      throw new Error('CAPTCHA_2CAPTCHA_API_KEY não configurada');
    }
    
    this.log('Resolvendo Turnstile via 2Captcha...');
    
    try {
      // Criar tarefa
      const submitResponse = await axios.get('https://2captcha.com/in.php', {
        params: {
          key: this.apiKey2captcha,
          method: 'turnstile',
          sitekey: sitekey,
          pageurl: pageUrl,
          json: 1
        }
      });

      if (submitResponse.data.status !== 1) {
        throw new Error(`2Captcha erro: ${submitResponse.data.request}`);
      }

      const captchaId = submitResponse.data.request;
      this.log(`Task 2Captcha criada: ${captchaId}`);

      // Aguardar resolução (máximo 2 minutos)
      for (let i = 0; i < 40; i++) {
        await this.sleep(3000);
        
        const resultResponse = await axios.get('https://2captcha.com/res.php', {
          params: {
            key: this.apiKey2captcha,
            action: 'get',
            id: captchaId,
            json: 1
          }
        });

        if (resultResponse.data.status === 1) {
          this.log(`Turnstile resolvido em ${(i + 1) * 3}s!`, 'SUCCESS');
          return resultResponse.data.request;
        }

        if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2Captcha erro: ${resultResponse.data.request}`);
        }
        
        if ((i + 1) % 10 === 0) {
          this.log(`Aguardando Turnstile... ${(i + 1) * 3}s`);
        }
      }

      throw new Error('Timeout aguardando 2Captcha (2 minutos)');

    } catch (error) {
      this.log(`Erro no Turnstile: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // ========================================
  // FAZER LOGIN
  // ========================================
  async login() {
    this.log('Iniciando login...');
    const startTime = Date.now();
    
    try {
      // PASSO 1: Gerar device_id
      this.deviceId = this.generateDeviceId();
      this.log(`Device ID: ${this.deviceId}`);

      // PASSO 2: Acessar página inicial COM device_id no cookie
      this.log('Acessando página inicial...');
      
      const initialResponse = await this.client.get('/', {
        headers: {
          'Cookie': `device_id=${this.deviceId}`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 5
      });
      
      this.log(`Status inicial: ${initialResponse.status}`);
      
      // Inicializar cookies COM device_id
      this.cookies = { device_id: this.deviceId };
      
      // Extrair cookies da resposta
      this.extractCookiesFromResponse(initialResponse);
      
      this.log(`Cookies obtidos: ${Object.keys(this.cookies).join(', ')}`);

      // CSRF Token vem no COOKIE (não no HTML!)
      if (this.cookies.csrfToken) {
        this.csrfToken = this.cookies.csrfToken;
        this.log('CSRF Token obtido do cookie', 'SUCCESS');
      } else {
        throw new Error('CSRF Token não encontrado nos cookies');
      }

      // Extrair _Token[fields] e _Token[unlocked] do HTML
      const html = initialResponse.data;
      const { tokenFields, tokenUnlocked } = this.extractTokensFromHtml(html);

      // PASSO 3: Salvar device
      this.log('Salvando device...');
      try {
        await this.client.post('/login-sessions/save-devices', 
          JSON.stringify({
            browser: 'Chrome',
            version: '121.0.0.0',
            platform: 'Windows',
            isMobile: false,
            fingerprint: this.deviceId
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cookie': this.getCookieString(),
              'X-Csrf-Token': this.csrfToken,
              'X-Requested-With': 'XMLHttpRequest'
            }
          }
        );
        this.log('Device salvo');
      } catch (e) {
        this.log('Aviso: Erro ao salvar device (não crítico)', 'WARNING');
      }

      // PASSO 4: Resolver Turnstile
      const turnstileToken = await this.solveTurnstile(this.baseUrl + '/');

      // PASSO 5: Fazer login (POST para / NÃO /login!)
      this.log('Enviando credenciais...');
      
      const postBodyParts = [
        `_method=POST`,
        `_csrfToken=${encodeURIComponent(this.csrfToken)}`,
        `username=${encodeURIComponent(this.username)}`,
        `password=${encodeURIComponent(this.password)}`,
        `cf-turnstile-response=${encodeURIComponent(turnstileToken)}`
      ];
      
      // Adicionar tokens de segurança
      if (tokenFields) {
        postBodyParts.push(`_Token%5Bfields%5D=${encodeURIComponent(tokenFields)}`);
      }
      if (tokenUnlocked) {
        postBodyParts.push(`_Token%5Bunlocked%5D=${encodeURIComponent(tokenUnlocked)}`);
      }
      
      const postBody = postBodyParts.join('&');
      const cookieString = this.getCookieString() + `; device_id=${this.deviceId}`;

      this.log(`POST para / com username: ${this.username}`);

      const loginResponse = await this.client.post('/', postBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString,
          'Origin': this.baseUrl,
          'Referer': this.baseUrl + '/',
          'Upgrade-Insecure-Requests': '1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      this.log(`Status do login: ${loginResponse.status}`);
      this.extractCookiesFromResponse(loginResponse);

      // PASSO 6: Testar acesso ao painel
      this.log('Verificando acesso ao painel...');
      
      const testResponse = await this.client.get('/gerenciador/home', {
        headers: {
          'Cookie': this.getCookieString()
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      this.extractCookiesFromResponse(testResponse);

      // Verificar se está logado
      if (testResponse.status === 302) {
        const location = testResponse.headers.location || '';
        if (location === '/' || location.includes('login')) {
          throw new Error('Login falhou - redirecionado para login');
        }
      }
      
      if (testResponse.status === 200) {
        const isLoginPage = typeof testResponse.data === 'string' && 
                           testResponse.data.includes('Acessar o Painel');
        if (isLoginPage) {
          throw new Error('Login falhou - ainda na página de login');
        }
      }

      // Login bem-sucedido!
      this.loggedIn = true;
      this.loginCount++;
      this.sessionStartTime = new Date().toISOString();
      this.lastCheckTime = new Date().toISOString();
      this.lastActivity = new Date().toISOString();
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.log(`LOGIN #${this.loginCount} realizado com sucesso em ${elapsed}s`, 'SUCCESS');
      
      // Salvar no banco
      this.saveToDatabase();
      
      return true;

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
      this.log('Verificando sessão...');
      
      const response = await this.client.get('/gerenciador/home', {
        headers: {
          'Cookie': this.getCookieString()
        },
        maxRedirects: 5,
        validateStatus: () => true
      });
      
      this.extractCookiesFromResponse(response);
      this.lastCheckTime = new Date().toISOString();
      
      // Verificar se foi redirecionado para login
      const finalUrl = response.request?.res?.responseUrl || response.config.url;
      
      const isLoginPage = typeof response.data === 'string' && (
        response.data.includes('Acessar o Painel') ||
        response.data.includes('name="username"') ||
        response.data.includes('cf-turnstile')
      );
      
      if (finalUrl.includes('login') || finalUrl === this.baseUrl + '/' || isLoginPage) {
        this.log('Sessão EXPIROU!', 'WARNING');
        this.loggedIn = false;
        this.saveToDatabase();
        return false;
      }
      
      // Sessão ativa
      if (response.status === 200 && !isLoginPage) {
        this.lastActivity = new Date().toISOString();
        this.log('Sessão ATIVA ✓', 'SUCCESS');
        this.saveToDatabase();
        return true;
      }
      
      this.log('Status da sessão incerto', 'WARNING');
      return false;

    } catch (error) {
      this.log(`Erro ao verificar sessão: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // ========================================
  // GARANTIR SESSÃO ATIVA
  // ========================================
  async ensureLoggedIn() {
    if (!this.loggedIn || Object.keys(this.cookies).length === 0) {
      this.log('Sessão não iniciada, fazendo login...');
      await this.login();
      return;
    }
    
    const isActive = await this.checkSession();
    
    if (!isActive) {
      this.log('Sessão expirou, re-logando...');
      await this.login();
    }
  }

  // ========================================
  // RENOVAR USUÁRIO
  // ========================================
  async renewClient(userId) {
    await this.ensureLoggedIn();
    
    this.log(`Renovando usuário: ${userId}`);
    
    try {
      const payload = `ids%5B%5D=${userId}`; // ids[]=userId
      
      const response = await this.client.post('/users/renova-users-selecionados', 
        payload,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'Cookie': this.getCookieString(),
            'X-Requested-With': 'XMLHttpRequest',
            'X-Csrf-Token': this.csrfToken,
            'Accept': '*/*',
            'Origin': this.baseUrl,
            'Referer': this.baseUrl + '/gerenciador/usuario-iptv'
          },
          timeout: 30000
        }
      );

      this.lastActivity = new Date().toISOString();
      this.saveToDatabase();
      
      const responseBody = response.data;
      
      // Verificar se sessão expirou
      const isLoginPage = typeof responseBody === 'string' && (
        responseBody.includes('<!DOCTYPE html') || 
        responseBody.includes('Acessar o Painel') ||
        responseBody.includes('name="username"')
      );

      if (isLoginPage) {
        this.log('Sessão expirou durante renovação!', 'WARNING');
        this.loggedIn = false;
        await this.login();
        return await this.renewClient(userId);
      }
      
      // Verificar sucesso
      let sucesso = false;
      let mensagem = '';
      
      if (typeof responseBody === 'object' && responseBody.success) {
        sucesso = true;
        mensagem = responseBody.success;
        this.log(`Usuário ${userId} renovado com sucesso!`, 'SUCCESS');
      } else if (response.status === 200 && !responseBody.error) {
        sucesso = true;
        mensagem = 'Renovado (status 200)';
        this.log(`Usuário ${userId} renovado!`, 'SUCCESS');
      } else {
        mensagem = responseBody.error || JSON.stringify(responseBody);
        this.log(`Falha ao renovar ${userId}: ${mensagem}`, 'ERROR');
      }

      return {
        success: sucesso,
        clientId: userId,
        message: mensagem,
        response: responseBody,
        mode: 'keeper',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.log(`Erro ao renovar ${userId}: ${error.message}`, 'ERROR');
      return {
        success: false,
        clientId: userId,
        error: error.message,
        mode: 'keeper',
        timestamp: new Date().toISOString()
      };
    }
  }

  // ========================================
  // RENOVAR MÚLTIPLOS MESES
  // ========================================
  async renewClientMultipleMonths(clientId, months) {
    this.log(`Renovando cliente ${clientId} por ${months} mês(es)...`);
    
    const results = [];
    
    for (let i = 0; i < months; i++) {
      this.log(`Renovação ${i + 1}/${months}...`);
      
      const result = await this.renewClient(clientId);
      results.push(result);
      
      if (!result.success) {
        this.log(`Falha na renovação ${i + 1}, abortando`, 'ERROR');
        break;
      }
      
      if (i < months - 1) {
        this.log('Aguardando 2s...');
        await this.sleep(2000);
      }
    }
    
    const sucessos = results.filter(r => r.success).length;
    
    return {
      success: sucessos === months,
      total: months,
      completed: sucessos,
      failed: months - sucessos,
      results
    };
  }

  // ========================================
  // FECHAR SESSÃO
  // ========================================
  close() {
    this.log('Fechando sessão...');
    this.cookies = {};
    this.csrfToken = null;
    this.loggedIn = false;
    this.sessionStartTime = null;
    this.lastCheckTime = null;
    this.lastActivity = null;
    
    // Remover do banco
    db.deleteCloudNationSession(this.userId, this.baseUrl);
  }
}

export default CloudNationSession;
