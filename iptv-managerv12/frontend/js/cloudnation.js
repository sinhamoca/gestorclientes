/* ========================================
   CLOUDNATION - GERENCIAMENTO
   Funções para credenciais e importação
   ======================================== */

const cloudnation = {
  /**
   * Salvar credenciais
   */
  async saveCredentials(username, password) {
    const token = auth.getToken();
    
    console.log('📤 [CN] Enviando:', { username, password: '***' });
    
    try {
      const response = await fetch(`${IPTV_API_URL}/cloudnation/credentials`, {
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
      console.error('❌ [CN] Erro ao salvar credenciais:', error);
      throw error;
    }
  },

  /**
   * Buscar credenciais
   */
  async getCredentials() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/cloudnation/credentials`, {
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
      console.error('❌ [CN] Erro ao buscar credenciais:', error);
      throw error;
    }
  },

  /**
   * Importar clientes
   */
  async importClients() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/cloudnation/import-clients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao importar clientes');
      }

      return data;
    } catch (error) {
      console.error('❌ [CN] Erro ao importar clientes:', error);
      throw error;
    }
  },

  /**
   * Listar clientes importados
   */
  async listClients(activeOnly = false) {
    const token = auth.getToken();
    
    try {
      const url = `${IPTV_API_URL}/cloudnation/clients${activeOnly ? '?activeOnly=true' : ''}`;
      
      const response = await fetch(url, {
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
      console.error('❌ [CN] Erro ao listar clientes:', error);
      throw error;
    }
  }
};
