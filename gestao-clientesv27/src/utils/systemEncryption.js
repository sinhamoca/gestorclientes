import { decrypt } from './encryption.js';

/**
 * Descriptografa WhatsApp usando a chave do sistema
 * Para uso em lembretes automáticos e envio de mensagens
 */
export function decryptSystemWhatsApp(encryptedWhatsApp) {
  if (!encryptedWhatsApp) {
    return null;
  }
  
  const systemKey = process.env.SYSTEM_ENCRYPTION_KEY;
  
  if (!systemKey) {
    throw new Error('SYSTEM_ENCRYPTION_KEY não configurada no .env');
  }
  
  try {
    return decrypt(encryptedWhatsApp, systemKey);
  } catch (error) {
    console.error('Erro ao descriptografar WhatsApp do sistema:', error);
    throw error;
  }
}
