/* ========================================
   DASHBOARD COMPONENT (MAIN) - COMPLETO E ATUALIZADO
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
  const [showModal, setShowModal] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [invoiceClient, setInvoiceClient] = useState(null);
  const [showMercadoPagoModal, setShowMercadoPagoModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false); // ← NOVO STATE

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
            
            {/* Botões de Ação */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => setShowModal('financial')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold whitespace-nowrap"
              >
                💰 Financeiro
              </button>
              
              <button
                onClick={() => {
                  const token = localStorage.getItem('user_token');  // ← CORRIGIDO!
                  window.open(`https://iptv.comprarecarga.shop?token=${token}`, '_blank');
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition flex items-center gap-2"
              >
                📺 Renovação IPTV
              </button>
              
              <button 
                onClick={() => setShowMercadoPagoModal(true)} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg whitespace-nowrap"
              >
                💳 Mercado Pago
              </button>
              
              {/* BOTÃO DE RENOVAÇÃO - NOVO! */}
              <button 
                onClick={() => setShowRenewalModal(true)} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-lg font-semibold shadow-md whitespace-nowrap"
              >
                🔄 Renovar
              </button>
              
              <button 
                onClick={() => setShowModal('whatsapp')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-semibold whitespace-nowrap"
              >
                📱 WhatsApp
              </button>
              
              <button 
                onClick={() => setShowModal('plans')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap"
              >
                📋 Planos
              </button>
              
              <button 
                onClick={() => setShowModal('servers')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-gray-100 hover:bg-gray-200 rounded-lg whitespace-nowrap"
              >
                🖥️ Servidores
              </button>
              
              <button 
                onClick={() => setShowModal('templates')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg whitespace-nowrap"
              >
                💬 Templates
              </button>
              
              <button 
                onClick={() => setShowModal('reminders')} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded-lg whitespace-nowrap"
              >
                🔔 Lembretes
              </button>
              
              <button 
                onClick={onLogout} 
                className="px-3 md:px-4 py-2 text-xs md:text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 whitespace-nowrap"
              >
                🚪 Sair
              </button>
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
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="🔍 Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="expired">Vencidos</option>
              <option value="expiring">Vencendo em 7d</option>
            </select>
            <button
              onClick={() => { setEditingClient(null); setShowModal('client'); }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 whitespace-nowrap"
            >
              ➕ Novo Cliente
            </button>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-semibold text-gray-600">Cliente</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">Plano</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-semibold text-gray-600">Vencimento</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-3 md:px-4 py-2 md:py-3 text-right text-xs font-semibold text-gray-600">Ações</th>
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
                        <div className="flex justify-end gap-1 md:gap-2 flex-wrap">
                          <button
                            onClick={() => { setEditingClient(client); setShowModal('client'); }}
                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleRenewClient(client.id, client.name)}
                            className="text-xs px-2 py-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            🔄
                          </button>
                          <button
                            onClick={() => handleCopyInvoice(client)}
                            className="text-xs px-2 py-1 text-purple-600 hover:bg-purple-50 rounded"
                          >
                            💳
                          </button>
                          <button
                            onClick={() => setInvoiceClient(client)}
                            className="text-xs px-2 py-1 text-orange-600 hover:bg-orange-50 rounded"
                          >
                            📄
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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

      {/* MODAL DE RENOVAÇÃO DE ASSINATURA - NOVO! */}
      {showRenewalModal && (
        <SubscriptionRenewalModal 
          user={user}
          onClose={() => setShowRenewalModal(false)}
          onRenewalSuccess={() => {
            setShowRenewalModal(false);
            loadData(); // Recarrega os dados após renovação bem-sucedida
          }}
        />
      )}

      {showModal === 'plans' && <PlansModal plans={plans} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'servers' && <ServersModal servers={servers} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'templates' && <TemplatesModal templates={templates} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'reminders' && <RemindersModal reminders={reminders} templates={templates} onClose={() => setShowModal(null)} onRefresh={loadData} />}
      {showModal === 'client' && <ClientModal client={editingClient} plans={plans} servers={servers} onClose={() => setShowModal(null)} onSave={() => { setShowModal(null); loadData(); }} />}
      {invoiceClient && <InvoicesModal client={invoiceClient} onClose={() => setInvoiceClient(null)} />}
    </div>
  );
}