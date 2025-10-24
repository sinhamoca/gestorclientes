/* ========================================
   API CLIENT - COMUNICAÇÃO COM BACKEND
   Salvar em: user-system/js/api.js
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
  renewClient: (id, data) => api.request(`/clients/${id}/renew`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getClientInvoices: (id) => api.request(`/clients/${id}/invoices`),

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
  }),

  // ========== FINANCEIRO ==========
  getFinancialDashboard: () => api.request('/financial/dashboard'),
  registerPayment: (data) => api.request('/financial/payment', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getTransactions: (params) => {
    const query = new URLSearchParams(params).toString();
    return api.request(`/financial/transactions?${query}`);
  },

  // ========== PAYMENT SETTINGS / MERCADO PAGO ==========
  getPaymentSettings: () => api.request('/payment-settings'),
  
  testMercadoPagoCredentials: (data) => api.request('/payment-settings/test', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  savePaymentSettings: (data) => api.request('/payment-settings', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  toggleMercadoPago: (enabled) => api.request('/payment-settings/toggle', {
    method: 'PATCH',
    body: JSON.stringify({ enabled })
  }),
  
  deletePaymentSettings: () => api.request('/payment-settings', {
    method: 'DELETE'
  }),

  // ========== RENOVAÇÃO DE ASSINATURA (NOVO!) ==========
  
  // Buscar informações da assinatura do usuário
  getSubscriptionInfo: () => api.request('/subscription/info'),
  
  // Criar pagamento PIX para renovação
  createSubscriptionPayment: () => api.request('/subscription/create-payment', {
    method: 'POST'
  }),
  
  // Verificar status do pagamento
  checkSubscriptionPaymentStatus: (paymentId) => 
    api.request(`/subscription/check-status/${paymentId}`),
  
  // Buscar histórico de pagamentos de renovação
  getSubscriptionPaymentHistory: () => api.request('/subscription/payment-history')
};