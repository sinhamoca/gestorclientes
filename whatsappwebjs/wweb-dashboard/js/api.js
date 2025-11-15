/* ========================================
   API HELPER
   ======================================== */

const api = {
  // Health check
  async health() {
    const response = await fetch(`${API_URL}/health`);
    return response.json();
  },

  // Criar sessão
  async createSession(sessionId) {
    const response = await fetch(`${API_URL}/api/session/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey()
      },
      body: JSON.stringify({ sessionId })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar sessão');
    }
    
    return response.json();
  },

  // Obter status da sessão
  async getSessionStatus(sessionId) {
    const response = await fetch(`${API_URL}/api/session/status/${sessionId}`, {
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao obter status');
    }
    
    return response.json();
  },

  // Obter QR Code
  async getQRCode(sessionId) {
    const response = await fetch(`${API_URL}/api/session/qr/${sessionId}`, {
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'QR Code não disponível');
    }
    
    return response.json();
  },

  // Desconectar sessão
  async disconnectSession(sessionId) {
    const response = await fetch(`${API_URL}/api/session/disconnect/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao desconectar');
    }
    
    return response.json();
  },

  // Listar sessões
  async listSessions() {
    const response = await fetch(`${API_URL}/api/session/list`, {
      headers: {
        'X-API-Key': getApiKey()
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao listar sessões');
    }
    
    return response.json();
  },

  // Enviar mensagem
  async sendMessage(sessionId, to, message) {
    const response = await fetch(`${API_URL}/api/message/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': getApiKey()
      },
      body: JSON.stringify({ sessionId, to, message })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao enviar mensagem');
    }
    
    return response.json();
  }
};
