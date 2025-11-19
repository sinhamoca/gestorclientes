// ==========================================
// WHATSAPP PROVIDER FACTORY
// Factory Pattern para suportar múltiplas APIs
// ==========================================

import WppConnectProvider from '../providers/WppConnectProvider.js';
import EvolutionProvider from '../providers/EvolutionProvider.js';
import BaileysProvider from '../providers/BaileysProvider.js';
import WhatsAppWebJsProvider from '../providers/WhatsAppWebJsProvider.js';


/**
 * Factory que retorna o provider correto baseado no nome
 */
class WhatsAppProviderFactory {
  
  /**
   * Obter instância do provider
   * @param {string} providerName - Nome do provider ('wppconnect', 'evolution', 'baileys')
   * @returns {WhatsAppProvider} Instância do provider
   */
  static getProvider(providerName) {
    console.log(`🏭 Factory: Criando provider '${providerName}'`);
    
    switch(providerName?.toLowerCase()) {
      case 'wppconnect':
        return new WppConnectProvider();

      case 'whatsappwebjs':
        return new WhatsAppWebJsProvider();
        
      case 'evolution':
        return new EvolutionProvider();
        
      case 'baileys':
        return new BaileysProvider();
        
      default:
        console.warn(`⚠️  Provider '${providerName}' desconhecido, usando WppConnect como fallback`);
        return new WppConnectProvider();
    }
  }
  
  /**
   * Listar providers disponíveis
   * @returns {Array} Lista de providers com status
   */
  static getAvailableProviders() {
    return [
      {
        id: 'wppconnect',
        name: 'WPP Connect',
        description: 'Estável e recomendado',
        status: 'active',
        icon: '✅'
      },
      {
        id: 'whatsappwebjs',
        name: 'WhatsApp-Web.js',
        description: 'Estável e confiável',
        status: 'active',
        icon: '🌐'
      },
      {
        id: 'evolution',
        name: 'Evolution API',
        description: 'Em breve',
        status: 'coming_soon',
        icon: '🚧'
      },
      {
        id: 'baileys',
        name: 'Baileys',
        description: 'Em desenvolvimento',
        status: 'development',
        icon: '🔜'
      }
    ];
  }
  
  /**
   * Verificar se provider está disponível
   * @param {string} providerName - Nome do provider
   * @returns {boolean} Se está disponível
   */
  static isProviderAvailable(providerName) {
    const available = ['wppconnect', 'whatsappwebjs']; // ← Adicionar aqui
    return available.includes(providerName?.toLowerCase());
  }
}

export default WhatsAppProviderFactory;
