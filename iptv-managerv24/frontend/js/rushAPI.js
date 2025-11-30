/* ========================================
   RUSH API
   Helper para chamadas à API do Rush
   
   ARQUIVO: frontend/js/rushAPI.js
   ======================================== */

const rushAPI = {
  /**
   * Buscar credenciais Rush do usuário
   * GET /api/rush/credentials
   */
  async getCredentials() {
    const response = await fetch(`${IPTV_API_URL}/rush/credentials`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar credenciais');
    }

    return response.json();
  },

  /**
   * Salvar credencial Rush
   * POST /api/rush/credentials
   */
  async saveCredential(username, password) {
    const response = await fetch(`${IPTV_API_URL}/rush/credentials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao salvar credencial');
    }

    return response.json();
  },

  /**
   * Atualizar credencial Rush
   * PUT /api/rush/credentials
   */
  async updateCredential(username, password) {
    const response = await fetch(`${IPTV_API_URL}/rush/credentials`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar credencial');
    }

    return response.json();
  },

  /**
   * Deletar credencial Rush
   * DELETE /api/rush/credentials
   */
  async deleteCredential() {
    const response = await fetch(`${IPTV_API_URL}/rush/credentials`, {
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
   * Testar conexão com as credenciais
   * POST /api/rush/test-connection
   */
  async testConnection() {
    const response = await fetch(`${IPTV_API_URL}/rush/test-connection`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao testar conexão');
    }

    return response.json();
  }
};
