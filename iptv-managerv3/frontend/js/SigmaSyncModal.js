/* ========================================
   SIGMA SYNC MODAL
   Modal para sincronizar pacotes
   ======================================== */

function SigmaSyncModal() {
  const { useState, useEffect, createElement: h } = React;
  
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [packages, setPackages] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDomain) {
      loadPackages();
    }
  }, [selectedDomain]);

  async function loadCredentials() {
    try {
      const data = await sigmaAPI.listCredentials();
      setCredentials(data);
      
      if (data.length > 0) {
        setSelectedDomain(data[0].domain);
      }
    } catch (error) {
      alert('Erro ao carregar credenciais: ' + error.message);
    }
  }

  async function loadPackages() {
    if (!selectedDomain) return;

    try {
      setLoading(true);
      const data = await sigmaAPI.listPackages(selectedDomain);
      setPackages(data.packages || []);
      setSelectedPackages([]);
    } catch (error) {
      alert('Erro ao carregar pacotes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function togglePackage(packageId) {
    setSelectedPackages(prev => {
      if (prev.includes(packageId)) {
        return prev.filter(id => id !== packageId);
      } else {
        return [...prev, packageId];
      }
    });
  }

  function toggleAll() {
    if (selectedPackages.length === packages.length) {
      setSelectedPackages([]);
    } else {
      setSelectedPackages(packages.map(p => p.id));
    }
  }

  async function handleSync() {
    if (selectedPackages.length === 0) {
      alert('Selecione pelo menos um pacote');
      return;
    }

    if (!confirm(`Deseja sincronizar ${selectedPackages.length} pacote(s) com o gestao-clientes?`)) {
      return;
    }

    try {
      setSyncing(true);
      const result = await sigmaAPI.syncPackages(selectedDomain, selectedPackages);
      
      const { created, updated, errors } = result.results;
      
      let message = `✅ Sincronização concluída!\n\n`;
      message += `➕ Criados: ${created}\n`;
      message += `🔄 Atualizados: ${updated}\n`;
      
      if (errors.length > 0) {
        message += `\n⚠️ Erros: ${errors.length}`;
      }
      
      alert(message);
      setSelectedPackages([]);
      
    } catch (error) {
      alert('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }

  if (!isOpen) {
    return h('button', {
      onClick: () => setIsOpen(true),
      className: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2'
    }, '🔄 Sincronizar Planos Sigma');
  }

  return h('div', { 
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' 
  },
    h('div', { 
      className: 'bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto' 
    },
      h('div', { className: 'flex items-center justify-between p-6 border-b' },
        h('div', null,
          h('h2', { className: 'text-2xl font-bold text-gray-800' }, '🔄 Sincronizar Planos Sigma'),
          h('p', { className: 'text-sm text-gray-600 mt-1' }, 
            'Selecione os pacotes que deseja adicionar ao gestao-clientes'
          )
        ),
        h('button', {
          onClick: () => setIsOpen(false),
          className: 'text-gray-500 hover:text-gray-700 text-2xl'
        }, '×')
      ),

      h('div', { className: 'p-6' },
        h('div', { className: 'mb-6' },
          h('label', { className: 'block text-sm font-medium mb-2' }, 'Selecionar Domínio'),
          h('select', {
            value: selectedDomain,
            onChange: (e) => setSelectedDomain(e.target.value),
            className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
            disabled: loading || syncing
          },
            h('option', { value: '' }, 'Selecione um domínio'),
            credentials.map((cred) =>
              h('option', { key: cred.domain, value: cred.domain }, cred.domain)
            )
          )
        ),

        credentials.length === 0 && h('div', { className: 'p-4 bg-yellow-50 border border-yellow-200 rounded-lg' },
          h('p', { className: 'text-yellow-800' },
            '⚠️ Nenhuma credencial cadastrada. Cadastre uma credencial primeiro.'
          )
        ),

        selectedDomain && (
          loading ? 
            h('div', { className: 'text-center py-8' },
              h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' }),
              h('p', { className: 'mt-2 text-gray-600' }, 'Carregando pacotes...')
            ) : packages.length === 0 ?
            h('div', { className: 'text-center py-8 text-gray-500' },
              'Nenhum pacote encontrado. Carregue os pacotes primeiro na página "Pacotes Sigma".'
            ) :
            h('div', null,
              h('div', { className: 'flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg' },
                h('label', { className: 'flex items-center gap-2 cursor-pointer' },
                  h('input', {
                    type: 'checkbox',
                    checked: selectedPackages.length === packages.length && packages.length > 0,
                    onChange: toggleAll,
                    className: 'w-4 h-4 text-blue-600'
                  }),
                  h('span', { className: 'font-medium' }, `Selecionar todos (${packages.length})`)
                ),
                
                h('div', { className: 'text-sm text-gray-600' },
                  `${selectedPackages.length} selecionado(s)`
                )
              ),

              h('div', { className: 'border rounded-lg overflow-hidden' },
                h('div', { className: 'max-h-96 overflow-y-auto' },
                  h('table', { className: 'w-full' },
                    h('thead', { className: 'bg-gray-50 sticky top-0' },
                      h('tr', null,
                        h('th', { className: 'px-4 py-3 text-left w-12' }),
                        h('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'ID'),
                        h('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Nome'),
                        h('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Duração'),
                        h('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Conexões'),
                        h('th', { className: 'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Servidor')
                      )
                    ),
                    h('tbody', { className: 'divide-y divide-gray-200' },
                      packages.map((pkg) =>
                        h('tr', { 
                          key: pkg.id, 
                          className: `hover:bg-gray-50 cursor-pointer ${
                            selectedPackages.includes(pkg.id) ? 'bg-blue-50' : ''
                          }`,
                          onClick: () => togglePackage(pkg.id)
                        },
                          h('td', { className: 'px-4 py-3' },
                            h('input', {
                              type: 'checkbox',
                              checked: selectedPackages.includes(pkg.id),
                              onChange: () => togglePackage(pkg.id),
                              className: 'w-4 h-4 text-blue-600',
                              onClick: (e) => e.stopPropagation()
                            })
                          ),
                          h('td', { className: 'px-4 py-3 text-sm font-mono text-gray-600' }, pkg.id),
                          h('td', { className: 'px-4 py-3 text-sm font-medium text-gray-800' }, pkg.nome),
                          h('td', { className: 'px-4 py-3 text-sm text-gray-600' },
                            `${pkg.duracao} ${pkg.duracao_tipo === 'MONTHS' ? 'meses' : 'dias'}`
                          ),
                          h('td', { className: 'px-4 py-3 text-sm text-gray-600' }, pkg.conexoes),
                          h('td', { className: 'px-4 py-3 text-sm text-gray-600' }, pkg.servidor_nome || '-')
                        )
                      )
                    )
                  )
                )
              )
            )
        )
      ),

      h('div', { className: 'p-6 border-t bg-gray-50 flex justify-between items-center' },
        h('div', { className: 'text-sm text-gray-600' },
          selectedPackages.length > 0 && h('span', { className: 'font-medium' },
            `${selectedPackages.length} pacote(s) selecionado(s)`
          )
        ),
        
        h('div', { className: 'flex gap-2' },
          h('button', {
            onClick: () => setIsOpen(false),
            className: 'px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400',
            disabled: syncing
          }, 'Cancelar'),
          
          h('button', {
            onClick: handleSync,
            disabled: selectedPackages.length === 0 || syncing,
            className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
          },
            syncing ? 
              h('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }) :
              '🔄',
            syncing ? 'Sincronizando...' : 
              selectedPackages.length > 0 ? `Sincronizar (${selectedPackages.length})` : 'Sincronizar'
          )
        )
      )
    )
  );
}