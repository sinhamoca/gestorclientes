/* ========================================
   CLUB RENEWAL SERVICE
   Serviço para renovação automática no painel Club (dashboard.bz)
   Baseado no CLI dashbz-cli.js fornecido
   ======================================== */

import axios from 'axios';

class ClubRenewalService {
  constructor(anticaptchaKey, username, password) {
    this.anticaptchaKey = anticaptchaKey;
    this.username = username;
    this.password = password;
    this.token = null;
    
    this.CONFIG = {
      HCAPTCHA_SITEKEY: '8cf2ef3e-6e60-456a-86ca-6f2c855c3a06',
      TARGET_URL: 'https://dashboard.bz/login.php',
      LOGIN_API_URL: 'https://pdcapi.io/login',
      RENEW_API_URL: 'https://pdcapi.io/listas'
    };
  }

  /**
   * Resolve hCaptcha usando Anti-Captcha API
   */
  async resolveHCaptcha() {
    console.log('🔓 [CLUB] Resolvendo hCaptcha...');
    
    try {
      // Criar tarefa de captcha
      const createResponse = await axios.post('https://api.anti-captcha.com/createTask', {
        clientKey: this.anticaptchaKey,
        task: {
          type: "HCaptchaTaskProxyless",
          websiteURL: this.CONFIG.TARGET_URL,
          websiteKey: this.CONFIG.HCAPTCHA_SITEKEY
        }
      });
      
      if (createResponse.data.errorId !== 0) {
        throw new Error(`Anti-Captcha Error: ${createResponse.data.errorDescription}`);
      }
      
      const taskId = createResponse.data.taskId;
      console.log(`   Task ID: ${taskId}`);
      
      // Aguardar resolução do captcha (máximo 150 segundos = 30 tentativas * 5s)
      for (let i = 0; i < 30; i++) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const resultResponse = await axios.post('https://api.anti-captcha.com/getTaskResult', {
          clientKey: this.anticaptchaKey,
          taskId: taskId
        });
        
        if (resultResponse.data.status === 'ready') {
          console.log('✅ [CLUB] hCaptcha resolvido com sucesso!');
          return resultResponse.data.solution.gRecaptchaResponse;
        }
        
        console.log(`   Tentativa ${i + 1}/30 - Status: ${resultResponse.data.status}`);
      }
      
      throw new Error('Timeout ao resolver hCaptcha (150 segundos)');
      
    } catch (error) {
      console.error('❌ [CLUB] Erro ao resolver hCaptcha:', error.message);
      throw new Error(`Falha ao resolver hCaptcha: ${error.message}`);
    }
  }

  /**
   * Fazer login no sistema Club
   */
  async login() {
    console.log('\n🔑 [CLUB] Fazendo login...');
    console.log(`   Usuário: ${this.username}`);
    
    try {
      // Resolver hCaptcha primeiro
      const hcaptchaToken = await this.resolveHCaptcha();
      
      // Preparar dados do formulário
      const formData = new URLSearchParams();
      formData.append('username', this.username);
      formData.append('password', this.password);
      formData.append('g-recaptcha-response', hcaptchaToken);
      formData.append('h-captcha-response', hcaptchaToken);
      
      // Fazer login
      const loginResponse = await axios.post(this.CONFIG.LOGIN_API_URL, formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://dashboard.bz',
          'Referer': 'https://dashboard.bz/login.php',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (loginResponse.data.result && loginResponse.data.token) {
        this.token = loginResponse.data.token;
        console.log('✅ [CLUB] Login realizado com sucesso!');
        return true;
      } else {
        throw new Error(loginResponse.data.msg || 'Login falhou sem mensagem de erro');
      }
      
    } catch (error) {
      console.error('❌ [CLUB] Erro no login:', error.message);
      
      if (error.response) {
        console.error('   Status:', error.response.status);
        console.error('   Data:', error.response.data);
      }
      
      throw new Error(`Falha no login Club: ${error.message}`);
    }
  }

  /**
   * Renovar um cliente por X meses
   */
  async renovarCliente(clientId, meses) {
    if (!this.token) {
      throw new Error('Token não disponível. Faça login primeiro.');
    }
    
    console.log(`\n🔄 [CLUB] Renovando cliente ${clientId} por ${meses} mês(es)...`);
    
    try {
      const formData = new URLSearchParams();
      formData.append('tempo', meses);
      
      const response = await axios.post(
        `${this.CONFIG.RENEW_API_URL}/${clientId}/renovar`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-access-token': this.token,
            'Origin': 'https://dashboard.bz',
            'Referer': 'https://dashboard.bz/',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36'
          }
        }
      );
      
      if (response.data.result) {
        console.log('✅ [CLUB] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
        console.log(`   Cliente: ${response.data.username}`);
        console.log(`   Renovado: ${response.data.tempo} mês(es)`);
        console.log(`   Próximo vencimento: ${new Date(response.data.novo_time * 1000).toLocaleString('pt-BR')}`);
        
        // Limpar HTML tags do comprovante
        const comprovante = response.data.msg.replace(/<[^>]*>/g, '');
        console.log(`\n📋 Comprovante:\n${comprovante}`);
        
        return {
          sucesso: true,
          cliente: response.data.username,
          mesesRenovados: response.data.tempo,
          novoVencimento: response.data.novo_time,
          comprovante: comprovante
        };
      } else {
        console.log('❌ [CLUB] FALHA NA RENOVAÇÃO:', response.data.msg || 'Erro desconhecido');
        return {
          sucesso: false,
          erro: response.data.msg || 'Erro desconhecido'
        };
      }
      
    } catch (error) {
      console.error('❌ [CLUB] Erro na renovação:', error.message);
      
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Resposta:', error.response.data);
      }
      
      return {
        sucesso: false,
        erro: error.message
      };
    }
  }
}

export default ClubRenewalService;