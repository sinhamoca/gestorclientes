// ========================================
// ENCRYPTION UTILITIES
// Sistema de criptografia de ponta a ponta
// ========================================

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Criptografa um texto usando AES-256-GCM
 * @param {string} text - Texto a ser criptografado
 * @param {string} encryptionKey - Chave de 64 caracteres hex (32 bytes)
 * @returns {string} - Formato: iv:authTag:encrypted
 */
export function encrypt(text, encryptionKey) {
  if (!text) return null;
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Chave de criptografia inválida (deve ter 64 caracteres hex)');
  }

  try {
    // Gera IV aleatório
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Converte chave hex para buffer
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    
    // Cria cipher
    const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
    
    // Criptografa
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Obtém tag de autenticação
    const authTag = cipher.getAuthTag();
    
    // Retorna: iv:authTag:encrypted
    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted
    ].join(':');
    
  } catch (error) {
    console.error('Erro ao criptografar:', error.message);
    throw new Error('Falha na criptografia');
  }
}

/**
 * Descriptografa um texto criptografado
 * @param {string} encryptedData - Dados no formato iv:authTag:encrypted
 * @param {string} encryptionKey - Chave de 64 caracteres hex (32 bytes)
 * @returns {string} - Texto descriptografado
 */
export function decrypt(encryptedData, encryptionKey) {
  if (!encryptedData) return null;
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Chave de criptografia inválida (deve ter 64 caracteres hex)');
  }

  try {
    // Divide os componentes
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Formato de dados criptografados inválido');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    
    // Converte de hex para buffer
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    
    // Cria decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(authTag);
    
    // Descriptografa
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
    
  } catch (error) {
    console.error('Erro ao descriptografar:', error.message);
    throw new Error('Falha na descriptografia - chave incorreta ou dados corrompidos');
  }
}

/**
 * Gera uma chave de criptografia aleatória
 * @returns {string} - Chave de 64 caracteres hex (32 bytes)
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Valida se uma chave tem o formato correto
 * @param {string} key - Chave a ser validada
 * @returns {boolean}
 */
export function isValidEncryptionKey(key) {
  return typeof key === 'string' && 
         key.length === 64 && 
         /^[0-9a-f]{64}$/i.test(key);
}

/**
 * Testa se uma chave consegue descriptografar dados
 * @param {string} encryptedData - Dados criptografados
 * @param {string} key - Chave a ser testada
 * @returns {boolean}
 */
export function testDecryptionKey(encryptedData, key) {
  try {
    decrypt(encryptedData, key);
    return true;
  } catch {
    return false;
  }
}