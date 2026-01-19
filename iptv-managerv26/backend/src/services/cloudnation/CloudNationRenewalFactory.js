/* ========================================
   CLOUDNATION RENEWAL FACTORY
   Factory para renovação CloudNation com suporte a dois modos:
   
   1. KEEPER: Usa sessão persistente (novo sistema)
   2. LEGACY: Login completo a cada renovação (sistema atual)
   
   Configuração via ENV:
   CLOUDNATION_RENEWAL_MODE=keeper|legacy (default: legacy)
   CLOUDNATION_FALLBACK_TO_LEGACY=true (fallback se keeper falhar)
   
   LOCALIZAÇÃO: backend/src/services/cloudnation/CloudNationRenewalFactory.js
   ======================================== */

import sessionManager from './CloudNationSessionManager.js';
import CloudNationService from '../cloudnation.js';
import * as db from '../../database.js';

class CloudNationRenewalFactory {
  constructor() {
    this.defaultMode = 'legacy';
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CN-FACTORY] [${type}] ${message}`);
  }

  // ========================================
  // OBTER MODO DE RENOVAÇÃO
  // ========================================
  getMode() {
    const mode = process.env.CLOUDNATION_RENEWAL_MODE || this.defaultMode;
    
    // Validar modo
    if (!['keeper', 'legacy'].includes(mode.toLowerCase())) {
      this.log(`Modo inválido "${mode}", usando "${this.defaultMode}"`, 'WARNING');
      return this.defaultMode;
    }
    
    return mode.toLowerCase();
  }

  // ========================================
  // RENOVAR CLIENTE (MÉTODO PRINCIPAL)
  // ========================================
  async renewClient({ userId, credentials, clientId, months }) {
    const mode = this.getMode();
    
    this.log(`═══════════════════════════════════════════════════`);
    this.log(`Renovação CloudNation - Modo: ${mode.toUpperCase()}`);
    this.log(`User: ${userId} | Client: ${clientId} | Meses: ${months}`);
    this.log(`═══════════════════════════════════════════════════`);
    
    const startTime = Date.now();
    let result;
    
    try {
      if (mode === 'keeper') {
        result = await this.renewWithSessionKeeper(userId, clientId, months);
      } else {
        result = await this.renewWithLegacy(credentials, clientId, months);
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      this.log(`Renovação concluída em ${elapsed}s - Sucesso: ${result.success}`, result.success ? 'SUCCESS' : 'ERROR');
      
      return result;
      
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      this.log(`Renovação FALHOU em ${elapsed}s: ${error.message}`, 'ERROR');
      
      return {
        success: false,
        error: error.message,
        mode,
        clientId,
        months
      };
    }
  }

  // ========================================
  // MODO KEEPER: Sessão Persistente
  // ========================================
  async renewWithSessionKeeper(userId, clientId, months) {
    this.log('[KEEPER] Usando sessão persistente...');
    
    // Domínio padrão do CloudNation
    const domain = 'https://painel.cloudnation.top';
    
    try {
      // Obter sessão ativa (já logada)
      const session = await sessionManager.getSession(domain, userId);
      
      this.log(`[KEEPER] Sessão obtida - Login #${session.loginCount}`);
      
      // Renovar usando sessão existente
      let result;
      
      if (months === 1) {
        result = await session.renewClient(clientId);
      } else {
        result = await session.renewClientMultipleMonths(clientId, months);
      }
      
      sessionManager.stats.totalRenewals++;
      
      return {
        ...result,
        mode: 'keeper',
        sessionInfo: session.getSessionInfo()
      };
      
    } catch (error) {
      this.log(`[KEEPER] Erro: ${error.message}`, 'ERROR');
      
      // Fallback para legacy se keeper falhar?
      const fallbackOnError = process.env.CLOUDNATION_FALLBACK_TO_LEGACY === 'true';
      
      if (fallbackOnError) {
        this.log('[KEEPER] Fallback para modo LEGACY...', 'WARNING');
        
        const credentials = db.getCredentials(userId);
        if (credentials) {
          // Decodificar senha
          const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');
          const decodedCreds = { ...credentials, password: decodedPassword };
          return await this.renewWithLegacy(decodedCreds, clientId, months);
        }
      }
      
      throw error;
    }
  }

  // ========================================
  // MODO LEGACY: Login a cada renovação
  // ========================================
  async renewWithLegacy(credentials, clientId, months) {
    this.log('[LEGACY] Usando login completo a cada renovação...');
    
    // Instanciar serviço antigo
    const service = new CloudNationService(
      credentials.username,
      credentials.password
    );
    
    // Fazer login (com Turnstile)
    this.log('[LEGACY] Fazendo login...');
    await service.login();
    
    // Renovar cliente
    this.log('[LEGACY] Renovando cliente...');
    
    // CloudNation não aceita múltiplos meses em uma request, precisa fazer loop
    const results = [];
    
    for (let i = 0; i < months; i++) {
      this.log(`[LEGACY] Renovação ${i + 1}/${months}...`);
      
      const result = await service.renewUser(clientId);
      results.push(result);
      
      if (!result.success) {
        this.log(`[LEGACY] Falha na renovação ${i + 1}`, 'ERROR');
        break;
      }
      
      if (i < months - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    if (months === 1) {
      return {
        ...results[0],
        mode: 'legacy'
      };
    }
    
    return {
      success: successCount === months,
      total: months,
      completed: successCount,
      failed: months - successCount,
      results,
      mode: 'legacy'
    };
  }

  // ========================================
  // RENOVAR MÚLTIPLOS CLIENTES
  // ========================================
  async renewMultipleClients({ userId, credentials, clientIds, months }) {
    const mode = this.getMode();
    
    this.log(`Renovação em lote - ${clientIds.length} clientes - Modo: ${mode.toUpperCase()}`);
    
    const results = [];
    
    if (mode === 'keeper') {
      // No modo keeper, obtemos a sessão uma vez
      const domain = 'https://painel.cloudnation.top';
      const session = await sessionManager.getSession(domain, userId);
      
      for (const clientId of clientIds) {
        try {
          let result;
          
          if (months === 1) {
            result = await session.renewClient(clientId);
          } else {
            result = await session.renewClientMultipleMonths(clientId, months);
          }
          
          results.push({ ...result, mode: 'keeper' });
          sessionManager.stats.totalRenewals++;
          
        } catch (error) {
          results.push({
            success: false,
            clientId,
            error: error.message,
            mode: 'keeper'
          });
        }
        
        // Delay entre renovações
        if (clientIds.indexOf(clientId) < clientIds.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } else {
      // No modo legacy, fazemos login uma vez e renovamos todos
      const service = new CloudNationService(
        credentials.username,
        credentials.password
      );
      
      await service.login();
      
      for (const clientId of clientIds) {
        try {
          // Renovar por N meses (loop)
          const monthResults = [];
          
          for (let i = 0; i < months; i++) {
            const result = await service.renewUser(clientId);
            monthResults.push(result);
            
            if (!result.success) break;
            
            if (i < months - 1) {
              await new Promise(r => setTimeout(r, 2000));
            }
          }
          
          const successCount = monthResults.filter(r => r.success).length;
          
          if (months === 1) {
            results.push({ ...monthResults[0], mode: 'legacy' });
          } else {
            results.push({
              success: successCount === months,
              clientId,
              total: months,
              completed: successCount,
              failed: months - successCount,
              mode: 'legacy'
            });
          }
          
        } catch (error) {
          results.push({
            success: false,
            clientId,
            error: error.message,
            mode: 'legacy'
          });
        }
        
        // Delay entre clientes
        if (clientIds.indexOf(clientId) < clientIds.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    this.log(`Lote concluído: ${successCount}/${clientIds.length} renovados com sucesso`);
    
    return {
      total: clientIds.length,
      success: successCount,
      failed: clientIds.length - successCount,
      results,
      mode
    };
  }

  // ========================================
  // OBTER STATUS DO SISTEMA
  // ========================================
  getStatus() {
    const mode = this.getMode();
    
    const status = {
      currentMode: mode,
      envValue: process.env.CLOUDNATION_RENEWAL_MODE || '(não definido)',
      fallbackEnabled: process.env.CLOUDNATION_FALLBACK_TO_LEGACY === 'true',
      modes: {
        keeper: {
          description: 'Sessão Persistente - Login único, renovações instantâneas',
          advantages: ['Sem custo de captcha por renovação', 'Renovação em ~2-3s', 'Sem falhas por falta de resolvedores'],
          disadvantages: ['Requer monitoramento de sessões']
        },
        legacy: {
          description: 'Login Tradicional - Login completo a cada renovação',
          advantages: ['Simples', 'Sem estado a manter'],
          disadvantages: ['Custo de captcha por renovação', '30-60s por renovação', 'Falha se 2Captcha sem resolvedores']
        }
      }
    };
    
    if (mode === 'keeper') {
      status.sessionManager = sessionManager.getStats();
    }
    
    return status;
  }

  // ========================================
  // INICIALIZAR (chamado no startup do servidor)
  // ========================================
  async initialize() {
    const mode = this.getMode();
    
    this.log(`Inicializando com modo: ${mode.toUpperCase()}`);
    
    if (mode === 'keeper') {
      this.log('Modo KEEPER ativo - Iniciando sessões...');
      
      try {
        // Iniciar todas as sessões existentes
        await sessionManager.initAllSessions();
        
        // Iniciar worker de background
        sessionManager.startBackgroundWorker();
        
        this.log('Sistema KEEPER inicializado com sucesso', 'SUCCESS');
        
      } catch (error) {
        this.log(`Erro ao inicializar KEEPER: ${error.message}`, 'ERROR');
        this.log('O sistema continuará funcionando, sessões serão criadas sob demanda', 'WARNING');
      }
    } else {
      this.log('Modo LEGACY ativo - Sem inicialização adicional necessária');
    }
  }

  // ========================================
  // OBTER MANAGER (para acesso externo às sessões)
  // ========================================
  getManager() {
    return sessionManager;
  }

  // ========================================
  // SHUTDOWN (chamado no encerramento do servidor)
  // ========================================
  async shutdown() {
    const mode = this.getMode();
    
    this.log('Encerrando...');
    
    if (mode === 'keeper') {
      sessionManager.stopBackgroundWorker();
      await sessionManager.closeAllSessions();
    }
    
    this.log('Encerrado com sucesso');
  }
}

// Singleton
const cloudnationFactory = new CloudNationRenewalFactory();

export default cloudnationFactory;
export { CloudNationRenewalFactory };