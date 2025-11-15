// ==========================================
// WHATSAPP-WEB.JS SERVICE
// ==========================================

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const logger = require('./logger');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

class WWebService {
  constructor() {
    this.clients = new Map(); // Map<sessionId, Client>
    this.qrCodes = new Map(); // Map<sessionId, qrData>
    this.sessionsPath = path.join(__dirname, '../sessions');
    
    logger.info('✅ WWebService inicializado');
    logger.info(`📁 Sessões serão salvas em: ${this.sessionsPath}`);
    
    // Criar diretório de sessões se não existir
    if (!fs.existsSync(this.sessionsPath)) {
      fs.mkdirSync(this.sessionsPath, { recursive: true });
    }
    
    // Carregar sessões existentes ao iniciar
    this.loadExistingSessions();
  }

  /**
   * Carregar sessões que já existem no disco
   */
  async loadExistingSessions() {
    try {
      const files = fs.readdirSync(this.sessionsPath);
      const sessionDirs = files.filter(f => {
        const fullPath = path.join(this.sessionsPath, f);
        return fs.statSync(fullPath).isDirectory() && f.startsWith('session-');
      });

      if (sessionDirs.length > 0) {
        logger.info(`📂 Encontradas ${sessionDirs.length} sessões salvas, restaurando...`);
        
        for (const dir of sessionDirs) {
          const sessionId = dir.replace('session-', '');
          try {
            await this.restoreSession(sessionId);
          } catch (error) {
            logger.warn(`Aviso ao restaurar sessão ${sessionId}:`, error.message);
          }
        }
      } else {
        logger.info('📂 Nenhuma sessão salva encontrada');
      }
    } catch (error) {
      logger.error('Erro ao carregar sessões existentes:', error);
    }
  }

  /**
   * Restaurar uma sessão existente
   */
  async restoreSession(sessionId) {
    logger.info(`🔄 Restaurando sessão: ${sessionId}`);

    try {
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: sessionId,
          dataPath: this.sessionsPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions'
          ]
        }
      });

      // Eventos
      client.on('ready', () => {
        logger.info(`✅ Sessão ${sessionId} restaurada e conectada!`);
      });

      client.on('disconnected', (reason) => {
        logger.warn(`⚠️  Sessão ${sessionId} desconectada: ${reason}`);
        this.clients.delete(sessionId);
      });

      client.on('auth_failure', (msg) => {
        logger.error(`❌ Falha na autenticação ${sessionId}: ${msg}`);
        this.clients.delete(sessionId);
      });

      // Salvar cliente
      this.clients.set(sessionId, client);

      // Inicializar
      await client.initialize();

    } catch (error) {
      logger.error(`❌ Erro ao restaurar sessão ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Verificar se cliente está conectado
   */
  async _isClientConnected(client) {
    try {
      const state = await client.getState();
      return state === 'CONNECTED';
    } catch (error) {
      return false;
    }
  }

  /**
   * Fechar cliente forçadamente
   */
  async _forceCloseClient(sessionId) {
    try {
      if (this.clients.has(sessionId)) {
        const client = this.clients.get(sessionId);
        await client.destroy().catch(() => {});
        this.clients.delete(sessionId);
      }
      this.qrCodes.delete(sessionId);
    } catch (error) {
      logger.warn(`Aviso ao fechar cliente ${sessionId}:`, error.message);
    }
  }

  /**
   * Matar processos Chrome travados
   */
  async _checkAndKillStuckChrome(sessionId) {
    try {
      logger.info(`🔍 Verificando processos Chrome para sessão: ${sessionId}`);
      
      execSync(`pkill -f "user-data-dir=.*${sessionId}" || true`, { 
        stdio: 'ignore' 
      });
      
      logger.info('🧹 Cleanup de processos Chrome concluído');
    } catch (error) {
      logger.warn('Aviso: Não foi possível fazer cleanup:', error.message);
    }
  }

  /**
   * Criar ou conectar sessão
   */
  async createSession(sessionId) {
    logger.info(`📱 Criando sessão: ${sessionId}`);

    try {
      // Verificar se já existe e está conectada
      if (this.clients.has(sessionId)) {
        const client = this.clients.get(sessionId);
        const isConnected = await this._isClientConnected(client);
        
        if (isConnected) {
          logger.info(`✅ Sessão ${sessionId} já conectada`);
          return { success: true, message: 'Já conectado', needsQR: false };
        }
        
        // Desconectado, remove e reconecta
        logger.warn(`⚠️  Sessão ${sessionId} desconectada, reconectando...`);
        await this._forceCloseClient(sessionId);
      }

      // Verificar se há Chrome travado
      await this._checkAndKillStuckChrome(sessionId);

      // Criar novo cliente
      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: sessionId,
          dataPath: this.sessionsPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions'
          ]
        }
      });

      // Promessa para aguardar QR ou conexão
      const sessionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout aguardando QR Code'));
        }, (process.env.QR_TIMEOUT || 45) * 1000);

        // QR Code recebido
        client.on('qr', async (qr) => {
          logger.info(`📱 QR Code gerado para: ${sessionId}`);
          
          try {
            const qrDataUrl = await qrcode.toDataURL(qr);
            this.qrCodes.set(sessionId, qrDataUrl);
            
            clearTimeout(timeout);
            resolve({
              success: true,
              needsQR: true,
              qr: qrDataUrl,
              message: 'QR Code gerado com sucesso'
            });
          } catch (error) {
            logger.error(`❌ Erro ao gerar QR Code:`, error);
            clearTimeout(timeout);
            reject(error);
          }
        });

        // Cliente pronto
        client.on('ready', () => {
          logger.info(`✅ Sessão ${sessionId} conectada e pronta!`);
          this.qrCodes.delete(sessionId); // Limpa QR após conectar
          clearTimeout(timeout);
        });

        // Autenticação bem-sucedida
        client.on('authenticated', () => {
          logger.info(`🔐 Sessão ${sessionId} autenticada`);
        });

        // Desconectado
        client.on('disconnected', (reason) => {
          logger.warn(`⚠️  Sessão ${sessionId} desconectada: ${reason}`);
          this.clients.delete(sessionId);
          this.qrCodes.delete(sessionId);
        });

        // Erro de autenticação
        client.on('auth_failure', (msg) => {
          logger.error(`❌ Falha na autenticação ${sessionId}: ${msg}`);
          clearTimeout(timeout);
          reject(new Error(`Falha na autenticação: ${msg}`));
        });
      });

      // Salvar cliente
      this.clients.set(sessionId, client);

      // Inicializar cliente
      logger.info(`🚀 Inicializando cliente: ${sessionId}`);
      await client.initialize();

      // Aguardar QR ou conexão
      return await sessionPromise;

    } catch (error) {
      logger.error(`❌ Erro ao criar sessão ${sessionId}:`, error);
      await this._forceCloseClient(sessionId);
      throw error;
    }
  }

  /**
   * Obter status da sessão
   */
  async getSessionStatus(sessionId) {
    try {
      if (!this.clients.has(sessionId)) {
        return {
          status: 'disconnected',
          message: 'Sessão não encontrada'
        };
      }

      const client = this.clients.get(sessionId);
      const state = await client.getState();
      
      return {
        status: state.toLowerCase(),
        connected: state === 'CONNECTED',
        message: `Estado: ${state}`
      };
    } catch (error) {
      logger.error(`Erro ao verificar status ${sessionId}:`, error);
      return {
        status: 'error',
        message: error.message
      };
    }
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(sessionId, to, message) {
    try {
      if (!this.clients.has(sessionId)) {
        throw new Error('Sessão não encontrada');
      }

      const client = this.clients.get(sessionId);
      const isConnected = await this._isClientConnected(client);

      if (!isConnected) {
        throw new Error('Cliente não está conectado');
      }

      // Formatar número (adicionar @c.us se necessário)
      const chatId = to.includes('@') ? to : `${to}@c.us`;

      // Enviar mensagem
      await client.sendMessage(chatId, message);

      logger.info(`✅ Mensagem enviada de ${sessionId} para ${to}`);
      return { success: true, message: 'Mensagem enviada' };

    } catch (error) {
      logger.error(`❌ Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  /**
   * Obter QR Code
   */
  getQRCode(sessionId) {
    return this.qrCodes.get(sessionId) || null;
  }

  /**
   * Desconectar sessão
   */
  async disconnectSession(sessionId) {
    logger.info(`🔌 Desconectando sessão: ${sessionId}`);
    
    try {
      await this._forceCloseClient(sessionId);
      
      // Remover pasta da sessão para forçar novo QR
      const sessionDir = path.join(this.sessionsPath, `session-${sessionId}`);
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
        logger.info(`🗑️  Pasta da sessão ${sessionId} removida`);
      }
      
      logger.info(`✅ Sessão ${sessionId} desconectada`);
      return { success: true, message: 'Sessão desconectada' };
    } catch (error) {
      logger.error(`❌ Erro ao desconectar ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Listar todas as sessões
   */
  listSessions() {
    const sessions = [];
    
    for (const [sessionId, client] of this.clients) {
      sessions.push({
        sessionId,
        hasQR: this.qrCodes.has(sessionId),
        created: true
      });
    }
    
    return sessions;
  }

  /**
   * Cleanup ao desligar
   */
  async cleanup() {
    logger.info('🧹 Fazendo cleanup de todas as sessões...');
    
    const promises = [];
    for (const sessionId of this.clients.keys()) {
      promises.push(this._forceCloseClient(sessionId));
    }
    
    await Promise.all(promises);
    logger.info('✅ Cleanup concluído');
  }
}

module.exports = new WWebService();