/* ========================================
   SIGMA RENEWAL SERVICE - RENOVAÇÃO AUTOMÁTICA
   Baseado no sigma.js fornecido pelo usuário
   Integrado ao sistema de webhooks do IPTV Manager
   COM SUPORTE A PROXY SOCKS5
   ======================================== */

import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';

class SigmaRenewalService {
    constructor(domain, username, password) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.authToken = null;
        this.client = null;
    }

    /**
     * Seleciona um proxy aleatório da lista
     */
    getRandomProxy() {
        const proxyList = process.env.SIGMA_PROXY_LIST;
        
        if (!proxyList) {
            console.warn('⚠️ [SIGMA-RENEWAL] SIGMA_PROXY_LIST não configurado no .env');
            return null;
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
     * Cria cliente axios com ou sem proxy SOCKS5
     */
    createClient() {
        const proxy = this.getRandomProxy();
        
        const config = {
            baseURL: this.domain,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
                'Accept': 'application/json',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        };

        // Se proxy estiver configurado, adicionar agent
        if (proxy) {
            console.log(`🔐 [SIGMA-RENEWAL] Usando proxy: ${proxy.username.substring(0, 20)}...`);
            const proxyUrl = `socks5://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
            const agent = new SocksProxyAgent(proxyUrl);
            config.httpAgent = agent;
            config.httpsAgent = agent;
        } else {
            console.log(`⚠️ [SIGMA-RENEWAL] Sem proxy configurado, conectando diretamente`);
        }

        return axios.create(config);
    }

    async delay(seconds) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async login() {
        console.log('🔑 [SIGMA] Fazendo login...');
        this.client = this.createClient();
        
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
            this.client.defaults.headers['Authorization'] = `Bearer ${this.authToken}`;
            console.log('✅ [SIGMA] Login realizado com sucesso!');
            return userData;
        } else {
            throw new Error(`Falha no login: ${loginResponse.status} - ${JSON.stringify(loginResponse.data)}`);
        }
    }

    async renewClient(customerId, packageId, connections = 1) {
        console.log(`\n🔄 [SIGMA] Iniciando renovação...`);
        console.log(`   🆔 Customer ID: ${customerId}`);
        console.log(`   📦 Package ID: ${packageId}`);
        console.log(`   🔌 Conexões: ${connections}`);

        await this.delay(2);

        const endpoint = `/api/customers/${customerId}/renew`;
        const renewalData = {
            package_id: packageId,
            connections: connections
        };

        try {
            const response = await this.client.post(endpoint, renewalData, {
                validateStatus: () => true
            });

            if (response.status === 200) {
                console.log('   ✅ Renovação realizada com sucesso!');
                console.log('   📋 Resposta:', JSON.stringify(response.data, null, 2));
                return { 
                    sucesso: true, 
                    customerId: customerId,
                    packageId: packageId,
                    connections: connections,
                    data: response.data,
                    timestamp: new Date().toISOString()
                };
            } else {
                console.log('   ❌ Erro na renovação');
                console.log('   📋 Status:', response.status);
                console.log('   📋 Resposta:', JSON.stringify(response.data, null, 2));
                return { 
                    sucesso: false,
                    customerId: customerId,
                    status: response.status,
                    error: response.data,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            console.log('   ❌ Erro na requisição de renovação:', error.message);
            return { 
                sucesso: false,
                customerId: customerId,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Renovar múltiplas vezes (para planos com mais de 1 mês)
     * O Sigma sempre renova por 1 período do pacote
     * Então precisamos renovar N vezes para N meses
     */
    async renewMultipleTimes(customerId, packageId, connections, times) {
        console.log(`\n📋 [SIGMA] Renovando ${times}x o cliente ID: ${customerId}...`);
        
        const resultados = [];
        
        for (let i = 0; i < times; i++) {
            console.log(`\n   [${i + 1}/${times}] Renovação #${i + 1}`);
            
            const resultado = await this.renewClient(customerId, packageId, connections);
            resultados.push(resultado);
            
            // Se falhou, parar
            if (!resultado.sucesso) {
                console.log(`   ⚠️ Renovação ${i + 1} falhou, interrompendo processo`);
                break;
            }
            
            // Aguardar entre renovações
            if (i < times - 1) {
                console.log(`   ⏳ Aguardando 3s antes da próxima renovação...`);
                await this.delay(3);
            }
        }
        
        const sucessos = resultados.filter(r => r.sucesso).length;
        
        console.log(`\n✅ [SIGMA] Renovações concluídas: ${sucessos}/${times}`);
        
        return {
            total: resultados.length,
            sucessos: sucessos,
            falhas: resultados.length - sucessos,
            resultados: resultados
        };
    }

    async logout() {
        if (this.authToken) {
            try {
                await this.client.post('/api/auth/logout', {}, { validateStatus: () => true });
                console.log('👋 [SIGMA] Logout realizado');
            } catch (error) {
                console.log('⚠️ [SIGMA] Erro no logout:', error.message);
            }
        }
    }
}

export default SigmaRenewalService;