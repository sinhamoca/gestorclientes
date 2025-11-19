import WhatsAppProvider from './WhatsAppProvider.js';

// ==========================================
// EVOLUTION API PROVIDER (PLACEHOLDER)
// Será implementado no futuro
// ==========================================

class EvolutionProvider extends WhatsAppProvider {
  constructor() {
    super('evolution');
  }

  async createOrConnectInstance(userId, instanceData) {
    throw new Error('🚧 Evolution API ainda não está disponível. Use WPP Connect por enquanto.');
  }

  async getQRCode(userId, instanceData) {
    throw new Error('🚧 Evolution API ainda não está disponível');
  }

  async checkConnectionStatus(userId, instanceData) {
    throw new Error('🚧 Evolution API ainda não está disponível');
  }

  async disconnectInstance(userId, instanceData) {
    throw new Error('🚧 Evolution API ainda não está disponível');
  }

  async deleteInstance(userId, instanceData) {
    throw new Error('🚧 Evolution API ainda não está disponível');
  }

  async sendTextMessage(sessionId, phoneNumber, message) {
    throw new Error('🚧 Evolution API ainda não está disponível');
  }

  async getUserInstance(userId) {
    return null;
  }
}

export default EvolutionProvider;