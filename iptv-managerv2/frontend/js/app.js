/* ========================================
   APLICAÇÃO PRINCIPAL - IPTV MANAGER
   Com CloudNation e Sigma integrados
   ======================================== */

const { useState, useEffect, createElement: h } = React;

function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('cloudnation'); // cloudnation, sigma-packages, clients
  const [clients, setClients] = useState([]);
  const [clientStats, setClientStats] = useState(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  // Estados para sincronização CloudNation
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
    
    try {
      await cloudnation.saveCredentials(username, password);
      setSuccess(MESSAGES.CREDENTIALS_SAVED);
      setShowCredentialsModal(false);
      setHasCredentials(true);
    } catch (error) {
      setError(error.message || MESSAGES.ERROR_GENERIC);
    }
  }

  async function handleImportClients() {
    if (!hasCredentials) {
      setError('Configure as credenciais do CloudNation primeiro');
      return;
    }
    
    if (!confirm('Deseja importar clientes do CloudNation? Pode levar alguns minutos.')) {
      return;
    }
    
    try {
      setImporting(true);
      setError(null);
      setSuccess(null);
      
      const result = await cloudnation.importClients();
      setSuccess(`✅ ${result.total} clientes importados com sucesso!`);
      await checkCredentials();
    } catch (error) {
      setError(error.message || MESSAGES.ERROR_GENERIC);
    } finally {
      setImporting(false);
    }
  }

  function handleOpenSyncModal(client) {
    setSelectedClient(client);
    setSyncModalOpen(true);
    loadCNClients();
  }

  async function loadCNClients() {
    try {
      const data = await cloudnation.listClients();
      setCnClients(data.clients || []);
    } catch (error) {
      console.error('Erro ao carregar clientes CN:', error);
    }
  }

  async function handleSync(cnClient) {
    if (!selectedClient || syncing) return;
    
    if (!confirm(`Sincronizar ${selectedClient.name} com cliente CloudNation #${cnClient.id}?`)) {
      return;
    }
    
    try {
      setSyncing(true);
      await api.syncClient(selectedClient.id, cnClient.id);
      setSuccess(`Cliente sincronizado com sucesso! Username IPTV: ${cnClient.id}`);
      setSyncModalOpen(false);
      await loadClients();
    } catch (error) {
      setError(error.message || 'Erro ao sincronizar cliente');
    } finally {
      setSyncing(false);
    }
  }

  const filteredCNClients = cnClients.filter(c => 
    !searchCN || c.nome.toLowerCase().includes(searchCN.toLowerCase()) || c.id.includes(searchCN)
  );

  if (loading) {
    return h('div', { className: 'flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100' },
      h('div', { className: 'text-center' },
        h('div', { className: 'inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4' }),
        h('p', { className: 'text-gray-600 text-lg' }, MESSAGES.LOADING)
      )
    );
  }

  if (!authenticated) {
    return h('div', { className: 'flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100' },
      h('div', { className: 'text-center' },
        h('p', { className: 'text-gray-600 text-lg' }, MESSAGES.UNAUTHORIZED)
      )
    );
  }

  return h('div', { className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100' },
    // Header
    h('header', { className: 'bg-white shadow-md border-b border-gray-200' },
      h('div', { className: 'max-w-7xl mx-auto px-4 py-4' },
        h('div', { className: 'flex items-center justify-between flex-wrap gap-4' },
          h('div', null,
            h('h1', { className: 'text-2xl font-bold text-gray-800 flex items-center gap-2' },
              '📺 IPTV Manager',
              user && h('span', { className: 'text-sm font-normal text-gray-600' }, `| ${user.name || user.email}`)
            )
          ),
          
          h('div', { className: 'flex items-center gap-2 flex-wrap' },
            // Botão Credenciais CloudNation
            h('button', {
              onClick: () => setShowCredentialsModal(true),
              className: `px-4 py-2 rounded-lg flex items-center gap-2 transition ${hasCredentials ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}`
            }, hasCredentials ? '✓ Credenciais Live21' : '🔑 Credenciais Live21'),
            
            // Botão Importar CloudNation
            h('button', {
              onClick: handleImportClients,
              disabled: importing || !hasCredentials,
              className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition'
            }, importing ? h('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }) : '📥', importing ? 'Carregando...' : 'Carregar Clientes Live21'),
            
            // Botão Credenciais Sigma (NOVO)
            h(SigmaCredentialsModal),
            
            // Botão Sincronizar Sigma (NOVO)
            h(SigmaSyncModal),
            
            // Botão Logout
            h('button', {
              onClick: () => auth.logout(),
              className: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition'
            }, '🚪 Sair')
          )
        )
      )
    ),

    // Menu de Navegação
    h('nav', { className: 'bg-white border-b' },
      h('div', { className: 'max-w-7xl mx-auto px-4' },
        h('div', { className: 'flex gap-2' },
          h('button', {
            onClick: () => setActiveTab('cloudnation'),
            className: `px-4 py-3 font-medium transition ${activeTab === 'cloudnation' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`
          }, '🏠 CloudNation'),
          
          // Nova Tab Sigma
          h('button', {
            onClick: () => setActiveTab('sigma-packages'),
            className: `px-4 py-3 font-medium transition ${activeTab === 'sigma-packages' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-600 hover:text-gray-800'}`
          }, '📦 Pacotes Sigma'),
          
          h('button', {
            onClick: () => setActiveTab('clients'),
            className: `px-4 py-3 font-medium transition ${activeTab === 'clients' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-800'}`
          }, '👥 Clientes')
        )
      )
    ),

    // Modal Credenciais CloudNation
    showCredentialsModal && h('div', { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: () => setShowCredentialsModal(false) },
      h('div', { className: 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'p-6 border-b' }, h('h2', { className: 'text-xl font-bold text-gray-800' }, '🔑 Credenciais CloudNation (Live21)')),
        h('form', { onSubmit: handleSaveCredentials, className: 'p-6 space-y-4' },
          h('div', null,
            h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Usuário'),
            h('input', { type: 'text', name: 'username', required: true, placeholder: 'seu_usuario', className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' })
          ),
          h('div', null,
            h('label', { className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Senha'),
            h('input', { type: 'password', name: 'password', required: true, placeholder: 'sua_senha', className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent' })
          ),
          h('div', { className: 'flex gap-2' },
            h('button', { type: 'submit', className: 'flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition' }, '💾 Salvar'),
            h('button', { type: 'button', onClick: () => setShowCredentialsModal(false), className: 'px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg font-medium transition' }, 'Cancelar')
          )
        )
      )
    ),

    // Modal Sincronização CloudNation
    syncModalOpen && h('div', { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: () => setSyncModalOpen(false) },
      h('div', { className: 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto', onClick: (e) => e.stopPropagation() },
        h('div', { className: 'p-6 border-b' },
          h('h2', { className: 'text-xl font-bold text-gray-800' }, '🔄 Sincronizar Cliente'),
          selectedClient && h('p', { className: 'text-sm text-gray-600 mt-1' }, `Cliente: ${selectedClient.name}`)
        ),
        h('div', { className: 'p-6' },
          h('input', {
            type: 'text',
            placeholder: '🔍 Buscar por nome ou ID...',
            value: searchCN,
            onChange: (e) => setSearchCN(e.target.value),
            className: 'w-full px-4 py-2 border rounded-lg mb-4'
          }),
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

    // Conteúdo Principal
    h('main', { className: 'max-w-7xl mx-auto px-4 py-8' },
      error && h('div', { className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6' }, error),
      success && h('div', { className: 'bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6' }, success),

      // Renderizar conteúdo baseado na tab ativa
      activeTab === 'cloudnation' && h('div', null,
        h('h2', { className: 'text-2xl font-bold mb-6' }, '🏠 CloudNation'),
        h('div', { className: 'bg-white rounded-lg shadow p-6' },
          h('p', { className: 'text-gray-600' }, 'Use os botões no topo para gerenciar credenciais e importar clientes do CloudNation.')
        )
      ),

      // Nova Tab Sigma Packages
      activeTab === 'sigma-packages' && h(SigmaPackagesPage),

      // Tab Clientes
      activeTab === 'clients' && h('div', null,
        clientStats && h('div', { className: 'grid grid-cols-1 md:grid-cols-4 gap-4 mb-6' },
          h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Total'), h('div', { className: 'text-2xl font-bold text-gray-900' }, clientStats.total || 0)),
          h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Ativos'), h('div', { className: 'text-2xl font-bold text-green-600' }, clientStats.active || 0)),
          h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Inativos'), h('div', { className: 'text-2xl font-bold text-red-600' }, clientStats.inactive || 0)),
          h('div', { className: 'bg-white rounded-lg shadow-sm border p-4' }, h('div', { className: 'text-sm text-gray-600 mb-1' }, 'Vencendo 7 dias'), h('div', { className: 'text-2xl font-bold text-yellow-600' }, clientStats.expiring_soon || 0))
        ),

        h('div', { className: 'bg-white rounded-lg shadow-sm border' },
          h('div', { className: 'px-6 py-4 border-b' }, h('h2', { className: 'text-lg font-semibold text-gray-900' }, `📋 Meus Clientes (${clients.length})`)),
          clients.length === 0 ?
            h('div', { className: 'px-6 py-12 text-center' }, h('p', { className: 'text-gray-500 text-lg mb-2' }, '📋'), h('p', { className: 'text-gray-600' }, MESSAGES.NO_CLIENTS)) :
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
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));