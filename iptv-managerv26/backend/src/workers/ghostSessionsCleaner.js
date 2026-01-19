/* ========================================
   GHOST SESSIONS CLEANER
   Worker que limpa sessões de usuários que 
   não existem mais no sistema principal
   
   - Roda 1x por semana (configurável)
   - Verifica se user_id existe no PostgreSQL
   - Remove credenciais e sessões órfãs do SQLite
   
   LOCALIZAÇÃO: backend/src/workers/ghostSessionsCleaner.js
   ======================================== */

import * as db from '../database.js';
import * as postgres from '../postgres.js';
import kofficeFactory from '../services/koffice/KofficeRenewalFactory.js';
import cloudnationFactory from '../services/cloudnation/CloudNationRenewalFactory.js';

class GhostSessionsCleaner {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    
    // Configuração: 1 semana em ms (pode alterar via ENV)
    this.cleanupInterval = parseInt(process.env.GHOST_CLEANUP_INTERVAL) || 7 * 24 * 60 * 60 * 1000;
    
    // Estatísticas
    this.stats = {
      lastRun: null,
      totalCleaned: 0,
      runsCount: 0
    };
  }

  // ========================================
  // LOGGING
  // ========================================
  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [GHOST-CLEANER] [${type}] ${message}`);
  }

  // ========================================
  // VERIFICAR SE USUÁRIO EXISTE NO POSTGRESQL
  // ========================================
  async userExistsInPostgres(userId) {
    try {
      const user = await postgres.getUserById(userId);
      return !!user;
    } catch (error) {
      // Em caso de erro de conexão, assumir que existe (não deletar)
      this.log(`Erro ao verificar user ${userId}: ${error.message}`, 'WARNING');
      return true;
    }
  }

  // ========================================
  // LIMPAR SESSÕES FANTASMAS
  // ========================================
  async cleanup() {
    if (this.isRunning) {
      this.log('Limpeza já está em andamento, pulando...', 'WARNING');
      return;
    }

    this.isRunning = true;
    this.stats.runsCount++;
    this.stats.lastRun = new Date().toISOString();

    this.log('═══════════════════════════════════════════════════');
    this.log('Iniciando limpeza de sessões fantasmas...');
    this.log('═══════════════════════════════════════════════════');

    let totalRemoved = 0;

    try {
      // ========== LIMPAR KOFFICE ==========
      const kofficeRemoved = await this.cleanKofficeSessions();
      totalRemoved += kofficeRemoved;

      // ========== LIMPAR CLOUDNATION ==========
      const cloudnationRemoved = await this.cleanCloudNationSessions();
      totalRemoved += cloudnationRemoved;

      // ========== RESUMO ==========
      this.stats.totalCleaned += totalRemoved;

      this.log('═══════════════════════════════════════════════════');
      this.log(`Limpeza concluída: ${totalRemoved} sessão(ões) removida(s)`, totalRemoved > 0 ? 'SUCCESS' : 'INFO');
      this.log(`Total histórico: ${this.stats.totalCleaned} sessões removidas em ${this.stats.runsCount} execuções`);
      this.log('═══════════════════════════════════════════════════');

    } catch (error) {
      this.log(`Erro durante limpeza: ${error.message}`, 'ERROR');
    } finally {
      this.isRunning = false;
    }

    return totalRemoved;
  }

  // ========================================
  // LIMPAR SESSÕES KOFFICE
  // ========================================
  async cleanKofficeSessions() {
    this.log('[KOFFICE] Verificando credenciais...');

    let removed = 0;

    try {
      const credentials = db.getAllKofficeCredentials();

      if (!credentials || credentials.length === 0) {
        this.log('[KOFFICE] Nenhuma credencial encontrada');
        return 0;
      }

      this.log(`[KOFFICE] Verificando ${credentials.length} credencial(is)...`);

      for (const cred of credentials) {
        const exists = await this.userExistsInPostgres(cred.user_id);

        if (!exists) {
          this.log(`[KOFFICE] 👻 User ${cred.user_id} não existe mais, removendo...`, 'WARNING');

          // Remover sessão do BANCO
          db.deleteKofficeSession(cred.user_id, cred.domain);
          
          // Remover credencial do BANCO
          db.deleteKofficeCredential(cred.user_id, cred.id);
          
          // Remover da MEMÓRIA (Manager)
          try {
            const manager = kofficeFactory.getManager();
            if (manager) {
              const key = `${cred.user_id}:${cred.domain}`;
              if (manager.sessions && manager.sessions.has(key)) {
                manager.sessions.delete(key);
                this.log(`[KOFFICE] 🧠 Removido da memória: ${key}`);
              }
            }
          } catch (e) {
            // Ignora se não conseguir acessar o manager
          }

          this.log(`[KOFFICE] ✅ Removido: user_id=${cred.user_id}, domain=${cred.domain}`);
          removed++;
        }
      }

      this.log(`[KOFFICE] Concluído: ${removed} removida(s)`);

    } catch (error) {
      this.log(`[KOFFICE] Erro: ${error.message}`, 'ERROR');
    }

    return removed;
  }

  // ========================================
  // LIMPAR SESSÕES CLOUDNATION
  // ========================================
  async cleanCloudNationSessions() {
    this.log('[CLOUDNATION] Verificando credenciais...');

    let removed = 0;

    try {
      const credentials = db.getAllCloudNationCredentials();

      if (!credentials || credentials.length === 0) {
        this.log('[CLOUDNATION] Nenhuma credencial encontrada');
        return 0;
      }

      this.log(`[CLOUDNATION] Verificando ${credentials.length} credencial(is)...`);

      for (const cred of credentials) {
        const exists = await this.userExistsInPostgres(cred.user_id);

        if (!exists) {
          this.log(`[CLOUDNATION] 👻 User ${cred.user_id} não existe mais, removendo...`, 'WARNING');

          // Remover sessão do BANCO
          db.deleteCloudNationSession(cred.user_id, 'https://painel.cloudnation.top');
          
          // Remover credencial do BANCO
          db.deleteCloudNationCredential(cred.user_id);
          
          // Remover da MEMÓRIA (Manager)
          try {
            const manager = cloudnationFactory.getManager();
            if (manager) {
              const key = `${cred.user_id}:painel.cloudnation.top`;
              if (manager.sessions && manager.sessions.has(key)) {
                manager.sessions.delete(key);
                this.log(`[CLOUDNATION] 🧠 Removido da memória: ${key}`);
              }
            }
          } catch (e) {
            // Ignora se não conseguir acessar o manager
          }

          this.log(`[CLOUDNATION] ✅ Removido: user_id=${cred.user_id}`);
          removed++;
        }
      }

      this.log(`[CLOUDNATION] Concluído: ${removed} removida(s)`);

    } catch (error) {
      this.log(`[CLOUDNATION] Erro: ${error.message}`, 'ERROR');
    }

    return removed;
  }

  // ========================================
  // INICIAR WORKER
  // ========================================
  start() {
    const intervalHours = Math.round(this.cleanupInterval / 1000 / 60 / 60);
    const intervalDays = (intervalHours / 24).toFixed(1);

    this.log(`Iniciando worker (intervalo: ${intervalDays} dias / ${intervalHours}h)`);

    // Executar primeira limpeza após 1 minuto do início
    setTimeout(() => {
      this.cleanup();
    }, 60000);

    // Agendar limpezas periódicas
    this.intervalId = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);

    this.log('Worker iniciado com sucesso', 'SUCCESS');
  }

  // ========================================
  // PARAR WORKER
  // ========================================
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.log('Worker parado');
    }
  }

  // ========================================
  // EXECUTAR MANUALMENTE (para testes)
  // ========================================
  async runNow() {
    this.log('Executando limpeza manual...');
    return await this.cleanup();
  }

  // ========================================
  // OBTER STATUS
  // ========================================
  getStatus() {
    const nextRun = this.stats.lastRun 
      ? new Date(new Date(this.stats.lastRun).getTime() + this.cleanupInterval).toISOString()
      : 'Aguardando primeira execução';

    return {
      running: !!this.intervalId,
      intervalMs: this.cleanupInterval,
      intervalDays: (this.cleanupInterval / 1000 / 60 / 60 / 24).toFixed(1),
      lastRun: this.stats.lastRun,
      nextRun: nextRun,
      totalCleaned: this.stats.totalCleaned,
      runsCount: this.stats.runsCount
    };
  }
}

// Singleton
const ghostCleaner = new GhostSessionsCleaner();

export default ghostCleaner;
export { GhostSessionsCleaner };