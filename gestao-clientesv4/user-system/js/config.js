/* ========================================
   CONFIGURAÇÕES DO SISTEMA
   ======================================== */

// URL da API (altere conforme necessário)
const API_URL = 'http://37.60.235.47:3001/api';

// Chaves do localStorage
const STORAGE_KEYS = {
  TOKEN: 'user_token',
  USER_DATA: 'user_data'
};

// Configurações gerais
const CONFIG = {
  API_URL,
  STORAGE_KEYS,
  RETRY_ATTEMPTS: 3,
  REQUEST_TIMEOUT: 30000, // 30 segundos
};
