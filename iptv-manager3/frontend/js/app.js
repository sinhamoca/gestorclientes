/* ========================================
   APLICAÇÃO PRINCIPAL - IPTV MANAGER
   Com sincronização de clientes CloudNation
   ======================================== */

const { useState, useEffect, createElement: h } = React;

function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [clientStats, setClientStats] = useState(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Estados para sincronização
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [cnClients, setCnClients] = useState([]);
  const [searchCN, setSearchCN] = useState('');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => { if (authenticated) { loadClients(); checkCredentials(); } }, [authenticated]);

  async function checkAuth() {
    try {
      const urlToken = auth.getTokenFromUrl();
      if (urlToken) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, urlToken);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      const token = auth.getToken();
      if (!token) { auth.redirectToLogin(); return; }
      const isValid = await auth.validateToken();
      if (!isValid) { auth.redirectToLogin(); return; }
      const userData = auth.getUser();
      if (!userData) { auth.redirectToLogin(); return; }
      setUser(userData);
      setAuthenticated(true);
    } catch (error) {
      console.error('❌ Erro na autenticação:', error);
      auth.redirectToLogin();
    } finally {
      setLoading(false);
    }
  }

  async function loadClients() {
    try {
      const data = await api.listClients();
      setClients(data.clients || []);
      setClientStats(data.stats);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      setClients([]);
    }
  }

  async function checkCredentials() {
    try {
      const data = await cloudnation.getCredentials();
      setHasCredentials(data.hasCredentials);
    } catch (error) {
      console.error('Erro ao verificar credenciais:', error);
    }
  }

async function handleSaveCredentials(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    console.log('📝 Dados do formulário:', { username, password: password ? '***' : 'vazio' });
    
    if (!username || !password) {
      setError('Preencha usuário e senha');
      return;
    }
    
    try {
      await cloudnation.saveCredentials(username, password);
      setSuccess(MESSAGES.CREDENTIALS_SAVED);
      setHasCredentials(true);
      setShowCredentialsModal(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.message || MESSAGES.ERROR);
    }
  }

  async function handleImportClients() {
    if (!hasCredentials) {
      setError('Configure as credenciais primeiro!');
      setShowCredentialsModal(true);
      return;
    }
    setImporting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await cloudnation.importClients();
      setSuccess(`Importação concluída! ${result.total} clientes salvos.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (error) {
      setError(error.message || MESSAGES.IMPORT_ERROR);
    } finally {
      setImporting(false);
    }
  }

  // Sincronização
  async function loadCNClients() {
    try {
      const data = await cloudnation.listClients();
      setCnClients(data.clients || []);
    } catch (error) {
      console.error('Erro ao carregar clientes CN:', error);
      setError('Erro ao carregar clientes do CloudNation');
    }
  }

  async function handleOpenSyncModal(client) {
    setSelectedClient(client);
    setSearchCN('');
    setSyncModalOpen(true);
    await loadCNClients();
  }

  async function handleSync(cnClient) {
    setSyncing(true);
    setError(null);
    
    try {
      await api.syncClient(selectedClient.id, cnClient.id);
      setSuccess(`✅ Cliente sincronizado! Usuário: ${cnClient.id}`);
      setSyncModalOpen(false);
      await loadClients();
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      setError(error.message || 'Erro ao sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return h('div', { className: 'min-h-screen bg-gray-50 flex items-center justify-center' },
      h('div', { className: 'text-center' },
        h('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4' }),
        h('p', { className: 'text-gray-600' }, 'Carregando...')
      )
    );
  }

  const filteredCNClients = cnClients.filter(c => 
    !searchCN || 
    c.nome?.toLowerCase().includes(searchCN.toLowerCase()) ||
    c.id?.includes(searchCN)
  );

  return h('div', { className: 'min-h-screen bg-gray-50' },
    h('header', { className: 'bg-white shadow-sm border-b' },
      h('div', { className: 'max-w-7xl mx-auto px-4 py-4' },
        h('div', { className: 'flex justify-between items-center' },
          h('div', null, h('h1', { className: 'text-2xl font-bold text-gray-900' }, '📺 IPTV Manager'), h('p', { className: 'text-sm text-gray-600 mt-1' }, 'Gerenciamento de Painéis IPTV')),
          h('div', { className: 'flex items-center gap-4' },
            h('button', {
              onClick: () => setShowCredentialsModal(true),
              className: `px-4 py-2 rounded-lg font-medium transition flex items-center gap-2 ${hasCredentials ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`
            }, '🔑 Credenciais Live21', hasCredentials && h('span', { className: 'ml-1 text-xs bg-green-500 px-2 py-0.5 rounded-full' }, '✓')),
            h('button', {
              onClick: handleImportClients,
              disabled: !hasCredentials || importing,
              className: `px-4 py-2 ${importing || !hasCredentials ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg font-medium transition flex items-center gap-2`
            }, importing ? '⏳ Importando...' : '📥 Carregar Clientes Live21'),
            h('div', { className: 'text-right border-l pl-4' }, h('p', { className: 'text-sm font-medium text-gray-900' }, user?.email), h('button', { onClick: () => auth.logout(), className: 'text-xs text-gray-500 hover:text-gray-700' }, 'Sair'))
          )
        )
      )
    ),

    // Modal Credenciais
    showCredentialsModal && h('div', { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: () => setShowCredentialsModal(false) },
      h('div', { className: 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'px-6 py-4 border-b' }, h('h3', { className: 'text-lg font-semibold text-gray-900' }, '🔑 Credenciais CloudNation')),
        h('form', { onSubmit: handleSaveCredentials, className: 'p-6' },
          h('div', { className: 'mb-4' }, h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Usuário'), h('input', { type: 'text', name: 'username', required: true, className: 'w-full px-3 py-2 border border-gray-300 rounded-lg', placeholder: 'Seu usuário do CloudNation' })),
          h('div', { className: 'mb-6' }, h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 'Senha'), h('input', { type: 'password', name: 'password', required: true, className: 'w-full px-3 py-2 border border-gray-300 rounded-lg', placeholder: 'Sua senha do CloudNation' })),
          h('div', { className: 'flex gap-3' }, h('button', { type: 'button', onClick: () => setShowCredentialsModal(false), className: 'flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50' }, 'Cancelar'), h('button', { type: 'submit', className: 'flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg' }, 'Salvar'))
        )
      )
    ),

    // Modal Sincronização
    syncModalOpen && h('div', { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: () => setSyncModalOpen(false) },
      h('div', { className: 'bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'px-6 py-4 border-b' },
          h('h3', { className: 'text-lg font-semibold text-gray-900' }, `🔄 Sincronizar: ${selectedClient?.name}`),
          h('p', { className: 'text-sm text-gray-600 mt-1' }, 'Selecione um cliente do CloudNation para vincular')
        ),
        h('div', { className: 'p-4 border-b' },
          h('input', {
            type: 'text',
            placeholder: 'Buscar por nome ou ID...',
            value: searchCN,
            onChange: (e) => setSearchCN(e.target.value),
            className: 'w-full px-4 py-2 border border-gray-300 rounded-lg'
          })
        ),
        h('div', { className: 'overflow-y-auto max-h-96 p-4' },
          filteredCNClients.length === 0 ? 
            h('p', { className: 'text-center text-gray-500 py-8' }, 'Nenhum cliente encontrado') :
            filteredCNClients.map(cnClient =>
              h('div', {
                key: cnClient.id,
                className: 'p-4 border rounded-lg mb-2 hover:bg-gray-50 cursor-pointer transition',
                onClick: () => !syncing && handleSync(cnClient)
              },
                h('div', { className: 'flex justify-between items-center' },
                  h('div', null,
                    h('p', { className: 'font-medium text-gray-900' }, cnClient.nome),
                    h('p', { className: 'text-sm text-gray-600' }, `ID: ${cnClient.id}`),
                    h('p', { className: 'text-xs text-gray-500' }, `Vencimento: ${cnClient.dataVencimento}`)
                  ),
                  h('button', {
                    disabled: syncing,
                    className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded text-sm'
                  }, syncing ? 'Sincronizando...' : 'Selecionar')
                )
              )
            )
        ),
        h('div', { className: 'px-6 py-4 border-t' },
          h('button', {
            onClick: () => setSyncModalOpen(false),
            className: 'w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50'
          }, 'Cancelar')
        )
      )
    ),

    h('main', { className: 'max-w-7xl mx-auto px-4 py-8' },
      error && h('div', { className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6' }, error),
      success && h('div', { className: 'bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6' }, success),

      clientStats && h('div', { className: 'grid grid-cols-1 md:grid-cols-4 gap-4 mb-6' },
        h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Total'), h('div', { className: 'text-2xl font-bold text-gray-900' }, clientStats.total || 0)),
        h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Ativos'), h('div', { className: 'text-2xl font-bold text-green-600' }, clientStats.active || 0)),
        h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Inativos'), h('div', { className: 'text-2xl font-bold text-red-600' }, clientStats.inactive || 0)),
        h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Vencendo 7 dias'), h('div', { className: 'text-2xl font-bold text-yellow-600' }, clientStats.expiring_soon || 0))
      ),

      h('div', { className: 'bg-white rounded-lg shadow-sm border' },
        h('div', { className: 'px-6 py-4 border-b' }, h('h2', { className: 'text-lg font-semibold text-gray-900' }, `📋 Meus Clientes (${clients.length})`)),
        clients.length === 0 ? h('div', { className: 'px-6 py-12 text-center' }, h('p', { className: 'text-gray-500 text-lg mb-2' }, '📋'), h('p', { className: 'text-gray-600' }, MESSAGES.NO_CLIENTS)) :
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full' },
            h('thead', { className: 'bg-gray-50' },
              h('tr', null,
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'ID'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Cliente'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'WhatsApp'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Usuário IPTV'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Plano'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Vencimento'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Status'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Ações')
              )
            ),
            h('tbody', { className: 'bg-white divide-y divide-gray-200' },
              clients.map(client =>
                h('tr', { key: client.id, className: 'hover:bg-gray-50' },
                  h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900' }, `#${client.id}`),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap' }, h('div', { className: 'text-sm font-medium text-gray-900' }, client.name)),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-600' }, client.whatsapp_number || '-'),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap' }, h('div', { className: 'text-sm text-gray-900' }, client.username || '-'), client.password && h('div', { className: 'text-xs text-gray-500' }, 'Senha: ••••••')),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-600' }, client.plan_name || '-'),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-600' }, client.due_date ? new Date(client.due_date).toLocaleDateString('pt-BR') : '-'),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap' }, client.is_active ? h('span', { className: 'px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full' }, 'Ativo') : h('span', { className: 'px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full' }, 'Inativo')),
                  h('td', { className: 'px-6 py-4 whitespace-nowrap' },
                    h('button', {
                      onClick: () => handleOpenSyncModal(client),
                      className: 'px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded'
                    }, '🔄 Sincronizar')
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));
