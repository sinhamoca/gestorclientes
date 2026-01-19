/* ========================================
   KOFFICE SESSION MANAGER
   Gerenciador de múltiplas sessões Koffice
   
   Responsável por:
   - Manter sessões ativas por usuário+domínio
   - Persistir/recuperar cookies do banco
   - Background heartbeat em todas as sessões
   - Inicialização automática ao cadastrar credenciais
   
   LOCALIZAÇÃO: backend/src/services/koffice/KofficeSessionManager.js
   ======================================== */

import KofficeSession from './KofficeSession.js';
import * as db from '../../database.js';

class KofficeSessionManager {
  constructor() {
    // Map de sessões: "userId:domain" -> KofficeSession
    this.sessions = new Map();
    
    // Intervalo do heartbeat (2 minutos)
    this.heartbeatInterval = parseInt(process.env.KOFFICE_SESSION_CHECK_INTERVAL) || 120000;
    
    // Timer do heartbeat
    this.heartbeatTimer = null;
    
    // Status
    this.initialized = false;
    this.isRunning = false;
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [KOFFICE-MANAGER] [${type}] ${message}`);
  }

  // ========================================
  // GERAR CHAVE ÚNICA
  // ========================================
  getSessionKey(userId, domain) {
    // Normalizar domínio
    const normalizedDomain = domain.replace(/\/$/, '').toLowerCase();
    return `${userId}:${normalizedDomain}`;
  }

  // ========================================
  // OBTER SESSÃO (PRINCIPAL)
  // ========================================
  async getSession(domain, userId) {
    const key = this.getSessionKey(userId, domain);
    
    this.log(`Solicitada sessão para ${key}`);
    
    // Se já existe e está ativa, retorna
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key);
      
      // Garantir que está logado
      await session.ensureLoggedIn();
      
      return session;
    }
    
    // Criar nova sessão
    return await this.createSession(domain, userId);
  }

  // ========================================
  // CRIAR SESSÃO
  // ========================================
  async createSession(domain, userId) {
    const key = this.getSessionKey(userId, domain);
    
    this.log(`Criando sessão para ${key}`);
    
    // Buscar credenciais do banco
    const credentials = db.getKofficeCredentialByDomain(userId, domain);
    
    if (!credentials) {
      throw new Error(`Credenciais Koffice não encontradas para user ${userId} no domínio ${domain}`);
    }
    
    // Criar instância da sessão
    const session = new KofficeSession({
      domain: credentials.domain,
      username: credentials.username,
      password: credentials.password,
      anticaptchaKey: process.env.KOFFICE_ANTICAPTCHA_KEY,
      userId
    });
    
    // Callback quando sessão expira
    session.onSessionExpired = (expiredSession) => {
      this.log(`Sessão expirou: ${key}`, 'WARNING');
      this.updateSessionStatus(userId, domain, 'expired');
    };
    
    // Tentar recuperar cookies do banco
    const savedSession = db.getKofficeSession(userId, domain);
    
    if (savedSession && savedSession.cookies_json) {
      this.log(`Recuperando cookies salvos para ${key}`);
      session.importCookies(savedSession.cookies_json);
      
      // Verificar se sessão ainda é válida
      const isValid = await session.checkSession();
      
      if (isValid) {
        this.log(`Sessão recuperada com sucesso para ${key}`, 'SUCCESS');
        this.sessions.set(key, session);
        this.updateSessionStatus(userId, domain, 'active');
        return session;
      } else {
        this.log(`Sessão salva expirou, será necessário novo login`, 'WARNING');
      }
    }
    
    // Fazer login
    try {
      await session.login();
      
      // Salvar no Map
      this.sessions.set(key, session);
      
      // Persistir no banco
      this.saveSessionToDb(userId, domain, session);
      
      this.log(`Sessão criada e logada com sucesso: ${key}`, 'SUCCESS');
      
      return session;
      
    } catch (error) {
      this.log(`Falha ao criar sessão ${key}: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // ========================================
  // INICIAR SESSÃO (ao cadastrar credencial)
  // ========================================
  async initSession(domain, userId) {
    const key = this.getSessionKey(userId, domain);
    
    this.log(`Iniciando sessão para ${key}`);
    
    try {
      const session = await this.createSession(domain, userId);
      return {
        success: true,
        message: 'Sessão iniciada com sucesso',
        sessionInfo: session.getSessionInfo()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ========================================
  // FECHAR SESSÃO (ao deletar credencial)
  // ========================================
  async closeSession(domain, userId) {
    const key = this.getSessionKey(userId, domain);
    
    this.log(`Fechando sessão: ${key}`);
    
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key);
      session.close();
      this.sessions.delete(key);
    }
    
    // Remover do banco
    db.deleteKofficeSession(userId, domain);
    
    this.log(`Sessão ${key} fechada`, 'SUCCESS');
  }

  // ========================================
  // INICIAR TODAS AS SESSÕES
  // ========================================
  async initAllSessions() {
    this.log('Iniciando todas as sessões Koffice...');
    
    try {
      // Buscar todas as credenciais do banco
      const allCredentials = db.getAllKofficeCredentials();
      
      this.log(`Encontradas ${allCredentials.length} credenciais Koffice`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const cred of allCredentials) {
        try {
          await this.createSession(cred.domain, cred.user_id);
          successCount++;
        } catch (error) {
          this.log(`Falha ao iniciar sessão user:${cred.user_id} domain:${cred.domain}: ${error.message}`, 'ERROR');
          failCount++;
        }
        
        // Delay entre logins para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      this.log(`Sessões iniciadas: ${successCount} sucesso, ${failCount} falhas`, 'SUCCESS');
      this.initialized = true;
      
      return { success: successCount, failed: failCount };
      
    } catch (error) {
      this.log(`Erro ao iniciar sessões: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  // ========================================
  // FECHAR TODAS AS SESSÕES
  // ========================================
  async closeAllSessions() {
    this.log('Fechando todas as sessões...');
    
    for (const [key, session] of this.sessions) {
      session.close();
    }
    
    this.sessions.clear();
    this.log('Todas as sessões fechadas', 'SUCCESS');
  }

  // ========================================
  // HEARTBEAT (verificar todas as sessões)
  // ========================================
  async heartbeat() {
    if (this.sessions.size === 0) {
      return;
    }
    
    this.log(`Heartbeat: verificando ${this.sessions.size} sessões...`);
    
    let activeCount = 0;
    let expiredCount = 0;
    let reloggedCount = 0;
    
    for (const [key, session] of this.sessions) {
      try {
        const isActive = await session.checkSession();
        
        if (isActive) {
          activeCount++;
          this.updateSessionStatus(session.userId, session.domain, 'active');
          
          // Atualizar cookies no banco
          this.saveSessionToDb(session.userId, session.domain, session);
        } else {
          expiredCount++;
          
          // Tentar re-login
          try {
            await session.login();
            reloggedCount++;
            this.updateSessionStatus(session.userId, session.domain, 'active');
            this.saveSessionToDb(session.userId, session.domain, session);
            this.log(`Re-login bem-sucedido: ${key}`, 'SUCCESS');
          } catch (loginError) {
            this.log(`Falha no re-login ${key}: ${loginError.message}`, 'ERROR');
            this.updateSessionStatus(session.userId, session.domain, 'error');
          }
        }
        
      } catch (error) {
        this.log(`Erro no heartbeat ${key}: ${error.message}`, 'ERROR');
      }
      
      // Pequeno delay entre verificações
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    this.log(`Heartbeat concluído: ${activeCount} ativas, ${expiredCount} expiradas, ${reloggedCount} re-logadas`);
  }

  // ========================================
  // INICIAR WORKER DE BACKGROUND
  // ========================================
  startBackgroundWorker() {
    if (this.isRunning) {
      this.log('Worker já está rodando', 'WARNING');
      return;
    }
    
    this.log(`Iniciando worker de background (intervalo: ${this.heartbeatInterval / 1000}s)`);
    
    this.isRunning = true;
    
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.heartbeat();
      } catch (error) {
        this.log(`Erro no worker: ${error.message}`, 'ERROR');
      }
    }, this.heartbeatInterval);
    
    this.log('Worker de background iniciado', 'SUCCESS');
  }

  // ========================================
  // PARAR WORKER DE BACKGROUND
  // ========================================
  stopBackgroundWorker() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.isRunning = false;
    this.log('Worker de background parado');
  }

  // ========================================
  // ESTATÍSTICAS
  // ========================================
  getStats() {
    const sessions = [];
    
    for (const [key, session] of this.sessions) {
      sessions.push(session.getSessionInfo());
    }
    
    return {
      total: this.sessions.size,
      isRunning: this.isRunning,
      initialized: this.initialized,
      heartbeatInterval: this.heartbeatInterval,
      sessions
    };
  }

  // ========================================
  // OBTER STATUS DE UMA SESSÃO
  // ========================================
  getSessionStatus(domain, userId) {
    const key = this.getSessionKey(userId, domain);
    
    if (!this.sessions.has(key)) {
      // Verificar se existe no banco
      const savedSession = db.getKofficeSession(userId, domain);
      
      if (savedSession) {
        return {
          exists: true,
          active: false,
          inMemory: false,
          status: savedSession.status,
          lastHeartbeat: savedSession.last_heartbeat
        };
      }
      
      return {
        exists: false,
        active: false,
        inMemory: false
      };
    }
    
    const session = this.sessions.get(key);
    const info = session.getSessionInfo();
    
    return {
      exists: true,
      active: session.loggedIn,
      inMemory: true,
      ...info
    };
  }

  // ========================================
  // PERSISTÊNCIA NO BANCO
  // ========================================
  saveSessionToDb(userId, domain, session) {
    try {
      const cookiesJson = session.exportCookies();
      db.saveKofficeSession(userId, domain, cookiesJson, 'active', session.loginCount);
    } catch (error) {
      this.log(`Erro ao salvar sessão no banco: ${error.message}`, 'ERROR');
    }
  }

  updateSessionStatus(userId, domain, status) {
    try {
      db.updateKofficeSessionStatus(userId, domain, status);
    } catch (error) {
      this.log(`Erro ao atualizar status: ${error.message}`, 'ERROR');
    }
  }
}

// Singleton
const sessionManager = new KofficeSessionManager();

export default sessionManager;
export { KofficeSessionManager };
