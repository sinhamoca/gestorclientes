/* ========================================
   API CLIENT - COMUNICAÇÃO COM BACKEND
   Salvar em: user-system/js/api.js
   
   ATUALIZADO: Funções de Activity Logs
   ======================================== */

const api = {
  // Request genérico
  async request(endpoint, options = {}) {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const encryptionKey = localStorage.getItem('encryption_key'); // 🔐 NOVO
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(encryptionKey && { 'X-Encryption-Key': encryptionKey }), // 🔐 NOVO
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

  // 🔐 ========== ENCRYPTION ==========
  encryption: {
    checkStatus: () => api.request('/encryption/status'),
    setup: () => api.request('/encryption/setup', { method: 'POST' }),
    validate: (encryptionKey) => api.request('/encryption/validate', {
      method: 'POST',
      body: JSON.stringify({ encryptionKey })
    }),
    reset: (confirmReset) => api.request('/encryption/reset', {
      method: 'POST',
      body: JSON.stringify({ confirmReset })
    })
  },

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
    const query = new URLSearchParams({
      ...(params.search && { search: params.search }),
      ...(params.status && { status: params.status }),
      ...(params.page && { page: params.page }),
      ...(params.limit && { limit: params.limit }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
      ...(params.serverId && { serverId: params.serverId }),
      ...(params.planId && { planId: params.planId })
    }).toString();
    return api.request(`/clients${query ? `?${query}` : ''}`);
  },
  getClientStats: () => api.request('/clients/stats'),
  getExpandedClientStats: () => api.request('/clients/stats/expanded'),
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

  // ========== ENVIO IMEDIATO DE LEMBRETES ==========

  // Preview - Quantos clientes serão afetados
  previewSendNow: (reminderIds) => {
    const ids = reminderIds.join(',');
    return api.request(`/reminders/preview-send-now?reminder_ids=${ids}`);
  },

  // Executar envio imediato
  sendRemindersNow: (reminderIds) => api.request('/reminders/send-now', {
    method: 'POST',
    body: JSON.stringify({ reminder_ids: reminderIds })
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

  // 🆕 ROTAS DE PROVIDER SELECTION
  getProviders: () => api.request('/whatsapp/providers'),
  setProvider: (provider) => api.request('/whatsapp/provider', {
    method: 'POST',
    body: JSON.stringify({ provider })
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

  // ========== UNITV CODES ==========
  getUnitvCodes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return api.request(`/unitv/codes?${query}`);
  },
  
  addUnitvCodesBulk: (codes) => api.request('/unitv/codes/bulk', {
    method: 'POST',
    body: JSON.stringify({ codes })
  }),
  
  updateUnitvCodeStatus: (id, status) => api.request(`/unitv/codes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  }),
  
  deleteUnitvCode: (id) => api.request(`/unitv/codes/${id}`, {
    method: 'DELETE'
  }),

  // ========== RENOVAÇÃO DE ASSINATURA ==========
  
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
  getSubscriptionPaymentHistory: () => api.request('/subscription/payment-history'),

  // ========== 📋 ACTIVITY LOGS (NOVO!) ==========
  
  // Buscar logs de atividades com filtros e paginação
  getActivityLogs: (params = {}) => {
    const query = new URLSearchParams({
      ...(params.type && { type: params.type }),
      ...(params.status && { status: params.status }),
      ...(params.page && { page: params.page }),
      ...(params.limit && { limit: params.limit }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate })
    }).toString();
    return api.request(`/activity-logs${query ? `?${query}` : ''}`);
  },
  
  // Buscar estatísticas dos logs (últimos 30 dias)
  getActivityStats: () => api.request('/activity-logs/stats'),
  
  // Limpar logs antigos (admin)
  cleanupActivityLogs: (days = 90) => api.request('/activity-logs/cleanup', {
    method: 'DELETE',
    body: JSON.stringify({ days })
  })
};