/* ========================================
   API CLIENT - COMUNICAÇÃO COM BACKEND
   ======================================== */

const api = {
  // Request genérico
  async request(endpoint, options = {}) {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    };
    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erro');
    return data;
  },

  // ========== AUTH ==========
  login: (email, password) => api.request('/auth/login', { 
    method: 'POST', 
    body: JSON.stringify({ email, password }) 
  }),
  getMe: () => api.request('/auth/me'),

  // ========== PLANOS ==========
  getPlans: () => api.request('/plans'),
  createPlan: (data) => api.request('/plans', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  updatePlan: (id, data) => api.request(`/plans/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  deletePlan: (id) => api.request(`/plans/${id}`, { 
    method: 'DELETE' 
  }),

  // ========== SERVIDORES ==========
  getServers: () => api.request('/servers'),
  createServer: (data) => api.request('/servers', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  updateServer: (id, data) => api.request(`/servers/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  deleteServer: (id) => api.request(`/servers/${id}`, { 
    method: 'DELETE' 
  }),

  // ========== CLIENTES ==========
  getClients: (params) => {
    const query = new URLSearchParams(params).toString();
    return api.request(`/clients?${query}`);
  },
  getClientStats: () => api.request('/clients/stats'),
  createClient: (data) => api.request('/clients', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  updateClient: (id, data) => api.request(`/clients/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  deleteClient: (id) => api.request(`/clients/${id}`, { 
    method: 'DELETE' 
  }),
  renewClient: (id) => api.request(`/clients/${id}/renew`, {
    method: 'POST'
  }),

  // ========== TEMPLATES ==========
  getTemplates: () => api.request('/templates'),
  createTemplate: (data) => api.request('/templates', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  updateTemplate: (id, data) => api.request(`/templates/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  deleteTemplate: (id) => api.request(`/templates/${id}`, { 
    method: 'DELETE' 
  }),
  previewTemplate: (id, clientId) => api.request(
    `/templates/${id}/preview${clientId ? `?client_id=${clientId}` : ''}`
  ),

  // ========== LEMBRETES ==========
  getReminders: () => api.request('/reminders'),
  createReminder: (data) => api.request('/reminders', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }),
  updateReminder: (id, data) => api.request(`/reminders/${id}`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  }),
  deleteReminder: (id) => api.request(`/reminders/${id}`, { 
    method: 'DELETE' 
  }),

  // ========== WHATSAPP / EVOLUTION API ==========
  connectWhatsApp: () => api.request('/whatsapp/connect', { 
    method: 'POST' 
  }),
  getQRCode: () => api.request('/whatsapp/qrcode'),
  checkWhatsAppStatus: () => api.request('/whatsapp/status'),
  disconnectWhatsApp: () => api.request('/whatsapp/disconnect', { 
    method: 'POST' 
  }),
  deleteWhatsAppInstance: () => api.request('/whatsapp/instance', { 
    method: 'DELETE' 
  })
};
