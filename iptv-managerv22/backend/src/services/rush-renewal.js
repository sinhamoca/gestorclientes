/* ========================================
   RUSH RENEWAL SERVICE
   Serviço para renovação automática de clientes RushPlay
   
   BASEADO NO: rush-auto.js
   
   CARACTERÍSTICAS:
   - Sem captcha necessário
   - Sem proxy necessário
   - API REST pura (JSON)
   - Suporta IPTV e P2P
   - Busca por nome (campo notes)
   - Renovação multi-mês em 1 request
   ======================================== */

import axios from 'axios';

class RushRenewalService {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.token = null;
    this.userData = null;
    this.clientesData = { iptv: [], p2p: [] };
    
    // Configuração da API
    this.config = {
      LOGIN_API_URL: 'https://api-new.paineloffice.click/auth/login',
      BASE_API_URL: 'https://api-new.paineloffice.click',
      IPTV_LIST_URL: 'https://api-new.paineloffice.click/iptv/list',
      P2P_LIST_URL: 'https://api-new.paineloffice.click/p2p/list'
    };
    
    // Cliente HTTP
    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const symbols = {
      info: '[RUSH]',
      success: '[RUSH ✓]',
      error: '[RUSH ✗]',
      loading: '[RUSH ...]'
    };
    console.log(`${timestamp} ${symbols[type] || '[RUSH]'} ${message}`);
  }

  async delay(seconds = 2) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  /**
   * Login na API do Rush
   */
  async login() {
    this.log('Realizando login...', 'loading');
    
    try {
      const response = await this.client.post(this.config.LOGIN_API_URL, {
        username: this.username,
        password: this.password
      });

      // Extrair token (pode vir como token ou access_token)
      const token = response.data.token || response.data.access_token;

      if (!token) {
        throw new Error('Token não encontrado na resposta do servidor');
      }

      this.token = token;
      this.userData = response.data;
      
      this.log('Login realizado com sucesso!', 'success');
      return true;

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      this.log(`Erro no login: ${errorMsg}`, 'error');
      throw new Error(`Falha no login Rush: ${errorMsg}`);
    }
  }

  /**
   * Buscar todos os clientes IPTV
   */
  async buscarClientesIPTV() {
    this.log('Buscando clientes IPTV...', 'loading');
    
    try {
      const url = `${this.config.IPTV_LIST_URL}?limit=1000&page=1&orderBy=exp_date&order=ASC&username=${this.username}&password=${this.password}&token=${this.token}`;
      
      const response = await this.client.get(url);
      
      if (response.data && response.data.items) {
        const clientes = response.data.items.map(cliente => ({
          id: cliente.id,
          username: cliente.username,
          password: cliente.password,
          notes: cliente.notes || '',
          screens: cliente.screens || 1,
          system: 'IPTV'
        }));
        
        this.log(`${clientes.length} clientes IPTV encontrados`, 'success');
        return clientes;
      }
      
      return [];
      
    } catch (error) {
      this.log(`Erro ao buscar clientes IPTV: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Buscar todos os clientes P2P
   */
  async buscarClientesP2P() {
    this.log('Buscando clientes P2P...', 'loading');
    
    try {
      const url = `${this.config.P2P_LIST_URL}?limit=1000&page=1&isTrial=0&orderBy=endTime&order=ASC&username=${this.username}&password=${this.password}&token=${this.token}`;
      
      const response = await this.client.get(url);
      
      if (response.data && response.data.items) {
        const clientes = response.data.items.map(cliente => ({
          id: cliente.new_id || cliente.id,
          username: cliente.name || cliente.username,
          password: cliente.pass || cliente.password,
          notes: cliente.nota || cliente.notes || '',
          screens: null, // P2P não usa screens
          system: 'P2P'
        }));
        
        this.log(`${clientes.length} clientes P2P encontrados`, 'success');
        return clientes;
      }
      
      return [];
      
    } catch (error) {
      this.log(`Erro ao buscar clientes P2P: ${error.message}`, 'error');
      return [];
    }
  }

  /**
   * Atualizar lista de todos os clientes
   */
  async atualizarListaClientes() {
    this.log('Atualizando lista de clientes...', 'loading');
    
    this.clientesData.iptv = await this.buscarClientesIPTV();
    this.clientesData.p2p = await this.buscarClientesP2P();

    const total = this.clientesData.iptv.length + this.clientesData.p2p.length;
    this.log(`Total: ${total} clientes carregados`, 'success');
    
    return this.clientesData;
  }

  /**
   * Buscar cliente por nome exato (campo notes)
   * @param {string} nomeCliente - Nome exato do cliente
   * @param {string} tipo - 'IPTV', 'P2P' ou 'AMBOS'
   */
  buscarClientePorNome(nomeCliente, tipo = 'AMBOS') {
    this.log(`Buscando cliente: "${nomeCliente}" (tipo: ${tipo})...`, 'loading');
    
    let clientes = [];
    
    if (tipo === 'IPTV' || tipo === 'AMBOS') {
      clientes = [...clientes, ...this.clientesData.iptv];
    }
    
    if (tipo === 'P2P' || tipo === 'AMBOS') {
      clientes = [...clientes, ...this.clientesData.p2p];
    }
    
    // Busca case-insensitive com trim
    const encontrados = clientes.filter(cliente => 
      cliente.notes.trim().toLowerCase() === nomeCliente.trim().toLowerCase()
    );

    if (encontrados.length === 0) {
      this.log(`Cliente "${nomeCliente}" não encontrado`, 'error');
      return { found: false, cliente: null, duplicates: [] };
    }

    if (encontrados.length > 1) {
      this.log(`ATENÇÃO: ${encontrados.length} clientes com o mesmo nome!`, 'error');
      return { found: false, cliente: null, duplicates: encontrados };
    }

    const cliente = encontrados[0];
    this.log(`Cliente encontrado! ID: ${cliente.id}, Sistema: ${cliente.system}`, 'success');

    return { found: true, cliente: cliente, duplicates: [] };
  }

  /**
   * Renovar cliente por ID
   * @param {string} clientId - ID do cliente no Rush
   * @param {number} months - Quantidade de meses
   * @param {string} planType - 'IPTV' ou 'P2P'
   * @param {number} screens - Quantidade de telas (só para IPTV)
   */
  async renovarClientePorId(clientId, months, planType, screens = 1) {
    this.log(`Renovando cliente ID ${clientId}...`, 'loading');
    this.log(`   Tipo: ${planType}, Meses: ${months}, Telas: ${screens}`, 'info');
    
    try {
      let payload = {
        month: months,
        amount: 25
      };

      let endpoint = '';
      
      if (planType.toUpperCase() === 'P2P') {
        endpoint = `${this.config.BASE_API_URL}/p2p/extend/${clientId}`;
      } else {
        endpoint = `${this.config.BASE_API_URL}/iptv/extend/${clientId}`;
        payload.screen = screens;
      }

      const url = `${endpoint}?username=${this.username}&password=${this.password}&token=${this.token}`;

      this.log(`   Endpoint: ${endpoint}`, 'info');
      this.log(`   Payload: ${JSON.stringify(payload)}`, 'info');

      const response = await this.client.put(url, payload);

      if (response.data.success || response.data.id) {
        const result = response.data.result || response.data;
        
        let novaExpiracao = '';
        if (planType.toUpperCase() === 'P2P') {
          novaExpiracao = new Date(result.endTime).toLocaleString('pt-BR');
        } else {
          novaExpiracao = new Date(result.exp_date * 1000).toLocaleString('pt-BR');
        }
        
        this.log(`Cliente renovado com sucesso!`, 'success');
        this.log(`   Nova expiração: ${novaExpiracao}`, 'success');

        return { 
          success: true, 
          data: response.data,
          nova_expiracao: novaExpiracao
        };
      } else {
        throw new Error('Resposta da API indicou falha na renovação');
      }

    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      this.log(`Erro na renovação: ${errorMsg}`, 'error');
      
      return { 
        success: false, 
        error: errorMsg 
      };
    }
  }

  /**
   * Renovar cliente por nome
   * Faz busca pelo nome e renova automaticamente
   * 
   * @param {string} nomeCliente - Nome exato do cliente (campo notes)
   * @param {number} months - Quantidade de meses
   * @param {string} planType - 'IPTV' ou 'P2P'
   * @param {number} screens - Quantidade de telas (só para IPTV)
   */
  async renovarClientePorNome(nomeCliente, months, planType, screens = 1) {
    this.log(`\n${'='.repeat(60)}`, 'info');
    this.log(`RENOVANDO: "${nomeCliente}"`, 'info');
    this.log(`Tipo: ${planType} | Meses: ${months} | Telas: ${screens}`, 'info');
    this.log('='.repeat(60), 'info');

    // Buscar cliente
    const resultado = this.buscarClientePorNome(nomeCliente, planType);

    if (!resultado.found) {
      if (resultado.duplicates.length > 0) {
        return {
          success: false,
          error: `Encontrados ${resultado.duplicates.length} clientes com o nome "${nomeCliente}". Corrija os nomes duplicados no painel.`,
          duplicates: resultado.duplicates
        };
      }
      
      return {
        success: false,
        error: `Cliente "${nomeCliente}" não encontrado no sistema ${planType}`
      };
    }

    const cliente = resultado.cliente;

    // Renovar
    const renovacao = await this.renovarClientePorId(
      cliente.id,
      months,
      cliente.system,
      screens
    );

    return {
      ...renovacao,
      cliente: {
        id: cliente.id,
        username: cliente.username,
        notes: cliente.notes,
        system: cliente.system
      }
    };
  }

  /**
   * Renovar múltiplos clientes por nome composto
   * Ex: nome="João", usernames="tela 1, tela 2" → busca "João tela 1", "João tela 2"
   * 
   * @param {string} nomeBase - Nome base do cliente
   * @param {string} usernames - Lista de sufixos separados por vírgula
   * @param {number} months - Quantidade de meses
   * @param {string} planType - 'IPTV' ou 'P2P'
   * @param {number} screens - Quantidade de telas (só para IPTV)
   */
  async renovarMultiplosClientes(nomeBase, usernames, months, planType, screens = 1) {
    this.log(`\n${'='.repeat(60)}`, 'info');
    this.log(`RENOVAÇÃO MÚLTIPLA: "${nomeBase}"`, 'info');
    this.log(`Tipo: ${planType} | Meses: ${months} | Telas: ${screens}`, 'info');
    this.log('='.repeat(60), 'info');

    // Processar lista de usernames
    const sufixos = usernames
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const total = sufixos.length;
    this.log(`Total de clientes para renovar: ${total}`, 'info');

    const resultados = [];
    let sucessos = 0;
    let falhas = 0;

    for (let i = 0; i < total; i++) {
      const sufixo = sufixos[i];
      const nomeCompleto = `${nomeBase} ${sufixo}`.trim();

      this.log(`\n[${i + 1}/${total}] Processando: "${nomeCompleto}"`, 'info');

      const resultado = await this.renovarClientePorNome(
        nomeCompleto,
        months,
        planType,
        screens
      );

      resultados.push({
        nome: nomeCompleto,
        ...resultado
      });

      if (resultado.success) {
        sucessos++;
      } else {
        falhas++;
      }

      // Delay entre renovações
      if (i < total - 1) {
        this.log('Aguardando 2s antes da próxima renovação...', 'loading');
        await this.delay(2);
      }
    }

    // Resumo
    this.log(`\n${'='.repeat(60)}`, 'info');
    this.log('RESUMO DA RENOVAÇÃO MÚLTIPLA', 'info');
    this.log('='.repeat(60), 'info');
    this.log(`Total: ${total}`, 'info');
    this.log(`Sucessos: ${sucessos}`, 'success');
    this.log(`Falhas: ${falhas}`, falhas > 0 ? 'error' : 'info');

    return {
      success: falhas === 0,
      total,
      sucessos,
      falhas,
      resultados
    };
  }
}

export default RushRenewalService;
