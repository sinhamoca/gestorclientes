/* ========================================
   CLOUDNATION SERVICE
   Automação de login e importação de clientes
   Adaptado dos scripts fornecidos
   
   🔧 CORREÇÃO: Regex mais robusto para _Token[fields]
   ======================================== */

import axios from 'axios';
import * as cheerio from 'cheerio';

class CloudNationService {
  constructor(username, password, apiKey2captcha) {
    this.username = username;
    this.password = password;
    this.apiKey2captcha = apiKey2captcha;
    this.baseUrl = 'https://painel.cloudnation.top';
    
    this.cookies = {};
    this.csrfToken = null;
    this.deviceId = null;
    
    this.session = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Sec-Ch-Ua': '"Chromium";v="121", "Not A(Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      }
    });
  }

  // ============= TURNSTILE (CLOUDFLARE) =============
  
  async solveTurnstile(pageUrl) {
    try {
      const sitekey = '0x4AAAAAABzciTXYJNKPGEVl';
      
      console.log('🔐 [CN] Resolvendo Turnstile...');
      
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
      console.log(`   📝 ID: ${captchaId}`);

      // Poll para resultado
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
          const token = resultResponse.data.request;
          console.log(`   ✅ Token obtido`);
          return token;
        }

        if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2Captcha erro: ${resultResponse.data.request}`);
        }
      }

      throw new Error('Timeout aguardando 2Captcha');
    } catch (error) {
      console.error(`❌ [CN] Erro Turnstile: ${error.message}`);
      throw error;
    }
  }

  // ============= EXTRAIR TOKENS DO HTML (MÉTODO ROBUSTO) =============
  
  extractTokensFromHtml(html) {
    console.log('🔍 [CN] Extraindo tokens do HTML...');
    console.log(`   📄 HTML length: ${html.length} caracteres`);
    
    let tokenFields = '';
    let tokenUnlocked = '';
    
    // MÉTODO 1: Usar Cheerio (mais confiável)
    try {
      const $ = cheerio.load(html);
      
      // Buscar _Token[fields]
      const fieldsInput = $('input[name="_Token[fields]"]');
      if (fieldsInput.length > 0) {
        tokenFields = fieldsInput.attr('value') || '';
        console.log('   ✅ [CHEERIO] _Token[fields] encontrado');
      }
      
      // Buscar _Token[unlocked]
      const unlockedInput = $('input[name="_Token[unlocked]"]');
      if (unlockedInput.length > 0) {
        tokenUnlocked = unlockedInput.attr('value') || '';
        console.log('   ✅ [CHEERIO] _Token[unlocked] encontrado');
      }
    } catch (cheerioError) {
      console.log(`   ⚠️  [CHEERIO] Erro: ${cheerioError.message}`);
    }
    
    // MÉTODO 2: Regex como fallback (múltiplos padrões)
    if (!tokenFields) {
      console.log('   🔄 [REGEX] Tentando extrair _Token[fields]...');
      
      // Padrão 1: name primeiro, depois value
      let match = html.match(/name=["']_Token\[fields\]["'][^>]*value=["']([^"']+)["']/i);
      
      // Padrão 2: value primeiro, depois name
      if (!match) {
        match = html.match(/value=["']([^"']+)["'][^>]*name=["']_Token\[fields\]["']/i);
      }
      
      // Padrão 3: Buscar o input inteiro e extrair value
      if (!match) {
        const inputMatch = html.match(/<input[^>]*name=["']_Token\[fields\]["'][^>]*>/i);
        if (inputMatch) {
          const valueMatch = inputMatch[0].match(/value=["']([^"']+)["']/i);
          if (valueMatch) {
            match = valueMatch;
          }
        }
      }
      
      // Padrão 4: Qualquer input com _Token[fields]
      if (!match) {
        match = html.match(/_Token\[fields\][^>]+value=["']([^"']+)["']/i);
      }
      
      if (match) {
        tokenFields = match[1];
        console.log('   ✅ [REGEX] _Token[fields] encontrado');
      } else {
        console.log('   ❌ [REGEX] _Token[fields] NÃO encontrado');
        
        // Debug: mostrar trecho do HTML onde deveria estar
        if (html.includes('_Token')) {
          const tokenIndex = html.indexOf('_Token');
          console.log('   🔍 [DEBUG] Trecho com _Token:');
          console.log(`      "${html.substring(tokenIndex, tokenIndex + 200)}"`);
        } else {
          console.log('   ❌ [DEBUG] String "_Token" não encontrada no HTML');
        }
      }
    }
    
    // MÉTODO 2b: Regex para _Token[unlocked]
    if (!tokenUnlocked) {
      console.log('   🔄 [REGEX] Tentando extrair _Token[unlocked]...');
      
      let match = html.match(/name=["']_Token\[unlocked\]["'][^>]*value=["']([^"']*)["']/i);
      
      if (!match) {
        match = html.match(/value=["']([^"']*)["'][^>]*name=["']_Token\[unlocked\]["']/i);
      }
      
      if (!match) {
        match = html.match(/_Token\[unlocked\][^>]+value=["']([^"']*)["']/i);
      }
      
      if (match) {
        tokenUnlocked = match[1];
        console.log('   ✅ [REGEX] _Token[unlocked] encontrado');
      } else {
        console.log('   ⚠️  [REGEX] _Token[unlocked] não encontrado, usando padrão');
        tokenUnlocked = 'cf-turnstile-response|g-recaptcha-response';
      }
    }
    
    // Processar tokenFields
    if (tokenFields) {
      // Decodificar se necessário
      if (tokenFields.includes('%')) {
        tokenFields = decodeURIComponent(tokenFields);
      }
      // Garantir que termina com :
      if (!tokenFields.endsWith(':')) {
        tokenFields = tokenFields + ':';
      }
      console.log(`   📝 Token[fields]: ${tokenFields.substring(0, 50)}...`);
    }
    
    // Processar tokenUnlocked
    if (tokenUnlocked && tokenUnlocked.includes('%')) {
      tokenUnlocked = decodeURIComponent(tokenUnlocked);
    }
    console.log(`   📝 Token[unlocked]: ${tokenUnlocked}`);
    
    return { tokenFields, tokenUnlocked };
  }

  // ============= LOGIN =============
  
  async login() {
    try {
      console.log('\n🔑 [CN] Iniciando login...\n');
      
      // Gerar device_id
      this.deviceId = this.generateDeviceId();
      console.log(`   🆔 Device ID: ${this.deviceId}`);
      
      // PASSO 1: GET inicial para pegar cookies
      console.log('\n📥 [CN] PASSO 1: Obtendo página inicial...');
      
      const initialResponse = await this.session.get('/', {
        headers: {
          'Cookie': `device_id=${this.deviceId}`,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 5
      });
      
      console.log(`   📊 Status: ${initialResponse.status}`);
      
      // Extrair cookies
      this.cookies = { device_id: this.deviceId };
      const setCookieHeader = initialResponse.headers['set-cookie'];
      if (setCookieHeader) {
        setCookieHeader.forEach(cookie => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          this.cookies[name.trim()] = value.trim();
        });
      }
      
      console.log(`   🍪 Cookies: ${Object.keys(this.cookies).join(', ')}`);

      this.csrfToken = this.cookies.csrfToken;
      
      if (!this.csrfToken) {
        throw new Error('CSRF Token não encontrado nos cookies');
      }
      
      console.log(`   ✅ CSRF Token obtido`);

      // Extrair tokens do HTML usando método robusto
      const html = initialResponse.data;
      const { tokenFields, tokenUnlocked } = this.extractTokensFromHtml(html);
      
      // Verificar se conseguiu extrair o tokenFields
      if (!tokenFields) {
        console.error('❌ [CN] ERRO CRÍTICO: _Token[fields] não encontrado no HTML');
        console.log('   💡 Possíveis causas:');
        console.log('      1. CloudNation mudou a estrutura da página');
        console.log('      2. Cloudflare bloqueou a requisição');
        console.log('      3. Sessão inválida');
        
        // Salvar HTML para debug
        const fs = await import('fs');
        const debugPath = '/app/data/cloudnation-debug.html';
        try {
          fs.writeFileSync(debugPath, html);
          console.log(`   📁 HTML salvo em: ${debugPath}`);
        } catch (e) {
          console.log(`   ⚠️  Não foi possível salvar HTML de debug`);
        }
        
        throw new Error('Token de segurança não encontrado na página. O CloudNation pode ter mudado a estrutura.');
      }

      // PASSO 2: Salvar device
      console.log('\n📤 [CN] PASSO 2: Salvando device...');
      try {
        await this.session.post('/login-sessions/save-devices',
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
              'Cookie': Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '),
              'X-Csrf-Token': this.csrfToken,
              'X-Requested-With': 'XMLHttpRequest'
            }
          }
        );
        console.log('   ✅ Device salvo');
      } catch (error) {
        console.log('   ⚠️  Erro ao salvar device (ignorando):', error.message);
      }

      // PASSO 3: Resolver Turnstile
      console.log('\n🔐 [CN] PASSO 3: Resolvendo Turnstile...');
      const turnstileToken = await this.solveTurnstile(this.baseUrl + '/');

      // PASSO 4: Fazer login
      console.log('\n📤 [CN] PASSO 4: Enviando credenciais...');
      
      const postBodyParts = [
        `_method=POST`,
        `_csrfToken=${encodeURIComponent(this.csrfToken)}`,
        `username=${encodeURIComponent(this.username)}`,
        `password=${encodeURIComponent(this.password)}`,
        `cf-turnstile-response=${encodeURIComponent(turnstileToken)}`,
        `_Token%5Bfields%5D=${encodeURIComponent(tokenFields)}`,
        `_Token%5Bunlocked%5D=${encodeURIComponent(tokenUnlocked)}`
      ];

      const postBody = postBodyParts.join('&');
      const cookieString = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ') + `; device_id=${this.deviceId}`;

      console.log(`   👤 Username: ${this.username}`);
      console.log(`   📤 POST para /`);

      const loginResponse = await this.session.post('/', postBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString,
          'Origin': this.baseUrl,
          'Referer': this.baseUrl + '/',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      console.log(`   📊 Status: ${loginResponse.status}`);

      // Atualizar cookies
      const loginSetCookie = loginResponse.headers['set-cookie'];
      if (loginSetCookie) {
        loginSetCookie.forEach(cookie => {
          const [nameValue] = cookie.split(';');
          const [name, value] = nameValue.split('=');
          const cookieName = name.trim();
          const cookieValue = value.trim();
          
          if (cookieValue !== 'deleted') {
            this.cookies[cookieName] = cookieValue;
          }
        });
      }

      // PASSO 5: Testar acesso
      console.log('\n🔍 [CN] PASSO 5: Testando acesso ao painel...');
      const testCookieString = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      
      const testResponse = await this.session.get('/gerenciador/home', {
        headers: {
          'Cookie': testCookieString
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

      console.log(`   📊 Status: ${testResponse.status}`);

      if (testResponse.status === 302) {
        const location = testResponse.headers.location || '';
        if (location === '/' || location.includes('login')) {
          throw new Error('Login falhou - redirecionado para login');
        }
      }

      const isLoginPage = typeof testResponse.data === 'string' && 
                         testResponse.data.includes('Acessar o Painel') &&
                         testResponse.data.includes('name="username"');

      if (isLoginPage) {
        throw new Error('Login falhou - retornou página de login');
      }

      console.log('✅ [CN] Login bem-sucedido!\n');
      return true;

    } catch (error) {
      console.error('❌ [CN] Erro no login:', error.message);
      throw error;
    }
  }

  // ============= IMPORTAR CLIENTES =============
  
  async importarClientes() {
    try {
      console.log('📥 [CN] Importando clientes...\n');
      
      const todosClientes = [];
      let pagina = 1;
      let temMaisPaginas = true;

      while (temMaisPaginas) {
        console.log(`   📄 Página ${pagina}...`);
        
        try {
          const cookieString = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
          
          const response = await this.session.get(`/gerenciador/usuario-iptv?page=${pagina}`, {
            headers: {
              'Cookie': cookieString
            },
            validateStatus: (status) => status >= 200 && status <= 500
          });

          // Verificar se página não existe (404)
          if (response.status === 404) {
            console.log(`      ⛔ Página ${pagina} não existe (fim)`);
            temMaisPaginas = false;
            break;
          }

          // Verificar se sessão expirou
          if (response.status === 302 || 
              (typeof response.data === 'string' && response.data.includes('Acessar o Painel'))) {
            console.log('      ❌ Sessão expirou!');
            throw new Error('Sessão expirada');
          }

          if (response.status === 200) {
            const clientes = this.extrairClientesDaPagina(response.data);
            
            if (clientes.length > 0) {
              todosClientes.push(...clientes);
              console.log(`      ✅ ${clientes.length} clientes válidos encontrados`);
            } else {
              console.log(`      ⚠️  Nenhum cliente válido nesta página`);
            }
            
            // Sempre ir para próxima página
            pagina++;
            await this.sleep(500);
          } else {
            temMaisPaginas = false;
          }

        } catch (error) {
          if (error.response && error.response.status === 404) {
            console.log(`      ⛔ Página ${pagina} não existe (fim)`);
            temMaisPaginas = false;
          } else {
            console.error(`      ❌ Erro na página ${pagina}:`, error.message);
            temMaisPaginas = false;
          }
        }
      }

      console.log(`\n📊 [CN] TOTAL: ${todosClientes.length} clientes válidos\n`);
      return todosClientes;

    } catch (error) {
      console.error('❌ [CN] Erro ao importar clientes:', error.message);
      throw error;
    }
  }

  extrairClientesDaPagina(html) {
    const $ = cheerio.load(html);
    const clientes = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    $('tr').each((i, tr) => {
      const $tr = $(tr);
      
      const $checkbox = $tr.find('input[type="checkbox"][value]');
      if ($checkbox.length === 0) return;

      const id = $checkbox.attr('value');
      if (!id) return;

      const cells = $tr.find('td');
      if (cells.length < 6) return;

      const nome = $(cells[1]).text().trim();
      
      let dataCriacao = '';
      let dataVencimento = '';
      
      cells.each((index, cell) => {
        const texto = $(cell).text().trim();
        if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(texto)) {
          if (!dataCriacao) {
            dataCriacao = texto;
          } else if (!dataVencimento) {
            dataVencimento = texto;
          }
        }
      });

      if (!nome || !dataVencimento) return;

      const vencimento = this.parseData(dataVencimento);
      
      if (vencimento >= hoje) {
        clientes.push({
          id: id,
          nome: nome,
          dataCriacao: dataCriacao,
          dataVencimento: dataVencimento,
          vencimentoTimestamp: vencimento.getTime(),
          isActive: true
        });
      }
    });

    return clientes;
  }

  parseData(dataStr) {
    const partes = dataStr.split('/');
    let dia = parseInt(partes[0]);
    let mes = parseInt(partes[1]) - 1;
    let ano = parseInt(partes[2]);

    if (ano < 100) {
      ano += 2000;
    }

    return new Date(ano, mes, dia);
  }

  // ============= UTILS =============

  generateDeviceId() {
    return Array.from({length: 32}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default CloudNationService;