/* ========================================
   KOFFICE SERVICE
   Integração com painéis Koffice
   
   Features:
   - Login com CSRF Token + hCaptcha
   - Anti-Captcha API integration
   - Captura paginada de clientes (DataTables API)
   - Parse HTML com Cheerio
   ======================================== */

import axios from 'axios';
import * as cheerio from 'cheerio';

class KofficeService {
    constructor(domain, username, password, resellerId) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.resellerId = resellerId;
        this.client = null;
        this.cookies = {};
        this.loggedIn = false;
        
        // Anti-Captcha key do .env
        this.anticaptchaKey = process.env.KOFFICE_ANTICAPTCHA_KEY;
    }

    /**
     * Criar cliente HTTP
     */
    createClient() {
        return axios.create({
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });
    }

    /**
     * Delay entre requisições
     */
    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    /**
     * Logger
     */
    log(message, type = 'info') {
        const symbols = { 
            info: '[Koffice]', 
            success: '[Koffice ✓]', 
            error: '[Koffice ✗]', 
            loading: '[Koffice ...]' 
        };
        console.log(`${symbols[type]} ${message}`);
    }

    /**
     * Obter CSRF Token e detectar hCaptcha
     */
    async getCsrfToken() {
        this.log('Acessando página de login...', 'loading');
        
        const response = await this.client.get(`${this.domain}/login/`);
        
        if (response.status !== 200) {
            throw new Error(`Falha ao acessar página: Status ${response.status}`);
        }

        // Extrair cookies
        if (response.headers['set-cookie']) {
            response.headers['set-cookie'].forEach(cookie => {
                const match = cookie.match(/^([^=]+)=([^;]+)/);
                if (match) {
                    this.cookies[match[1]] = match[2];
                }
            });
        }

        // Parse HTML para extrair CSRF e detectar hCaptcha
        const $ = cheerio.load(response.data);
        const csrfToken = $('input[name="csrf_token"]').val();
        const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || 
                                $('[data-sitekey]').attr('data-sitekey');
        
        if (!csrfToken) {
            throw new Error('CSRF Token não encontrado na página de login');
        }

        this.log('CSRF Token obtido', 'success');

        return {
            csrfToken,
            hasHCaptcha: !!hcaptchaSiteKey,
            hcaptchaSiteKey
        };
    }

    /**
     * Resolver hCaptcha usando Anti-Captcha API
     */
    async solveHCaptcha(siteKey) {
        if (!this.anticaptchaKey) {
            throw new Error('KOFFICE_ANTICAPTCHA_KEY não configurada no .env');
        }

        this.log('Resolvendo hCaptcha via Anti-Captcha...', 'loading');
        
        // Criar tarefa
        const createTask = await axios.post('https://api.anti-captcha.com/createTask', {
            clientKey: this.anticaptchaKey,
            task: {
                type: 'HCaptchaTaskProxyless',
                websiteURL: `${this.domain}/login/`,
                websiteKey: siteKey
            }
        });

        if (createTask.data.errorId !== 0) {
            throw new Error(`Anti-Captcha Error: ${createTask.data.errorDescription}`);
        }

        const taskId = createTask.data.taskId;
        this.log(`Tarefa criada: ${taskId}`, 'info');

        // Aguardar resolução (timeout 3 minutos)
        let attempts = 0;
        const maxAttempts = 60; // 60 * 3s = 3 minutos
        
        while (attempts < maxAttempts) {
            await this.delay(3);
            attempts++;

            const getResult = await axios.post('https://api.anti-captcha.com/getTaskResult', {
                clientKey: this.anticaptchaKey,
                taskId: taskId
            });

            if (getResult.data.status === 'ready') {
                this.log('hCaptcha resolvido!', 'success');
                return getResult.data.solution.gRecaptchaResponse;
            }

            if (getResult.data.errorId !== 0) {
                throw new Error(`Anti-Captcha Error: ${getResult.data.errorDescription}`);
            }

            this.log(`Aguardando resolução... (${attempts}/${maxAttempts})`, 'loading');
        }

        throw new Error('Timeout aguardando resolução do hCaptcha');
    }

    /**
     * Fazer login no Koffice
     */
    async login() {
        this.client = this.createClient();
        
        try {
            // 1. Obter CSRF Token
            const { csrfToken, hasHCaptcha, hcaptchaSiteKey } = await this.getCsrfToken();

            // 2. Resolver hCaptcha se necessário
            let captchaToken = null;
            if (hasHCaptcha) {
                this.log('hCaptcha detectado no domínio', 'info');
                captchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
            } else {
                this.log('Nenhum captcha detectado', 'info');
            }

            // 3. Fazer login
            this.log('Fazendo login...', 'loading');

            const payload = {
                try_login: '1',
                csrf_token: csrfToken,
                username: this.username,
                password: this.password
            };

            // Adicionar token do captcha se foi resolvido
            if (captchaToken) {
                payload['g-recaptcha-response'] = captchaToken;
                payload['h-captcha-response'] = captchaToken;
            }

            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            const loginResponse = await this.client.post(`${this.domain}/login/`, 
                new URLSearchParams(payload).toString(), 
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cookie': cookieString,
                        'Referer': `${this.domain}/login/`,
                        'Origin': this.domain
                    },
                    maxRedirects: 0,
                    validateStatus: () => true
                }
            );

            // Atualizar cookies após login
            if (loginResponse.headers['set-cookie']) {
                loginResponse.headers['set-cookie'].forEach(cookie => {
                    const parts = cookie.split(';')[0].split('=');
                    if (parts.length === 2) {
                        this.cookies[parts[0]] = parts[1];
                    }
                });
            }

            // 4. Seguir redirects manualmente
            let currentResponse = loginResponse;
            let redirectCount = 0;
            
            while ((currentResponse.status === 302 || currentResponse.status === 301) && redirectCount < 5) {
                const location = currentResponse.headers.location;
                
                // Se redirecionou de volta para login = falha
                if (!location || location.includes('login')) {
                    throw new Error('Login falhou - redirecionado para login');
                }
                
                redirectCount++;
                const fullUrl = location.startsWith('http') ? location : `${this.domain}${location}`;
                const cookieStr = Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
                
                currentResponse = await this.client.get(fullUrl, {
                    headers: {
                        'Cookie': cookieStr
                    },
                    maxRedirects: 0,
                    validateStatus: () => true
                });
                
                // Atualizar cookies
                if (currentResponse.headers['set-cookie']) {
                    currentResponse.headers['set-cookie'].forEach(cookie => {
                        const parts = cookie.split(';')[0].split('=');
                        if (parts.length === 2) {
                            this.cookies[parts[0]] = parts[1];
                        }
                    });
                }
            }

            // 5. Login bem-sucedido (seguimos todos os redirects sem voltar ao login)
            this.loggedIn = true;
            this.log('Login realizado com sucesso!', 'success');

            return true;

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Extrair nome do cliente do HTML
     */
    extractNameFromHtml(html) {
        if (!html) return '';
        
        try {
            const $ = cheerio.load(html);
            return $.text().trim();
        } catch (error) {
            return html;
        }
    }

    /**
     * Buscar página de clientes (paginada)
     */
    async fetchClientsPage(resellerId, start = 0, length = 1000) {
        if (!this.loggedIn) {
            throw new Error('Não está logado');
        }

        const cookieString = Object.entries(this.cookies)
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');

        // Payload para DataTables API (completo com todas as colunas)
        const payload = new URLSearchParams();
        
        // Draw
        payload.append('draw', '1');
        
        // Configuração de colunas (0-9)
        for (let i = 0; i <= 9; i++) {
            payload.append(`columns[${i}][data]`, i.toString());
            payload.append(`columns[${i}][name]`, '');
            payload.append(`columns[${i}][searchable]`, 'true');
            payload.append(`columns[${i}][orderable]`, 'true');
            payload.append(`columns[${i}][search][value]`, '');
            payload.append(`columns[${i}][search][regex]`, 'false');
        }
        
        // Ordenação
        payload.append('order[0][column]', '0');
        payload.append('order[0][dir]', 'desc');
        
        // Paginação
        payload.append('start', start.toString());
        payload.append('length', length.toString());
        
        // Busca
        payload.append('search[value]', '');
        payload.append('search[regex]', 'false');
        
        // Filtros
        payload.append('filter_value', 'active');
        payload.append('reseller_id', resellerId);

        const apiUrl = `${this.domain}/clients/api/?get_clients`;

        const response = await this.client.post(apiUrl, payload.toString(), {
            headers: {
                'Cookie': cookieString,
                'Referer': `${this.domain}/clients/`,
                'Origin': this.domain,
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Erro ao buscar clientes: Status ${response.status}`);
        }

        // Verificar se sessão expirou
        if (typeof response.data === 'string' && response.data.includes('login')) {
            throw new Error('Sessão expirou - faça login novamente');
        }

        return response.data;
    }

    /**
     * Buscar TODOS os clientes do revendedor (com paginação)
     */
    async fetchAllClients(resellerId) {
        this.log('Iniciando captura de clientes...', 'info');

        const allClients = [];
        let start = 0;
        const length = 1000; // Buscar 1000 por vez

        // Primeira requisição para descobrir o total
        const firstPage = await this.fetchClientsPage(resellerId, start, length);
        
        // DEBUG: Ver o que foi retornado
        console.log('🔍 [KOFFICE-DEBUG] Tipo da resposta:', typeof firstPage);
        console.log('🔍 [KOFFICE-DEBUG] Keys da resposta:', Object.keys(firstPage || {}));
        console.log('🔍 [KOFFICE-DEBUG] firstPage.data tipo:', typeof firstPage.data);
        console.log('🔍 [KOFFICE-DEBUG] firstPage.data é array?:', Array.isArray(firstPage.data));
        console.log('🔍 [KOFFICE-DEBUG] Primeiros 500 chars:', JSON.stringify(firstPage).substring(0, 500));
        
        if (!firstPage.data || !Array.isArray(firstPage.data)) {
            console.error('❌ [KOFFICE-DEBUG] Resposta completa:', JSON.stringify(firstPage, null, 2));
            throw new Error('Formato de resposta inválido da API Koffice');
        }

        const totalClients = firstPage.recordsFiltered || 0;
        this.log(`Total de clientes encontrados: ${totalClients}`, 'info');

        // Processar primeira página
        firstPage.data.forEach(client => {
            if (Array.isArray(client) && client.length >= 8) {
                allClients.push({
                    id: client[0],              // ID interno do Koffice
                    username: client[1],
                    password: client[2],
                    created_date: client[3],
                    expiry_date: client[4],
                    reseller: client[5],
                    screens: parseInt(client[6]) || 1,
                    client_name: this.extractNameFromHtml(client[7])
                });
            }
        });

        this.log(`Página 1: ${allClients.length} clientes capturados`, 'success');

        // Se tem mais clientes, continuar paginando
        if (totalClients > length) {
            const totalPages = Math.ceil(totalClients / length);
            
            for (let page = 2; page <= totalPages; page++) {
                start = (page - 1) * length;
                
                await this.delay(1); // Pequeno delay entre requisições
                
                const pageData = await this.fetchClientsPage(resellerId, start, length);
                
                if (pageData.data && Array.isArray(pageData.data)) {
                    pageData.data.forEach(client => {
                        if (Array.isArray(client) && client.length >= 8) {
                            allClients.push({
                                id: client[0],
                                username: client[1],
                                password: client[2],
                                created_date: client[3],
                                expiry_date: client[4],
                                reseller: client[5],
                                screens: parseInt(client[6]) || 1,
                                client_name: this.extractNameFromHtml(client[7])
                            });
                        }
                    });
                    
                    this.log(`Página ${page}/${totalPages}: ${pageData.data.length} clientes`, 'success');
                }
            }
        }

        this.log(`Total capturado: ${allClients.length} clientes`, 'success');
        return allClients;
    }
}

export default KofficeService;