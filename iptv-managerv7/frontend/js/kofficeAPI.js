/* ========================================
   KOFFICE API
   Helper para chamadas à API do Koffice
   
   INSTRUÇÕES:
   Adicionar este arquivo em: iptv-managerv5/frontend/js/kofficeAPI.js
   ======================================== */

const kofficeAPI = {
  /**
   * Salvar credencial Koffice
   */
  async saveCredential(domain, username, password, resellerId) {
    const response = await fetch(`${IPTV_API_URL}/koffice/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      },
      body: JSON.stringify({
        domain,
        username,
        password,
        reseller_id: resellerId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao salvar credencial');
    }

    return response.json();
  },

  /**
   * Listar credenciais Koffice
   */
  async listCredentials() {
    const response = await fetch(`${IPTV_API_URL}/koffice/credentials`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar credenciais');
    }

    const data = await response.json();
    return data.credentials || [];
  },

  /**
   * Atualizar credencial Koffice
   */
  async updateCredential(id, username, password, resellerId) {
    const response = await fetch(`${IPTV_API_URL}/koffice/credentials/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      },
      body: JSON.stringify({
        username,
        password,
        reseller_id: resellerId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar credencial');
    }

    return response.json();
  },

  /**
   * Deletar credencial Koffice
   */
  async deleteCredential(id) {
    const response = await fetch(`${IPTV_API_URL}/koffice/credentials/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar credencial');
    }

    return response.json();
  },

  /**
   * Capturar clientes de um domínio Koffice
   */
  async captureClients(domain) {
    const response = await fetch(`${IPTV_API_URL}/koffice/capture-clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      },
      body: JSON.stringify({ domain })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || error.details || 'Erro ao capturar clientes');
    }

    return response.json();
  },

  /**
   * Listar clientes capturados de um domínio
   */
  async listClients(domain) {
    const response = await fetch(`${IPTV_API_URL}/koffice/clients?domain=${encodeURIComponent(domain)}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar clientes');
    }

    return response.json();
  },

  /**
   * Listar domínios com clientes capturados
   */
  async listDomainsWithClients() {
    const response = await fetch(`${IPTV_API_URL}/koffice/domains`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar domínios');
    }

    const data = await response.json();
    return data.domains || [];
  }
};