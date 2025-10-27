/* ========================================
   CLOUDNATION SERVICE
   Automação de login e importação de clientes
   Adaptado dos scripts fornecidos
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

  // ============= LOGIN =============
  
  async login() {
    try {
      console.log('\n🔑 [CN] Iniciando login...\n');
      
      // Gerar device_id
      this.deviceId = this.generateDeviceId();
      
      // PASSO 1: GET inicial para pegar cookies
      const initialResponse = await this.session.get('/', {
        headers: {
          'Cookie': `device_id=${this.deviceId}`
        },
        maxRedirects: 5
      });
      
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

      this.csrfToken = this.cookies.csrfToken;

      // Extrair tokens do HTML
      const html = initialResponse.data;
      const tokenFieldsMatch = html.match(/name="_Token\[fields\]"\s+value="([^"]+)"/);
      const tokenUnlockedMatch = html.match(/name="_Token\[unlocked\]"\s+value="([^"]+)"/);
      
      let tokenFields = tokenFieldsMatch ? tokenFieldsMatch[1] : '';
      let tokenUnlocked = tokenUnlockedMatch ? tokenUnlockedMatch[1] : '';

      let tokenFieldsFinal = tokenFields;
      if (tokenFields && !tokenFields.endsWith(':')) {
        tokenFieldsFinal = tokenFields.replace(/%3A/g, ':');
        if (!tokenFieldsFinal.endsWith(':')) {
          tokenFieldsFinal = tokenFieldsFinal + ':';
        }
      } else if (!tokenFields) {
        tokenFieldsFinal = '3a8b9680acaf2e40786fd57433e6b74eaf1cf182:';
      }
      
      if (tokenUnlocked && tokenUnlocked.includes('%')) {
        tokenUnlocked = decodeURIComponent(tokenUnlocked);
      } else if (!tokenUnlocked) {
        tokenUnlocked = 'cf-turnstile-response|g-recaptcha-response';
      }

      // PASSO 2: Salvar device
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
      } catch (error) {
        // Ignorar erro
      }

      // PASSO 3: Resolver Turnstile
      const turnstileToken = await this.solveTurnstile(this.baseUrl + '/');

      // PASSO 4: Fazer login
      console.log('📤 [CN] Enviando credenciais...');
      
      const postBodyParts = [
        `_method=POST`,
        `_csrfToken=${encodeURIComponent(this.csrfToken)}`,
        `username=${encodeURIComponent(this.username)}`,
        `password=${encodeURIComponent(this.password)}`,
        `cf-turnstile-response=${encodeURIComponent(turnstileToken)}`,
        `_Token%5Bfields%5D=${encodeURIComponent(tokenFieldsFinal)}`,
        `_Token%5Bunlocked%5D=${encodeURIComponent(tokenUnlocked)}`
      ];

      const postBody = postBodyParts.join('&');
      const cookieString = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ') + `; device_id=${this.deviceId}`;

      const loginResponse = await this.session.post('/', postBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookieString,
          'Origin': this.baseUrl,
          'Referer': this.baseUrl + '/',
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

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

      // Testar acesso
      const testCookieString = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
      
      const testResponse = await this.session.get('/gerenciador/home', {
        headers: {
          'Cookie': testCookieString
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });

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
