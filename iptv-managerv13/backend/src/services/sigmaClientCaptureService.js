/* ========================================
   SIGMA CLIENT CAPTURE SERVICE
   Captura todos os clientes de um domínio Sigma
   ======================================== */

import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

export default class SigmaClientCaptureService {
  constructor(domain, username, password) {
    this.domain = domain.replace(/\/$/, '');
    this.username = username;
    this.password = password;
    this.authToken = null;
    this.userId = null;
    this.client = null;
  }

  /**
   * Seleciona um proxy aleatório da lista
   */
  getRandomProxy() {
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
  createClient() {
    const proxy = this.getRandomProxy();
    
    console.log(`🔐 [SIGMA-CAPTURE] Usando proxy: ${proxy.username.substring(0, 20)}...`);
    
    // Construir URL SOCKS5 no formato correto
    const proxyUrl = `socks5://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
    const agent = new SocksProxyAgent(proxyUrl);
    
    return axios.create({
      baseURL: this.domain,
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

  async delay(seconds) {
    await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async login() {
    console.log(`🔐 [SIGMA-CAPTURE] Fazendo login em ${this.domain}...`);
    this.client = this.createClient();
    
    try {
      // Carregar página inicial
      const homeResponse = await this.client.get('/', { validateStatus: () => true });
      if (homeResponse.status !== 200) {
        throw new Error(`Erro ao carregar página inicial: ${homeResponse.status}`);
      }

      // Configurar cookies
      const cookies = homeResponse.headers['set-cookie'];
      if (cookies) {
        const cookieString = cookies.map(cookie => cookie.split(';')[0]).join('; ');
        this.client.defaults.headers['Cookie'] = cookieString;
      }

      await this.delay(2);

      // Configurar headers para API
      this.client.defaults.headers['Content-Type'] = 'application/json';
      this.client.defaults.headers['Origin'] = this.domain;
      this.client.defaults.headers['Referer'] = this.domain + '/';

      // Fazer login
      const loginResponse = await this.client.post('/api/auth/login', {
        captcha: "not-a-robot",
        captchaChecked: true,
        username: this.username,
        password: this.password,
        twofactor_code: "",
        twofactor_recovery_code: "",
        twofactor_trusted_device_id: ""
      }, { validateStatus: () => true });

      if (loginResponse.status === 200) {
        const userData = loginResponse.data;
        this.authToken = userData.token;
        this.userId = userData.id || userData.user_id || userData.userId;
        this.client.defaults.headers['Authorization'] = `Bearer ${this.authToken}`;
        
        console.log('✅ [SIGMA-CAPTURE] Login realizado com sucesso!');
        console.log(`   🆔 User ID: ${this.userId}`);
        console.log(`   👤 Username: ${this.username}`);
        
        return userData;
      } else {
        throw new Error(`Falha no login: ${loginResponse.status} - ${JSON.stringify(loginResponse.data)}`);
      }
    } catch (error) {
      console.error('❌ [SIGMA-CAPTURE] Erro no login:', error.message);
      throw error;
    }
  }

  async captureAllClients(resellerId, perPage = 100) {
    console.log(`\n📥 [SIGMA-CAPTURE] Iniciando captura de clientes...`);
    console.log(`   🆔 Revendedor ID: ${resellerId}`);
    console.log(`   📄 Itens por página: ${perPage}\n`);

    let allClients = [];
    let currentPage = 1;
    let hasMorePages = true;
    let totalPages = 0;

    try {
      while (hasMorePages) {
        console.log(`📄 [SIGMA-CAPTURE] Capturando página ${currentPage}...`);

        const searchParams = new URLSearchParams({
          page: currentPage.toString(),
          username: '',
          userId: resellerId,
          serverId: '',
          packageId: '',
          expiryFrom: '',
          expiryTo: '',
          status: '',
          isTrial: '',
          connections: '',
          perPage: perPage.toString()
        });

        const response = await this.client.get(`/api/customers?${searchParams.toString()}`, {
          validateStatus: () => true
        });

        if (response.status !== 200) {
          console.log(`⚠️  [SIGMA-CAPTURE] Erro ao buscar página ${currentPage}: Status ${response.status}`);
          break;
        }

        let pageData = [];
        let pagination = null;

        // Extrair dados da resposta
        if (response.data.data && Array.isArray(response.data.data)) {
          pageData = response.data.data;
          pagination = response.data.meta || response.data.pagination || response.data;
        } else if (Array.isArray(response.data)) {
          pageData = response.data;
        }

        console.log(`   ✅ ${pageData.length} clientes encontrados nesta página`);

        // Processar clientes da página
        for (const client of pageData) {
          const clientData = {
            id_interno: client.id,
            id_externo: client.username,
            nome: client.note || client.name || client.username,
            senha: client.password || null,
            status: client.status,
            expira_em: client.expires_at_tz || client.expires_at,
            conexoes: client.connections,
            pacote: client.package,
            servidor: client.server,
            revendedor: client.reseller,
            tipo_conexao: client.connection_type
          };

          allClients.push(clientData);
        }

        // Verificar se há mais páginas
        if (pagination) {
          totalPages = pagination.last_page || pagination.total_pages || 0;
          const currentPageFromApi = pagination.current_page || pagination.page || currentPage;
          
          console.log(`   📊 Página ${currentPageFromApi} de ${totalPages || '?'}`);
          
          if (totalPages && currentPage >= totalPages) {
            hasMorePages = false;
          } else if (pageData.length < perPage) {
            hasMorePages = false;
          } else {
            currentPage++;
            await this.delay(1); // Delay entre páginas
          }
        } else {
          // Sem informação de paginação, verificar se há dados
          if (pageData.length < perPage) {
            hasMorePages = false;
          } else {
            currentPage++;
            await this.delay(1);
          }
        }
      }

      console.log(`\n✅ [SIGMA-CAPTURE] Captura concluída!`);
      console.log(`   📊 Total de páginas processadas: ${currentPage}`);
      console.log(`   👥 Total de clientes capturados: ${allClients.length}`);

      return allClients;
    } catch (error) {
      console.error('❌ [SIGMA-CAPTURE] Erro ao capturar clientes:', error.message);
      throw error;
    }
  }

  async logout() {
    if (this.authToken) {
      try {
        await this.client.post('/api/auth/logout', {}, { validateStatus: () => true });
        console.log('👋 [SIGMA-CAPTURE] Logout realizado');
      } catch (error) {
        console.log('⚠️  [SIGMA-CAPTURE] Erro no logout:', error.message);
      }
    }
  }
}