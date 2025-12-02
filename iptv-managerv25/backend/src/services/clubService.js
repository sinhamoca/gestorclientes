/* ========================================
   CLUB (DASHBOARD.BZ) SERVICE
   Integração com painel Club via API pdcapi.io
   
   Features:
   - Login com hCaptcha (Anti-Captcha)
   - Autenticação via JWT Token
   - API DataTables para listar clientes
   - Captura paginada de clientes
   ======================================== */

import axios from 'axios';

class ClubService {
    constructor(username, password, anticaptchaKey = null) {
        this.username = username;
        this.password = password;
        this.anticaptchaKey = anticaptchaKey || process.env.CLUB_ANTICAPTCHA_KEY;
        this.token = null;
        this.loggedIn = false;
        
        // URLs da API
        this.targetUrl = 'https://dashboard.bz/login.php';
        this.loginApiUrl = 'https://pdcapi.io/login';
        this.clientsApiUrl = 'https://pdcapi.io/listas/minhas';
        this.hcaptchaSitekey = '8cf2ef3e-6e60-456a-86ca-6f2c855c3a06';
        
        // Cliente HTTP
        this.client = axios.create({
            timeout: 30000,
            validateStatus: () => true,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': '*/*',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const symbols = { 
            info: '[CLUB]', 
            success: '[CLUB ✓]', 
            error: '[CLUB ✗]', 
            loading: '[CLUB ...]' 
        };
        console.log(`${timestamp} ${symbols[type]} ${message}`);
    }

    async delay(seconds = 2) {
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }

    /**
     * Resolver hCaptcha usando Anti-Captcha API
     */
    async resolveHCaptcha() {
        if (!this.anticaptchaKey) {
            throw new Error('Anti-Captcha API Key não configurada. Configure CLUB_ANTICAPTCHA_KEY no .env');
        }

        this.log('Resolvendo hCaptcha via Anti-Captcha...', 'loading');
        
        try {
            // Criar tarefa no Anti-Captcha
            const createTaskResponse = await axios.post('https://api.anti-captcha.com/createTask', {
                clientKey: this.anticaptchaKey,
                task: {
                    type: 'HCaptchaTaskProxyless',
                    websiteURL: this.targetUrl,
                    websiteKey: this.hcaptchaSitekey
                }
            });

            if (createTaskResponse.data.errorId !== 0) {
                throw new Error(`Anti-Captcha Error: ${createTaskResponse.data.errorDescription}`);
            }

            const taskId = createTaskResponse.data.taskId;
            this.log(`Tarefa criada no Anti-Captcha: ${taskId}`, 'info');
            this.log('Aguardando resolução do captcha (~20-30s)...', 'loading');

            // Aguardar resolução (máximo 60 tentativas de 3s = 3 minutos)
            let attempts = 0;
            const maxAttempts = 60;

            while (attempts < maxAttempts) {
                await this.delay(3);
                attempts++;

                const getResultResponse = await axios.post('https://api.anti-captcha.com/getTaskResult', {
                    clientKey: this.anticaptchaKey,
                    taskId: taskId
                });

                if (getResultResponse.data.status === 'ready') {
                    this.log('hCaptcha resolvido com sucesso!', 'success');
                    return getResultResponse.data.solution.gRecaptchaResponse;
                }

                if (getResultResponse.data.errorId !== 0) {
                    throw new Error(`Anti-Captcha Error: ${getResultResponse.data.errorDescription}`);
                }

                // Log a cada 10 tentativas
                if (attempts % 10 === 0) {
                    this.log(`Ainda aguardando... (${attempts * 3}s)`, 'loading');
                }
            }

            throw new Error('Timeout ao resolver hCaptcha (3 minutos)');

        } catch (error) {
            this.log(`Erro ao resolver hCaptcha: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Fazer login no painel Club
     */
    async login() {
        this.log('Iniciando login no dashboard.bz...', 'info');

        try {
            // 1. Resolver hCaptcha
            const hcaptchaToken = await this.resolveHCaptcha();

            // 2. Preparar dados do formulário
            const formData = new URLSearchParams();
            formData.append('username', this.username);
            formData.append('password', this.password);
            formData.append('g-recaptcha-response', hcaptchaToken);
            formData.append('h-captcha-response', hcaptchaToken);

            this.log('Enviando requisição de login...', 'loading');

            // 3. Fazer login
            const loginResponse = await this.client.post(this.loginApiUrl, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Origin': 'https://dashboard.bz',
                    'Referer': this.targetUrl
                }
            });

            // 4. Validar resposta
            if (!loginResponse.data || !loginResponse.data.result) {
                const errorMsg = loginResponse.data?.msg || 'Resposta inválida da API';
                throw new Error(`Login falhou: ${errorMsg}`);
            }

            if (!loginResponse.data.token) {
                throw new Error('Token não retornado pela API');
            }

            // 5. Armazenar token
            this.token = loginResponse.data.token;
            this.loggedIn = true;

            this.log('Login realizado com sucesso!', 'success');
            this.log(`Token obtido: ${this.token.substring(0, 20)}...`, 'info');

            return true;

        } catch (error) {
            this.log(`Erro no login: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Listar clientes do painel Club
     * Usa API DataTables com paginação
     */
    async listarClientes() {
        if (!this.loggedIn || !this.token) {
            throw new Error('Não está logado. Execute login() primeiro.');
        }

        this.log('Buscando lista de clientes...', 'loading');

        try {
            // Montar payload DataTables (igual ao capturado)
            const formData = new URLSearchParams();
            
            // Configurações de colunas (DataTables API)
            formData.append('draw', '1');
            
            // Colunas
            const columns = [
                { data: 'id', searchable: true, orderable: true },
                { data: 'status', searchable: true, orderable: false },
                { data: 'username', searchable: true, orderable: true },
                { data: 'exp_date', searchable: false, orderable: true },
                { data: 'member_id', searchable: true, orderable: true },
                { data: 'conexoes', searchable: false, orderable: false },
                { data: 'reseller_notes', searchable: true, orderable: false },
                { data: 'acoes', searchable: true, orderable: false }
            ];

            columns.forEach((col, index) => {
                formData.append(`columns[${index}][data]`, col.data);
                formData.append(`columns[${index}][name]`, '');
                formData.append(`columns[${index}][searchable]`, col.searchable.toString());
                formData.append(`columns[${index}][orderable]`, col.orderable.toString());
                formData.append(`columns[${index}][search][value]`, '');
                formData.append(`columns[${index}][search][regex]`, 'false');
            });

            // Ordenação e paginação
            formData.append('order[0][column]', '0');
            formData.append('order[0][dir]', 'desc');
            formData.append('start', '0');
            formData.append('length', '1000'); // Buscar até 1000 clientes
            formData.append('search[value]', '');
            formData.append('search[regex]', 'false');

            // Fazer requisição
            const response = await this.client.post(this.clientsApiUrl, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'x-access-token': this.token,
                    'x_filtro': 'todas',
                    'Origin': 'https://dashboard.bz',
                    'Referer': 'https://dashboard.bz/',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36'
                }
            });

            // Validar resposta
            if (!response.data || !response.data.data) {
                throw new Error('Resposta inválida da API');
            }

            // Processar clientes
            const clientes = response.data.data.map(cliente => ({
                id: cliente.id,
                username: cliente.username,
                reseller_notes: cliente.reseller_notes || '',
                status: cliente.status || '',
                exp_date: cliente.exp_date || '',
                member_id: cliente.member_id || '',
                conexoes: cliente.conexoes || ''
            }));

            this.log(`${clientes.length} clientes encontrados!`, 'success');

            return {
                success: true,
                total: response.data.recordsTotal || clientes.length,
                clientes: clientes
            };

        } catch (error) {
            this.log(`Erro ao listar clientes: ${error.message}`, 'error');
            
            if (error.response) {
                this.log(`Status HTTP: ${error.response.status}`, 'error');
                this.log(`Resposta: ${JSON.stringify(error.response.data)}`, 'error');
            }

            throw error;
        }
    }
}

export default ClubService;