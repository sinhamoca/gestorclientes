/* ========================================
   CLUB API - FRONTEND
   Funções para interagir com API Club
   ======================================== */

const club = {
  /**
   * Salvar credenciais
   */
  async saveCredentials(username, password) {
    const token = auth.getToken();
    
    console.log('📤 [CLUB] Enviando credenciais:', { username, password: '***' });
    
    try {
      const response = await fetch(`${IPTV_API_URL}/club/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar credenciais');
      }

      return data;
    } catch (error) {
      console.error('❌ [CLUB] Erro ao salvar credenciais:', error);
      throw error;
    }
  },

  /**
   * Buscar credenciais
   */
  async getCredentials() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/club/credentials`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar credenciais');
      }

      return data;
    } catch (error) {
      console.error('❌ [CLUB] Erro ao buscar credenciais:', error);
      throw error;
    }
  },

  /**
   * Capturar clientes
   */
  async captureClients() {
    const token = auth.getToken();
    
    console.log('📥 [CLUB] Iniciando captura de clientes...');
    
    try {
      const response = await fetch(`${IPTV_API_URL}/club/capture-clients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao capturar clientes');
      }

      return data;
    } catch (error) {
      console.error('❌ [CLUB] Erro ao capturar clientes:', error);
      throw error;
    }
  },

  /**
   * Listar clientes capturados
   */
  async listClients() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/club/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao listar clientes');
      }

      return data;
    } catch (error) {
      console.error('❌ [CLUB] Erro ao listar clientes:', error);
      throw error;
    }
  }
};