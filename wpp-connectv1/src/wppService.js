/* ==========================================
   WPPCONNECT SERVICE - Lógica Principal
   ========================================== */

import wppconnect from '@wppconnect-team/wppconnect';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class WPPService {
  constructor() {
    this.sessions = new Map();
    // 🔥 CORRETO: /app/sessions (mapeado para volume Docker)
    this.sessionsPath = path.join(__dirname, '..', 'sessions');
    this.qrCodeCallbacks = new Map();
    this.statusCallbacks = new Map();
    this.chromePids = new Map(); // Rastrear PIDs do Chrome
    
    // 🆕 SISTEMA DE RECONEXÃO INTELIGENTE
    this.reconnectAttempts = new Map();      // Controle de tentativas por sessão
    this.reconnectTimers = new Map();        // Timers de reconexão
    this.sessionStates = new Map();          // Último estado conhecido
    this.heartbeatInterval = null;           // Intervalo do heartbeat
    this.isReconnecting = new Map();         // Flag para evitar reconexões simultâneas
    
    // 🆕 CONFIGURAÇÕES DE CHAMADAS E PRESENCE
    this.sessionConfigs = new Map();         // Configurações por sessão (rejectCalls, alwaysOnline)
    this.presenceIntervals = new Map();      // Intervalos de presence (para always online)
    this.callListenersRegistered = new Map(); // Controle de listeners já registrados
    
    // Configurações de reconexão
    this.HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutos
    this.MAX_RECONNECT_ATTEMPTS = 5;         // Máximo de tentativas
    this.RECONNECT_BASE_DELAY = 10 * 1000;   // 10 segundos (delay base)
    this.RECONNECT_MAX_DELAY = 5 * 60 * 1000; // 5 minutos (delay máximo)
    
    // Criar pasta de sessões
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
      logger.info('📁 Pasta de sessões criada');
    }

    // Cleanup inicial de processos Chrome órfãos
    this._cleanupOrphanedChrome();

    // 🆕 CARREGAR SESSÕES EXISTENTES NO STARTUP
    this._loadExistingSessions();
    
    // 🆕 INICIAR HEARTBEAT APÓS CARREGAR SESSÕES
    this._startHeartbeat();

    logger.info('✅ WPPService inicializado');
    logger.info(`   💓 Heartbeat configurado: ${this.HEARTBEAT_INTERVAL / 1000}s`);
    logger.info(`   🔄 Max reconexões: ${this.MAX_RECONNECT_ATTEMPTS}`);
  }

  // ==========================================
  // 🆕 CONFIGURAÇÕES DE CHAMADAS E PRESENCE
  // ==========================================

  /**
   * Salvar configurações de uma sessão
   */
  setSessionConfig(sessionId, config) {
    const currentConfig = this.sessionConfigs.get(sessionId) || {};
    this.sessionConfigs.set(sessionId, { ...currentConfig, ...config });
    logger.info(`⚙️ Configurações salvas para ${sessionId}:`, JSON.stringify(config));
  }

  /**
   * Obter configurações de uma sessão
   */
  getSessionConfig(sessionId) {
    return this.sessionConfigs.get(sessionId) || {
      rejectCalls: false,
      rejectCallMessage: 'Desculpe, não recebo chamadas por aqui. Me envie uma mensagem! 📱',
      alwaysOnline: false
    };
  }

  /**
   * Aplicar configuração de "always online"
   */
  async _applyAlwaysOnline(sessionId, client, enabled) {
    try {
      // Limpar intervalo anterior se existir
      if (this.presenceIntervals.has(sessionId)) {
        clearInterval(this.presenceIntervals.get(sessionId));
        this.presenceIntervals.delete(sessionId);
        logger.info(`   🔄 ${sessionId}: Intervalo de presence anterior limpo`);
      }

      if (enabled) {
        // Tentar diferentes métodos do WPPConnect para definir online
        let success = false;
        
        // Método 1: setOnlinePresence (mais comum no WPPConnect)
        if (typeof client.setOnlinePresence === 'function') {
          await client.setOnlinePresence(true);
          success = true;
          logger.info(`   🟢 ${sessionId}: Definido como ONLINE (setOnlinePresence)`);
        }
        // Método 2: markOnline 
        else if (typeof client.markOnline === 'function') {
          await client.markOnline();
          success = true;
          logger.info(`   🟢 ${sessionId}: Definido como ONLINE (markOnline)`);
        }
        // Método 3: sendPresenceAvailable
        else if (typeof client.sendPresenceAvailable === 'function') {
          await client.sendPresenceAvailable();
          success = true;
          logger.info(`   🟢 ${sessionId}: Definido como ONLINE (sendPresenceAvailable)`);
        }
        // Método 4: setPresence com boolean
        else if (typeof client.setPresence === 'function') {
          await client.setPresence(true);
          success = true;
          logger.info(`   🟢 ${sessionId}: Definido como ONLINE (setPresence)`);
        }

        if (!success) {
          logger.warn(`   ⚠️ ${sessionId}: Nenhum método de presence disponível`);
          return;
        }

        // Manter online a cada 4 minutos
        const interval = setInterval(async () => {
          try {
            if (this.sessions.has(sessionId)) {
              const session = this.sessions.get(sessionId);
              const isConnected = await this._isSessionConnected(session);
              if (isConnected) {
                // Usar o mesmo método que funcionou
                if (typeof session.setOnlinePresence === 'function') {
                  await session.setOnlinePresence(true);
                } else if (typeof session.markOnline === 'function') {
                  await session.markOnline();
                } else if (typeof session.sendPresenceAvailable === 'function') {
                  await session.sendPresenceAvailable();
                } else if (typeof session.setPresence === 'function') {
                  await session.setPresence(true);
                }
                logger.debug(`   🔄 ${sessionId}: Presence renovado (online)`);
              }
            } else {
              // Sessão não existe mais, limpar intervalo
              clearInterval(interval);
              this.presenceIntervals.delete(sessionId);
            }
          } catch (e) {
            logger.warn(`   ⚠️ ${sessionId}: Erro ao renovar presence:`, e.message);
          }
        }, 4 * 60 * 1000); // 4 minutos

        this.presenceIntervals.set(sessionId, interval);
        logger.info(`   ⏰ ${sessionId}: Intervalo de always online configurado (4 min)`);
      } else {
        // Desativar - definir como offline/unavailable
        try {
          if (typeof client.setOnlinePresence === 'function') {
            await client.setOnlinePresence(false);
          } else if (typeof client.markOffline === 'function') {
            await client.markOffline();
          } else if (typeof client.sendPresenceUnavailable === 'function') {
            await client.sendPresenceUnavailable();
          } else if (typeof client.setPresence === 'function') {
            await client.setPresence(false);
          }
        } catch (e) {
          // Ignorar erro ao desativar
        }
        logger.info(`   ⚪ ${sessionId}: Always online desativado`);
      }
    } catch (error) {
      logger.warn(`   ⚠️ Erro ao aplicar always online para ${sessionId}:`, error.message);
    }
  }

  /**
   * Configurar listener de chamadas recebidas
   * IMPORTANTE: Só registra o listener UMA VEZ por sessão
   */
  async _setupCallRejection(sessionId, client, config) {
    try {
      // Verificar se já registrou o listener para esta sessão
      if (this.callListenersRegistered.has(sessionId)) {
        logger.info(`   📞 ${sessionId}: Listener já registrado, apenas atualizando config`);
        // O listener já existe e verifica a config dinamicamente
        return;
      }

      // Registrar listener APENAS UMA VEZ
      // O listener verifica a config atual a cada chamada
      client.onIncomingCall(async (call) => {
        // Verificar config ATUAL (pode ter mudado desde o registro)
        const currentConfig = this.getSessionConfig(sessionId);
        
        if (!currentConfig.rejectCalls) {
          logger.info(`   📞 ${sessionId}: Chamada recebida, mas rejeição desativada`);
          return;
        }

        logger.info(`📞 ${sessionId}: Chamada recebida de ${call.peerJid}`);
        
        try {
          // Rejeitar a chamada
          await client.rejectCall(call.id);
          logger.info(`   ❌ Chamada rejeitada automaticamente`);

          // Enviar mensagem se configurada (apenas para números normais, não LID)
          if (currentConfig.rejectCallMessage && currentConfig.rejectCallMessage.trim()) {
            // Verificar se é um número normal (não LID)
            if (call.peerJid && call.peerJid.includes('@c.us')) {
              const number = call.peerJid.replace('@c.us', '');
              await client.sendText(`${number}@c.us`, currentConfig.rejectCallMessage);
              logger.info(`   💬 Mensagem de rejeição enviada para ${number}`);
            } else {
              logger.info(`   ℹ️ Número ${call.peerJid} não é formato padrão, mensagem não enviada`);
            }
          }
        } catch (error) {
          logger.warn(`   ⚠️ Erro ao rejeitar chamada:`, error.message);
        }
      });

      // Marcar que o listener foi registrado
      this.callListenersRegistered.set(sessionId, true);
      logger.info(`   📞 ${sessionId}: Listener de chamadas registrado (rejeição: ${config.rejectCalls ? 'ATIVA' : 'INATIVA'})`);
      
    } catch (error) {
      logger.warn(`   ⚠️ Erro ao configurar rejeição de chamadas para ${sessionId}:`, error.message);
    }
  }

  /**
   * Aplicar todas as configurações em uma sessão
   */
  async applySessionConfig(sessionId) {
    const client = this.sessions.get(sessionId);
    if (!client) {
      logger.warn(`   ⚠️ ${sessionId}: Sessão não encontrada para aplicar configs`);
      return false;
    }

    const config = this.getSessionConfig(sessionId);
    logger.info(`⚙️ Aplicando configurações para ${sessionId}...`);

    // Aplicar always online
    await this._applyAlwaysOnline(sessionId, client, config.alwaysOnline);
    
    // Configurar rejeição de chamadas
    await this._setupCallRejection(sessionId, client, config);

    return true;
  }

  /**
   * 🆕 Carregar sessões existentes no startup
   * Reconecta automaticamente sessões que têm tokens salvos
   */
  async _loadExistingSessions() {
    try {
      logger.info('🔄 Verificando sessões existentes...');
      
      // Ler pastas na sessionsPath
      const sessionFolders = fs.readdirSync(this.sessionsPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      if (sessionFolders.length === 0) {
        logger.info('   ℹ️  Nenhuma sessão anterior encontrada');
        return;
      }

      logger.info(`   📂 Encontradas ${sessionFolders.length} sessão(ões) para restaurar`);

      // 🔥 IMPORTANTE: Limpar locks ANTES de tentar restaurar
      for (const sessionId of sessionFolders) {
        await this._removeLockFiles(sessionId);
      }

      // Reconectar cada sessão em paralelo (mas com limite)
      for (const sessionId of sessionFolders) {
        // Não bloquear o startup - fazer em background
        this._restoreSession(sessionId).catch(error => {
          logger.warn(`   ⚠️  Erro ao restaurar ${sessionId}:`, error.message);
        });
        
        // Pequeno delay entre cada tentativa para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (error) {
      logger.error('❌ Erro ao carregar sessões existentes:', error);
    }
  }

  // ==========================================
  // 🆕 SISTEMA DE MONITORAMENTO ATIVO
  // ==========================================

  /**
   * Inicia o heartbeat que verifica sessões periodicamente
   */
  _startHeartbeat() {
    // Limpar intervalo anterior se existir
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    logger.info('💓 Iniciando sistema de heartbeat...');

    this.heartbeatInterval = setInterval(async () => {
      await this._checkAllSessions();
    }, this.HEARTBEAT_INTERVAL);

    // Primeira verificação após 1 minuto (dar tempo das sessões carregarem)
    setTimeout(async () => {
      await this._checkAllSessions();
    }, 60 * 1000);
  }

  /**
   * Verifica o status de todas as sessões ativas
   */
  async _checkAllSessions() {
    const sessionCount = this.sessions.size;
    
    if (sessionCount === 0) {
      logger.info('💓 Heartbeat: Nenhuma sessão ativa');
      return;
    }

    logger.info(`💓 Heartbeat: Verificando ${sessionCount} sessão(ões)...`);

    for (const [sessionId, client] of this.sessions.entries()) {
      try {
        // Pular se já está em processo de reconexão
        if (this.isReconnecting.get(sessionId)) {
          logger.info(`   ⏳ ${sessionId}: Reconexão em andamento, pulando...`);
          continue;
        }

        const isConnected = await this._isSessionConnected(client);
        const previousState = this.sessionStates.get(sessionId);

        if (isConnected) {
          logger.info(`   ✅ ${sessionId}: CONNECTED`);
          this.sessionStates.set(sessionId, 'CONNECTED');
          
          // Resetar contador de tentativas se estava reconectando
          if (this.reconnectAttempts.has(sessionId)) {
            this.reconnectAttempts.delete(sessionId);
            logger.info(`   🔄 ${sessionId}: Contador de reconexão resetado`);
          }
        } else {
          logger.warn(`   ❌ ${sessionId}: DISCONNECTED`);
          this.sessionStates.set(sessionId, 'DISCONNECTED');
          
          // Iniciar processo de reconexão se não estava desconectado antes
          if (previousState !== 'DISCONNECTED') {
            logger.warn(`   🔄 ${sessionId}: Detectada desconexão! Iniciando reconexão...`);
            this._handleDisconnection(sessionId);
          }
        }
      } catch (error) {
        logger.error(`   ❌ ${sessionId}: Erro ao verificar - ${error.message}`);
        this.sessionStates.set(sessionId, 'ERROR');
        this._handleDisconnection(sessionId);
      }
    }
  }

  /**
   * Configura monitoramento de eventos para uma sessão
   */
  _setupSessionMonitoring(sessionId, client) {
    logger.info(`📡 Configurando monitoramento para ${sessionId}...`);

    // Listener de mudança de estado
    client.onStateChange((state) => {
      logger.info(`🔄 Estado de ${sessionId}: ${state}`);
      this.sessionStates.set(sessionId, state);

      // Estados que indicam desconexão
      const disconnectedStates = ['DISCONNECTED', 'UNPAIRED', 'CONFLICT', 'UNLAUNCHED'];
      
      if (disconnectedStates.includes(state)) {
        logger.warn(`⚠️  ${sessionId}: Estado de desconexão detectado (${state})`);
        this._handleDisconnection(sessionId);
      } else if (state === 'CONNECTED') {
        // Sessão reconectada com sucesso
        logger.info(`✅ ${sessionId}: Reconectado com sucesso via evento`);
        this.reconnectAttempts.delete(sessionId);
        this.isReconnecting.set(sessionId, false);
        
        // Cancelar timer de reconexão se existir
        const timer = this.reconnectTimers.get(sessionId);
        if (timer) {
          clearTimeout(timer);
          this.reconnectTimers.delete(sessionId);
        }
      }
    });

    // Listener de mudança de stream
    client.onStreamChange((state) => {
      logger.info(`📡 Stream de ${sessionId}: ${state}`);
      
      if (state === 'DISCONNECTED') {
        logger.warn(`⚠️  ${sessionId}: Stream desconectado`);
        this._handleDisconnection(sessionId);
      }
    });

    logger.info(`📡 Eventos registrados para ${sessionId}`);
  }

  /**
   * Trata desconexão de uma sessão
   */
  _handleDisconnection(sessionId) {
    // Evitar múltiplas tentativas simultâneas
    if (this.isReconnecting.get(sessionId)) {
      logger.info(`   ⏳ ${sessionId}: Já existe reconexão em andamento`);
      return;
    }

    const attempts = this.reconnectAttempts.get(sessionId) || 0;

    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`❌ ${sessionId}: Máximo de tentativas (${this.MAX_RECONNECT_ATTEMPTS}) atingido`);
      logger.error(`   ℹ️  Sessão removida do monitoramento. Reconecte manualmente.`);
      
      // Limpar sessão problemática
      this.sessions.delete(sessionId);
      this.reconnectAttempts.delete(sessionId);
      this.isReconnecting.delete(sessionId);
      this.sessionStates.set(sessionId, 'FAILED');
      return;
    }

    // Calcular delay com backoff exponencial
    const delay = Math.min(
      this.RECONNECT_BASE_DELAY * Math.pow(2, attempts),
      this.RECONNECT_MAX_DELAY
    );

    logger.info(`🔄 ${sessionId}: Tentativa ${attempts + 1}/${this.MAX_RECONNECT_ATTEMPTS} em ${delay / 1000}s...`);

    // Marcar como reconectando
    this.isReconnecting.set(sessionId, true);
    this.reconnectAttempts.set(sessionId, attempts + 1);

    // Agendar reconexão
    const timer = setTimeout(async () => {
      await this._attemptReconnection(sessionId);
    }, delay);

    this.reconnectTimers.set(sessionId, timer);
  }

  /**
   * Tenta reconectar uma sessão
   */
  async _attemptReconnection(sessionId) {
    const attempt = this.reconnectAttempts.get(sessionId) || 1;
    logger.info(`🔄 ${sessionId}: Executando tentativa ${attempt} de reconexão...`);

    try {
      // 1. Fechar sessão antiga se existir
      const oldClient = this.sessions.get(sessionId);
      if (oldClient) {
        try {
          await oldClient.close();
          logger.info(`   🔌 Sessão antiga fechada`);
        } catch (e) {
          logger.warn(`   ⚠️  Erro ao fechar sessão antiga: ${e.message}`);
        }
        this.sessions.delete(sessionId);
      }

      // 2. Limpar processos Chrome órfãos
      await this._checkAndKillStuckChrome(sessionId);

      // 3. Remover locks
      await this._removeLockFiles(sessionId);

      // 4. Aguardar um pouco
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 5. Tentar restaurar sessão
      const success = await this._restoreSession(sessionId);

      if (success) {
        logger.info(`✅ ${sessionId}: Reconexão bem-sucedida!`);
        this.reconnectAttempts.delete(sessionId);
        this.isReconnecting.set(sessionId, false);
        this.sessionStates.set(sessionId, 'CONNECTED');
      } else {
        logger.warn(`⚠️  ${sessionId}: Reconexão falhou`);
        this.isReconnecting.set(sessionId, false);
        
        // Tentar novamente se ainda houver tentativas
        if ((this.reconnectAttempts.get(sessionId) || 0) < this.MAX_RECONNECT_ATTEMPTS) {
          this._handleDisconnection(sessionId);
        }
      }

    } catch (error) {
      logger.error(`❌ ${sessionId}: Erro na reconexão - ${error.message}`);
      this.isReconnecting.set(sessionId, false);
      
      // Tentar novamente se ainda houver tentativas
      if ((this.reconnectAttempts.get(sessionId) || 0) < this.MAX_RECONNECT_ATTEMPTS) {
        this._handleDisconnection(sessionId);
      }
    }
  }

  /**
   * Para o sistema de heartbeat
   */
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('💓 Heartbeat parado');
    }

    // Cancelar todos os timers de reconexão
    for (const [sessionId, timer] of this.reconnectTimers.entries()) {
      clearTimeout(timer);
      logger.info(`   🔄 Timer de reconexão cancelado: ${sessionId}`);
    }
    this.reconnectTimers.clear();
  }

  /**
   * 🆕 Remover arquivos de lock do Chrome
   */
  async _removeLockFiles(sessionId) {
    try {
      const sessionPath = path.join(this.sessionsPath, sessionId);
      
      // Arquivos de lock que o Chrome cria
      const lockFiles = [
        'SingletonLock',
        'SingletonSocket',
        'SingletonCookie'
      ];

      for (const lockFile of lockFiles) {
        const lockPath = path.join(sessionPath, lockFile);
        if (fs.existsSync(lockPath)) {
          try {
            fs.unlinkSync(lockPath);
            logger.info(`   🔓 Lock removido: ${sessionId}/${lockFile}`);
          } catch (err) {
            logger.warn(`   ⚠️  Não foi possível remover lock ${lockFile}:`, err.message);
          }
        }
      }
    } catch (error) {
      logger.warn(`   ⚠️  Erro ao remover locks de ${sessionId}:`, error.message);
    }
  }

  /**
   * 🆕 Restaurar uma sessão específica
   */
  async _restoreSession(sessionId) {
    try {
      logger.info(`   🔌 Restaurando sessão: ${sessionId}`);

      // 🔥 FORÇAR diretório de dados do Chrome
      const userDataDir = path.join(this.sessionsPath, sessionId);

      // Criar cliente WPP Connect sem gerar novo QR
      const client = await wppconnect.create({
        session: sessionId,
        folderNameToken: this.sessionsPath,
        puppeteerOptions: {
          userDataDir: userDataDir,
          args: [
            `--user-data-dir=${userDataDir}`,  // 🔥 FORÇAR via argumento
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions'
          ],
          headless: process.env.HEADLESS !== 'false'
        },
        logQR: false, // Não mostrar QR no log
        disableWelcome: true,
        updatesLog: false,
        autoClose: 86400000, // 24h
        
        // Callbacks para monitorar status
        statusFind: (statusSession) => {
          if (statusSession === 'isLogged') {
            logger.info(`   ✅ Sessão ${sessionId} autenticada`);
          } else if (statusSession === 'notLogged') {
            logger.warn(`   ⚠️  Sessão ${sessionId} precisa reautenticar (tokens expirados)`);
          }
        }
      });

      // 🆕 AGUARDAR SINCRONIZAÇÃO (até 30 segundos)
      let attempts = 0;
      let isReady = false;
      
      while (attempts < 30 && !isReady) {
        try {
          const state = await client.getConnectionState();
          
          // Aceitar CONNECTED ou SYNCING como válidos
          if (state === 'CONNECTED' || state === 'SYNCING') {
            isReady = true;
            logger.info(`   ✅ Sessão ${sessionId} em estado: ${state}`);
            break;
          }
          
          // Se não conectado, aguardar 1 segundo e tentar novamente
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          
        } catch (error) {
          // Ignorar erros durante tentativas
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      if (isReady) {
        // Adicionar ao mapa de sessões MESMO se estiver SYNCING
        this.sessions.set(sessionId, client);
        logger.info(`   ✅ ${sessionId} restaurada e adicionada ao mapa`);
        
        // 🆕 CONFIGURAR MONITORAMENTO DE EVENTOS
        this._setupSessionMonitoring(sessionId, client);
        this.sessionStates.set(sessionId, 'CONNECTED');
        
        // 🆕 APLICAR CONFIGURAÇÕES (rejectCalls, alwaysOnline)
        const config = this.getSessionConfig(sessionId);
        await this._setupCallRejection(sessionId, client, config);
        await this._applyAlwaysOnline(sessionId, client, config.alwaysOnline);
        
        // Obter informações da sessão (pode falhar se ainda sincronizando)
        try {
          const hostDevice = await client.getHostDevice();
          if (hostDevice?.id?.user) {
            logger.info(`   📱 Número conectado: ${hostDevice.id.user}`);
          }
        } catch (err) {
          logger.info(`   ⏳ Sessão ${sessionId} ainda sincronizando dados...`);
        }
        
        return true;
      } else {
        logger.warn(`   ⚠️  ${sessionId} não conectou após 30 segundos`);
        await client.close();
        return false;
      }

    } catch (error) {
      logger.warn(`   ⚠️  Não foi possível restaurar ${sessionId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Limpar processos Chrome órfãos (travados)
   */
  async _cleanupOrphanedChrome() {
    try {
      const { execSync } = await import('child_process');
      
      // Matar processos Chrome órfãos (que não estão sendo usados)
      execSync('pkill -f "chrome.*--user-data-dir=/app/sessions" || true', { 
        stdio: 'ignore' 
      });
      
      logger.info('🧹 Cleanup de processos Chrome órfãos concluído');
    } catch (error) {
      logger.warn('Aviso: Não foi possível fazer cleanup de Chrome órfãos:', error.message);
    }
  }

  /**
   * Criar ou conectar sessão
   */
  async createSession(sessionId) {
    logger.info(`📱 Criando sessão: ${sessionId}`);

    try {
      // VERIFICAR SE HÁ CHROME TRAVADO PARA ESTA SESSÃO
      await this._checkAndKillStuckChrome(sessionId);
      
      // Limpar sessão anterior se existir (cleanup de Chrome travado)
      await this._forceCloseSession(sessionId);

      // Se já existe sessão ativa, verifica
      if (this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId);
        const isConnected = await this._isSessionConnected(session);
        
        if (isConnected) {
          logger.info(`✅ Sessão ${sessionId} já conectada`);
          return { success: true, message: 'Já conectado', needsQR: false };
        }
        
        // Desconectada, remove e reconecta
        logger.warn(`⚠️  Sessão ${sessionId} desconectada, reconectando...`);
        await this._closeSession(sessionId);
      }

      // 🔥 FORÇAR diretório de dados do Chrome
      const userDataDir = path.join(this.sessionsPath, sessionId);

      // Promessa para aguardar QR ou conexão
      const sessionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout aguardando QR Code'));
        }, (process.env.QR_TIMEOUT || 45) * 1000);

        wppconnect.create({
          session: sessionId,
          // Força pasta única por sessão
          folderNameToken: this.sessionsPath,
          
          // 🔥 CRÍTICO: Define userDataDir único por sessão para evitar conflitos
          puppeteerOptions: {
            userDataDir: userDataDir,
            
            // Headless otimizado (mais leve que GUI)
            headless: process.env.HEADLESS !== 'false',  // Default: true
            
            // Argumentos otimizados para menor consumo
            args: [
              // 🔥 FORÇAR diretório de dados via argumento
              `--user-data-dir=${userDataDir}`,
              
              // ========== SEGURANÇA ==========
              '--no-sandbox',
              '--disable-setuid-sandbox',
              
              // ========== MEMÓRIA ==========
              '--disable-dev-shm-usage',           // Não usar /dev/shm (pode dar problema em Docker)
              '--disable-accelerated-2d-canvas',   // Desabilitar canvas acelerado
              '--no-first-run',                    // Pular primeiro run
              '--no-zygote',                       // Reduzir processos filho
              '--disable-gpu',                     // Sem GPU (headless)
              
              // ========== REDE ==========
              '--disable-background-networking',   // Sem sync em background
              '--disable-sync',                    // Sem sincronização Chrome
              '--disable-translate',               // Sem tradutor
              '--disable-default-apps',            // Sem apps padrão
              
              // ========== PERFORMANCE ==========
              '--disable-extensions',              // Sem extensões
              '--disable-plugins',                 // Sem plugins
              '--disable-component-extensions-with-background-pages',
              '--disable-background-timer-throttling',
              '--disable-renderer-backgrounding',
              '--disable-backgrounding-occluded-windows',
              '--disable-ipc-flooding-protection',
              '--disable-hang-monitor',
              '--disable-prompt-on-repost',
              '--disable-domain-reliability',
              '--disable-features=TranslateUI',
              '--disable-features=BlinkGenPropertyTrees',
              
              // ========== CACHE E ARMAZENAMENTO ==========
              '--disk-cache-size=50000000',        // Cache de 50MB (pequeno)
              '--media-cache-size=50000000',
              '--aggressive-cache-discard',
              '--disable-notifications',
              '--disable-speech-api',
              
              // ========== ÁUDIO/VÍDEO ==========
              '--mute-audio',                      // Sem áudio
              '--disable-webgl',                   // Sem WebGL
              '--disable-software-rasterizer',
              
              // ========== OUTROS ==========
              '--no-pings',
              '--no-default-browser-check',
              '--autoplay-policy=user-gesture-required',
              '--disable-client-side-phishing-detection',
              '--disable-features=IsolateOrigins,site-per-process',
              
              // ========== LIMITES DE RECURSOS ==========
              '--single-process',                  // 🔥 IMPORTANTE: Um único processo
              '--disable-renderer-backgrounding',
              '--renderer-process-limit=1',        // Apenas 1 processo renderer
              '--max-old-space-size=512',          // Limite de memória Node.js: 512MB
            ],
            
            // ========== TIMEOUTS AJUSTADOS ==========
            timeout: 60000,  // 60s para operações (padrão é 30s)
            
            // ========== IGNORAR ERROS DE HTTPS ==========
            ignoreHTTPSErrors: true,
          },
        
          // ========== 🆕 CONFIGURAÇÕES WPPCONNECT ==========
          disableWelcome: true,              // Sem mensagem de boas-vindas
          updatesLog: false,   
          headless: process.env.HEADLESS === 'true',
          devtools: false,
          useChrome: false,
          debug: false,
          logQR: false,
          autoClose: 60000 * 60 * 24,
          createPathFileToken: true,
          waitForLogin: true,
          
          // QR Code gerado
          catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
            clearTimeout(timeout);
            logger.info(`📲 QR Code gerado para ${sessionId} (tentativa ${attempts})`);
            
            // Chamar callback se registrado
            const callback = this.qrCodeCallbacks.get(sessionId);
            if (callback) {
              callback({ qrCode: base64Qr, attempts, urlCode });
            }
            
            resolve({ 
              success: true, 
              needsQR: true, 
              qrCode: base64Qr,
              attempts 
            });
          },

          // Status mudou
          statusFind: (statusSession, session) => {
            logger.info(`📊 Status ${sessionId}: ${statusSession}`);
            
            const callback = this.statusCallbacks.get(sessionId);
            if (callback) {
              callback({ status: statusSession });
            }

            // Se conectado com sucesso
            if (statusSession === 'qrReadSuccess') {
              logger.info(`✅ ${sessionId} conectado com sucesso!`);
            }
          }
        })
        .then(async (client) => {
          this.sessions.set(sessionId, client);
          logger.info(`✅ Cliente ${sessionId} criado e salvo`);
          
          // 🆕 CONFIGURAR MONITORAMENTO DE EVENTOS
          this._setupSessionMonitoring(sessionId, client);
          this.sessionStates.set(sessionId, 'CONNECTED');
          
          // 🆕 APLICAR CONFIGURAÇÕES (rejectCalls, alwaysOnline)
          const config = this.getSessionConfig(sessionId);
          await this._setupCallRejection(sessionId, client, config);
          await this._applyAlwaysOnline(sessionId, client, config.alwaysOnline);
        })
        .catch(error => {
          clearTimeout(timeout);
          logger.error(`❌ Erro ao criar ${sessionId}:`, error);
          reject(error);
        });
      });

      return await sessionPromise;

    } catch (error) {
      logger.error(`❌ Erro em createSession (${sessionId}):`, error);
      throw error;
    }
  }

  /**
   * Obter informações da sessão
   */
  async getSessionInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return { connected: false, message: 'Sessão não encontrada' };
    }

    try {
      const isConnected = await this._isSessionConnected(session);
      
      if (!isConnected) {
        return { connected: false, message: 'Desconectado' };
      }

      const hostDevice = await session.getHostDevice();
      const state = await session.getConnectionState();
      
      return {
        connected: true,
        phoneNumber: hostDevice?.id?.user || null,
        platform: hostDevice?.platform || null,
        pushname: hostDevice?.pushname || null,
        state: state
      };

    } catch (error) {
      logger.error(`❌ Erro ao obter info (${sessionId}):`, error);
      return { connected: false, error: error.message };
    }
  }

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(sessionId, phoneNumber, message) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Sessão ${sessionId} não encontrada`);
    }

    const isConnected = await this._isSessionConnected(session);
    if (!isConnected) {
      throw new Error(`Sessão ${sessionId} não está conectada`);
    }

    try {
      // Formatar número
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const chatId = formattedNumber.includes('@') 
        ? formattedNumber 
        : `${formattedNumber}@c.us`;

      logger.info(`📤 Enviando mensagem via ${sessionId} para ${chatId}`);

      const result = await session.sendText(chatId, message);
      
      logger.info(`✅ Mensagem enviada com sucesso`);
      
      return { 
        success: true, 
        messageId: result.id,
        timestamp: result.t
      };

    } catch (error) {
      logger.error(`❌ Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  /**
   * Verificar se número existe no WhatsApp
   */
  async checkNumberStatus(sessionId, phoneNumber) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Sessão ${sessionId} não encontrada`);
    }

    const isConnected = await this._isSessionConnected(session);
    if (!isConnected) {
      throw new Error(`Sessão ${sessionId} não está conectada`);
    }

    try {
      // Formatar número
      const formattedNumber = phoneNumber.replace(/\D/g, '');
      const chatId = `${formattedNumber}@c.us`;
      
      logger.info(`🔍 Verificando número: ${formattedNumber}`);
      
      // Usar checkNumberStatus do WPPConnect
      const result = await session.checkNumberStatus(chatId);
      
      logger.info(`   📋 Resultado: ${JSON.stringify(result)}`);
      
      // WPPConnect retorna: { id, status, isBusiness, canReceiveMessage }
      const exists = result.status === 200 || result.numberExists === true || result.canReceiveMessage === true;
      
      return {
        success: true,
        exists: exists,
        number: formattedNumber,
        numberFormatted: chatId,
        isBusiness: result.isBusiness || false,
        canReceiveMessage: result.canReceiveMessage || exists,
        raw: result
      };

    } catch (error) {
      logger.error(`❌ Erro ao verificar número (${sessionId}):`, error);
      
      // Se o erro indica que não existe, retornar como não existente
      if (error.message?.includes('not found') || error.message?.includes('invalid')) {
        return {
          success: true,
          exists: false,
          number: phoneNumber.replace(/\D/g, ''),
          error: error.message
        };
      }
      
      throw error;
    }
  }

  /**
   * Desconectar sessão
   */
  async disconnect(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Sessão ${sessionId} não encontrada`);
    }

    logger.info(`🔌 Desconectando ${sessionId}`);

    try {
      // 1. Fazer logout do WhatsApp
      await session.logout();
      logger.info(`   ✅ Logout realizado`);
      
      // 2. 🔥 CRÍTICO: Fechar o Chrome também
      await session.close();
      logger.info(`   ✅ Chrome fechado`);
      
      // 3. Remover do mapa
      this.sessions.delete(sessionId);
      
      logger.info(`✅ ${sessionId} desconectado completamente`);
      
      return { success: true, message: 'Desconectado com sucesso' };

    } catch (error) {
      logger.error(`❌ Erro ao desconectar:`, error);
      
      // Tentar fechar com força se logout falhar
      try {
        await session.close();
        this.sessions.delete(sessionId);
      } catch (closeError) {
        logger.error(`❌ Erro ao fechar Chrome:`, closeError);
      }
      
      throw error;
    }
  }

  /**
   * Excluir sessão e tokens
   */
  async deleteSession(sessionId) {
    logger.info(`🗑️  Excluindo sessão ${sessionId}`);

    try {
      // 1. FORÇAR FECHAMENTO (mata Chrome)
      await this._forceCloseSession(sessionId);
      
      // 2. AGUARDAR PROCESSOS SEREM MORTOS
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 3. REMOVER PASTA DE TOKENS (com retry se estiver travada)
      const tokenPath = path.join(this.sessionsPath, sessionId);
      
      if (fs.existsSync(tokenPath)) {
        try {
          // Tentar remover normalmente
          fs.rmSync(tokenPath, { recursive: true, force: true });
          logger.info(`✅ Tokens removidos de ${tokenPath}`);
        } catch (error) {
          // Se falhar, forçar com comando do sistema
          logger.warn(`⚠️  Erro ao remover pasta, tentando com força...`);
          const { execSync } = await import('child_process');
          try {
            execSync(`rm -rf "${tokenPath}"`, { stdio: 'ignore' });
            logger.info(`✅ Tokens removidos com força`);
          } catch (rmError) {
            logger.error(`❌ Não foi possível remover pasta:`, rmError.message);
          }
        }
      }

      // 4. LIMPAR DO MAPA
      this.sessions.delete(sessionId);
      this.chromePids.delete(sessionId);
      this.clearCallbacks(sessionId);

      logger.info(`✅ Sessão ${sessionId} completamente excluída`);
      return { success: true, message: 'Sessão excluída e Chrome finalizado' };

    } catch (error) {
      logger.error(`❌ Erro ao excluir sessão:`, error);
      throw error;
    }
  }

  /**
   * Listar sessões ativas
   */
  listSessions() {
    const sessions = [];
    
    for (const [sessionId, client] of this.sessions.entries()) {
      sessions.push({
        sessionId,
        active: true
      });
    }
    
    return sessions;
  }

  /**
   * Registrar callback de QR Code
   */
  onQRCode(sessionId, callback) {
    this.qrCodeCallbacks.set(sessionId, callback);
  }

  /**
   * Registrar callback de status
   */
  onStatusChange(sessionId, callback) {
    this.statusCallbacks.set(sessionId, callback);
  }

  /**
   * Limpar callbacks
   */
  clearCallbacks(sessionId) {
    this.qrCodeCallbacks.delete(sessionId);
    this.statusCallbacks.delete(sessionId);
  }

  // ========== MÉTODOS PRIVADOS ==========

  async _isSessionConnected(session) {
    try {
      const state = await session.getConnectionState();
      return state === 'CONNECTED';
    } catch (error) {
      return false;
    }
  }

  async _closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.close();
      } catch (error) {
        logger.error(`Erro ao fechar sessão ${sessionId}:`, error);
      }
      this.sessions.delete(sessionId);
    }
    this.clearCallbacks(sessionId);
  }

  /**
   * Forçar fechamento de sessão (matando Chrome se necessário)
   */
  async _forceCloseSession(sessionId) {
    try {
      // Tentar fechar normalmente primeiro
      await this._closeSession(sessionId);
      
      // Matar processos Chrome específicos desta sessão
      const { execSync } = await import('child_process');
      
      try {
        execSync(`pkill -f "chrome.*${sessionId}" || true`, { stdio: 'ignore' });
        logger.info(`🔪 Processos Chrome da sessão ${sessionId} finalizados`);
      } catch (error) {
        // Ignorar erro se não houver processos
      }
      
      // Aguardar um pouco para garantir que tudo foi liberado
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      logger.warn(`Aviso ao forçar fechamento de ${sessionId}:`, error.message);
    }
  }

  /**
   * Verificar e matar Chrome travado ANTES de criar sessão
   */
  async _checkAndKillStuckChrome(sessionId) {
    try {
      const { execSync } = await import('child_process');
      const sessionPath = path.join(this.sessionsPath, sessionId);
      
      // Verificar se há processos Chrome usando esta sessão
      try {
        const result = execSync(`ps aux | grep "chrome.*${sessionId}" | grep -v grep | awk '{print $2}'`, { 
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'ignore']
        });
        
        if (result.trim()) {
          const pids = result.trim().split('\n');
          logger.warn(`⚠️  ${pids.length} processo(s) Chrome travado(s) para ${sessionId}, matando...`);
          
          // Matar cada PID com força
          for (const pid of pids) {
            try {
              execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            } catch (e) {
              // Ignorar se processo já foi morto
            }
          }
          
          // Aguardar processo ser morto
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          logger.info(`✅ Chrome travado eliminado`);
        }
      } catch (error) {
        // Se não encontrar processos, está ok
      }
      
      // Verificar se pasta está travada (locked)
      if (fs.existsSync(sessionPath)) {
        const lockFile = path.join(sessionPath, 'SingletonLock');
        if (fs.existsSync(lockFile)) {
          logger.warn(`⚠️  Lock file detectado em ${sessionId}, removendo...`);
          try {
            fs.unlinkSync(lockFile);
            logger.info(`✅ Lock file removido`);
          } catch (error) {
            logger.error(`❌ Erro ao remover lock:`, error.message);
          }
        }
      }
      
    } catch (error) {
      logger.warn(`Aviso ao verificar Chrome travado:`, error.message);
    }
  }

  /**
   * Fechar todas as sessões (cleanup)
   */
  async closeAll() {
    logger.info(`🔌 Fechando todas as sessões...`);
    
    // 🆕 Parar heartbeat
    this._stopHeartbeat();
    
    const promises = [];
    for (const [sessionId] of this.sessions.entries()) {
      promises.push(this._closeSession(sessionId));
    }
    
    await Promise.allSettled(promises);
    logger.info(`✅ Todas as sessões fechadas`);
  }
}

// Exportar instância única
export default new WPPService();