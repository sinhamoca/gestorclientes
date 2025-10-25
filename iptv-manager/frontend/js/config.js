/* ========================================
   CONFIGURAÇÕES - IPTV RENEWAL SERVICE
   ======================================== */

// URL da API do sistema principal
const API_URL = 'https://api.comprarecarga.shop/api';

// Chaves do localStorage (MESMAS do sistema principal!)
const STORAGE_KEYS = {
  TOKEN: 'user_token',      // ← CORRIGIDO!
  USER: 'user_data'         // ← CORRIGIDO!
};

// Mensagens
const MESSAGES = {
  UNAUTHORIZED: 'Você precisa estar logado no sistema principal para acessar esta página.',
  ERROR: 'Ocorreu um erro. Tente novamente.',
  NO_CLIENTS: 'Nenhum cliente cadastrado encontrado.'
};