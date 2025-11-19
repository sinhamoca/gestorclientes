/* ========================================
   CLOUDNATION SERVICE - RENOVAÇÃO AUTOMÁTICA
   Baseado no vps-cloudnation.js FUNCIONAL
   Corrigido para usar método correto de login
   ======================================== */

import axios from 'axios';

class CloudNationRenewalService {
    constructor(apiKey2captcha, username, password) {
        this.apiKey2captcha = apiKey2captcha;
        this.username = username;
        this.password = password;
        this.baseUrl = 'https://painel.cloudnation.top';
        
        // Cookies e tokens
        this.cookies = {};
        this.csrfToken = null;
        this.deviceId = null;
        
        // Session HTTP
        this.session = axios.create({
            baseURL: this.baseUrl,
            timeout: 60000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Sec-Ch-Ua': '"Chromium";v="121", "Not A(Brand";v="99"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
                'Sec-Fetch-Dest': 'empty',
                'Sec-Fetch-Mode': 'cors',
                'Sec-Fetch-Site': 'same-origin'
            }
        });
    }

    // ============= TURNSTILE (CLOUDFLARE) =============
    
    async solveTurnstile(pageUrl) {
        try {
            const sitekey = '0x4AAAAAABzciTXYJNKPGEVl';
            
            console.log('🔐 [CN-RENEWAL] Resolvendo Turnstile...');
            
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
            console.log(`   🎯 Captcha ID: ${captchaId}`);
            console.log('   ⏳ Aguardando solução...');

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
                    console.log(`   ✅ Token obtido!`);
                    return token;
                }

                if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
                    throw new Error(`2Captcha erro: ${resultResponse.data.request}`);
                }
            }

            throw new Error('Timeout aguardando 2Captcha');

        } catch (error) {
            console.error(`❌ [CN-RENEWAL] Erro Turnstile: ${error.message}`);
            throw error;
        }
    }

    // ============= LOGIN (MÉTODO CORRETO) =============
    
    async login() {
        try {
            console.log('\n🔑 [CN-RENEWAL] INICIANDO LOGIN\n');
            
            // PASSO 1: Gerar device_id ANTES de qualquer requisição
            this.deviceId = this.generateDeviceId();
            console.log('1️⃣ Obtendo cookies iniciais...');
            
            // Acessar página inicial COM device_id
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

            console.log(`   ✅ Cookies: ${Object.keys(this.cookies).join(', ')}`);

            // CSRF token está no cookie
            if (this.cookies.csrfToken) {
                this.csrfToken = this.cookies.csrfToken;
                console.log(`   ✅ CSRF Token obtido`);
            } else {
                throw new Error('CSRF Token não encontrado');
            }

            // CRÍTICO: Extrair _Token[fields] e _Token[unlocked] do HTML
            const html = initialResponse.data;
            
            let tokenFieldsMatch = html.match(/name="_Token\[fields\]"\s+value="([^"]+)"/);
            if (!tokenFieldsMatch) {
                tokenFieldsMatch = html.match(/_Token\[fields\][^>]+value="([^"]+)"/);
            }
            
            let tokenUnlockedMatch = html.match(/name="_Token\[unlocked\]"\s+value="([^"]+)"/);
            if (!tokenUnlockedMatch) {
                tokenUnlockedMatch = html.match(/_Token\[unlocked\][^>]+value="([^"]+)"/);
            }
            
            let tokenFields = tokenFieldsMatch ? tokenFieldsMatch[1] : '';
            let tokenUnlocked = tokenUnlockedMatch ? tokenUnlockedMatch[1] : '';

            // Ajustar tokenFields (adicionar : no final)
            if (tokenFields && !tokenFields.endsWith(':')) {
                tokenFields = tokenFields.replace(/%3A/g, ':');
                if (!tokenFields.endsWith(':')) {
                    tokenFields = tokenFields + ':';
                }
            } else if (!tokenFields) {
                tokenFields = '3a8b9680acaf2e40786fd57433e6b74eaf1cf182:';
                console.log('   ⚠️  Token[fields] não encontrado, usando padrão');
            }
            
            // Decodificar tokenUnlocked
            if (tokenUnlocked && tokenUnlocked.includes('%')) {
                tokenUnlocked = decodeURIComponent(tokenUnlocked);
            } else if (!tokenUnlocked) {
                tokenUnlocked = 'cf-turnstile-response|g-recaptcha-response';
                console.log('   ⚠️  Token[unlocked] não encontrado, usando padrão');
            }

            console.log(`   ✅ Token[fields]: ${tokenFields.substring(0, 40)}...`);
            console.log(`   ✅ Token[unlocked]: ${tokenUnlocked}`);

            // PASSO 2: Salvar device
            console.log('\n2️⃣ Salvando device...');
            await this.saveDevice();

            // PASSO 3: Resolver Turnstile
            console.log('\n3️⃣ Resolvendo Turnstile...');
            const turnstileToken = await this.solveTurnstile(this.baseUrl + '/');

            // PASSO 4: Fazer login (POST para / e não /login!)
            console.log('\n4️⃣ Enviando credenciais...');
            
            const postBodyParts = [
                `_method=POST`,
                `_csrfToken=${encodeURIComponent(this.csrfToken)}`,
                `username=${encodeURIComponent(this.username)}`,
                `password=${encodeURIComponent(this.password)}`,
                `cf-turnstile-response=${encodeURIComponent(turnstileToken)}`
            ];
            
            // CRÍTICO: Adicionar _Token[fields] e _Token[unlocked]
            if (tokenFields) {
                postBodyParts.push(`_Token%5Bfields%5D=${encodeURIComponent(tokenFields)}`);
            }
            
            if (tokenUnlocked) {
                postBodyParts.push(`_Token%5Bunlocked%5D=${encodeURIComponent(tokenUnlocked)}`);
            }
            
            const postBody = postBodyParts.join('&');

            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ') + `; device_id=${this.deviceId}`;

            console.log(`   📤 Fazendo POST para / (não /login)`);
            console.log(`   👤 Username: ${this.username}`);

            // POST para / (NÃO /login!)
            const loginResponse = await this.session.post('/', postBody, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Cookie': cookieString,
                    'Origin': this.baseUrl,
                    'Referer': this.baseUrl + '/',
                    'Upgrade-Insecure-Requests': '1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });

            console.log(`   📊 Status: ${loginResponse.status}`);

            // Atualizar cookies pós-login
            const loginSetCookie = loginResponse.headers['set-cookie'];
            if (loginSetCookie) {
                loginSetCookie.forEach(cookie => {
                    const [nameValue] = cookie.split(';');
                    const [name, value] = nameValue.split('=');
                    if (value.trim() !== 'deleted') {
                        this.cookies[name.trim()] = value.trim();
                    }
                });
            }

            // PASSO 5: Testar acesso ao /gerenciador/home
            console.log('\n5️⃣ Testando acesso ao painel...');
            
            const testCookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');
            
            const testResponse = await this.session.get('/gerenciador/home', {
                headers: {
                    'Cookie': testCookieString
                },
                maxRedirects: 0,
                validateStatus: (status) => status >= 200 && status < 400
            });

            console.log(`   📊 Status: ${testResponse.status}`);
            
            // Verificar se está logado (não deve ter redirect para /)
            if (testResponse.status === 302) {
                const location = testResponse.headers.location || '';
                if (location === '/' || location.includes('login')) {
                    throw new Error('Login falhou - não conseguiu acessar /gerenciador/home');
                }
            }
            
            // Se status 200, verificar se não é página de login
            if (testResponse.status === 200) {
                const isLoginPage = typeof testResponse.data === 'string' && 
                                   testResponse.data.includes('Acessar o Painel');
                
                if (isLoginPage) {
                    throw new Error('Login falhou - ainda na página de login');
                }
            }

            console.log('✅ [CN-RENEWAL] Login bem-sucedido!');
            return true;

        } catch (error) {
            console.error(`❌ [CN-RENEWAL] Erro no login: ${error.message}`);
            throw error;
        }
    }

    // ============= RENOVAR USUÁRIO =============
    
    async renovarUsuario(userId) {
        try {
            console.log(`\n🔄 [CN-RENEWAL] Renovando usuário: ${userId}`);
            
            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            // CORREÇÃO: URL e payload corretos
            const payload = `ids%5B%5D=${userId}`; // ids[]=userId em URL encoded
            
            const response = await this.session.post('/users/renova-users-selecionados', 
                payload,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Cookie': cookieString,
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-Csrf-Token': this.csrfToken,
                        'Accept': '*/*',
                        'Origin': this.baseUrl,
                        'Referer': this.baseUrl + '/gerenciador/usuario-iptv'
                    },
                    timeout: 30000
                }
            );

            const responseBody = response.data;
            
            // Verificar se sessão expirou
            const isLoginPage = typeof responseBody === 'string' && 
                               (responseBody.includes('<!DOCTYPE html') || 
                                responseBody.includes('Acessar o Painel') ||
                                responseBody.includes('name="username"'));

            if (isLoginPage) {
                console.log(`   ❌ SESSÃO EXPIROU!`);
                return {
                    sucesso: false,
                    userId: userId,
                    status: response.status,
                    erro: 'Sessão expirada',
                    timestamp: new Date().toISOString()
                };
            }
            
            console.log(`   📥 Status: ${response.status}`);
            
            // Verificar sucesso baseado na resposta
            // O servidor retorna: {"success":"Usuários Renovados com sucesso!"}
            let sucesso = false;
            
            if (typeof responseBody === 'object' && responseBody.success) {
                sucesso = true;
                console.log(`   ✅ Renovado com sucesso!`);
                console.log(`   📩 Resposta: ${responseBody.success}`);
            } else if (response.status === 200 && !responseBody.error) {
                sucesso = true;
                console.log(`   ✅ Renovado com sucesso! (status 200)`);
            } else {
                console.log(`   ⚠️ Resposta inesperada:`, responseBody);
            }

            return {
                sucesso: sucesso,
                userId: userId,
                status: response.status,
                response: responseBody,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`   ❌ Erro ao renovar: ${error.message}`);
            return {
                sucesso: false,
                userId: userId,
                erro: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // ============= RENOVAR MÚLTIPLOS (PARA PLANOS >1 MÊS) =============
    
    async renovarMultiplosMeses(userId, meses) {
        console.log(`\n📋 [CN-RENEWAL] Renovando ${meses}x o usuário ${userId}...`);
        
        const resultados = [];
        
        for (let i = 0; i < meses; i++) {
            console.log(`\n   [${i + 1}/${meses}] Renovação #${i + 1}`);
            
            const resultado = await this.renovarUsuario(userId);
            resultados.push(resultado);
            
            if (i < meses - 1) {
                console.log(`   ⏳ Aguardando 2s antes da próxima...`);
                await this.sleep(2000);
            }
        }
        
        const sucessos = resultados.filter(r => r.sucesso).length;
        
        console.log(`\n✅ [CN-RENEWAL] Renovações concluídas: ${sucessos}/${meses}`);
        
        return {
            total: resultados.length,
            sucessos: sucessos,
            falhas: resultados.length - sucessos,
            resultados: resultados
        };
    }

    // ============= DEVICE =============

    async saveDevice() {
        try {
            const cookieString = Object.entries(this.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            // CORREÇÃO: URL correta + JSON payload
            await this.session.post('/login-sessions/save-devices', 
                JSON.stringify({ visitorId: this.deviceId }),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Cookie': cookieString,
                        'X-Csrf-Token': this.csrfToken,
                        'Origin': this.baseUrl,
                        'Referer': this.baseUrl + '/'
                    }
                }
            );
            
            console.log('   ✅ Device salvo');
        } catch (error) {
            console.warn('⚠️ [CN-RENEWAL] Erro ao salvar device (não crítico)');
        }
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

export default CloudNationRenewalService;