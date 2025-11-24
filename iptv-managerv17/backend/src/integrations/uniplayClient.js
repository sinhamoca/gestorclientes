/* ========================================
   UNIPLAY CLIENT - COM PROXYCHAINS
   Cliente para integração com GesAPIOffice (Uniplay)
   
   CRÍTICO: USA PROXYCHAINS4 (proxy residencial BR obrigatório)
   ======================================== */

const { spawn } = require('child_process');

class UniplayClient {
  constructor(username, password, useProxy = true) {
    this.baseURL = 'https://gesapioffice.com';
    this.username = username;
    this.password = password;
    this.useProxy = useProxy; // Sempre true em produção
    this.token = null;
    this.cryptPass = null;
    this.userId = null;
  }

  /**
   * Executar comando curl com proxychains
   * IGUAL AO SIGMA - usando spawn com proxychains4
   */
  async executeCommand(args) {
    return new Promise((resolve, reject) => {
      const command = this.useProxy ? 'proxychains4' : 'curl';
      const finalArgs = this.useProxy 
        ? ['-q', 'curl', ...args]  // proxychains4 -q curl [args]
        : args;

      console.log(`🔄 [UNIPLAY-CMD] Executando: ${command} ${finalArgs.slice(0, 5).join(' ')}...`);
      
      const proc = spawn(command, finalArgs);
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      proc.on('close', (code) => {
        if (code === 0 || stdout.length > 0) {
          console.log(`✅ [UNIPLAY-CMD] Sucesso! Code: ${code}, Output length: ${stdout.length}`);
          resolve({ stdout, stderr, code });
        } else {
          console.error(`❌ [UNIPLAY-CMD] Falhou! Code: ${code}`);
          console.error(`   STDERR: ${stderr.substring(0, 200)}`);
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });
      
      proc.on('error', (error) => {
        console.error(`❌ [UNIPLAY-CMD] Erro ao iniciar comando: ${error.message}`);
        reject(new Error(`Failed to start command: ${error.message}`));
      });
    });
  }

  /**
   * Fazer login no GesAPIOffice
   */
  async login() {
    try {
      console.log('\n🔐 [UNIPLAY] Fazendo login...');
      console.log(`   Usuário: ${this.username}`);
      console.log(`   URL: ${this.baseURL}/api/login`);
      
      const loginData = JSON.stringify({
        username: this.username,
        password: this.password,
        code: ""
      });

      // Montar comando curl com proxychains
      const curlArgs = [
        '-X', 'POST',
        `${this.baseURL}/api/login`,
        '-H', 'Accept: application/json, text/plain, */*',
        '-H', 'Content-Type: application/json',
        '-H', 'Origin: https://gestordefender.com',
        '-H', 'Referer: https://gestordefender.com/',
        '-H', 'User-Agent: Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
        '--data-raw', loginData,
        '-s',  // Silent mode
        '--max-time', '30'
      ];

      const result = await this.executeCommand(curlArgs);
      const response = JSON.parse(result.stdout);

      if (response.access_token) {
        this.token = response.access_token;
        this.userId = response.id;
        this.cryptPass = response.crypt_pass;
        
        console.log('✅ [UNIPLAY] Login realizado com sucesso!');
        console.log(`   User ID: ${this.userId}`);
        console.log(`   Token: ${this.token.substring(0, 20)}...`);
        return true;
      }

      console.error('❌ [UNIPLAY] Login falhou - sem access_token');
      return false;

    } catch (error) {
      console.error('❌ [UNIPLAY] Erro no login:', error.message);
      throw new Error(`Falha no login Uniplay: ${error.message}`);
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
      console.log('\n📡 [UNIPLAY] Buscando clientes P2P...');

      const curlArgs = [
        `${this.baseURL}/api/users-p2p`,
        '-H', 'Accept: application/json, text/plain, */*',
        '-H', `Authorization: Bearer ${this.token}`,
        '-H', 'Origin: https://gestordefender.com',
        '-H', 'Referer: https://gestordefender.com/',
        '-s',
        '--max-time', '30'
      ];

      const result = await this.executeCommand(curlArgs);
      const clients = JSON.parse(result.stdout);

      console.log(`✅ [UNIPLAY] ${clients.length} clientes P2P encontrados`);
      return Array.isArray(clients) ? clients : [];

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
      console.log('\n📺 [UNIPLAY] Buscando clientes IPTV...');

      const curlArgs = [
        `${this.baseURL}/api/users-iptv?reg_password=${encodeURIComponent(this.cryptPass)}`,
        '-H', 'Accept: application/json, text/plain, */*',
        '-H', `Authorization: Bearer ${this.token}`,
        '-H', 'Origin: https://gestordefender.com',
        '-H', 'Referer: https://gestordefender.com/',
        '-s',
        '--max-time', '30'
      ];

      const result = await this.executeCommand(curlArgs);
      const clients = JSON.parse(result.stdout);

      console.log(`✅ [UNIPLAY] ${clients.length} clientes IPTV encontrados`);
      return Array.isArray(clients) ? clients : [];

    } catch (error) {
      console.error('❌ [UNIPLAY] Erro ao buscar clientes IPTV:', error.message);
      return [];
    }
  }

  /**
   * Buscar cliente por nome (busca automática em P2P e IPTV)
   */
  async findClientByName(clientName) {
    console.log(`\n🔍 [UNIPLAY] Buscando cliente: "${clientName}"`);
    
    const normalizedSearch = clientName.trim().toLowerCase();

    // Buscar em P2P primeiro
    console.log('   → Buscando em P2P...');
    const p2pClients = await this.getP2PClients();
    
    for (const client of p2pClients) {
      const nota = client.nota || '';
      const cleanedNota = this.cleanClientName(nota);
      
      if (cleanedNota.toLowerCase() === normalizedSearch) {
        console.log(`✅ [UNIPLAY] Cliente encontrado em P2P!`);
        console.log(`   ID: ${client.id}`);
        console.log(`   Nome: ${cleanedNota}`);
        return { ...client, serviceType: 'p2p', name: cleanedNota };
      }
    }

    // Se não encontrou em P2P, buscar em IPTV
    console.log('   → Cliente não encontrado em P2P, buscando em IPTV...');
    const iptvClients = await this.getIPTVClients();
    
    for (const client of iptvClients) {
      const nota = client.nota || '';
      const cleanedNota = this.cleanClientName(nota);
      
      if (cleanedNota.toLowerCase() === normalizedSearch) {
        console.log(`✅ [UNIPLAY] Cliente encontrado em IPTV!`);
        console.log(`   ID: ${client.id}`);
        console.log(`   Nome: ${cleanedNota}`);
        return { ...client, serviceType: 'iptv', name: cleanedNota };
      }
    }

    console.error(`❌ [UNIPLAY] Cliente "${clientName}" não encontrado em P2P nem IPTV`);
    throw new Error(`Cliente "${clientName}" não encontrado`);
  }

  /**
   * Renovar cliente
   */
  async renewClient(clientId, serviceType, credits) {
    if (!this.token) {
      throw new Error('Token não disponível. Faça login primeiro.');
    }

    console.log(`\n🔄 [UNIPLAY] Renovando cliente...`);
    console.log(`   ID: ${clientId}`);
    console.log(`   Tipo: ${serviceType.toUpperCase()}`);
    console.log(`   Créditos: ${credits}`);

    const endpoint = serviceType.toLowerCase() === 'iptv' ? 'users-iptv' : 'users-p2p';

    const renewalData = JSON.stringify({
      action: 1,
      credits: credits,
      reg_password: this.cryptPass
    });

    try {
      const curlArgs = [
        '-X', 'PUT',
        `${this.baseURL}/api/${endpoint}/${clientId}`,
        '-H', 'Accept: application/json, text/plain, */*',
        '-H', 'Content-Type: application/json',
        '-H', `Authorization: Bearer ${this.token}`,
        '-H', 'Origin: https://gestordefender.com',
        '-H', 'Referer: https://gestordefender.com/',
        '--data-raw', renewalData,
        '-s',
        '--max-time', '30'
      ];

      const result = await this.executeCommand(curlArgs);
      
      console.log('✅ [UNIPLAY] Renovação concluída com sucesso!');
      console.log(`   Response: ${result.stdout.substring(0, 200)}`);
      
      return {
        success: true,
        data: result.stdout ? JSON.parse(result.stdout) : {}
      };

    } catch (error) {
      console.error('❌ [UNIPLAY] Erro ao renovar cliente:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Limpar nome do cliente (remover textos padrão)
   */
  cleanClientName(nota) {
    if (!nota) return '';
    
    let cleaned = nota.replace(/\\u([0-9a-fA-F]{4})/g, (match, grp) => {
      return String.fromCharCode(parseInt(grp, 16));
    });
    
    cleaned = cleaned.replace(/Usuário migrado externamente\.\s*Obs:\s*/gi, '');
    cleaned = cleaned.replace(/Obs:\s*/gi, '');
    cleaned = cleaned.trim().replace(/\s+/g, ' ');
    
    return cleaned;
  }
}

module.exports = UniplayClient;
