/* ========================================
   API CLIENT
   ======================================== */

const api = {
  // Helper para fazer requisições
  async request(endpoint, options = {}) {
    const apiKey = getApiKey();
    
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...options.headers
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro na requisição');
    }

    return data;
  },

  // Health check
  health: () => fetch(`${API_URL}/health`).then(r => r.json()),

  // Sessões
  sessions: {
    list: () => api.request('/api/sessions'),
    
    create: (sessionId) => api.request('/api/session/create', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    }),
    
    status: (sessionId) => api.request(`/api/session/status/${sessionId}`),
    
    disconnect: (sessionId) => api.request('/api/session/disconnect', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    }),
    
    delete: (sessionId) => api.request(`/api/session/${sessionId}`, {
      method: 'DELETE'
    })
  },

  // Mensagens
  messages: {
    send: (sessionId, phoneNumber, message) => api.request('/api/message/send', {
      method: 'POST',
      body: JSON.stringify({ sessionId, phoneNumber, message })
    })
  },

  // Validar API Key
  validateKey: async (key) => {
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        headers: { 'x-api-key': key }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
};
