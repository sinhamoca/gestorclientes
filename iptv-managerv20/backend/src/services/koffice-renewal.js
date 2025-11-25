/* ========================================
   KOFFICE RENEWAL SERVICE - VERSÃO FINAL COM CAPTCHA
   Serviço para renovação automática de clientes Koffice
   
   LOCALIZAÇÃO: iptv-managerv5/backend/src/services/koffice-renewal.js
   
   ✅ COM SUPORTE A HCAPTCHA
   ✅ RENOVAÇÃO DIRETA (SEM LOOP)
   ✅ LOGS DETALHADOS
   ======================================== */

import axios from 'axios';
import * as cheerio from 'cheerio';

class KofficeRenewalService {
    constructor(domain, username, password, anticaptchaKey = null) {
        this.domain = domain.replace(/\/$/, ''); // Remove trailing slash
        this.username = username;
        this.password = password;
        this.anticaptchaKey = anticaptchaKey || process.env.KOFFICE_ANTICAPTCHA_KEY;
        this.cookies = {};
        this.loggedIn = false;
        this.maxRetries = 3;
        
        // Criar cliente axios
        this.client = axios.create({
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '[KOFFICE]',
            success: '[KOFFICE ✓]',
            error: '[KOFFICE ✗]',
            loading: '[KOFFICE ...]'
        }[type] || '[KOFFICE]';
        
        console.log(`${timestamp} ${prefix} ${message}`);
    }

    async delay(seconds = 2) {
        return new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    /**
     * Obter CSRF Token e detectar hCaptcha
     */
    async getCsrfToken() {
        this.log('Acessando página de login para obter CSRF token...', 'loading');
        
        try {
            const response = await this.client.get(`${this.domain}/login/`);
            
            if (response.status !== 200) {
                throw new Error(`Falha ao acessar página de login: Status ${response.status}`);
            }

            // Capturar cookies
            if (response.headers['set-cookie']) {
                response.headers['set-cookie'].forEach(cookie => {
                    const match = cookie.match(/^([^=]+)=([^;]+)/);
                    if (match) {
                        this.cookies[match[1]] = match[2];
                    }
                });
            }

            // Extrair CSRF token e hCaptcha sitekey
            const $ = cheerio.load(response.data);
            const csrfToken = $('input[name="csrf_token"]').val();
            const hcaptchaSiteKey = $('.h-captcha').attr('data-sitekey') || 
                                    $('[data-sitekey]').attr('data-sitekey');
            
            if (!csrfToken) {
                throw new Error('CSRF Token não encontrado na página de login');
            }

            this.log('CSRF Token obtido com sucesso', 'success');
            
            if (hcaptchaSiteKey) {
                this.log(`hCaptcha detectado! SiteKey: ${hcaptchaSiteKey}`, 'info');
            }
            
            return {
                csrfToken,
                hasHCaptcha: !!hcaptchaSiteKey,
                hcaptchaSiteKey
            };
            
        } catch (error) {
            this.log(`Erro ao obter CSRF token: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Resolver hCaptcha usando Anti-Captcha API
     */
    async solveHCaptcha(siteKey) {
        if (!this.anticaptchaKey) {
            throw new Error('Anti-Captcha API Key não configurada. Configure KOFFICE_ANTICAPTCHA_KEY no .env');
        }

        this.log('Resolvendo hCaptcha via Anti-Captcha...', 'loading');
        
        try {
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
                throw new Error(`Anti-Captcha erro: ${createTask.data.errorDescription}`);
            }

            const taskId = createTask.data.taskId;
            this.log(`Tarefa criada no Anti-Captcha: ${taskId}`, 'info');
            this.log('Aguardando resolução do captcha (pode levar ~20-30s)...', 'loading');

            // Aguardar resolução (até 60 tentativas de 3s = 3 minutos)
            let attempts = 0;
            while (attempts < 60) {
                await this.delay(3);
                attempts++;

                const getResult = await axios.post('https://api.anti-captcha.com/getTaskResult', {
                    clientKey: this.anticaptchaKey,
                    taskId: taskId
                });

                if (getResult.data.status === 'ready') {
                    this.log('Captcha resolvido com sucesso!', 'success');
                    return getResult.data.solution.gRecaptchaResponse;
                }

                if (getResult.data.errorId !== 0) {
                    throw new Error(`Anti-Captcha erro: ${getResult.data.errorDescription}`);
                }

                // Log a cada 10 tentativas
                if (attempts % 10 === 0) {
                    this.log(`Ainda aguardando resolução... (${attempts * 3}s)`, 'loading');
                }
            }

            throw new Error('Timeout ao aguardar resolução do captcha (3 minutos)');
            
        } catch (error) {
            this.log(`Erro ao resolver hCaptcha: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Fazer login no painel Koffice
     */
    async login() {
        this.log(`Iniciando login no domínio: ${this.domain}`, 'info');
        
        try {
            // 1. Obter CSRF Token e detectar hCaptcha
            const { csrfToken, hasHCaptcha, hcaptchaSiteKey } = await this.getCsrfToken();

            // 2. Resolver hCaptcha se necessário
            let captchaToken = null;
            if (hasHCaptcha) {
                this.log('hCaptcha detectado! Resolvendo...', 'loading');
                captchaToken = await this.solveHCaptcha(hcaptchaSiteKey);
            } else {
                this.log('Sem captcha detectado, prosseguindo com login...', 'info');
            }

            // 3. Preparar payload de login
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

            // 4. Preparar cookies
            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            this.log('Enviando requisição de login...', 'loading');

            // 5. Fazer requisição de login
            const loginResponse = await this.client.post(`${this.domain}/login/`, payload, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookieString,
                    'Referer': `${this.domain}/login/`,
                    'Origin': this.domain
                },
                maxRedirects: 0,
                validateStatus: () => true
            });

            // 6. Capturar novos cookies da resposta
            if (loginResponse.headers['set-cookie']) {
                loginResponse.headers['set-cookie'].forEach(cookie => {
                    const parts = cookie.split(';')[0].split('=');
                    if (parts.length === 2) {
                        this.cookies[parts[0]] = parts[1];
                    }
                });
            }

            // 7. Seguir redirecionamentos manualmente
            let currentResponse = loginResponse;
            let redirectCount = 0;
            
            while ((currentResponse.status === 302 || currentResponse.status === 301) && redirectCount < 5) {
                const location = currentResponse.headers.location;
                
                // Se redirecionou para login novamente, falha de autenticação
                if (!location || location.includes('login')) {
                    throw new Error('Login falhou - credenciais inválidas ou captcha incorreto');
                }
                
                redirectCount++;
                const fullUrl = location.startsWith('http') ? location : `${this.domain}${location}`;
                
                const cookieStr = Object.entries(this.cookies)
                    .map(([k, v]) => `${k}=${v}`)
                    .join('; ');
                
                currentResponse = await this.client.get(fullUrl, {
                    headers: {
                        'Cookie': cookieStr
                    },
                    maxRedirects: 0,
                    validateStatus: () => true
                });
                
                // Capturar novos cookies
                if (currentResponse.headers['set-cookie']) {
                    currentResponse.headers['set-cookie'].forEach(cookie => {
                        const parts = cookie.split(';')[0].split('=');
                        if (parts.length === 2) {
                            this.cookies[parts[0]] = parts[1];
                        }
                    });
                }
            }

            // 8. Validar se está logado
            const finalHtml = currentResponse.data.toString();
            
            if (finalHtml.includes('logout') || 
                finalHtml.includes('sair') || 
                finalHtml.includes('dashboard') ||
                currentResponse.status === 200) {
                this.loggedIn = true;
                this.log('Login realizado com sucesso!', 'success');
                this.log(`Cookies capturados: ${Object.keys(this.cookies).length}`, 'info');
                return true;
            } else {
                throw new Error('Login falhou - não foi possível validar sessão');
            }

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Renovar cliente Koffice
     * 
     * IMPORTANTE: Diferente do CloudNation e Sigma, o Koffice aceita
     * múltiplos meses em UMA ÚNICA requisição!
     * 
     * @param {string} clientId - ID do cliente no Koffice
     * @param {number} months - Quantidade de meses para renovar
     * @returns {Object} - { sucesso: boolean, data: any }
     */
    async renovarCliente(clientId, months) {
        if (!this.loggedIn) {
            throw new Error('Não está logado. Execute login() primeiro.');
        }

        this.log(`Renovando cliente ${clientId} por ${months} mês(es)...`, 'loading');

        try {
            // Preparar cookies
            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            // URL da API de renovação
            const apiUrl = `${this.domain}/clients/api/?renew_client_plus&client_id=${clientId}&months=${months}`;

            this.log(`API URL: ${apiUrl}`, 'info');

            // Fazer requisição de renovação
            const response = await this.client.post(apiUrl, '', {
                headers: {
                    'Cookie': cookieString,
                    'Referer': `${this.domain}/clients/`,
                    'Origin': this.domain,
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            // Verificar se sessão expirou
            if (typeof response.data === 'string' && response.data.includes('login')) {
                throw new Error('Sessão expirou durante a renovação');
            }

            // Validar resposta
            if (response.status === 200) {
                // Resposta em JSON
                if (response.data && typeof response.data === 'object') {
                    if (response.data.result === 'success') {
                        this.log('Cliente renovado com sucesso!', 'success');
                        return {
                            sucesso: true,
                            clientId: clientId,
                            months: months,
                            data: response.data,
                            timestamp: new Date().toISOString()
                        };
                    } else if (response.data.result === 'failed') {
                        this.log('Falha ao renovar cliente (result: failed)', 'error');
                        throw new Error('Falha ao renovar cliente no painel Koffice (result: failed)');
                    } else {
                        this.log(`Resposta inesperada: ${JSON.stringify(response.data)}`, 'error');
                        throw new Error(`Resposta inesperada do servidor: ${JSON.stringify(response.data)}`);
                    }
                }
                // Resposta em String
                else if (typeof response.data === 'string') {
                    const lowerData = response.data.toLowerCase();
                    if (lowerData.includes('success') || lowerData === 'ok') {
                        this.log('Cliente renovado com sucesso!', 'success');
                        return {
                            sucesso: true,
                            clientId: clientId,
                            months: months,
                            message: response.data,
                            timestamp: new Date().toISOString()
                        };
                    } else {
                        this.log(`Falha: ${response.data}`, 'error');
                        throw new Error(`Falha ao renovar cliente: ${response.data}`);
                    }
                } else {
                    this.log('Resposta vazia ou formato desconhecido', 'error');
                    throw new Error('Resposta vazia ou formato desconhecido do servidor');
                }
            } else {
                throw new Error(`Erro ao renovar cliente: Status ${response.status}`);
            }

        } catch (error) {
            this.log(`Erro na renovação: ${error.message}`, 'error');
            return {
                sucesso: false,
                clientId: clientId,
                months: months,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Fazer logout (opcional, mas boa prática)
     */
    async logout() {
        if (!this.loggedIn) {
            return;
        }

        try {
            this.log('Fazendo logout...', 'info');
            
            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            await this.client.get(`${this.domain}/logout/`, {
                headers: {
                    'Cookie': cookieString
                }
            });

            this.loggedIn = false;
            this.cookies = {};
            this.log('Logout realizado', 'success');
        } catch (error) {
            this.log(`Erro no logout: ${error.message}`, 'error');
        }
    }
}

export default KofficeRenewalService;