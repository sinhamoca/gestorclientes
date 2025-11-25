/* ========================================
   SIGMA RENEWAL SERVICE - COM CLOUDFLARE BYPASS
   Versão atualizada para passar pelo Cloudflare
   ======================================== */

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

class SigmaRenewalService {
    constructor(domain, username, password, useProxy = false) {
        this.domain = domain.replace(/\/$/, '');
        this.username = username;
        this.password = password;
        this.useProxy = useProxy;  // Definir true se quiser usar proxychains
        this.cookies = {};
        this.authToken = null;
        
        this.defaultHeaders = {
            'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        };
    }

    _escapeShell(str) {
        return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    }

    _headersToString(headers) {
        return Object.entries(headers)
            .map(([key, value]) => `-H "${this._escapeShell(key)}: ${this._escapeShell(value)}"`)
            .join(' ');
    }

    _cookiesToString() {
        return Object.entries(this.cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ');
    }

    _parseCookies(headerOutput) {
        const cookieMatches = headerOutput.match(/set-cookie: ([^=]+)=([^;]+)/gi);
        if (cookieMatches) {
            cookieMatches.forEach(match => {
                const parts = match.match(/set-cookie: ([^=]+)=([^;]+)/i);
                if (parts) {
                    this.cookies[parts[1]] = parts[2];
                }
            });
        }
    }

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async executeCommand(cmd) {
        try {
            const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
            // Aceitar stdout mesmo com stderr
            if (stdout && stdout.length > 0) {
                return { stdout, stderr };
            }
            throw new Error(`Command returned no output. stderr: ${stderr}`);
        } catch (error) {
            // Log detalhado do erro
            console.error('❌ [SIGMA] Erro ao executar comando:', {
                message: error.message,
                code: error.code,
                cmd: cmd.substring(0, 100) + '...'
            });
            
            // Se erro 127 (command not found), dar dica
            if (error.code === 127) {
                console.error('💡 [SIGMA] Erro 127 = Comando não encontrado!');
                console.error('   Verifique se proxychains4 e curl-impersonate-chrome estão instalados');
                console.error('   Execute dentro do container:');
                console.error('   - which proxychains4');
                console.error('   - which curl-impersonate-chrome');
            }
            
            // Se tem stdout no erro, considerar sucesso parcial
            if (error.stdout && error.stdout.length > 0) {
                return { stdout: error.stdout, stderr: error.stderr };
            }
            throw error;
        }
    }

    async request(method, path, data = null, customHeaders = {}) {
        const url = `${this.domain}${path}`;
        
        // Usar wrapper com proxy ao invés de proxychains
        // O wrapper curl-with-proxy já configura o proxy via ALL_PROXY
        const curlCmd = this.useProxy ? 'curl-with-proxy' : 'curl_chrome120';
        
        const headers = { ...this.defaultHeaders, ...customHeaders };
        
        if (Object.keys(this.cookies).length > 0) {
            headers['Cookie'] = this._cookiesToString();
        }
        
        if (this.authToken) {
            headers['Authorization'] = `Bearer ${this.authToken}`;
        }
        
        const headersString = this._headersToString(headers);
        let cmd = `${curlCmd} ${headersString} -s`;
        
        if (method === 'POST' && data) {
            const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
            const escapedData = jsonData.replace(/'/g, "'\\''");
            cmd += ` -X POST -d '${escapedData}'`;
        }
        
        cmd += ` "${url}" 2>/dev/null`;
        
        const { stdout } = await this.executeCommand(cmd);
        
        // Log da resposta raw (primeiras 200 chars)
        console.log(`🔍 [SIGMA] Resposta (${method} ${path}):`, stdout.substring(0, 200));
        
        try {
            return JSON.parse(stdout);
        } catch {
            return stdout;
        }
    }

    async initSession() {
        console.log(`🔄 [SIGMA] Inicializando sessão: ${this.domain}`);
        
        const curlCmd = this.useProxy ? 'curl-with-proxy' : 'curl_chrome120';
        const headersString = this._headersToString(this.defaultHeaders);
        const cmd = `${curlCmd} ${headersString} -s -I "${this.domain}" 2>/dev/null`;
        
        const { stdout } = await this.executeCommand(cmd);
        
        if (!stdout || stdout.length === 0) {
            throw new Error('Nenhuma resposta do servidor');
        }
        
        const firstLine = stdout.split('\n')[0];
        console.log(`📋 [SIGMA] Resposta: ${firstLine}`);
        
        this._parseCookies(stdout);
        
        // Aceitar 200, 301, 302, 404 (desde que o Cloudflare respondeu)
        const success = stdout.includes('200') || stdout.includes('301') || stdout.includes('302') || stdout.includes('404');
        
        if (success) {
            console.log(`✅ [SIGMA] Sessão OK - Cookies: ${Object.keys(this.cookies).length}`);
        } else {
            console.log(`⚠️ [SIGMA] Status inesperado, mas continuando...`);
        }
        
        return true; // Sempre retorna true se teve resposta do Cloudflare
    }

    async login() {
        console.log(`🔐 [SIGMA] Fazendo login: ${this.username}`);
        
        const sessionOk = await this.initSession();
        if (!sessionOk) {
            throw new Error('Falha ao inicializar sessão');
        }
        
        await this.delay(3);
        
        const loginHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Origin': this.domain,
            'Referer': `${this.domain}/`,
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };
        
        const response = await this.request('POST', '/api/auth/login', {
            captcha: "not-a-robot",
            captchaChecked: true,
            username: this.username,
            password: this.password,
            twofactor_code: "",
            twofactor_recovery_code: "",
            twofactor_trusted_device_id: ""
        }, loginHeaders);
        
        if (response.token) {
            this.authToken = response.token;
            console.log('✅ [SIGMA] Login OK!');
            return response;
        } else {
            throw new Error(`Login falhou: ${JSON.stringify(response)}`);
        }
    }

    async findCustomerByUsername(targetUsername) {
        console.log(`🔍 [SIGMA] Buscando cliente: ${targetUsername}`);
        
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
        
        const response = await this.request('GET', searchUrl, null, {
            'Accept': 'application/json',
            'Referer': `${this.domain}/`
        });
        
        let customers = [];
        if (Array.isArray(response)) {
            customers = response;
        } else if (response.data && Array.isArray(response.data)) {
            customers = response.data;
        }
        
        console.log(`📊 [SIGMA] Clientes encontrados: ${customers.length}`);
        
        // Buscar por username exato
        let customer = customers.find(c => c.username === targetUsername);
        
        // Fallback: buscar por note
        if (!customer) {
            customer = customers.find(c => c.note && c.note.toLowerCase().includes(targetUsername.toLowerCase()));
        }
        
        // Fallback: buscar por user_id
        if (!customer) {
            customer = customers.find(c => c.user_id === targetUsername);
        }
        
        if (customer) {
            console.log(`✅ [SIGMA] Cliente encontrado! ID: ${customer.id || customer.user_id}`);
            return customer;
        } else {
            throw new Error(`Cliente ${targetUsername} não encontrado`);
        }
    }

    async renewClient(customerId, packageId, connections = 1) {
        console.log(`\n🔄 [SIGMA] Renovando cliente...`);
        console.log(`   🆔 Customer ID: ${customerId}`);
        console.log(`   📦 Package ID: ${packageId}`);
        console.log(`   🔌 Conexões: ${connections}`);

        await this.delay(2);

        const renewHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': this.domain,
            'Referer': `${this.domain}/`,
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Dest': 'empty'
        };

        const payload = {
            package_id: packageId,
            connections: parseInt(connections)
        };

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
        } else {
            throw new Error(`Renovação falhou: ${JSON.stringify(response)}`);
        }
    }
}

export default SigmaRenewalService;
