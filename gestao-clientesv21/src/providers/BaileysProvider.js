import WhatsAppProvider from './WhatsAppProvider.js';

// ==========================================
// BAILEYS PROVIDER (PLACEHOLDER)
// Será implementado no futuro
// ==========================================

class BaileysProvider extends WhatsAppProvider {
  constructor() {
    super('baileys');
  }

  async createOrConnectInstance(userId, instanceData) {
    throw new Error('🔜 Baileys ainda está em desenvolvimento. Use WPP Connect por enquanto.');
  }

  async getQRCode(userId, instanceData) {
    throw new Error('🔜 Baileys ainda está em desenvolvimento');
  }

  async checkConnectionStatus(userId, instanceData) {
    throw new Error('🔜 Baileys ainda está em desenvolvimento');
  }

  async disconnectInstance(userId, instanceData) {
    throw new Error('🔜 Baileys ainda está em desenvolvimento');
  }

  async deleteInstance(userId, instanceData) {
    throw new Error('🔜 Baileys ainda está em desenvolvimento');
  }

  async sendTextMessage(sessionId, phoneNumber, message) {
    throw new Error('🔜 Baileys ainda está em desenvolvimento');
  }

  async getUserInstance(userId) {
    return null;
  }
}

export default BaileysProvider;