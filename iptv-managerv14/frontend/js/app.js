/* ========================================
   APLICAÇÃO PRINCIPAL - IPTV MANAGER
   Com CloudNation e Sigma integrados + CLIENTES SIGMA
   ======================================== */

const { useState, useEffect, createElement: h } = React;

function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('clients');
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

  // ===== NOVOS ESTADOS SIGMA CLIENTS =====
  const [capturingClients, setCapturingClients] = useState(false);
  const [showClientCaptureModal, setShowClientCaptureModal] = useState(false);
  const [sigmaDomainsForCapture, setSigmaDomainsForCapture] = useState([]);
  
  // Estados para sincronização Sigma
  const [sigmaSyncModalOpen, setSigmaSyncModalOpen] = useState(false);
  const [selectedClientForSigmaSync, setSelectedClientForSigmaSync] = useState(null);
  const [sigmaDomainsForSync, setSigmaDomainsForSync] = useState([]);
  const [selectedSigmaDomain, setSelectedSigmaDomain] = useState('');
  const [sigmaClientsForSync, setSigmaClientsForSync] = useState([]);
  const [searchSigma, setSearchSigma] = useState('');
  const [syncingSigma, setSyncingSigma] = useState(false);
  // ===== ESTADOS KOFFICE =====
  const [capturingKofficeClients, setCapturingKofficeClients] = useState(false);
  const [showKofficeClientCaptureModal, setShowKofficeClientCaptureModal] = useState(false);

  // Estados para sincronização Koffice
  const [koffficeSyncModalOpen, setKoffficeSyncModalOpen] = useState(false);
  const [selectedClientForKofficeSync, setSelectedClientForKofficeSync] = useState(null);
  const [syncingKoffice, setSyncingKoffice] = useState(false);

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
      setSuccess(`Cliente sincronizado com sucesso!\nUsername IPTV: ${cnClient.id}`);
      setSyncModalOpen(false);
      await loadClients();
    } catch (error) {
      setError(error.message || 'Erro ao sincronizar cliente');
    } finally {
      setSyncing(false);
    }
  }

  // ===== NOVAS FUNÇÕES SIGMA CLIENTS =====
  
  async function loadSigmaDomainsForCapture() {
    try {
      const creds = await sigmaAPI.listCredentials();
      setSigmaDomainsForCapture(creds);
    } catch (error) {
      console.error('Erro ao carregar domínios:', error);
    }
  }

  async function handleCaptureSigmaClients(domain) {
    if (!domain) {
      setError('Selecione um domínio');
      return;
    }

    if (!confirm(`Deseja capturar clientes do domínio ${domain}? Pode levar alguns minutos.`)) {
      return;
    }

    try {
      setCapturingClients(true);
      setError(null);
      setSuccess(null);
      setShowClientCaptureModal(false);

      const result = await sigmaAPI.captureClients(domain);
      
      setSuccess(`✅ ${result.total} clientes Sigma capturados! (${result.ativos} ativos)`);
    } catch (error) {
      setError(error.message || 'Erro ao capturar clientes');
    } finally {
      setCapturingClients(false);
    }
  }

  function handleOpenSigmaSyncModal(client) {
    setSelectedClientForSigmaSync(client);
    setSigmaSyncModalOpen(true);
    setSelectedSigmaDomain('');
    setSigmaClientsForSync([]);
    setSearchSigma('');
    loadSigmaDomainsForSync();
  }

  async function loadSigmaDomainsForSync() {
    try {
      const data = await sigmaAPI.listDomainsWithClients();
      console.log('🔍 [DEBUG] Dados recebidos:', data); // ADICIONE ESTA LINHA
      setSigmaDomainsForSync(Array.isArray(data) ? data : (data.domains || [])); // ✅ correto
    } catch (error) {
      console.error('Erro ao carregar domínios Sigma:', error);
    }
  }

  async function loadSigmaClientsForSync(domain) {
    try {
      const data = await sigmaAPI.listSigmaClients(domain);
      setSigmaClientsForSync(data.clients || []);
    } catch (error) {
      console.error('Erro ao carregar clientes Sigma:', error);
      setError('Erro ao carregar clientes Sigma: ' + error.message);
    }
  }

  async function handleSyncWithSigma(sigmaClient) {
    if (!selectedClientForSigmaSync || syncingSigma) return;
    
    if (!confirm(`Sincronizar ${selectedClientForSigmaSync.name} com cliente Sigma ${sigmaClient.id_externo}?`)) {
      return;
    }
    
    try {
      setSyncingSigma(true);
      await api.syncClientWithSigma(
        selectedClientForSigmaSync.id, 
        sigmaClient.id_interno,
        selectedSigmaDomain
      );
      
      setSuccess(`✅ Cliente sincronizado com Sigma!\nUsername IPTV: ${sigmaClient.id_interno}`);
      setSigmaSyncModalOpen(false);
      await loadClients();
    } catch (error) {
      setError(error.message || 'Erro ao sincronizar cliente com Sigma');
    } finally {
      setSyncingSigma(false);
    }
  }

  // ===== FUNÇÕES KOFFICE =====

  async function handleCaptureKofficeClients(domain) {
    if (!domain) {
      setError('Selecione um domínio');
      return;
    }

    if (!confirm(`Deseja capturar clientes do domínio ${domain}?\n\n⚠️ ATENÇÃO: Pode demorar alguns minutos se o painel tiver hCaptcha ou muitos clientes.`)) {
      return;
    }

    try {
      setCapturingKofficeClients(true);
      setError(null);
      setSuccess(null);
      setShowKofficeClientCaptureModal(false);

      const result = await kofficeAPI.captureClients(domain);
      
      setSuccess(`✅ ${result.total} clientes Koffice capturados!\n📊 ${result.ativos} ativos | ${result.inativos} inativos`);
    } catch (error) {
      setError(error.message || 'Erro ao capturar clientes Koffice');
    } finally {
      setCapturingKofficeClients(false);
    }
  }

  function handleOpenKofficeSyncModal(client) {
    setSelectedClientForKofficeSync(client);
    setKoffficeSyncModalOpen(true);
  }

  async function handleSyncKofficeClient(kofficeClient) {
    if (!selectedClientForKofficeSync || syncingKoffice) return;
    
    if (!confirm(`Confirma sincronização?\n\nCliente: ${selectedClientForKofficeSync.name}\nKoffice ID: ${kofficeClient.client_id}\nKoffice Username: ${kofficeClient.username}`)) {
      return;
    }
    
    try {
      setSyncingKoffice(true);
      
      const response = await fetch(`${IPTV_API_URL}/clients/${selectedClientForKofficeSync.id}/sync-koffice`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN)}`
        },
        body: JSON.stringify({
          koffice_client_id: kofficeClient.client_id,
          domain: kofficeClient.domain
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao sincronizar');
      }

      setSuccess(`✅ Cliente sincronizado com Koffice!\n🆔 ID: ${kofficeClient.client_id}\n👤 Username: ${kofficeClient.username}`);
      setKoffficeSyncModalOpen(false);
      await loadClients();
    } catch (error) {
      setError(error.message || 'Erro ao sincronizar cliente com Koffice');
    } finally {
      setSyncingKoffice(false);
    }
  }

  // Filtrar clientes CN pela busca
  const filteredCNClients = cnClients.filter(c => 
    !searchCN || c.nome.toLowerCase().includes(searchCN.toLowerCase()) || c.id.includes(searchCN)
  );

  // Filtrar clientes Sigma pela busca
  const filteredSigmaClients = sigmaClientsForSync.filter(c => 
    !searchSigma || 
    c.id_externo.toLowerCase().includes(searchSigma.toLowerCase()) ||
    c.nome.toLowerCase().includes(searchSigma.toLowerCase()) ||
    c.id_interno.toLowerCase().includes(searchSigma.toLowerCase())
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
            
            // Botão Credenciais Sigma
            h(SigmaCredentialsModal),
            
            // Botão Sincronizar Sigma (Pacotes)
            h(SigmaSyncModal),
            
            // Botão Capturar Clientes Sigma (NOVO!)
            h('button', {
              onClick: () => {
                loadSigmaDomainsForCapture();
                setShowClientCaptureModal(true);
              },
              disabled: capturingClients,
              className: 'px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition'
            }, 
            capturingClients ? h('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }) : '👥', 
            capturingClients ? 'Capturando...' : '👥 Capturar Clientes Sigma'),

            // Botão Credenciais Koffice
            h(KofficeCredentialsModal),

            

            // Botão Capturar Clientes Koffice
            h('button', {
              onClick: () => setShowKofficeClientCaptureModal(true),
              disabled: capturingKofficeClients,
              className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg flex items-center gap-2 transition'
            }, 
            capturingKofficeClients ? h('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }) : '👥', 
            capturingKofficeClients ? 'Capturando Koffice...' : '📥 Capturar Koffice'
            ),
            
            // Botão Credenciais Uniplay ← ADICIONAR
            h(UniplayCredentialsModal),

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
    syncModalOpen && h('div', { className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50', onClick: () => !syncing && setSyncModalOpen(false) },
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
            h('div', { className: 'space-y-2' },
              filteredCNClients.map(cnClient =>
                h('button', {
                  key: cnClient.id,
                  onClick: () => handleSync(cnClient),
                  disabled: syncing,
                  className: 'w-full p-4 bg-white hover:bg-blue-50 disabled:bg-gray-100 border rounded-lg text-left transition'
                },
                  h('div', { className: 'flex justify-between items-center' },
                    h('div', null,
                      h('div', { className: 'font-medium' }, cnClient.nome),
                      h('div', { className: 'text-sm text-gray-600' }, `ID: ${cnClient.id}`)
                    ),
                    h('span', { className: 'text-2xl' }, '▶️')
                  )
                )
              )
            )
        )
      )
    ),

    // ===== MODAL DE CAPTURA DE CLIENTES SIGMA (NOVO!) =====
    showClientCaptureModal && h('div', { 
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
      onClick: () => !capturingClients && setShowClientCaptureModal(false)
    },
      h('div', { 
        className: 'bg-white rounded-lg p-6 w-full max-w-md',
        onClick: (e) => e.stopPropagation()
      },
        h('h3', { className: 'text-xl font-bold mb-4 text-gray-800' }, '👥 Capturar Clientes Sigma'),
        
        sigmaDomainsForCapture.length === 0 ? (
          h('div', { className: 'text-center py-8' },
            h('p', { className: 'text-gray-600 mb-4' }, 'Nenhum domínio Sigma cadastrado.'),
            h('p', { className: 'text-gray-500 text-sm' }, 'Configure as credenciais Sigma primeiro.')
          )
        ) : (
          h('div', { className: 'space-y-3' },
            h('p', { className: 'text-gray-600 text-sm mb-4' }, 
              'Selecione o domínio para capturar os clientes:'
            ),
            
            sigmaDomainsForCapture.map(cred =>
              h('button', {
                key: cred.domain,
                onClick: () => handleCaptureSigmaClients(cred.domain),
                disabled: capturingClients,
                className: 'w-full p-4 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg transition text-left'
              },
                h('div', { className: 'flex items-center justify-between' },
                  h('div', null,
                    h('div', { className: 'font-medium' }, '🌐 ' + cred.domain),
                    h('div', { className: 'text-xs opacity-80' }, '👤 ' + cred.username)
                  ),
                  h('div', { className: 'text-2xl' }, '📥')
                )
              )
            )
          )
        ),
        
        h('div', { className: 'mt-6 flex justify-end' },
          h('button', {
            onClick: () => setShowClientCaptureModal(false),
            disabled: capturingClients,
            className: 'px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg'
          }, 'Cancelar')
        )
      )
    ),

    // ===== MODAL DE SINCRONIZAÇÃO SIGMA (NOVO!) =====
    sigmaSyncModalOpen && h('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
      onClick: () => !syncingSigma && setSigmaSyncModalOpen(false)
    },
      h('div', {
        className: 'bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col',
        onClick: (e) => e.stopPropagation()
      },
        // Header
        h('div', { className: 'p-6 border-b border-gray-200' },
          h('h3', { className: 'text-xl font-bold text-gray-800' }, 
            '🔄 Sincronizar com Sigma'
          ),
          selectedClientForSigmaSync && h('p', { className: 'text-gray-600 mt-2' },
            `Cliente: ${selectedClientForSigmaSync.name}`
          )
        ),

        // Seleção de domínio
        h('div', { className: 'p-6 border-b border-gray-200 bg-gray-50' },
          h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' },
            '1️⃣ Selecione o domínio Sigma:'
          ),
          
          sigmaDomainsForSync.length === 0 ? (
            h('div', { className: 'text-center py-4 text-gray-500' },
              'Nenhum domínio com clientes capturados. Capture os clientes primeiro.'
            )
          ) : (
            h('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-3' },
              sigmaDomainsForSync.map(domainInfo =>
                h('button', {
                  key: domainInfo.domain,
                  onClick: () => {
                    setSelectedSigmaDomain(domainInfo.domain);
                    loadSigmaClientsForSync(domainInfo.domain);
                  },
                  className: `p-4 rounded-lg border-2 transition ${
                    selectedSigmaDomain === domainInfo.domain
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-300 bg-white'
                  }`
                },
                  h('div', { className: 'text-left' },
                    h('div', { className: 'font-medium text-gray-800' }, domainInfo.domain),
                    h('div', { className: 'text-sm text-gray-500 mt-1' },
                      `👥 ${domainInfo.client_count} clientes`
                    )
                  )
                )
              )
            )
          )
        ),

        // Modal Captura Koffice
        showKofficeClientCaptureModal && h(KofficeClientCaptureModal, {
          isOpen: showKofficeClientCaptureModal,
          onClose: () => setShowKofficeClientCaptureModal(false),
          onCapture: handleCaptureKofficeClients,
          capturing: capturingKofficeClients
        }),

        // Modal Sincronização Koffice
        koffficeSyncModalOpen && h(KofficeSyncModal, {
          isOpen: koffficeSyncModalOpen,
          onClose: () => !syncingKoffice && setKoffficeSyncModalOpen(false),
          client: selectedClientForKofficeSync,
          onSync: handleSyncKofficeClient,
          syncing: syncingKoffice
        }),

        // Lista de clientes Sigma
        selectedSigmaDomain && h('div', { className: 'flex-1 overflow-auto' },
          h('div', { className: 'p-6' },
            h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' },
              '2️⃣ Selecione o cliente Sigma:'
            ),
            
            // Campo de busca
            h('input', {
              type: 'text',
              placeholder: '🔍 Buscar por ID Externo, Nome ou ID Interno...',
              value: searchSigma,
              onChange: (e) => setSearchSigma(e.target.value),
              className: 'w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent'
            }),

            sigmaClientsForSync.length === 0 ? (
              h('div', { className: 'text-center py-8 text-gray-500' },
                'Carregando clientes...'
              )
            ) : filteredSigmaClients.length === 0 ? (
              h('div', { className: 'text-center py-8 text-gray-500' },
                'Nenhum cliente encontrado com essa busca.'
              )
            ) : (
              h('div', { className: 'space-y-2 max-h-96 overflow-auto' },
                filteredSigmaClients.map(sigmaClient =>
                  h('button', {
                    key: sigmaClient.id_interno,
                    onClick: () => handleSyncWithSigma(sigmaClient),
                    disabled: syncingSigma,
                    className: 'w-full p-4 bg-white hover:bg-purple-50 disabled:bg-gray-100 border border-gray-200 rounded-lg transition text-left'
                  },
                    h('div', { className: 'flex items-center justify-between' },
                      h('div', { className: 'flex-1' },
                        h('div', { className: 'font-medium text-gray-800 mb-1' },
                          `📱 ${sigmaClient.id_externo}`,
                          sigmaClient.nome !== sigmaClient.id_externo && 
                            h('span', { className: 'text-gray-500 text-sm ml-2' }, 
                              `(${sigmaClient.nome})`
                            )
                        ),
                        h('div', { className: 'text-sm text-gray-600' },
                          `🔑 ID Interno: ${sigmaClient.id_interno}`
                        ),
                        sigmaClient.status && h('div', { className: 'text-xs mt-1' },
                          h('span', {
                            className: `px-2 py-1 rounded ${
                              sigmaClient.status === 'ACTIVE' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`
                          }, sigmaClient.status)
                        )
                      ),
                      h('div', { className: 'text-2xl' }, '▶️')
                    )
                  )
                )
              )
            )
          )
        ),

        // Footer
        h('div', { className: 'p-6 border-t border-gray-200 bg-gray-50' },
          h('div', { className: 'flex justify-between items-center' },
            h('div', { className: 'text-sm text-gray-600' },
              filteredSigmaClients.length > 0 && 
                `${filteredSigmaClients.length} cliente(s) encontrado(s)`
            ),
            h('button', {
              onClick: () => setSigmaSyncModalOpen(false),
              disabled: syncingSigma,
              className: 'px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg'
            }, 'Fechar')
          )
        )
      )
    ),

    // Conteúdo principal
    h('main', { className: 'max-w-7xl mx-auto px-4 py-8' },
      // Alertas
      error && h('div', { className: 'mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded' }, error),
      success && h('div', { className: 'mb-4 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded whitespace-pre-line' }, success),

      // Conteúdo das tabs
      activeTab === 'cloudnation' && h('div', { className: 'text-center py-12' },
        h('p', { className: 'text-gray-600' }, 'Página CloudNation')
      ),

      activeTab === 'sigma-packages' && h(SigmaPackagesPage),

      activeTab === 'clients' && h('div', null,
        h('div', { className: 'mb-6' },
          h('h2', { className: 'text-2xl font-bold text-gray-800 mb-2' }, '👥 Clientes'),
          clientStats && h('div', { className: 'grid grid-cols-2 md:grid-cols-5 gap-4' },
            h('div', { className: 'bg-white p-4 rounded-lg shadow' },
              h('p', { className: 'text-gray-600 text-sm' }, 'Total'),
              h('p', { className: 'text-2xl font-bold' }, clientStats.total)
            ),
            h('div', { className: 'bg-green-50 p-4 rounded-lg shadow' },
              h('p', { className: 'text-gray-600 text-sm' }, 'Ativos'),
              h('p', { className: 'text-2xl font-bold text-green-600' }, clientStats.active)
            ),
            h('div', { className: 'bg-red-50 p-4 rounded-lg shadow' },
              h('p', { className: 'text-gray-600 text-sm' }, 'Vencidos'),
              h('p', { className: 'text-2xl font-bold text-red-600' }, clientStats.expired)
            ),
            h('div', { className: 'bg-yellow-50 p-4 rounded-lg shadow' },
              h('p', { className: 'text-gray-600 text-sm' }, 'Vencem em 7 dias'),
              h('p', { className: 'text-2xl font-bold text-yellow-600' }, clientStats.expiring_soon)
            ),
            h('div', { className: 'bg-gray-50 p-4 rounded-lg shadow' },
              h('p', { className: 'text-gray-600 text-sm' }, 'Inativos'),
              h('p', { className: 'text-2xl font-bold text-gray-600' }, clientStats.inactive)
            )
          )
        ),

        // Lista de clientes
        h('div', { className: 'space-y-4' },
          clients.length === 0 ? (
            h('div', { className: 'text-center py-12 bg-white rounded-lg shadow' },
              h('p', { className: 'text-gray-500' }, 'Nenhum cliente encontrado')
            )
          ) : (
            clients.map(client =>
              h('div', { key: client.id, className: 'bg-white p-6 rounded-lg shadow hover:shadow-md transition' },
                h('div', { className: 'flex justify-between items-start mb-4' },
                  h('div', null,
                    h('h3', { className: 'text-lg font-bold text-gray-800' }, client.name),
                    h('p', { className: 'text-sm text-gray-600' }, `📱 ${client.whatsapp_number}`),
                    client.username && h('p', { className: 'text-sm text-gray-600' }, `🔑 Username: ${client.username}`)
                  ),
                  h('span', {
                    className: `px-3 py-1 rounded-full text-sm font-medium ${
                      client.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`
                  }, client.is_active ? 'Ativo' : 'Inativo')
                ),
                
                h('div', { className: 'grid grid-cols-2 gap-4 mb-4' },
                  h('div', null,
                    h('p', { className: 'text-xs text-gray-500' }, 'Plano'),
                    h('p', { className: 'font-medium' }, client.plan_name || '-')
                  ),
                  h('div', null,
                    h('p', { className: 'text-xs text-gray-500' }, 'Vencimento'),
                    h('p', { className: 'font-medium' }, new Date(client.due_date).toLocaleDateString('pt-BR'))
                  )
                ),

                // Botões de ação
                h('div', { className: 'flex gap-2' },
                  h('button', {
                    onClick: () => handleOpenSyncModal(client),
                    className: 'px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition'
                  }, '🔄 Sincronizar Live 21'),
                  
                  // NOVO BOTÃO SINCRONIZAR SIGMA
                  h('button', {
                    onClick: () => handleOpenSigmaSyncModal(client),
                    className: 'px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm transition'
                  }, '🔄 Sincronizar Sigma'),

                  h('button', {
                    onClick: () => handleOpenKofficeSyncModal(client),
                    className: 'px-3 py-1 bg-orange-600 hover:bg-orange-700 text-white text-sm rounded transition'
                  }, '🔄 Sincronizar Koffice'),
                  
                )
              )
            )
          )
        )
      ),
      // Modal Captura Koffice
      showKofficeClientCaptureModal && h(KofficeClientCaptureModal, {
        isOpen: showKofficeClientCaptureModal,
        onClose: () => setShowKofficeClientCaptureModal(false),
        onCapture: handleCaptureKofficeClients,
        capturing: capturingKofficeClients
      }),

      // Modal Sincronização Koffice
      koffficeSyncModalOpen && h(KofficeSyncModal, {
        isOpen: koffficeSyncModalOpen,
        onClose: () => !syncingKoffice && setKoffficeSyncModalOpen(false),
        client: selectedClientForKofficeSync,
        onSync: handleSyncKofficeClient,
        syncing: syncingKoffice
      })
    )
  );
}

// Inicializar aplicação
ReactDOM.render(h(App), document.getElementById('root'));