/* ========================================
   CLUB SYNC MODAL - COMPONENTE REACT
   Modal para sincronizar clientes do PostgreSQL com Club
   
   INSTRUÇÕES:
   Criar arquivo: frontend/js/ClubSyncModal.js
   Adicionar no index.html: <script src="js/ClubSyncModal.js"></script>
   ======================================== */

function ClubSyncModal({ isOpen, onClose, client, onSync, syncing }) {
  const { useState, useEffect, createElement: h } = React;
  
  const [clubClients, setClubClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadClubClients();
      setSearch('');
    }
  }, [isOpen]);

  async function loadClubClients() {
    try {
      setLoading(true);
      const data = await club.listClients();
      setClubClients(data.clients || []);
    } catch (error) {
      console.error('Erro ao carregar clientes Club:', error);
      alert('Erro ao carregar clientes Club: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clubClients.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      c.reseller_notes?.toLowerCase().includes(searchLower) ||
      c.username?.toLowerCase().includes(searchLower) ||
      c.client_id?.toLowerCase().includes(searchLower)
    );
  });

  function handleSync(clubClient) {
    onSync(clubClient);
  }

  if (!isOpen || !client) return null;

  return h('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4',
    onClick: (e) => {
      if (e.target === e.currentTarget && !syncing) {
        onClose();
      }
    }
  },
    h('div', { 
      className: 'bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col',
      onClick: (e) => e.stopPropagation()
    },
      // Header
      h('div', { className: 'p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-purple-100' },
        h('h2', { className: 'text-2xl font-bold text-gray-800 mb-2' }, 
          '🔄 Sincronizar com Club'
        ),
        client && h('div', { className: 'space-y-1' },
          h('p', { className: 'text-sm text-gray-700' },
            h('span', { className: 'font-semibold' }, 'Cliente: '),
            client.name
          ),
          h('p', { className: 'text-sm text-gray-600' },
            h('span', { className: 'font-semibold' }, 'WhatsApp: '),
            client.whatsapp_number
          ),
          h('p', { className: 'text-xs text-purple-600 mt-2' },
            '💡 Selecione o cliente correspondente do painel Club (dashboard.bz)'
          )
        )
      ),

      // Content
      h('div', { className: 'flex-1 overflow-auto p-6' },
        // Campo de busca
        h('div', { className: 'mb-4' },
          h('input', {
            type: 'text',
            placeholder: '🔍 Buscar por ID, Username ou Nome...',
            value: search,
            onChange: (e) => setSearch(e.target.value),
            className: 'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-sm',
            autoFocus: true
          })
        ),

        // Loading
        loading ? (
          h('div', { className: 'text-center py-12' },
            h('div', { className: 'inline-block animate-spin rounded-full h-12 w-12 border-b-4 border-purple-600 mb-4' }),
            h('p', { className: 'text-gray-600' }, 'Carregando clientes Club...')
          )
        ) : clubClients.length === 0 ? (
          // Sem clientes
          h('div', { className: 'text-center py-12' },
            h('div', { className: 'text-6xl mb-4' }, '📭'),
            h('p', { className: 'text-gray-600 text-lg mb-2' }, 'Nenhum cliente Club encontrado'),
            h('p', { className: 'text-gray-500 text-sm mb-4' }, 
              'Capture os clientes Club primeiro no botão "Capturar Clientes Club"'
            ),
            h('button', {
              onClick: onClose,
              className: 'px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition'
            }, 'Fechar')
          )
        ) : filteredClients.length === 0 ? (
          // Busca sem resultados
          h('div', { className: 'text-center py-12' },
            h('div', { className: 'text-6xl mb-4' }, '🔍'),
            h('p', { className: 'text-gray-600 text-lg' }, 'Nenhum cliente encontrado'),
            h('p', { className: 'text-gray-500 text-sm' }, 'Tente outro termo de busca')
          )
        ) : (
          // Lista de clientes
          h('div', { className: 'space-y-2' },
            filteredClients.map(clubClient =>
              h('button', {
                key: clubClient.id,
                onClick: () => handleSync(clubClient),
                disabled: syncing,
                className: 'w-full p-4 bg-white hover:bg-purple-50 disabled:bg-gray-100 border-2 border-gray-200 hover:border-purple-400 disabled:border-gray-200 rounded-lg transition text-left group'
              },
                h('div', { className: 'flex items-center justify-between' },
                  h('div', { className: 'flex-1' },
                    h('div', { className: 'flex items-center gap-3 mb-2' },
                      h('span', { className: 'text-2xl' }, '🎯'),
                      h('div', null,
                        h('div', { className: 'font-bold text-gray-800 text-lg' },
                          clubClient.reseller_notes || clubClient.username
                        ),
                        clubClient.reseller_notes && clubClient.username && (
                          h('div', { className: 'text-sm text-gray-600' },
                            `Username: ${clubClient.username}`
                          )
                        )
                      )
                    ),
                    
                    h('div', { className: 'grid grid-cols-2 gap-4 mt-2' },
                      h('div', null,
                        h('span', { className: 'text-xs text-gray-500' }, 'ID Club: '),
                        h('span', { className: 'text-sm font-mono font-semibold text-purple-600' }, 
                          clubClient.client_id
                        )
                      ),
                      clubClient.status && h('div', null,
                        h('span', {
                          className: `text-xs px-2 py-1 rounded ${
                            clubClient.status === 'active' || clubClient.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`
                        }, clubClient.status)
                      )
                    ),

                    clubClient.exp_date && h('div', { className: 'text-xs text-gray-500 mt-1' },
                      `Vencimento: ${new Date(clubClient.exp_date).toLocaleDateString('pt-BR')}`
                    )
                  ),
                  
                  h('div', { className: 'text-3xl text-purple-600 group-hover:scale-110 transition-transform' }, 
                    '▶️'
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
            filteredClients.length > 0 && 
              `${filteredClients.length} cliente(s) encontrado(s)`
          ),
          h('button', {
            onClick: onClose,
            disabled: syncing,
            className: 'px-6 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg transition font-medium'
          }, 'Fechar')
        )
      )
    )
  );
}