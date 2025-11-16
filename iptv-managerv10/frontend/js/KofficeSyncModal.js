/* ========================================
   KOFFICE SYNC MODAL
   Modal para sincronizar clientes Koffice com PostgreSQL
   
   INSTRUÇÕES:
   Adicionar este arquivo em: iptv-managerv5/frontend/js/KofficeSyncModal.js
   ======================================== */

function KofficeSyncModal({ isOpen, onClose, client, onSync, syncing }) {
  const { useState, useEffect, createElement: h } = React;
  
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [kofficeClients, setKofficeClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDomains();
      setSelectedDomain('');
      setKofficeClients([]);
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDomain) {
      loadKofficeClients(selectedDomain);
    }
  }, [selectedDomain]);

  async function loadDomains() {
    try {
      setLoading(true);
      const data = await kofficeAPI.listDomainsWithClients();
      setDomains(data);
    } catch (error) {
      console.error('Erro ao carregar domínios:', error);
      alert('Erro ao carregar domínios: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadKofficeClients(domain) {
    try {
      setLoading(true);
      const data = await kofficeAPI.listClients(domain);
      setKofficeClients(data.clients || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      alert('Erro ao carregar clientes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = kofficeClients.filter(c => {
    const searchLower = search.toLowerCase();
    return (
      c.client_name?.toLowerCase().includes(searchLower) ||
      c.username?.toLowerCase().includes(searchLower) ||
      c.client_id?.toLowerCase().includes(searchLower)
    );
  });

  function handleSync(kofficeClient) {
    onSync(kofficeClient);
  }

  if (!isOpen || !client) return null;

  return h('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    onClick: () => !syncing && onClose()
  },
    h('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[85vh] overflow-hidden flex flex-col',
      onClick: (e) => e.stopPropagation()
    },
      // Header
      h('div', { className: 'p-6 border-b flex-shrink-0' },
        h('h2', { className: 'text-xl font-bold text-gray-800 flex items-center gap-2' },
          '🔄 Sincronizar com Koffice'
        ),
        h('p', { className: 'text-sm text-gray-600 mt-1' },
          'Cliente: ',
          h('span', { className: 'font-medium' }, client.name)
        )
      ),

      // Body
      h('div', { className: 'flex-1 overflow-y-auto' },
        h('div', { className: 'p-6' },
          // Seleção de domínio
          h('div', { className: 'mb-4' },
            h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' },
              'Selecione o Domínio Koffice'
            ),
            loading && domains.length === 0 ?
              h('div', { className: 'py-2' },
                h('div', { className: 'animate-pulse flex items-center gap-2' },
                  h('div', { className: 'h-10 bg-gray-200 rounded flex-1' })
                )
              ) :
            domains.length === 0 ?
              h('div', { className: 'text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed' },
                h('p', { className: 'text-3xl mb-2' }, '📭'),
                h('p', { className: 'text-gray-600' }, 'Nenhum domínio com clientes capturados'),
                h('p', { className: 'text-sm text-gray-500 mt-1' }, 'Capture clientes primeiro')
              ) :
              h('select', {
                value: selectedDomain,
                onChange: (e) => setSelectedDomain(e.target.value),
                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500',
                disabled: syncing
              },
                h('option', { value: '' }, 'Selecione um domínio...'),
                domains.map(domain =>
                  h('option', {
                    key: `${domain.domain}-${domain.reseller_id}`,
                    value: domain.domain
                  }, `${domain.domain} (${domain.client_count} clientes | Reseller: ${domain.reseller_id})`)
                )
              )
          ),

          // Campo de busca
          selectedDomain && h('div', { className: 'mb-4' },
            h('input', {
              type: 'text',
              placeholder: '🔍 Buscar por nome, username ou ID...',
              value: search,
              onChange: (e) => setSearch(e.target.value),
              className: 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500',
              disabled: syncing
            })
          ),

          // Lista de clientes
          selectedDomain && (
            loading ?
              h('div', { className: 'text-center py-8' },
                h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600' }),
                h('p', { className: 'mt-2 text-gray-600' }, 'Carregando clientes...')
              ) :
            filteredClients.length === 0 ?
              h('div', { className: 'text-center py-8 bg-gray-50 rounded-lg' },
                h('p', { className: 'text-3xl mb-2' }, '🔍'),
                h('p', { className: 'text-gray-600' }, 
                  search ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponível'
                )
              ) :
              h('div', { className: 'space-y-2 max-h-96 overflow-y-auto' },
                filteredClients.map(kc =>
                  h('div', {
                    key: kc.id,
                    className: 'p-4 border rounded-lg hover:shadow-md transition cursor-pointer bg-white hover:bg-orange-50',
                    onClick: () => !syncing && handleSync(kc)
                  },
                    h('div', { className: 'flex justify-between items-start' },
                      h('div', { className: 'flex-1' },
                        h('div', { className: 'flex items-center gap-2 mb-2' },
                          h('span', { className: 'text-lg' }, '👤'),
                          h('span', { className: 'font-semibold text-gray-800' }, 
                            kc.client_name || 'Sem nome'
                          ),
                          kc.expiry_date && new Date(kc.expiry_date) >= new Date() &&
                            h('span', { className: 'px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full' }, 
                              '✓ Ativo'
                            )
                        ),
                        h('div', { className: 'grid grid-cols-2 gap-2 text-sm' },
                          h('div', null,
                            h('span', { className: 'text-gray-600' }, '🆔 ID: '),
                            h('span', { className: 'font-mono' }, kc.client_id)
                          ),
                          h('div', null,
                            h('span', { className: 'text-gray-600' }, '👤 Username: '),
                            h('span', { className: 'font-mono' }, kc.username)
                          ),
                          kc.expiry_date && h('div', null,
                            h('span', { className: 'text-gray-600' }, '📅 Expira: '),
                            h('span', null, new Date(kc.expiry_date).toLocaleDateString('pt-BR'))
                          ),
                          kc.screens && h('div', null,
                            h('span', { className: 'text-gray-600' }, '📺 Telas: '),
                            h('span', null, kc.screens)
                          )
                        )
                      ),
                      h('button', {
                        onClick: (e) => {
                          e.stopPropagation();
                          handleSync(kc);
                        },
                        disabled: syncing,
                        className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50 transition'
                      }, syncing ? '⏳' : '🔄 Sincronizar')
                    )
                  )
                )
              )
          )
        )
      ),

      // Footer
      h('div', { className: 'p-4 border-t bg-gray-50 flex-shrink-0' },
        h('div', { className: 'flex justify-between items-center' },
          h('p', { className: 'text-sm text-gray-600' },
            selectedDomain ? 
              `${filteredClients.length} cliente(s) disponível(is)` :
              'Selecione um domínio para ver os clientes'
          ),
          h('button', {
            onClick: onClose,
            disabled: syncing,
            className: 'px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-700 rounded-lg transition'
          }, 'Fechar')
        )
      )
    )
  );
}
