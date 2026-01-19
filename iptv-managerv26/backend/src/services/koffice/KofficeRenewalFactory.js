/* ========================================
   KOFFICE RENEWAL FACTORY
   Factory para renovação Koffice com suporte a dois modos:
   
   1. KEEPER: Usa sessão persistente (novo sistema)
   2. LEGACY: Login completo a cada renovação (sistema atual)
   
   Configuração via ENV:
   KOFFICE_RENEWAL_MODE=keeper|legacy (default: legacy)
   
   LOCALIZAÇÃO: backend/src/services/koffice/KofficeRenewalFactory.js
   ======================================== */

import sessionManager from './KofficeSessionManager.js';
import KofficeRenewalService from '../koffice-renewal.js';
import * as db from '../../database.js';

class KofficeRenewalFactory {
  constructor() {
    this.defaultMode = 'legacy';
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KOFFICE-FACTORY] [${type}] ${message}`);
  }

  // ========================================
  // OBTER MODO DE RENOVAÇÃO
  // ========================================
  getMode() {
    const mode = process.env.KOFFICE_RENEWAL_MODE || this.defaultMode;
    
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
  async renewClient({ userId, domain, credentials, clientId, months }) {
    const mode = this.getMode();
    
    this.log(`═══════════════════════════════════════════════════`);
    this.log(`Renovação Koffice - Modo: ${mode.toUpperCase()}`);
    this.log(`User: ${userId} | Domain: ${domain} | Client: ${clientId} | Meses: ${months}`);
    this.log(`═══════════════════════════════════════════════════`);
    
    const startTime = Date.now();
    let result;
    
    try {
      if (mode === 'keeper') {
        result = await this.renewWithSessionKeeper(userId, domain, clientId, months);
      } else {
        result = await this.renewWithLegacy(domain, credentials, clientId, months);
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
  async renewWithSessionKeeper(userId, domain, clientId, months) {
    this.log('[KEEPER] Usando sessão persistente...');
    
    try {
      // Obter sessão ativa (já logada)
      const session = await sessionManager.getSession(domain, userId);
      
      this.log(`[KEEPER] Sessão obtida - Login #${session.loginCount}`);
      
      // Renovar usando sessão existente
      const result = await session.renewClient(clientId, months);
      
      return {
        ...result,
        mode: 'keeper',
        sessionInfo: session.getSessionInfo()
      };
      
    } catch (error) {
      this.log(`[KEEPER] Erro: ${error.message}`, 'ERROR');
      
      // Fallback para legacy se keeper falhar?
      const fallbackOnError = process.env.KOFFICE_FALLBACK_TO_LEGACY === 'true';
      
      if (fallbackOnError) {
        this.log('[KEEPER] Fallback para modo LEGACY...', 'WARNING');
        
        const credentials = db.getKofficeCredentialByDomain(userId, domain);
        if (credentials) {
          return await this.renewWithLegacy(domain, credentials, clientId, months);
        }
      }
      
      throw error;
    }
  }

  // ========================================
  // MODO LEGACY: Login a cada renovação
  // ========================================
  async renewWithLegacy(domain, credentials, clientId, months) {
    this.log('[LEGACY] Usando login completo a cada renovação...');
    
    // Instanciar serviço antigo
    const service = new KofficeRenewalService(
      domain,
      credentials.username,
      credentials.password
    );
    
    // Fazer login (com captcha se necessário)
    this.log('[LEGACY] Fazendo login...');
    await service.login();
    
    // Renovar cliente
    this.log('[LEGACY] Renovando cliente...');
    const result = await service.renovarCliente(clientId, months);
    
    return {
      ...result,
      mode: 'legacy'
    };
  }

  // ========================================
  // RENOVAR MÚLTIPLOS CLIENTES
  // ========================================
  async renewMultipleClients({ userId, domain, credentials, clientIds, months }) {
    const mode = this.getMode();
    
    this.log(`Renovação em lote - ${clientIds.length} clientes - Modo: ${mode.toUpperCase()}`);
    
    const results = [];
    
    if (mode === 'keeper') {
      // No modo keeper, obtemos a sessão uma vez
      const session = await sessionManager.getSession(domain, userId);
      
      for (const clientId of clientIds) {
        try {
          const result = await session.renewClient(clientId, months);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            clientId,
            error: error.message,
            mode: 'keeper'
          });
        }
      }
    } else {
      // No modo legacy, fazemos login uma vez e renovamos todos
      const service = new KofficeRenewalService(
        domain,
        credentials.username,
        credentials.password
      );
      
      await service.login();
      
      for (const clientId of clientIds) {
        try {
          const result = await service.renovarCliente(clientId, months);
          results.push({ ...result, mode: 'legacy' });
        } catch (error) {
          results.push({
            success: false,
            clientId,
            error: error.message,
            mode: 'legacy'
          });
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
      envValue: process.env.KOFFICE_RENEWAL_MODE || '(não definido)',
      fallbackEnabled: process.env.KOFFICE_FALLBACK_TO_LEGACY === 'true',
      modes: {
        keeper: {
          description: 'Sessão Persistente - Login único, renovações instantâneas',
          advantages: ['Sem custo de captcha por renovação', 'Renovação em ~2s', 'Sem falhas por falta de resolvedores'],
          disadvantages: ['Requer monitoramento de sessões']
        },
        legacy: {
          description: 'Login Tradicional - Login completo a cada renovação',
          advantages: ['Simples', 'Sem estado a manter'],
          disadvantages: ['Custo de captcha por renovação', '30-60s por renovação', 'Falha se Anti-Captcha sem resolvedores']
        }
      }
    };
    
    if (mode === 'keeper') {
      status.sessionManager = sessionManager.getStats();
    }
    
    return status;
  }

  // ========================================
  // OBTER MANAGER (para acesso externo às sessões)
  // ========================================
  getManager() {
    return sessionManager;  // ou como você chama o manager no Koffice
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
const kofficeFactory = new KofficeRenewalFactory();

export default kofficeFactory;
export { KofficeRenewalFactory };
