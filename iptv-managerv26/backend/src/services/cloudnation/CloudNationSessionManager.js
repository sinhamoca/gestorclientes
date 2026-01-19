/* ========================================
   CLOUDNATION SESSION MANAGER
   Gerenciador multi-tenant de sessões CloudNation
   
   Features:
   - Uma sessão por combinação userId + domain
   - Heartbeat automático em background
   - Persistência em SQLite
   - Re-login automático quando sessão expira
   
   LOCALIZAÇÃO: backend/src/services/cloudnation/CloudNationSessionManager.js
   ======================================== */

import CloudNationSession from './CloudNationSession.js';
import * as db from '../../database.js';

class CloudNationSessionManager {
  constructor() {
    // Map de sessões ativas: key = "userId:domain"
    this.sessions = new Map();
    
    // Configurações
    this.heartbeatInterval = parseInt(process.env.CLOUDNATION_HEARTBEAT_INTERVAL) || 120000; // 2 min
    this.heartbeatWorker = null;
    
    // Estatísticas
    this.stats = {
      startTime: null,
      totalHeartbeats: 0,
      totalRelogins: 0,
      totalRenewals: 0,
      errors: 0
    };
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CN-MANAGER] [${type}] ${message}`);
  }

  // ========================================
  // GERAR CHAVE DA SESSÃO
  // ========================================
  getSessionKey(userId, domain) {
    // Normalizar domain
    const normalizedDomain = domain.replace(/\/$/, '').replace('https://', '').replace('http://', '');
    return `${userId}:${normalizedDomain}`;
  }

  // ========================================
  // OBTER OU CRIAR SESSÃO
  // ========================================
  async getSession(domain, userId) {
    const key = this.getSessionKey(userId, domain);
    
    // Verificar se já existe na memória
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key);
      
      // Garantir que está logada
      await session.ensureLoggedIn();
      
      return session;
    }
    
    // Buscar credenciais do banco (função existente no sistema)
    const credentials = db.getCredentials(userId);
    
    if (!credentials) {
      throw new Error(`Credenciais CloudNation não encontradas para userId ${userId}`);
    }
    
    // Decodificar senha (está em base64 no banco)
    const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');
    
    // Criar nova sessão
    this.log(`Criando sessão: ${key}`);
    
    const session = new CloudNationSession({
      userId,
      domain,
      username: credentials.username,
      password: decodedPassword
    });
    
    // Tentar carregar sessão existente do banco
    const loaded = session.loadFromDatabase();
    
    if (loaded && session.loggedIn) {
      this.log(`Sessão restaurada do banco: ${key}`);
      
      // Verificar se ainda está válida
      const isValid = await session.checkSession();
      
      if (!isValid) {
        this.log(`Sessão restaurada expirou, re-logando: ${key}`);
        await session.login();
        this.stats.totalRelogins++;
      }
    } else {
      // Fazer login inicial
      this.log(`Fazendo login inicial: ${key}`);
      await session.login();
    }
    
    // Armazenar na memória
    this.sessions.set(key, session);
    
    return session;
  }

  // ========================================
  // INICIALIZAR TODAS AS SESSÕES
  // ========================================
  async initAllSessions() {
    this.log('Inicializando todas as sessões CloudNation...');
    
    try {
      // Buscar TODAS as credenciais CloudNation (igual ao Koffice!)
      const allCredentials = db.getAllCloudNationCredentials();
      
      if (!allCredentials || allCredentials.length === 0) {
        this.log('Nenhuma credencial CloudNation encontrada');
        return;
      }
      
      this.log(`Encontradas ${allCredentials.length} credencial(is) CloudNation`);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const credentials of allCredentials) {
        const domain = 'https://painel.cloudnation.top';
        const key = this.getSessionKey(credentials.user_id, domain);
        
        this.log(`Criando sessão para ${key}`);
        
        try {
          // Decodificar senha
          const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');
          
          const session = new CloudNationSession({
            userId: credentials.user_id,
            domain: domain,
            username: credentials.username,
            password: decodedPassword
          });
          
          // Tentar recuperar sessão existente do banco
          const savedSession = db.getCloudNationSession(credentials.user_id, domain);
          
          if (savedSession) {
            this.log(`Recuperando cookies salvos para ${key}`);
            session.loadFromDatabase();
            
            // Verificar se sessão ainda é válida
            const isValid = await session.checkSession();
            
            if (isValid) {
              this.log(`Sessão recuperada com sucesso para ${key}`, 'SUCCESS');
              this.sessions.set(key, session);
              successCount++;
              
              // Delay entre verificações
              await new Promise(r => setTimeout(r, 2000));
              continue;
            } else {
              this.log(`Sessão expirada para ${key}, fazendo novo login...`, 'WARNING');
            }
          } else {
            this.log(`Nenhuma sessão prévia para ${key}, fazendo login...`);
          }
          
          // Fazer login (sessão não existe ou expirou)
          await session.login();
          this.sessions.set(key, session);
          successCount++;
          
          this.log(`Sessão criada com sucesso para ${key}`, 'SUCCESS');
          
          // Delay entre logins para não sobrecarregar 2Captcha
          await new Promise(r => setTimeout(r, 2000));
          
        } catch (error) {
          this.log(`Erro ao criar sessão para ${key}: ${error.message}`, 'ERROR');
          failCount++;
          this.stats.errors++;
        }
      }
      
      this.log(`Sessões iniciadas: ${successCount} sucesso, ${failCount} falhas`, 'SUCCESS');
      
    } catch (error) {
      this.log(`Erro ao inicializar sessões: ${error.message}`, 'ERROR');
    }
  }

  // ========================================
  // BACKGROUND WORKER (HEARTBEAT)
  // ========================================
  startBackgroundWorker() {
    if (this.heartbeatWorker) {
      this.log('Worker já está rodando', 'WARNING');
      return;
    }
    
    this.stats.startTime = new Date().toISOString();
    
    this.log(`Iniciando background worker (intervalo: ${this.heartbeatInterval / 1000}s)`);
    
    this.heartbeatWorker = setInterval(async () => {
      await this.runHeartbeat();
    }, this.heartbeatInterval);
    
    // Primeiro heartbeat após 30 segundos
    setTimeout(() => this.runHeartbeat(), 30000);
  }

  stopBackgroundWorker() {
    if (this.heartbeatWorker) {
      clearInterval(this.heartbeatWorker);
      this.heartbeatWorker = null;
      this.log('Background worker parado');
    }
  }

  async runHeartbeat() {
    this.stats.totalHeartbeats++;
    
    const sessionsToCheck = Array.from(this.sessions.entries());
    
    if (sessionsToCheck.length === 0) {
      return;
    }
    
    this.log(`=== HEARTBEAT #${this.stats.totalHeartbeats} - ${sessionsToCheck.length} sessão(ões) ===`);
    
    for (const [key, session] of sessionsToCheck) {
      try {
        const isActive = await session.checkSession();
        
        if (!isActive) {
          this.log(`Sessão ${key} expirou, re-logando...`, 'WARNING');
          await session.login();
          this.stats.totalRelogins++;
          this.log(`Sessão ${key} re-logada com sucesso`, 'SUCCESS');
        }
        
      } catch (error) {
        this.log(`Erro no heartbeat da sessão ${key}: ${error.message}`, 'ERROR');
        this.stats.errors++;
      }
    }
  }

  // ========================================
  // ESTATÍSTICAS
  // ========================================
  getStats() {
    return {
      ...this.stats,
      activeSessions: this.sessions.size,
      sessionsList: Array.from(this.sessions.entries()).map(([key, session]) => ({
        key,
        info: session.getSessionInfo()
      })),
      uptime: this.stats.startTime 
        ? Math.floor((Date.now() - new Date(this.stats.startTime).getTime()) / 1000 / 60)
        : 0
    };
  }

  // ========================================
  // REMOVER SESSÃO
  // ========================================
  removeSession(userId, domain) {
    const key = this.getSessionKey(userId, domain);
    
    if (this.sessions.has(key)) {
      const session = this.sessions.get(key);
      session.close();
      this.sessions.delete(key);
      this.log(`Sessão removida: ${key}`);
      return true;
    }
    
    return false;
  }

  // ========================================
  // FECHAR TODAS AS SESSÕES
  // ========================================
  async closeAllSessions() {
    this.log(`Fechando ${this.sessions.size} sessão(ões)...`);
    
    for (const [key, session] of this.sessions.entries()) {
      try {
        session.saveToDatabase();
        this.log(`Sessão ${key} salva`);
      } catch (error) {
        this.log(`Erro ao salvar sessão ${key}: ${error.message}`, 'ERROR');
      }
    }
    
    this.sessions.clear();
    this.log('Todas as sessões fechadas');
  }
}

// Singleton
const sessionManager = new CloudNationSessionManager();

export default sessionManager;
export { CloudNationSessionManager };