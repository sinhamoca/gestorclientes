/* ========================================
   CONFIGURAÇÕES - IPTV MANAGER
   ======================================== */

// Detecta ambiente
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// URL da API do sistema principal
const API_URL = isLocalhost 
  ? 'http://localhost:3001/api' 
  : 'https://api.comprarecarga.shop/api';

// URL da API do IPTV Manager (backend)
// Em produção, o Nginx faz proxy de /api/ para o backend na porta 5001
const IPTV_API_URL = isLocalhost 
  ? 'http://localhost:5001/api' 
  : window.location.origin + '/api';

// Chaves do localStorage (MESMAS do sistema principal!)
const STORAGE_KEYS = {
  TOKEN: 'user_token',
  USER: 'user_data'
};

// Mensagens
const MESSAGES = {
  UNAUTHORIZED: 'Você precisa estar logado no sistema principal para acessar esta página.',
  ERROR: 'Ocorreu um erro. Tente novamente.',
  NO_CLIENTS: 'Nenhum cliente cadastrado encontrado.',
  NO_CN_CLIENTS: 'Nenhum cliente importado do CloudNation ainda.',
  CREDENTIALS_SAVED: 'Credenciais salvas com sucesso!',
  IMPORT_SUCCESS: 'Clientes importados com sucesso!',
  IMPORT_ERROR: 'Erro ao importar clientes. Tente novamente.'
};
