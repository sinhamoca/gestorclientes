/* ========================================
   API - CLIENTES (PostgreSQL)
   Funções para buscar clientes do sistema principal
   COM SUPORTE A SIGMA
   ======================================== */

const api = {
  /**
   * Listar clientes do PostgreSQL (sistema principal)
   */
  async listClients() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/clients`, {
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
      console.error('❌ [API] Erro ao listar clientes:', error);
      throw error;
    }
  },

  /**
   * Sincronizar cliente com CloudNation
   */
  async syncClient(clientId, cloudnationId) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/clients/${clientId}/sync`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cloudnation_id: cloudnationId })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar cliente');
      }

      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao sincronizar cliente:', error);
      throw error;
    }
  },

  /**
   * Sincronizar cliente com Sigma (NOVO!)
   */
  async syncClientWithSigma(clientId, sigmaIdInterno, domain) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/clients/${clientId}/sync-sigma`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          sigma_id_interno: sigmaIdInterno,
          domain: domain
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar cliente com Sigma');
      }

      return data;
    } catch (error) {
      console.error('❌ [API] Erro ao sincronizar cliente com Sigma:', error);
      throw error;
    }
  }
};