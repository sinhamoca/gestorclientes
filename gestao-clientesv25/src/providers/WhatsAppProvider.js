// ==========================================
// WHATSAPP PROVIDER - INTERFACE BASE
// Todos os providers devem implementar estes métodos
// ==========================================

/**
 * Classe base abstrata para providers WhatsApp
 * Define a interface que TODOS os providers devem seguir
 */
class WhatsAppProvider {
  constructor(providerName) {
    this.providerName = providerName;
  }

  /**
   * Criar ou reconectar instância WhatsApp
   * @param {number} userId - ID do usuário
   * @param {object} instanceData - Dados da instância do banco
   * @returns {Promise<object>} { success, message, qrCode?, connected?, needsQR? }
   */
  async createOrConnectInstance(userId, instanceData) {
    throw new Error('createOrConnectInstance() deve ser implementado pelo provider');
  }

  /**
   * Buscar QR Code atualizado
   * @param {number} userId - ID do usuário
   * @param {object} instanceData - Dados da instância do banco
   * @returns {Promise<object>} { qrCode?, connected?, phoneNumber? }
   */
  async getQRCode(userId, instanceData) {
    throw new Error('getQRCode() deve ser implementado pelo provider');
  }

  /**
   * Verificar status da conexão
   * @param {number} userId - ID do usuário
   * @param {object} instanceData - Dados da instância do banco
   * @returns {Promise<object>} { connected, phoneNumber?, platform?, pushname? }
   */
  async checkConnectionStatus(userId, instanceData) {
    throw new Error('checkConnectionStatus() deve ser implementado pelo provider');
  }

  /**
   * Desconectar instância (faz logout mas mantém tokens)
   * @param {number} userId - ID do usuário
   * @param {object} instanceData - Dados da instância do banco
   * @returns {Promise<object>} { success, message }
   */
  async disconnectInstance(userId, instanceData) {
    throw new Error('disconnectInstance() deve ser implementado pelo provider');
  }

  /**
   * Excluir instância completamente (remove tokens)
   * @param {number} userId - ID do usuário
   * @param {object} instanceData - Dados da instância do banco
   * @returns {Promise<object>} { success, message }
   */
  async deleteInstance(userId, instanceData) {
    throw new Error('deleteInstance() deve ser implementado pelo provider');
  }

  /**
   * Enviar mensagem de texto
   * @param {string} sessionId - ID da sessão (ex: user_2)
   * @param {string} phoneNumber - Número do destinatário
   * @param {string} message - Texto da mensagem
   * @returns {Promise<object>} { success, messageId?, timestamp? }
   */
  async sendTextMessage(sessionId, phoneNumber, message) {
    throw new Error('sendTextMessage() deve ser implementado pelo provider');
  }

  /**
   * Obter instância ativa do usuário
   * @param {number} userId - ID do usuário
   * @returns {Promise<object|null>} Dados da instância ou null
   */
  async getUserInstance(userId) {
    throw new Error('getUserInstance() deve ser implementado pelo provider');
  }
  
  /**
   * Obter nome do provider
   * @returns {string} Nome do provider
   */
  getProviderName() {
    return this.providerName;
  }
}

export default WhatsAppProvider;