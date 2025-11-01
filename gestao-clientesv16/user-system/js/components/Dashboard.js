/* ========================================
   DASHBOARD COMPONENT - VERSÃO FINAL OTIMIZADA
   Header: 5 principais + dropdown | Tabela: dropdown
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
        api.getClientStats(),
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
    if (!client.is_active) return React.createElement('span', {className: 'px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs'}, 'Inativo');
    if (client.is_expired) return React.createElement('span', {className: 'px-2 py-1 bg-red-200 text-red-700 rounded text-xs'}, 'Vencido');
    if (client.days_until_due <= 7) return React.createElement('span', {className: 'px-2 py-1 bg-yellow-200 text-yellow-700 rounded text-xs'}, `Vence em ${client.days_until_due}d`);
    return React.createElement('span', {className: 'px-2 py-1 bg-green-200 text-green-700 rounded text-xs'}, 'Ativo');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ==================== HEADER OTIMIZADO ==================== */}
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold text-gray-800">{user.name}</h1>
            
            {/* Botões de Ação - Otimizados */}
            <div className="flex flex-wrap gap-2">
              {/* 1. Financeiro */}
              <button 
                onClick={() => setShowModal('financial')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold whitespace-nowrap flex items-center gap-2 shadow-sm"
              >
                <i data-lucide="dollar-sign" className="w-4 h-4"></i>
                <span className="hidden md:inline">Financeiro</span>
              </button>
              
              {/* 2. Renovação IPTV */}
              <button
                onClick={() => {
                  const token = localStorage.getItem('user_token');
                  window.open(`https://iptv.comprarecarga.shop?token=${token}`, '_blank');
                }}
                className="px-3 md:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2 text-xs md:text-sm font-semibold shadow-sm"
              >
                <i data-lucide="tv" className="w-4 h-4"></i>
                <span className="hidden md:inline">IPTV</span>
              </button>
              
              {/* 3. Pagamentos */}
              <button 
                onClick={() => setShowMercadoPagoModal(true)} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg whitespace-nowrap flex items-center gap-2 font-semibold shadow-sm"
              >
                <i data-lucide="credit-card" className="w-4 h-4"></i>
                <span className="hidden md:inline">Pagamentos</span>
              </button>
              
              {/* 4. Renovar Assinatura */}
              <button 
                onClick={() => setShowRenewalModal(true)} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold shadow-sm whitespace-nowrap flex items-center gap-2"
              >
                <i data-lucide="refresh-cw" className="w-4 h-4"></i>
                <span className="hidden md:inline">Renovar</span>
              </button>
              
              {/* 5. WhatsApp */}
              <button 
                onClick={() => setShowModal('whatsapp')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold whitespace-nowrap flex items-center gap-2 shadow-sm"
              >
                <i data-lucide="message-circle" className="w-4 h-4"></i>
                <span className="hidden md:inline">WhatsApp</span>
              </button>
              
              {/* Dropdown - Opções Secundárias */}
              <div className="relative group">
                <button
                  className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold whitespace-nowrap flex items-center gap-2 shadow-sm"
                  title="Mais opções"
                >
                  <i data-lucide="menu" className="w-4 h-4"></i>
                  <span className="hidden md:inline">Mais</span>
                </button>
                
                {/* Dropdown Menu */}
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-20">
                  {/* Planos */}
                  <button
                    onClick={() => setShowModal('plans')}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 first:rounded-t-lg transition"
                  >
                    <i data-lucide="file-text" className="w-4 h-4 text-gray-600"></i>
                    <span>Gerenciar Planos</span>
                  </button>
                  
                  {/* Servidores */}
                  <button
                    onClick={() => setShowModal('servers')}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700 transition"
                  >
                    <i data-lucide="server" className="w-4 h-4 text-gray-600"></i>
                    <span>Gerenciar Servidores</span>
                  </button>
                  
                  {/* Templates */}
                  <button
                    onClick={() => setShowModal('templates')}
                    className="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center gap-3 text-sm text-gray-700 transition"
                  >
                    <i data-lucide="message-square" className="w-4 h-4 text-blue-600"></i>
                    <span>Templates de Mensagens</span>
                  </button>
                  
                  {/* Lembretes */}
                  <button
                    onClick={() => setShowModal('reminders')}
                    className="w-full px-4 py-3 text-left hover:bg-green-50 flex items-center gap-3 text-sm text-gray-700 transition"
                  >
                    <i data-lucide="bell" className="w-4 h-4 text-green-600"></i>
                    <span>Configurar Lembretes</span>
                  </button>
                  
                  {/* Divisor */}
                  <div className="border-t border-gray-200"></div>
                  
                  {/* Sair */}
                  <button
                    onClick={onLogout}
                    className="w-full px-4 py-3 text-left hover:bg-red-50 flex items-center gap-3 text-sm text-red-600 last:rounded-b-lg transition"
                  >
                    <i data-lucide="log-out" className="w-4 h-4"></i>
                    <span>Sair do Sistema</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {/* Cards de Estatísticas */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <div className="text-xl md:text-2xl font-bold text-blue-600">{stats.total}</div>
              <div className="text-xs md:text-sm text-gray-600">Total</div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <div className="text-xl md:text-2xl font-bold text-green-600">{stats.active}</div>
              <div className="text-xs md:text-sm text-gray-600">Ativos</div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <div className="text-xl md:text-2xl font-bold text-red-600">{stats.expired}</div>
              <div className="text-xs md:text-sm text-gray-600">Vencidos</div>
            </div>
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <div className="text-xl md:text-2xl font-bold text-yellow-600">{stats.expiring_soon}</div>
              <div className="text-xs md:text-sm text-gray-600">Vence em 7d</div>
            </div>
          </div>
        )}

        {/* Filtros e Busca */}
        <div className="bg-white p-3 md:p-4 rounded-lg shadow mb-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                placeholder="🔍 Buscar cliente..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => handleStatusFilterChange(e.target.value)}
                className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
                <option value="expired">Vencidos</option>
                <option value="expiring">Vencendo (7 dias)</option>
              </select>
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <select
                value={serverFilter}
                onChange={(e) => handleServerFilterChange(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Servidores</option>
                {servers.map(server => (
                  <option key={server.id} value={server.id}>{server.name}</option>
                ))}
              </select>

              <select
                value={planFilter}
                onChange={(e) => handlePlanFilterChange(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Planos</option>
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>{plan.name}</option>
                ))}
              </select>

              {DateRangeFilter && (
                <DateRangeFilter
                  startDate={startDate}
                  endDate={endDate}
                  onDateChange={handleDateChange}
                  onClear={handleClearDateFilter}
                />
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => { setEditingClient(null); setShowModal('client'); }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-semibold"
              >
                <i data-lucide="plus" className="w-4 h-4"></i>
                Novo Cliente
              </button>
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">Cliente</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700 hidden md:table-cell">Plano</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">Vencimento</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs md:text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-right text-xs md:text-sm font-semibold text-gray-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">Carregando...</td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-gray-500">Nenhum cliente encontrado</td>
                  </tr>
                ) : (
                  clients.map(client => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-3 md:px-4 py-2 md:py-3">
                        <div className="text-xs md:text-sm font-medium text-gray-900">{client.name}</div>
                        <div className="text-xs text-gray-500">{client.whatsapp_number}</div>
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-600 hidden md:table-cell">
                        {client.plan_name}
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-600">
                        {new Date(client.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3">
                        {getStatusBadge(client)}
                      </td>
                      <td className="px-3 md:px-4 py-2 md:py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => { setEditingClient(client); setShowModal('client'); }}
                            className="px-2 md:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center gap-1.5 text-xs md:text-sm font-medium shadow-sm"
                            title="Editar cliente"
                          >
                            <i data-lucide="edit-3" className="w-3 h-3 md:w-4 md:h-4"></i>
                            <span className="hidden md:inline">Editar</span>
                          </button>
                          
                          <button
                            onClick={() => handleRenewClient(client)}
                            className="px-2 md:px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition flex items-center gap-1.5 text-xs md:text-sm font-medium shadow-sm"
                            title="Renovar cliente"
                          >
                            <i data-lucide="refresh-cw" className="w-3 h-3 md:w-4 md:h-4"></i>
                            <span className="hidden md:inline">Renovar</span>
                          </button>
                          
                          <div className="relative group">
                            <button
                              className="px-2 md:px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition flex items-center gap-1.5 text-xs md:text-sm font-medium shadow-sm"
                              title="Mais ações"
                            >
                              <i data-lucide="more-vertical" className="w-3 h-3 md:w-4 md:h-4"></i>
                            </button>
                            
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                              <button
                                onClick={() => handleCopyInvoice(client)}
                                className="w-full px-4 py-2.5 text-left hover:bg-purple-50 flex items-center gap-3 text-sm text-gray-700 first:rounded-t-lg transition"
                              >
                                <i data-lucide="credit-card" className="w-4 h-4 text-purple-600"></i>
                                <span>Copiar Fatura</span>
                              </button>
                              
                              <button
                                onClick={() => setInvoiceClient(client)}
                                className="w-full px-4 py-2.5 text-left hover:bg-orange-50 flex items-center gap-3 text-sm text-gray-700 transition"
                              >
                                <i data-lucide="file-text" className="w-4 h-4 text-orange-600"></i>
                                <span>Histórico Faturas</span>
                              </button>
                              
                              <div className="border-t border-gray-200"></div>
                              
                              <button
                                onClick={() => handleDeleteClient(client.id)}
                                className="w-full px-4 py-2.5 text-left hover:bg-red-50 flex items-center gap-3 text-sm text-red-600 last:rounded-b-lg transition"
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
      {showModal === 'financial' && <FinancialDashboard onClose={() => setShowModal(null)} />}
      {showModal === 'whatsapp' && <WhatsAppModal onClose={() => setShowModal(null)} />}
      
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

      {showModal === 'plans' && <PlansModal plans={plans} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'servers' && <ServersModal servers={servers} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'templates' && <TemplatesModal templates={templates} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'reminders' && <RemindersModal reminders={reminders} templates={templates} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'client' && <ClientModal client={editingClient} plans={plans} servers={servers} onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadData(); }} />}
      {invoiceClient && <InvoicesModal client={invoiceClient} onClose={() => setInvoiceClient(null)} />}
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