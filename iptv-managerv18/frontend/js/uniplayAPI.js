/* ========================================
   UNIPLAY API
   Helper para chamadas à API do Uniplay
   
   ARQUIVO: iptv-managerv8/frontend/js/uniplayAPI.js
   ======================================== */

const uniplayAPI = {
  /**
   * Buscar credenciais Uniplay do usuário
   * GET /api/uniplay/credentials
   */
  async getCredentials() {
    const response = await fetch(`${IPTV_API_URL}/uniplay/credentials`, {
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
   * Salvar credencial Uniplay
   * POST /api/uniplay/credentials
   */
  async saveCredential(username, password) {
    const response = await fetch(`${IPTV_API_URL}/uniplay/credentials`, {
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
   * Atualizar credencial Uniplay
   * PUT /api/uniplay/credentials
   */
  async updateCredential(username, password) {
    const response = await fetch(`${IPTV_API_URL}/uniplay/credentials`, {
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
   * Deletar credencial Uniplay
   * DELETE /api/uniplay/credentials
   */
  async deleteCredential() {
    const response = await fetch(`${IPTV_API_URL}/uniplay/credentials`, {
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
  }
};
