/* ========================================
   AUTENTICAÇÃO - VALIDAÇÃO JWT
   ======================================== */

const auth = {
  // Verifica se o usuário está logado
  isAuthenticated() {
    console.log('🔍 [AUTH] Verificando autenticação...');
    
    // Primeiro verifica se veio token pela URL
    const urlToken = this.getTokenFromUrl();
    if (urlToken) {
      console.log('✅ [AUTH] Token encontrado na URL:', urlToken.substring(0, 20) + '...');
      localStorage.setItem(STORAGE_KEYS.TOKEN, urlToken);
      // Remove token da URL
      window.history.replaceState({}, document.title, window.location.pathname);
      console.log('✅ [AUTH] Token salvo no localStorage e removido da URL');
    } else {
      console.log('ℹ️  [AUTH] Nenhum token na URL');
    }
    
    const token = this.getToken();
    const user = this.getUser();
    
    console.log('📊 [AUTH] Status:', {
      hasToken: !!token,
      hasUser: !!user,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'null'
    });
    
    return !!token && !!user;
  },

  // Obtém token da URL (se existir)
  getTokenFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    console.log('🔗 [AUTH] Verificando URL params:', window.location.search);
    return token;
  },

  // Obtém o token do localStorage
  getToken() {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    console.log('💾 [AUTH] Token do localStorage:', token ? 'existe' : 'não existe');
    return token;
  },

  // Obtém os dados do usuário
  getUser() {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    console.log('👤 [AUTH] User do localStorage:', userStr ? 'existe' : 'não existe');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      console.error('❌ [AUTH] Erro ao fazer parse do user');
      return null;
    }
  },

  // Valida o token com o backend
  async validateToken() {
    const token = this.getToken();
    if (!token) {
      console.warn('⚠️  [AUTH] Nenhum token para validar');
      return false;
    }

    console.log('🔄 [AUTH] Validando token com backend...');
    console.log('📡 [AUTH] URL da API:', API_URL);

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('📥 [AUTH] Resposta do backend:', response.status, response.statusText);
      
      if (response.ok) {
        const userData = await response.json();
        console.log('✅ [AUTH] Token válido! User:', userData.name);
        // Atualiza dados do usuário
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
        return true;
      }
      
      console.error('❌ [AUTH] Token inválido (status:', response.status + ')');
      return false;
    } catch (error) {
      console.error('❌ [AUTH] Erro ao validar token:', error);
      return false;
    }
  },

  // Redireciona para login do sistema principal
  redirectToLogin() {
    console.warn('🔄 [AUTH] Redirecionando para login...');
    alert(MESSAGES.UNAUTHORIZED);
    window.location.href = 'https://comprarecarga.shop';
  },

  // Limpa autenticação
  logout() {
    console.log('🚪 [AUTH] Fazendo logout...');
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    this.redirectToLogin();
  }
};