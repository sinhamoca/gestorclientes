/* ========================================
   DASHBOARD COMPONENT (MAIN)
   ======================================== */

function Dashboard({ user, onLogout }) {
  const { useState, useEffect } = React;
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [plans, setPlans] = useState([]);
  const [servers, setServers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [invoiceClient, setInvoiceClient] = useState(null);
  const [showMercadoPagoModal, setShowMercadoPagoModal] = useState(false);


  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleCopyInvoice = async (client) => {
    const invoiceUrl = `https://pagamentos.comprarecarga.shop/pay/${client.payment_token}`;
    
    try {
      await navigator.clipboard.writeText(invoiceUrl);
      alert(`✅ Link da fatura copiado!\n\n${client.name}\n${invoiceUrl}`);
    } catch (error) {
      // Fallback para navegadores antigos
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
        api.getClients({ search, status: statusFilter }),
        api.getClientStats(),
        api.getPlans(),
        api.getServers(),
        api.getTemplates(),
        api.getReminders()
      ]);
      setClients(clientsData);
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

  const handleRenewClient = async (id, clientName) => {
    const registerPayment = confirm(`Renovar o cliente "${clientName}"?\n\n✅ Clique em OK para RENOVAR E REGISTRAR PAGAMENTO\n❌ Clique em CANCELAR para apenas renovar sem registrar`);
    
    try {
      const response = await api.renewClient(id, { 
        register_payment: registerPayment,
        payment_method: 'pix' 
      });
      
      const msg = registerPayment 
        ? `✅ Cliente renovado e pagamento registrado!\n\n💰 Valor: ${response.transaction ? 'R$ ' + response.transaction.amount_received : 'N/A'}\n📅 Nova data: ${new Date(response.client.due_date).toLocaleDateString('pt-BR')}`
        : `✅ Cliente renovado!\n\n📅 Nova data: ${new Date(response.client.due_date).toLocaleDateString('pt-BR')}`;
      
      alert(msg);
      loadData();
    } catch (error) {
      alert(`❌ Erro ao renovar: ${error.message}`);
    }
  };

  const getStatusBadge = (client) => {
    if (!client.is_active) return React.createElement('span', {className: 'px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs'}, 'Inativo');
    if (client.is_expired) return React.createElement('span', {className: 'px-2 py-1 bg-red-200 text-red-700 rounded text-xs'}, 'Vencido');
    if (client.days_until_due <= 7) return React.createElement('span', {className: 'px-2 py-1 bg-yellow-200 text-yellow-700 rounded text-xs'}, `Vence em ${client.days_until_due}d`);
    return React.createElement('span', {className: 'px-2 py-1 bg-green-200 text-green-700 rounded text-xs'}, 'Ativo');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 md:px-4 py-3 md:py-4">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3">
            <h1 className="text-lg md:text-xl font-bold text-gray-800">{user.name}</h1>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowModal('financial')} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold whitespace-nowrap">💰 Financeiro</button>
              <button onClick={() => setShowMercadoPagoModal(true)} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg whitespace-nowrap">💳 Mercado Pago</button>
              <button onClick={() => setShowModal('whatsapp')} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold whitespace-nowrap">📱 WhatsApp</button>
              <button onClick={() => setShowModal('plans')} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap">📋 Planos</button>
              <button onClick={() => setShowModal('servers')} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap">🖥️ Servidores</button>
              <button onClick={() => setShowModal('templates')} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg whitespace-nowrap">💬 Templates</button>
              <button onClick={() => setShowModal('reminders')} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg whitespace-nowrap">🔔 Lembretes</button>
              <button onClick={onLogout} className="px-3 md:px-4 py-2 text-xs md:text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 whitespace-nowrap">Sair</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 md:px-4 py-4 md:py-8">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-8">
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-gray-600 text-xs md:text-sm">Total</p>
              <p className="text-2xl md:text-3xl font-bold mt-2">{stats.total}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-gray-600 text-xs md:text-sm">Ativos</p>
              <p className="text-2xl md:text-3xl font-bold mt-2 text-green-600">{stats.active}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-gray-600 text-xs md:text-sm">Vencidos</p>
              <p className="text-2xl md:text-3xl font-bold mt-2 text-red-600">{stats.expired}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 md:p-6">
              <p className="text-gray-600 text-xs md:text-sm truncate">Vencem 7d</p>
              <p className="text-2xl md:text-3xl font-bold mt-2 text-yellow-600">{stats.expiring_soon}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 md:p-6 border-b">
            <div className="flex flex-col gap-4">
              <h2 className="text-lg md:text-xl font-bold">Clientes</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  className="flex-1 px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base" 
                />
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)} 
                  className="px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base"
                >
                  <option value="">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="expired">Vencidos</option>
                  <option value="expiring">Vencendo</option>
                </select>
                <button 
                  onClick={() => { setEditingClient(null); setShowModal('client'); }} 
                  className="px-4 md:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm md:text-base whitespace-nowrap"
                >
                  + Novo
                </button>
              </div>
            </div>
          </div>

          {/* Tabela Desktop / Cards Mobile */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="text-center py-12 text-sm md:text-base">Carregando...</div>
            ) : clients.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm md:text-base">Nenhum cliente encontrado</div>
            ) : (
              <>
                {/* Tabela para Desktop */}
                <table className="w-full hidden md:table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plano</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vencimento</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clients.map(client => (
                      <tr key={client.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{client.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.whatsapp_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{client.plan_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {parseFloat(client.price_value).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(client.due_date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">{getStatusBadge(client)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleCopyInvoice(client)} 
                              className="text-purple-600 hover:text-purple-900"
                              title="Copiar Link da Fatura"
                            >
                              📄
                            </button>
                            <button 
                              onClick={() => handleRenewClient(client.id, client.name)} 
                              className="text-green-600 hover:text-green-900"
                              title="Renovar"
                            >
                              🔄
                            </button>
                            <button 
                              onClick={() => setInvoiceClient(client)} 
                              className="text-purple-600 hover:text-purple-900"
                              title="Ver Faturas"
                            >
                              📜
                            </button>
                            <button 
                              onClick={() => { setEditingClient(client); setShowModal('client'); }} 
                              className="text-blue-600 hover:text-blue-900"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDeleteClient(client.id)} 
                              className="text-red-600 hover:text-red-900"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Cards para Mobile */}
                <div className="md:hidden divide-y">
                  {clients.map(client => (
                    <div key={client.id} className="p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{client.name}</p>
                          <p className="text-sm text-gray-600">{client.whatsapp_number}</p>
                        </div>
                        {getStatusBadge(client)}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3 mb-3">
                        <div>
                          <p className="text-gray-500 text-xs">Plano</p>
                          <p className="font-medium">{client.plan_name}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-xs">Valor</p>
                          <p className="font-medium">R$ {parseFloat(client.price_value).toFixed(2)}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-500 text-xs">Vencimento</p>
                          <p className="font-medium">{new Date(client.due_date).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-3 pt-3 border-t">
                        <button 
                          onClick={() => handleCopyInvoice(client)} 
                          className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded text-sm font-medium hover:bg-purple-200"
                        >
                          📄 Fatura
                        </button>
                        <button 
                          onClick={() => handleRenewClient(client.id, client.name)} 
                          className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded text-sm font-medium hover:bg-green-200"
                        >
                          🔄 Renovar
                        </button>
                        <button 
                          onClick={() => { setEditingClient(client); setShowModal('client'); }} 
                          className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200"
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          onClick={() => setInvoiceClient(client)} 
                          className="flex-1 px-3 py-2 bg-purple-100 text-purple-700 rounded text-sm font-medium hover:bg-purple-200"
                        >
                          📜 Faturas
                        </button>
                        <button 
                          onClick={() => handleDeleteClient(client.id)} 
                          className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {showModal === 'financial' && <FinancialDashboard onClose={() => setShowModal(null)} />}
      {showModal === 'whatsapp' && <WhatsAppModal onClose={() => setShowModal(null)} />}
      {showMercadoPagoModal && (<MercadoPagoModal     onClose={() => setShowMercadoPagoModal(false)} onSuccess={() => setShowMercadoPagoModal(false)} />)}
      {showModal === 'plans' && <PlansModal plans={plans} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'servers' && <ServersModal servers={servers} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'templates' && <TemplatesModal templates={templates} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'reminders' && <RemindersModal reminders={reminders} templates={templates} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'client' && <ClientModal client={editingClient} plans={plans} servers={servers} onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadData(); }} />}
      {invoiceClient && <InvoicesModal client={invoiceClient} onClose={() => setInvoiceClient(null)} />}
    </div>
  );
}
