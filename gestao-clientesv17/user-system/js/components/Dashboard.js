/* ========================================
   DASHBOARD COMPONENT - VERSÃO GRADIENT BOLD
   Header: 5 principais + dropdown | Tabela: dropdown
   TEMA: Dark Mode com Gradientes e Neon
   ======================================== */

function Dashboard({ user, onLogout }) {
  const { useState, useEffect } = React;
  
  // States
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [servers, setServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const DateRangeFilter = window.DateRangeFilter;
  const [serverFilter, setServerFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [showModal, setShowModal] = useState(null);
  const [clientToRenew, setClientToRenew] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [invoiceClient, setInvoiceClient] = useState(null);
  const [showMercadoPagoModal, setShowMercadoPagoModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const RenewalModal = window.RenewalModal;
  const Pagination = window.Pagination;

  // Inicializar ícones Lucide após cada renderização
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  });

  useEffect(() => {
    loadData();
  }, [search, statusFilter, currentPage, startDate, endDate, serverFilter, planFilter]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleServerFilterChange = (value) => {
    setServerFilter(value);
    setCurrentPage(1);
  };

  const handlePlanFilterChange = (value) => {
    setPlanFilter(value);
    setCurrentPage(1);
  };

  const handleDateChange = (type, value) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
    setCurrentPage(1);
  };

  const handleClearDateFilter = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const handleCopyInvoice = async (client) => {
    const invoiceUrl = `https://pagamentos.comprarecarga.shop/pay/${client.payment_token}`;
    
    try {
      await navigator.clipboard.writeText(invoiceUrl);
      alert(`✅ Link da fatura copiado!\n\n${client.name}\n${invoiceUrl}`);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = invoiceUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert(`✅ Link da fatura copiado!\n\n${client.name}\n${invoiceUrl}`);
    }
  };

  const loadData = async () => {
    try {
      const [clientsData, statsData, plansData, serversData, templatesData, remindersData] = await Promise.all([
        api.getClients({ search, status: statusFilter, startDate, endDate, serverId: serverFilter, planId: planFilter, page: currentPage, limit: 20 }),
        api.getExpandedClientStats(),
        api.getPlans(),
        api.getServers(),
        api.getTemplates(),
        api.getReminders()
      ]);
      
      setClients(clientsData.clients || clientsData);
      setPagination(clientsData.pagination || null);
      setStats(statsData);
      setPlans(plansData);
      setServers(serversData);
      setTemplates(templatesData);
      setReminders(remindersData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!confirm('Excluir este cliente?')) return;
    try {
      await api.deleteClient(id);
      loadData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleRenewClient = (client) => {
    setClientToRenew(client);
  };

  const getStatusBadge = (client) => {
    if (!client.is_active) return React.createElement('span', {className: 'badge-neon bg-gray-500/20 text-gray-400 neon-border border-gray-500'}, 'Inativo');
    if (client.is_expired) return React.createElement('span', {className: 'badge-neon bg-red-500/20 text-red-400 neon-border border-red-500'}, 'Vencido');
    if (client.days_until_due <= 7) return React.createElement('span', {className: 'badge-neon bg-yellow-500/20 text-yellow-400 neon-border border-yellow-500'}, `Vence em ${client.days_until_due}d`);
    return React.createElement('span', {className: 'badge-neon bg-green-500/20 text-green-400 neon-border border-green-500'}, 'Ativo');
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Background animated lines */}
      <div className="bg-lines"></div>

      {/* ==================== HEADER OTIMIZADO ==================== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-5">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold gradient-text">Sistema de Gestão</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm text-slate-400 font-medium">{user.name}</p>
                {user.subscription_end && (
                  <>
                    <span className="text-slate-600">•</span>
                    <div className="flex items-center gap-2">
                      <i data-lucide="calendar" className="w-3 h-3 text-slate-400"></i>
                      <span className="text-sm text-slate-400 font-medium">
                        Vence: {new Date(user.subscription_end).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Botões de Ação - Otimizados */}
            <div className="flex flex-wrap gap-2 md:gap-3">
              {/* 1. Financeiro */}
              <button 
                onClick={() => setShowModal('financial')} 
                className="nav-btn flex items-center gap-2 text-xs md:text-sm"
              >
                <i data-lucide="dollar-sign" className="w-4 h-4"></i>
                <span className="hidden md:inline">Financeiro</span>
              </button>
              
              {/* 2. IPTV */}
              <button 
                onClick={() => {
                  const token = localStorage.getItem('user_token');
                  window.open(`https://iptv.comprarecarga.shop?token=${token}`, '_blank');
                }}
                className="nav-btn flex items-center gap-2 text-xs md:text-sm"
              >
                <i data-lucide="tv" className="w-4 h-4"></i>
                <span className="hidden md:inline">IPTV</span>
              </button>
              
              {/* 3. Pagamentos */}
              <button 
                onClick={() => setShowMercadoPagoModal(true)} 
                className="nav-btn flex items-center gap-2 text-xs md:text-sm"
              >
                <i data-lucide="credit-card" className="w-4 h-4"></i>
                <span className="hidden md:inline">Pagamentos</span>
              </button>
              
              {/* 4. Renovar Assinatura */}
              <button 
                onClick={() => setShowRenewalModal(true)} 
                className="nav-btn flex items-center gap-2 text-xs md:text-sm"
              >
                <i data-lucide="refresh-cw" className="w-4 h-4"></i>
                <span className="hidden md:inline">Renovar</span>
              </button>
              
              {/* 5. WhatsApp */}
              <button 
                onClick={() => setShowModal('whatsapp')} 
                className="nav-btn flex items-center gap-2 text-xs md:text-sm"
              >
                <i data-lucide="message-circle" className="w-4 h-4"></i>
                <span className="hidden md:inline">WhatsApp</span>
              </button>
              
              {/* Dropdown - Opções Secundárias */}
              <div className="relative">
                <button
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="nav-btn flex items-center gap-2 text-xs md:text-sm"
                  title="Mais opções"
                >
                  <i data-lucide="menu" className="w-4 h-4"></i>
                  <span className="hidden md:inline">Mais</span>
                </button>
                
                {/* Dropdown Menu - Abre à ESQUERDA no mobile, à DIREITA no desktop */}
                {showMobileMenu && (
                  <>
                    {/* Backdrop para fechar ao clicar fora */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowMobileMenu(false)}
                    ></div>
                    
                    <div className="absolute left-0 md:right-0 md:left-auto top-full mt-2 w-56 bg-slate-800 rounded-lg shadow-lg border border-slate-700 z-20">
                      {/* Planos */}
                      <button
                        onClick={() => { setShowModal('plans'); setShowMobileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-300 first:rounded-t-lg transition"
                      >
                        <i data-lucide="file-text" className="w-4 h-4 text-slate-400"></i>
                        <span>Gerenciar Planos</span>
                      </button>
                      
                      {/* Servidores */}
                      <button
                        onClick={() => { setShowModal('servers'); setShowMobileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-300 transition"
                      >
                        <i data-lucide="server" className="w-4 h-4 text-slate-400"></i>
                        <span>Gerenciar Servidores</span>
                      </button>
                      
                      {/* Templates */}
                      <button
                        onClick={() => { setShowModal('templates'); setShowMobileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-300 transition"
                      >
                        <i data-lucide="message-square" className="w-4 h-4 text-blue-400"></i>
                        <span>Templates de Mensagens</span>
                      </button>
                      
                      {/* Lembretes */}
                      <button
                        onClick={() => { setShowModal('reminders'); setShowMobileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-300 transition"
                      >
                        <i data-lucide="bell" className="w-4 h-4 text-green-400"></i>
                        <span>Configurar Lembretes</span>
                      </button>
                      
                      {/* Divisor */}
                      <div className="border-t border-slate-700"></div>
                      
                      {/* Sair */}
                      <button
                        onClick={() => { onLogout(); setShowMobileMenu(false); }}
                        className="w-full px-4 py-3 text-left hover:bg-red-900/30 flex items-center gap-3 text-sm text-red-400 last:rounded-b-lg transition"
                      >
                        <i data-lucide="log-out" className="w-4 h-4"></i>
                        <span>Sair do Sistema</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 md:px-6 py-6 md:py-10 relative z-10">
        {/* Cards de Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 md:gap-6 mb-6 md:mb-10">
            {/* Total */}
            <div className="gradient-card-1 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="users" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stats.total}</div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">Total</div>
              </div>
            </div>

            {/* Ativos */}
            <div className="gradient-card-2 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="check-circle" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stats.active}</div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">Ativos</div>
              </div>
            </div>

            {/* Vencidos */}
            <div className="gradient-card-3 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="x-circle" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stats.expired}</div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">Vencidos</div>
              </div>
            </div>

            {/* Total Recebido no Ano */}
            <div className="gradient-card-2 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="trending-up" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-black text-white mb-1">
                  R$ {(stats.total_received_year || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">Recebido Ano</div>
              </div>
            </div>

            {/* Total Recebido no Mês */}
            <div className="gradient-card-1 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="calendar-check" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-2xl md:text-3xl font-black text-white mb-1">
                  R$ {(stats.total_received_month || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">Recebido Mês</div>
              </div>
            </div>

            {/* Vencidos +30 dias */}
            <div className="gradient-card-4 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="alert-circle" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stats.expired_30_days || 0}</div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">+30 Dias</div>
              </div>
            </div>

            {/* Vencidos +60 dias */}
            <div className="gradient-card-3 stat-card-hover">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="alert-triangle" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stats.expired_60_days || 0}</div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">+60 Dias</div>
              </div>
            </div>

            {/* Vencidos +90 dias - coluna inteira no mobile */}
            <div className="gradient-card-3 stat-card-hover col-span-2 md:col-span-1">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <div className="p-2 md:p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <i data-lucide="alert-octagon" className="w-5 h-5 md:w-6 md:h-6 text-white"></i>
                  </div>
                </div>
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{stats.expired_90_days || 0}</div>
                <div className="text-xs md:text-sm font-bold text-white/90 uppercase tracking-wider">+90 Dias</div>
              </div>
            </div>
          </div>
        )}

        {/* Filtros e Busca */}
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-4 md:p-6 mb-4 md:mb-6 border border-slate-700">
          <div className="flex flex-col gap-3 md:gap-4">
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <div className="flex-1 relative">
                <i data-lucide="search" className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 transform -translate-y-1/2"></i>
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="input-dark w-full pl-12"
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="input-dark"
              >
                <option value="">Todos os Status</option>
                <option value="active">Ativo</option>
                <option value="expired">Vencido</option>
                <option value="expiring_soon">Vence em 7d</option>
              </select>
              
              <select
                value={serverFilter}
                onChange={(e) => handleServerFilterChange(e.target.value)}
                className="input-dark"
              >
                <option value="">Todos os Servidores</option>
                {servers.map(server => (
                  <option key={server.id} value={server.id}>{server.name}</option>
                ))}
              </select>
              
              <select
                value={planFilter}
                onChange={(e) => handlePlanFilterChange(e.target.value)}
                className="input-dark"
              >
                <option value="">Todos os Planos</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>
            </div>

            {startDate || endDate ? (
              <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onDateChange={handleDateChange}
                onClear={handleClearDateFilter}
              />
            ) : null}

            <div className="flex justify-end">
              <button
                onClick={() => { setEditingClient(null); setShowModal('client'); }}
                className="btn-gradient flex items-center gap-2 text-sm md:text-base"
              >
                <i data-lucide="plus-circle" className="w-4 h-4 md:w-5 md:h-5"></i>
                Novo Cliente
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="bg-slate-800/30 backdrop-blur-xl rounded-2xl overflow-hidden p-3 md:p-4 border border-slate-700">
          <div className="overflow-x-auto">
            <table className="table-dark w-full">
              <thead>
                <tr>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Cliente</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Plano</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Vencimento</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-left text-xs font-bold text-slate-300 uppercase tracking-wider">Status</th>
                  <th className="px-4 md:px-6 py-3 md:py-4 text-right text-xs font-bold text-slate-300 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-400">
                      <div className="loader mx-auto mb-4"></div>
                      Carregando...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-400">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                ) : (
                  clients.map(client => (
                    <tr key={client.id}>
                      <td className="px-4 md:px-6 py-4 md:py-5">
                        <div>
                          <div className="font-bold text-white text-sm md:text-base">{client.name}</div>
                          <div className="text-xs md:text-sm text-slate-400">{client.whatsapp_number || client.phone}</div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-5">
                        <span className="text-slate-300 font-semibold">{client.plan_name}</span>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-5">
                        <div className="flex items-center gap-2">
                          <i data-lucide="calendar" className="w-3 h-3 md:w-4 md:h-4 text-slate-400"></i>
                          <span className="text-slate-300 font-semibold text-xs md:text-sm">{new Date(client.due_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-5">
                        {getStatusBadge(client)}
                      </td>
                      <td className="px-4 md:px-6 py-4 md:py-5">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setEditingClient(client); setShowModal('client'); }}
                            className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-xs md:text-sm font-bold shadow-lg"
                            title="Editar cliente"
                          >
                            <i data-lucide="edit" className="w-3 h-3 md:w-4 md:h-4"></i>
                            <span className="hidden md:inline">Editar</span>
                          </button>
                          
                          <button
                            onClick={() => handleRenewClient(client)}
                            className="px-3 md:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-xs md:text-sm font-bold shadow-lg"
                            title="Renovar cliente"
                          >
                            <i data-lucide="refresh-cw" className="w-3 h-3 md:w-4 md:h-4"></i>
                            <span className="hidden md:inline">Renovar</span>
                          </button>

                          <button
                            onClick={() => {
                              const phone = client.whatsapp_number || client.phone;
                              if (phone) {
                                // Remove todos os caracteres não numéricos
                                const cleanPhone = phone.replace(/\D/g, '');
                                // Abre WhatsApp em nova aba
                                window.open(`https://wa.me/${cleanPhone}`, '_blank');
                              } else {
                                alert('❌ Cliente não possui número de WhatsApp cadastrado');
                              }
                            }}
                            className="px-3 md:px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-2 text-xs md:text-sm font-bold shadow-lg"
                            title="Abrir WhatsApp"
                          >
                            <i data-lucide="message-circle" className="w-3 h-3 md:w-4 md:h-4"></i>
                            <span className="hidden md:inline">WhatsApp</span>
                          </button>
                          
                          <div className="relative group">
                            <button
                              className="px-2 md:px-3 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition shadow-lg"
                              title="Mais ações"
                            >
                              <i data-lucide="more-vertical" className="w-3 h-3 md:w-4 md:h-4"></i>
                            </button>
                            
                            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 rounded-lg shadow-lg border border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                              <button
                                onClick={() => handleCopyInvoice(client)}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-300 first:rounded-t-lg transition"
                              >
                                <i data-lucide="credit-card" className="w-4 h-4 text-purple-400"></i>
                                <span>Copiar Fatura</span>
                              </button>
                              
                              <button
                                onClick={() => setInvoiceClient(client)}
                                className="w-full px-4 py-2.5 text-left hover:bg-slate-700 flex items-center gap-3 text-sm text-slate-300 transition"
                              >
                                <i data-lucide="file-text" className="w-4 h-4 text-orange-400"></i>
                                <span>Histórico Faturas</span>
                              </button>
                              
                              <div className="border-t border-slate-700"></div>
                              
                              <button
                                onClick={() => handleDeleteClient(client.id)}
                                className="w-full px-4 py-2.5 text-left hover:bg-red-900/30 flex items-center gap-3 text-sm text-red-400 last:rounded-b-lg transition"
                              >
                                <i data-lucide="trash-2" className="w-4 h-4"></i>
                                <span>Excluir Cliente</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {pagination && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </main>

      {/* Modais */}
      {showModal === 'client' && (
        <ClientModal
          client={editingClient}
          onClose={() => { setShowModal(null); setEditingClient(null); }}
          onSave={loadData}
          plans={plans}
          servers={servers}
        />
      )}
      {showModal === 'plans' && (
        <PlansModal
          plans={plans}
          onClose={() => setShowModal(null)}
          onRefresh={loadData}
        />
      )}
      {showModal === 'servers' && (
        <ServersModal
          servers={servers}
          onClose={() => setShowModal(null)}
          onRefresh={loadData}
        />
      )}
      {showModal === 'templates' && (
        <TemplatesModal
          templates={templates}
          onClose={() => setShowModal(null)}
          onRefresh={loadData}
        />
      )}
      {showModal === 'reminders' && (
        <RemindersModal
          reminders={reminders}
          templates={templates}
          onClose={() => setShowModal(null)}
          onRefresh={loadData}
        />
      )}
      {showModal === 'financial' && (
        <FinancialDashboard onClose={() => setShowModal(null)} />
      )}
      {showModal === 'whatsapp' && (
        <WhatsAppModal onClose={() => setShowModal(null)} />
      )}
      {invoiceClient && (
        <InvoicesModal
          client={invoiceClient}
          onClose={() => setInvoiceClient(null)}
        />
      )}
      {showMercadoPagoModal && (
        <MercadoPagoModal 
          onClose={() => setShowMercadoPagoModal(false)}
          onSuccess={() => setShowMercadoPagoModal(false)}
        />
      )}
      {showRenewalModal && (
        <SubscriptionRenewalModal 
          user={user}
          onClose={() => setShowRenewalModal(false)}
          onRenewalSuccess={() => {
            setShowRenewalModal(false);
            loadData();
          }}
        />
      )}
      {clientToRenew && (
        <RenewalModal
          client={clientToRenew}
          onClose={() => setClientToRenew(null)}
          onSuccess={() => {
            loadData();
            setClientToRenew(null);
          }}
        />
      )}
    </div>
  );
}

window.Dashboard = Dashboard;