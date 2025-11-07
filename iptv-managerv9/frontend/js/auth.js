/* ========================================
   AUTENTICAÇÃO - VALIDAÇÃO JWT
   ======================================== */

const auth = {
  // Verifica se o usuário está logado
  isAuthenticated() {
    const token = this.getToken();
    const user = this.getUser();
    return !!token && !!user;
  },

  // Obtém token da URL (se existir)
  getTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
  },

  // Obtém o token do localStorage
  getToken() {
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
  },

  // Obtém os dados do usuário
  getUser() {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // Valida o token com o backend
  async validateToken() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ [AUTH] Erro ao validar token:', error);
      return false;
    }
  },

  // Redireciona para login do sistema principal
  redirectToLogin() {
    alert(MESSAGES.UNAUTHORIZED);
    window.location.href = 'https://comprarecarga.shop';
  },

  // Limpa autenticação
  logout() {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    this.redirectToLogin();
  }
};
