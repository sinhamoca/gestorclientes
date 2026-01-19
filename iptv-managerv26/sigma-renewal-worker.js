/* ========================================
   SIGMA RENEWAL SERVICE - VIA CLOUDFLARE WORKER
   
   Versão atualizada que usa Cloudflare Worker para bypass
   ao invés de proxy residencial + curl-impersonate
   
   VANTAGENS:
   - Elimina custo de proxy residencial
   - Mais confiável (Cloudflare não bloqueia a si mesmo)
   - Mais rápido (sem overhead de proxy SOCKS5)
   - Funciona de qualquer lugar (não precisa de IP brasileiro)
   
   CONFIGURAÇÃO:
   - SIGMA_WORKER_URL: URL do seu Cloudflare Worker
   - SIGMA_WORKER_SECRET: Chave secreta para autenticação
   ======================================== */

import axios from 'axios';

class SigmaRenewalService {
    constructor(domain, username, password, useWorker = true) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.useWorker = useWorker;
        this.authToken = null;
        
        // Configuração do Worker - NOVO WORKER DEDICADO SIGMA
        this.workerUrl = process.env.SIGMA_WORKER_URL || 'https://summer-forest-2bc5sigma.isaacofc2.workers.dev';
        this.workerSecret = process.env.SIGMA_WORKER_SECRET || 'MinhaChaveSigma2024!';
        
        // Headers padrão para simular browser
        this.defaultHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        };
        
        // Cliente HTTP para comunicação com Worker
        this.client = axios.create({
            timeout: 60000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`🔧 [SIGMA] Inicializado com Worker: ${this.workerUrl}`);
        console.log(`🌐 [SIGMA] Domínio alvo: ${this.domain}`);
    }

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    /**
     * Faz requisição via Cloudflare Worker
     * O Worker atua como proxy, bypassando a proteção Cloudflare
     */
    async request(method, path, data = null, customHeaders = {}) {
        const url = `${this.domain}${path}`;
        
        console.log(`📤 [SIGMA] ${method} ${path}`);
        
        // Montar headers finais
        const headers = {
            ...this.defaultHeaders,
            ...customHeaders,
            'Origin': this.domain,
            'Referer': `${this.domain}/`
        };
        
        // Adicionar token de autenticação se existir
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        // Payload para o Worker
        const workerPayload = {
            method,
            url,
            headers
        };
        
        // Adicionar body se necessário
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            workerPayload.body = data;
        }
        
        try {
            // Fazer requisição para o Worker
            const response = await this.client.post(
                `${this.workerUrl}/proxy`,
                workerPayload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Proxy-Secret': this.workerSecret
                    }
                }
            );
            
            const result = response.data;
            
            // Log do resultado
            console.log(`📥 [SIGMA] Status: ${result.status} | Success: ${result.success}`);
            
            // Verificar se a requisição foi bem-sucedida
            if (!result.success && result.status >= 400) {
                console.error(`❌ [SIGMA] Erro na requisição: ${JSON.stringify(result.data)}`);
                throw new Error(`HTTP ${result.status}: ${result.statusText}`);
            }
            
            // Retornar dados da resposta
            return result.data;
            
        } catch (error) {
            // Se for erro do axios, extrair detalhes
            if (error.response) {
                console.error(`❌ [SIGMA] Worker retornou erro:`, {
                    status: error.response.status,
                    data: error.response.data
                });
                throw new Error(`Worker error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            
            console.error(`❌ [SIGMA] Erro de conexão:`, error.message);
            throw error;
        }
    }

    /**
     * Inicializa sessão acessando página inicial
     * Isso pode ser útil para alguns painéis que requerem cookies iniciais
     */
    async initSession() {
        console.log(`🔄 [SIGMA] Inicializando sessão: ${this.domain}`);
        
        try {
            // Acessar página inicial via Worker
            const result = await this.request('GET', '/', null, {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            });
            
            console.log(`✅ [SIGMA] Sessão inicializada`);
            return true;
            
        } catch (error) {
            console.warn(`⚠️ [SIGMA] Erro ao inicializar sessão (continuando): ${error.message}`);
            // Não falhar aqui, alguns painéis não precisam dessa etapa
            return true;
        }
    }

    /**
     * Fazer login no painel Sigma
     */
    async login() {
        console.log(`🔐 [SIGMA] Fazendo login: ${this.username}`);
        
        // Inicializar sessão (opcional, mas recomendado)
        await this.initSession();
        
        // Aguardar um pouco para simular comportamento humano
        await this.delay(2);
        
        // Headers específicos para login
        const loginHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };
        
        // Payload de login (formato padrão Sigma)
        const loginData = {
            captcha: "not-a-robot",
            captchaChecked: true,
            username: this.username,
            password: this.password,
            twofactor_code: "",
            twofactor_recovery_code: "",
            twofactor_trusted_device_id: ""
        };
        
        // Fazer requisição de login
        const response = await this.request('POST', '/api/auth/login', loginData, loginHeaders);
        
        // Verificar resposta
        if (response.token) {
            this.authToken = response.token;
            console.log('✅ [SIGMA] Login realizado com sucesso!');
            console.log(`🔑 [SIGMA] Token: ${this.authToken.substring(0, 30)}...`);
            return response;
        }
        
        // Tentar extrair token de estrutura alternativa
        if (response.data?.token) {
            this.authToken = response.data.token;
            console.log('✅ [SIGMA] Login realizado com sucesso!');
            return response;
        }
        
        // Se não encontrou token, falhar
        throw new Error(`Login falhou: ${JSON.stringify(response)}`);
    }

    /**
     * Buscar cliente pelo username
     */
    async findCustomerByUsername(targetUsername) {
        console.log(`🔍 [SIGMA] Buscando cliente: ${targetUsername}`);
        
        // Parâmetros de busca
        const searchParams = new URLSearchParams({
            page: '1',
            username: targetUsername,
            serverId: '',
            packageId: '',
            expiryFrom: '',
            expiryTo: '',
            status: '',
            isTrial: '',
            connections: '',
            perPage: '20'
        });
        
        const searchUrl = `/api/customers?${searchParams.toString()}`;
        
        // Fazer busca
        const response = await this.request('GET', searchUrl, null, {
            'Accept': 'application/json'
        });
        
        // Extrair lista de clientes
        let customers = [];
        if (Array.isArray(response)) {
            customers = response;
        } else if (response.data && Array.isArray(response.data)) {
            customers = response.data;
        }
        
        console.log(`📊 [SIGMA] Clientes encontrados: ${customers.length}`);
        
        // Buscar por username exato
        let customer = customers.find(c => c.username === targetUsername);
        
        // Fallback: buscar por note (alguns painéis salvam username no campo note)
        if (!customer) {
            customer = customers.find(c => 
                c.note && c.note.toLowerCase().includes(targetUsername.toLowerCase())
            );
        }
        
        // Fallback: buscar por user_id
        if (!customer) {
            customer = customers.find(c => c.user_id === targetUsername);
        }
        
        if (customer) {
            console.log(`✅ [SIGMA] Cliente encontrado!`);
            console.log(`   👤 Username: ${customer.username}`);
            console.log(`   🆔 ID: ${customer.id || customer.user_id}`);
            console.log(`   📅 Expira: ${customer.expires_at || 'N/A'}`);
            return customer;
        }
        
        throw new Error(`Cliente ${targetUsername} não encontrado`);
    }

    /**
     * Renovar cliente
     */
    async renewClient(customerId, packageId, connections = 1) {
        console.log(`\n🔄 [SIGMA] Renovando cliente...`);
        console.log(`   🆔 Customer ID: ${customerId}`);
        console.log(`   📦 Package ID: ${packageId}`);
        console.log(`   🔌 Conexões: ${connections}`);

        // Aguardar um pouco para simular comportamento humano
        await this.delay(2);

        // Headers para renovação
        const renewHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };

        // Payload de renovação
        const payload = {
            package_id: packageId,
            connections: parseInt(connections)
        };

        // Fazer requisição de renovação
        const response = await this.request(
            'POST',
            `/api/customers/${customerId}/renew`,
            payload,
            renewHeaders
        );

        // Detectar sucesso por múltiplos critérios
        const hasSuccessMessage = response.message && response.message.includes('sucesso');
        const hasExpiresAt = response.expires_at || (response.data && response.data.expires_at);
        const hasActiveStatus = response.status === 'ACTIVE' || (response.data && response.data.status === 'ACTIVE');

        if (hasSuccessMessage || hasExpiresAt || hasActiveStatus) {
            console.log('✅ [SIGMA] Renovação realizada com sucesso!');
            const customerData = response.data || response;
            return {
                success: true,
                response: customerData,
                expires_at: customerData.expires_at,
                status: customerData.status
            };
        }
        
        // Se a resposta não tem indicadores claros de sucesso mas também não tem erro
        // Considerar sucesso se tiver dados do cliente
        if (response.id || response.username) {
            console.log('✅ [SIGMA] Renovação aparentemente bem-sucedida');
            return {
                success: true,
                response: response,
                expires_at: response.expires_at,
                status: response.status
            };
        }

        throw new Error(`Renovação falhou: ${JSON.stringify(response)}`);
    }

    /**
     * Buscar servidores e pacotes
     */
    async getServers() {
        console.log('📥 [SIGMA] Buscando servidores e pacotes...');
        
        const response = await this.request('GET', '/api/servers', null, {
            'Accept': 'application/json'
        });
        
        let servers = [];
        if (response.data && Array.isArray(response.data)) {
            servers = response.data;
        } else if (Array.isArray(response)) {
            servers = response;
        }
        
        console.log(`✅ [SIGMA] ${servers.length} servidores encontrados`);
        return servers;
    }

    /**
     * Buscar clientes paginados
     */
    async getCustomers(page = 1, perPage = 100) {
        console.log(`📥 [SIGMA] Buscando clientes (página ${page})...`);
        
        const response = await this.request(
            'GET', 
            `/api/customers?page=${page}&perPage=${perPage}`,
            null,
            { 'Accept': 'application/json' }
        );
        
        let customers = [];
        if (response.data && Array.isArray(response.data)) {
            customers = response.data;
        } else if (Array.isArray(response)) {
            customers = response;
        }
        
        console.log(`📊 [SIGMA] ${customers.length} clientes na página ${page}`);
        return customers;
    }
}

export default SigmaRenewalService;
