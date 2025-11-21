/* ========================================
   UNIPLAY RENEWAL SERVICE - COM PROXY
   Serviço para renovação automática via GesAPIOffice (Uniplay)
   
   FEATURES:
   - ✅ Proxy obrigatório (proxychains)
   - ✅ Busca automática em P2P e IPTV
   - ✅ Identificação por NOME do cliente
   - ✅ Renovação direta com N créditos
   - ✅ Logs detalhados
   
   LOCALIZAÇÃO: iptv-managerv8/backend/src/services/uniplay-renewal.js
   ======================================== */

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

class UniplayRenewalService {
    constructor(username, password, useProxy = true) {
        this.baseURL = 'https://gesapioffice.com';  // Domínio fixo
        this.username = username;
        this.password = password;
        this.useProxy = useProxy;  // SEMPRE true (obrigatório)
        this.token = null;
        this.userInfo = null;
        
        this.defaultHeaders = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'pt-BR,pt;q=0.9',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
            'Origin': 'https://gestordefender.com',
            'Pragma': 'no-cache',
            'Referer': 'https://gestordefender.com/',
            'Sec-CH-UA': '"Google Chrome";v="141", "Not?A_Brand";v="8", "Chromium";v="141"',
            'Sec-CH-UA-Mobile': '?1',
            'Sec-CH-UA-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36'
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

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    async executeCommand(cmd) {
        try {
            const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 10 });
            if (stdout && stdout.length > 0) {
                return { stdout, stderr };
            }
            throw new Error(`Command returned no output. stderr: ${stderr}`);
        } catch (error) {
            console.error('❌ [UNIPLAY] Erro ao executar comando:', {
                message: error.message,
                code: error.code,
                cmd: cmd.substring(0, 100) + '...'
            });
            
            if (error.code === 127) {
                console.error('💡 [UNIPLAY] Erro 127 = Comando não encontrado!');
                console.error('   Verifique se proxychains4 e curl-impersonate-chrome estão instalados');
            }
            
            if (error.stdout && error.stdout.length > 0) {
                return { stdout: error.stdout, stderr: error.stderr };
            }
            throw error;
        }
    }

    async request(method, path, data = null, customHeaders = {}) {
        const url = `${this.baseURL}${path}`;
        
        // Usar wrapper com proxy (igual Sigma)
        const curlCmd = this.useProxy ? 'curl-with-proxy' : 'curl_chrome120';
        
        const headers = { ...this.defaultHeaders, ...customHeaders };
        
        // Adicionar token se disponível
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const headersString = this._headersToString(headers);
        let cmd = `${curlCmd} ${headersString} -s`;
        
        if (method === 'POST' && data) {
            const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
            const escapedData = jsonData.replace(/'/g, "'\\''");
            cmd += ` -X POST -d '${escapedData}'`;
        }
        
        if (method === 'PUT' && data) {
            const jsonData = typeof data === 'string' ? data : JSON.stringify(data);
            const escapedData = jsonData.replace(/'/g, "'\\''");
            cmd += ` -X PUT -d '${escapedData}'`;
        }
        
        cmd += ` "${url}" 2>/dev/null`;
        
        const { stdout } = await this.executeCommand(cmd);
        
        // Log da resposta (primeiros 300 chars)
        console.log(`🔍 [UNIPLAY] Resposta (${method} ${path}):`, stdout.substring(0, 300));
        
        try {
            return JSON.parse(stdout);
        } catch {
            return stdout;
        }
    }

    /**
     * Fazer login no Uniplay
     */
    async login() {
        console.log('🔑 [UNIPLAY] Fazendo login...');
        
        try {
            const loginData = {
                username: this.username,
                password: this.password,
                code: ""
            };

            const response = await this.request('POST', '/api/login', loginData);

            if (response && response.access_token) {
                this.token = response.access_token;
                this.userInfo = {
                    id: response.id,
                    username: response.username,
                    tokenType: response.token_type,
                    expiresIn: response.expires_in,
                    cryptPass: response.crypt_pass
                };

                console.log('✅ [UNIPLAY] Login realizado com sucesso!');
                console.log(`👤 [UNIPLAY] Usuário: ${this.userInfo.username}`);
                return true;
            }

            console.error('❌ [UNIPLAY] Falha no login - resposta inválida');
            return false;

        } catch (error) {
            console.error('❌ [UNIPLAY] Erro ao fazer login:', error.message);
            throw error;
        }
    }

    /**
     * Buscar clientes P2P
     */
    async getP2PClients() {
        if (!this.token) {
            throw new Error('Token não disponível. Faça login primeiro.');
        }

        try {
            console.log('📡 [UNIPLAY] Buscando clientes P2P...');
            
            const response = await this.request('GET', '/api/users-p2p');

            if (Array.isArray(response)) {
                console.log(`✅ [UNIPLAY] ${response.length} clientes P2P encontrados`);
                return response;
            }

            return [];

        } catch (error) {
            console.error('❌ [UNIPLAY] Erro ao buscar clientes P2P:', error.message);
            return [];
        }
    }

    /**
     * Buscar clientes IPTV
     */
    async getIPTVClients() {
        if (!this.token) {
            throw new Error('Token não disponível. Faça login primeiro.');
        }

        try {
            console.log('📺 [UNIPLAY] Buscando clientes IPTV...');
            
            const response = await this.request(
                'GET', 
                `/api/users-iptv?reg_password=${encodeURIComponent(this.userInfo.cryptPass)}`
            );

            if (Array.isArray(response)) {
                console.log(`✅ [UNIPLAY] ${response.length} clientes IPTV encontrados`);
                return response;
            }

            return [];

        } catch (error) {
            console.error('❌ [UNIPLAY] Erro ao buscar clientes IPTV:', error.message);
            return [];
        }
    }

    /**
     * Limpar e normalizar nome do cliente
     */
    cleanClientName(nota) {
        if (!nota) return '';
        
        // Decodificar caracteres unicode
        let cleaned = nota.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
            return String.fromCharCode(parseInt(grp, 16));
        });
        
        // Remover textos padrão indesejados
        cleaned = cleaned.replace(/Usuário migrado externamente\.\s*Obs:\s*/gi, '');
        cleaned = cleaned.replace(/Obs:\s*/gi, '');
        
        // Trim e normalizar espaços
        cleaned = cleaned.trim().replace(/\s+/g, ' ');
        
        return cleaned;
    }

    /**
     * Buscar cliente por nome EXATO (case-insensitive)
     * Modo AUTO: busca em P2P e IPTV automaticamente
     * 
     * @param {string} searchName - Nome do cliente para buscar
     * @returns {Object|null} - { id, name, username, password, serviceType } ou null
     */
    async findClientByName(searchName) {
        const normalizedSearch = searchName.trim().toLowerCase();
        
        console.log('\n🔍 [UNIPLAY] Iniciando busca AUTOMÁTICA (P2P + IPTV)...');
        console.log(`   Nome procurado: "${searchName}"`);
        
        // ========== BUSCAR EM P2P PRIMEIRO ==========
        console.log('\n📡 [UNIPLAY] Buscando em clientes P2P...');
        const p2pClients = await this.getP2PClients();
        
        for (const client of p2pClients) {
            const clientName = this.cleanClientName(client.nota || client.name || '');
            const normalizedClientName = clientName.toLowerCase();
            
            if (normalizedClientName === normalizedSearch) {
                console.log('✅ [UNIPLAY] Cliente encontrado em P2P!');
                console.log(`   ID: ${client.id}`);
                console.log(`   Nome: ${clientName}`);
                console.log(`   Username: ${client.username || 'N/A'}`);
                
                return {
                    id: client.id,
                    name: clientName,
                    username: client.username || '',
                    password: client.password || '',
                    serviceType: 'p2p'
                };
            }
        }
        
        console.log('⚠️  [UNIPLAY] Cliente não encontrado em P2P');
        
        // ========== BUSCAR EM IPTV SE NÃO ENCONTROU EM P2P ==========
        console.log('\n📺 [UNIPLAY] Buscando em clientes IPTV...');
        const iptvClients = await this.getIPTVClients();
        
        for (const client of iptvClients) {
            const clientName = this.cleanClientName(client.nota || client.name || '');
            const normalizedClientName = clientName.toLowerCase();
            
            if (normalizedClientName === normalizedSearch) {
                console.log('✅ [UNIPLAY] Cliente encontrado em IPTV!');
                console.log(`   ID: ${client.id}`);
                console.log(`   Nome: ${clientName}`);
                console.log(`   Username: ${client.username || 'N/A'}`);
                
                return {
                    id: client.id,
                    name: clientName,
                    username: client.username || '',
                    password: client.password || '',
                    serviceType: 'iptv'
                };
            }
        }
        
        console.error('\n❌ [UNIPLAY] Cliente não encontrado em P2P nem IPTV');
        console.log(`   Nome procurado: "${searchName}"`);
        console.log(`   Total P2P: ${p2pClients.length}`);
        console.log(`   Total IPTV: ${iptvClients.length}`);
        
        return null;
    }

    /**
     * Renovar cliente Uniplay
     * 
     * @param {string} clientId - ID do cliente no Uniplay
     * @param {string} serviceType - 'p2p' ou 'iptv'
     * @param {number} credits - Quantidade de créditos (1 mês = 1 crédito)
     * @returns {Object} - { sucesso: boolean, status: number, data: any }
     */
    async renewClient(clientId, serviceType, credits) {
        if (!this.token) {
            throw new Error('Token não disponível. Faça login primeiro.');
        }

        const endpoint = serviceType.toLowerCase() === 'iptv' ? 'users-iptv' : 'users-p2p';

        const renewalData = {
            action: 1,
            credits: credits,
            reg_password: this.userInfo.cryptPass
        };

        console.log(`\n🔄 [UNIPLAY] Renovando cliente...`);
        console.log(`   ID: ${clientId}`);
        console.log(`   Tipo: ${serviceType.toUpperCase()}`);
        console.log(`   Créditos: ${credits}`);

        try {
            const response = await this.request(
                'PUT',
                `/api/${endpoint}/${clientId}`,
                renewalData
            );

            // Verificar resposta
            let isSuccess = false;

            // Caso 1: Resposta é uma STRING (provavelmente a data)
            if (typeof response === 'string' && response.trim().length > 0) {
                // Verificar se é uma data válida (formato DD/MM/YYYY)
                const datePattern = /^\d{2}\/\d{2}\/\d{4}/;
                if (datePattern.test(response.trim())) {
                    console.log('✅ [UNIPLAY] Renovação realizada com sucesso!');
                    console.log(`   📅 Nova data de vencimento: ${response.trim()}`);
                    isSuccess = true;
                }
            }
            // Caso 2: Resposta é JSON (compatibilidade futura)
            else if (response && typeof response === 'object') {
                if (response.success === true || response.status === 'success') {
                    isSuccess = true;
                }
            }

            if (isSuccess) {
                console.log('✅ [UNIPLAY] Renovação realizada com sucesso!');
                return {
                    sucesso: true,
                    status: 200,
                    data: response
                };
            } else {
                console.error('❌ [UNIPLAY] Falha na renovação');
                return {
                    sucesso: false,
                    status: response.status || 400,
                    error: response
                };
            }

        } catch (error) {
            console.error('❌ [UNIPLAY] Erro na renovação:', error.message);
            return {
                sucesso: false,
                status: 500,
                error: error.message
            };
        }
    }

    /**
     * Logout (opcional, mas recomendado)
     */
    async logout() {
        if (this.token) {
            console.log('👋 [UNIPLAY] Fazendo logout...');
            this.token = null;
            this.userInfo = null;
        }
    }
}

export default UniplayRenewalService;

