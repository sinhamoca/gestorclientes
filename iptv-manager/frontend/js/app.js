/* ========================================
   APLICAÇÃO PRINCIPAL - IPTV RENEWAL
   ======================================== */

const { useState, useEffect, createElement: h } = React;

// Componente principal
function App() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState(null);

  // Verificação de autenticação ao carregar
  useEffect(() => {
    checkAuth();
  }, []);

  // Carrega clientes após autenticação
  useEffect(() => {
    if (authenticated) {
      loadClients();
    }
  }, [authenticated]);

  // Verifica autenticação
  async function checkAuth() {
    try {
      console.log('🔍 [APP] Iniciando verificação de autenticação...');
      
      // PASSO 1: Verificar se veio token pela URL
      const urlToken = auth.getTokenFromUrl();
      if (urlToken) {
        console.log('✅ [APP] Token encontrado na URL, salvando...');
        localStorage.setItem(STORAGE_KEYS.TOKEN, urlToken);
        // Remove token da URL
        window.history.replaceState({}, document.title, window.location.pathname);
      }
      
      // PASSO 2: Verificar se tem token no localStorage
      const token = auth.getToken();
      if (!token) {
        console.warn('⚠️  [APP] Nenhum token encontrado!');
        auth.redirectToLogin();
        return;
      }
      
      console.log('✅ [APP] Token encontrado, validando...');

      // PASSO 3: Validar token com backend (isso vai salvar o user no localStorage)
      const isValid = await auth.validateToken();
      
      if (!isValid) {
        console.error('❌ [APP] Token inválido!');
        auth.redirectToLogin();
        return;
      }

      // PASSO 4: Pegar dados do usuário
      const userData = auth.getUser();
      if (!userData) {
        console.error('❌ [APP] Erro ao obter dados do usuário!');
        auth.redirectToLogin();
        return;
      }
      
      console.log('✅ [APP] Autenticação OK! User:', userData.name);
      setUser(userData);
      setAuthenticated(true);
      
    } catch (error) {
      console.error('❌ [APP] Erro na autenticação:', error);
      auth.redirectToLogin();
    } finally {
      setLoading(false);
    }
  }

  // Carrega clientes do usuário
  async function loadClients() {
    try {
      setLoading(true);
      const token = auth.getToken();
      
      console.log('📥 [APP] Carregando clientes...');
      console.log('🔗 [APP] URL:', `${API_URL}/clients`);
      
      const response = await fetch(`${API_URL}/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 [APP] Status da resposta:', response.status);

      if (!response.ok) {
        throw new Error('Erro ao carregar clientes');
      }

      const data = await response.json();
      console.log('📦 [APP] Dados recebidos:', data);
      console.log('📦 [APP] Tipo de dados:', typeof data);
      console.log('📦 [APP] É array?', Array.isArray(data));
      
      // Trata diferentes formatos de resposta
      let clientsList = [];
      
      if (Array.isArray(data)) {
        // Se a resposta for um array direto
        clientsList = data;
      } else if (data && typeof data === 'object') {
        // Se for um objeto, procura por 'clients', 'data' ou 'result'
        clientsList = data.clients || data.data || data.result || [];
      }
      
      console.log('✅ [APP] Clientes processados:', clientsList.length);
      setClients(clientsList);
    } catch (error) {
      console.error('❌ [APP] Erro ao carregar clientes:', error);
      setError(MESSAGES.ERROR);
      setClients([]); // Garante que sempre terá um array
    } finally {
      setLoading(false);
    }
  }

  // Tela de carregamento
  if (loading) {
    return h('div', { className: 'min-h-screen bg-gray-50 flex items-center justify-center' },
      h('div', { className: 'text-center' },
        h('div', { className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4' }),
        h('p', { className: 'text-gray-600' }, 'Carregando...')
      )
    );
  }

  return h('div', { className: 'min-h-screen bg-gray-50' },
    // Header
    h('header', { className: 'bg-white shadow-sm border-b' },
      h('div', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4' },
        h('div', { className: 'flex justify-between items-center' },
          h('div', null,
            h('h1', { className: 'text-2xl font-bold text-gray-900' }, '📺 Renovação IPTV'),
            h('p', { className: 'text-sm text-gray-600 mt-1' }, 'Sistema de renovação automatizada')
          ),
          h('div', { className: 'flex items-center gap-4' },
            h('div', { className: 'text-right' },
              h('p', { className: 'text-sm font-medium text-gray-900' }, user?.name),
              h('p', { className: 'text-xs text-gray-500' }, user?.email)
            ),
            h('button', {
              onClick: () => auth.logout(),
              className: 'px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition text-sm'
            }, 'Sair')
          )
        )
      )
    ),

    // Conteúdo Principal
    h('main', { className: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8' },
      error && h('div', { className: 'bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6' }, error),

      // Card de informação
      h('div', { className: 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6' },
        h('div', { className: 'flex items-start gap-3' },
          h('span', { className: 'text-2xl' }, 'ℹ️'),
          h('div', null,
            h('h3', { className: 'font-semibold text-blue-900 mb-1' }, 'Sistema em Desenvolvimento'),
            h('p', { className: 'text-sm text-blue-800' }, 
              'Esta é a versão inicial do sistema de renovação IPTV. Por enquanto, você pode visualizar todos os seus clientes cadastrados. As funcionalidades de renovação automática serão adicionadas em breve.'
            )
          )
        )
      ),

      // Lista de Clientes
      h('div', { className: 'bg-white rounded-lg shadow-sm border' },
        h('div', { className: 'px-6 py-4 border-b' },
          h('h2', { className: 'text-lg font-semibold text-gray-900' }, `Meus Clientes (${clients.length})`)
        ),

        clients.length === 0 ? (
          h('div', { className: 'px-6 py-12 text-center' },
            h('p', { className: 'text-gray-500 text-lg mb-2' }, '📋'),
            h('p', { className: 'text-gray-600' }, MESSAGES.NO_CLIENTS)
          )
        ) : (
          h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'w-full' },
              h('thead', { className: 'bg-gray-50' },
                h('tr', null,
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'ID'),
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Cliente'),
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'WhatsApp'),
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Usuário IPTV'),
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Plano'),
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Vencimento'),
                  h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider' }, 'Status')
                )
              ),
              h('tbody', { className: 'bg-white divide-y divide-gray-200' },
                clients.map(client =>
                  h('tr', { key: client.id, className: 'hover:bg-gray-50' },
                    h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-900' }, `#${client.id}`),
                    h('td', { className: 'px-6 py-4 whitespace-nowrap' },
                      h('div', { className: 'text-sm font-medium text-gray-900' }, client.name)
                    ),
                    h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-600' }, client.whatsapp_number),
                    h('td', { className: 'px-6 py-4 whitespace-nowrap' },
                      h('div', { className: 'text-sm text-gray-900' }, client.username || '-'),
                      h('div', { className: 'text-xs text-gray-500' }, `Senha: ${client.password ? '••••••' : '-'}`)
                    ),
                    h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-600' }, client.plan_name || '-'),
                    h('td', { className: 'px-6 py-4 whitespace-nowrap text-sm text-gray-600' }, 
                      new Date(client.due_date).toLocaleDateString('pt-BR')
                    ),
                    h('td', { className: 'px-6 py-4 whitespace-nowrap' },
                      client.is_active ? 
                        h('span', { className: 'px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full' }, 'Ativo') :
                        h('span', { className: 'px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full' }, 'Inativo')
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

// Renderiza a aplicação
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(h(App));