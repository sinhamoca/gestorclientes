/* ========================================
   SIGMA API - Frontend
   Funções para interagir com API Sigma
   ATUALIZADO: Adicionadas funções de verificação de conflitos
   ======================================== */

const sigmaAPI = {
  /**
   * Salvar credencial Sigma
   */
  async saveCredential(domain, username, password) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/credentials`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, username, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar credencial');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao salvar credencial:', error);
      throw error;
    }
  },

  /**
   * Listar credenciais Sigma
   */
  async listCredentials() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/credentials`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao listar credenciais');
      }

      return data.credentials || [];
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao listar credenciais:', error);
      throw error;
    }
  },

  /**
   * Deletar credencial Sigma
   */
  async deleteCredential(domain) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/credentials/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao deletar credencial');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao deletar credencial:', error);
      throw error;
    }
  },

  /**
   * Buscar pacotes de um domínio (usa proxy)
   */
  async fetchPackages(domain) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/fetch-packages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar pacotes');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao buscar pacotes:', error);
      throw error;
    }
  },

  /**
   * Listar pacotes de um domínio (do cache local)
   */
  async listPackages(domain) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/packages?domain=${encodeURIComponent(domain)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao listar pacotes');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao listar pacotes:', error);
      throw error;
    }
  },

  /**
   * Listar domínios com pacotes
   */
  async listDomains() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/domains`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao listar domínios');
      }

      return data.domains || [];
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao listar domínios:', error);
      throw error;
    }
  },

  // ========== NOVAS FUNÇÕES - VERIFICAÇÃO DE CONFLITOS ==========

  /**
   * Verificar conflitos antes de sincronizar
   * NOVA FUNÇÃO
   */
  async checkSyncConflicts(domain, packageIds) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/sync/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: domain,
          package_ids: packageIds
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao verificar conflitos');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao verificar conflitos:', error);
      throw error;
    }
  },

  /**
   * Sincronizar pacotes com resoluções definidas
   * FUNÇÃO ATUALIZADA
   */
  async syncPackagesWithResolutions(domain, packageIds, resolutions) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          domain: domain,
          package_ids: packageIds,
          resolutions: resolutions
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao sincronizar pacotes');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao sincronizar pacotes:', error);
      throw error;
    }
  },

  /**
   * Sincronizar pacotes (versão antiga - mantida para compatibilidade)
   * Recomendado usar syncPackagesWithResolutions()
   */
  async syncPackages(domain, packageIds) {
    return this.syncPackagesWithResolutions(domain, packageIds, null);
  },

  // ========== FUNÇÕES DE CLIENTES ==========

  /**
   * Capturar clientes do Sigma
   */
  async captureClients(domain) {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/capture-clients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao capturar clientes');
      }

      return data;
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao capturar clientes:', error);
      throw error;
    }
  },

  /**
   * Listar clientes do Sigma
   */
  async listClients(domain) {
    const token = auth.getToken();
    
    try {
      const url = domain 
        ? `${IPTV_API_URL}/sigma/clients?domain=${encodeURIComponent(domain)}`
        : `${IPTV_API_URL}/sigma/clients`;

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
      console.error('❌ [SIGMA] Erro ao listar clientes:', error);
      throw error;
    }
  },

  /**
   * Listar domínios com clientes
   */
  async listDomainsWithClients() {
    const token = auth.getToken();
    
    try {
      const response = await fetch(`${IPTV_API_URL}/sigma/domains-with-clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao listar domínios');
      }

      return data.domains || [];
    } catch (error) {
      console.error('❌ [SIGMA] Erro ao listar domínios:', error);
      throw error;
    }
  }
};