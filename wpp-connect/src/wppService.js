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
    this.sessionsPath = path.join(__dirname, 'sessions');
    this.qrCodeCallbacks = new Map();
    this.statusCallbacks = new Map();
    this.chromePids = new Map(); // Rastrear PIDs do Chrome
    
    // Criar pasta de sessões
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
      logger.info('📁 Pasta de sessões criada');
    }

    // Cleanup inicial de processos Chrome órfãos
    this._cleanupOrphanedChrome();

    logger.info('✅ WPPService inicializado');
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
            userDataDir: path.join(this.sessionsPath, sessionId),
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--no-first-run',
              '--no-zygote',
              '--disable-gpu',
              '--disable-software-rasterizer',
              '--disable-extensions',
              '--disable-background-networking',
              '--disable-sync',
              '--metrics-recording-only',
              '--disable-default-apps',
              '--mute-audio',
              '--disable-background-timer-throttling',
              '--disable-renderer-backgrounding',
              '--disable-backgrounding-occluded-windows'
            ]
          },
          
          headless: process.env.HEADLESS === 'true',
          devtools: false,
          useChrome: false,
          debug: false,
          logQR: false,
          autoClose: 120000, // Auto-fechar após 2min sem usar
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
        .then(client => {
          this.sessions.set(sessionId, client);
          logger.info(`✅ Cliente ${sessionId} criado e salvo`);
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
   * Desconectar sessão
   */
  async disconnect(sessionId) {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error(`Sessão ${sessionId} não encontrada`);
    }

    logger.info(`🔌 Desconectando ${sessionId}`);

    try {
      await session.logout();
      this.sessions.delete(sessionId);
      
      logger.info(`✅ ${sessionId} desconectado`);
      
      return { success: true, message: 'Desconectado com sucesso' };

    } catch (error) {
      logger.error(`❌ Erro ao desconectar:`, error);
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