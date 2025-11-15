/* ========================================
   CONFIGURAÇÕES DO DASHBOARD
   ======================================== */

// URL da API - ALTERE PARA O IP DO SEU SERVIDOR
const API_URL = 'http://37.60.235.47:9100';

// Chave de API (salva no localStorage após login)
const getApiKey = () => localStorage.getItem('wweb_api_key');

// Storage keys
const STORAGE_KEYS = {
  API_KEY: 'wweb_api_key',
  AUTH: 'wweb_authenticated'
};

// Configurações
const CONFIG = {
  apiUrl: API_URL,
  refreshInterval: 5000,
  maxSessions: 50,
  version: '1.0.0'
};
