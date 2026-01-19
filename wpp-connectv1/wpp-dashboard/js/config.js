/* ========================================
   CONFIGURAÇÕES DO DASHBOARD
   ======================================== */

// URL da API - IP PÚBLICO DO SERVIDOR
const API_URL = 'http://37.60.235.47:9000';

// Chave de API (salva no localStorage após login)
const getApiKey = () => localStorage.getItem('wpp_api_key');

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'wpp_api_key',
  AUTH: 'wpp_authenticated'
};

// Configurações
const CONFIG = {
  apiUrl: API_URL,
  refreshInterval: 5000,
  maxSessions: 50,
  version: '1.0.0'
};
