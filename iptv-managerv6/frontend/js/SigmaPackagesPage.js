/* ========================================
   SIGMA PACKAGES PAGE
   Página para visualizar e carregar pacotes
   ======================================== */

function SigmaPackagesPage() {
  const { useState, useEffect, createElement: h } = React;
  
  const [credentials, setCredentials] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [packages, setPackages] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, trial: 0 });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    loadCredentials();
  }, []);

  useEffect(() => {
    if (selectedDomain) {
      loadPackages();
    }
  }, [selectedDomain]);

  async function loadCredentials() {
    try {
      const data = await sigmaAPI.listCredentials();
      setCredentials(data);
      
      if (data.length > 0 && !selectedDomain) {
        setSelectedDomain(data[0].domain);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  }

  async function loadPackages() {
    if (!selectedDomain) return;

    try {
      setLoading(true);
      const data = await sigmaAPI.listPackages(selectedDomain);
      setPackages(data.packages || []);
      setStats(data.stats || { total: 0, active: 0, trial: 0 });
    } catch (error) {
      console.error('Erro ao carregar pacotes:', error);
      alert('Erro ao carregar pacotes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFetchPackages() {
    if (!selectedDomain) {
      alert('Selecione um domínio');
      return;
    }

    if (!confirm('Deseja buscar pacotes do Sigma? Isso pode levar 1-2 minutos.')) {
      return;
    }

    try {
      setFetching(true);
      const result = await sigmaAPI.fetchPackages(selectedDomain);
      alert(`✅ ${result.total} pacotes capturados com sucesso!`);
      await loadPackages();
    } catch (error) {
      alert('Erro ao buscar pacotes: ' + error.message);
    } finally {
      setFetching(false);
    }
  }

  return h('div', { className: 'space-y-6' },
    h('div', { className: 'flex items-center justify-between' },
      h('h1', { className: 'text-3xl font-bold' }, '📦 Pacotes Sigma')
    ),

    h('div', { className: 'bg-white rounded-lg shadow p-6' },
      h('div', { className: 'flex flex-col sm:flex-row gap-4' },
        h('div', { className: 'flex-1' },
          h('label', { className: 'block text-sm font-medium mb-2' }, 'Selecionar Domínio'),
          h('select', {
            value: selectedDomain,
            onChange: (e) => setSelectedDomain(e.target.value),
            className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500',
            disabled: loading || fetching
          },
            h('option', { value: '' }, 'Selecione um domínio'),
            credentials.map((cred) =>
              h('option', { key: cred.domain, value: cred.domain }, cred.domain)
            )
          )
        ),

        h('div', { className: 'flex items-end' },
          h('button', {
            onClick: handleFetchPackages,
            disabled: !selectedDomain || fetching,
            className: 'px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
          },
            fetching ? 
              h('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }) :
              '📥',
            fetching ? 'Carregando...' : 'Carregar Pacotes'
          )
        )
      ),

      credentials.length === 0 && h('div', { className: 'mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg' },
        h('p', { className: 'text-yellow-800' },
          '⚠️ Nenhuma credencial cadastrada. Cadastre uma credencial primeiro no botão "🔑 Credenciais Sigma".'
        )
      )
    ),

    selectedDomain && h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
      h('div', { className: 'bg-white rounded-lg shadow p-6' },
        h('div', { className: 'text-sm text-gray-600' }, 'Total de Pacotes'),
        h('div', { className: 'text-3xl font-bold text-gray-800' }, stats.total)
      ),
      
      h('div', { className: 'bg-white rounded-lg shadow p-6' },
        h('div', { className: 'text-sm text-gray-600' }, 'Pacotes Ativos'),
        h('div', { className: 'text-3xl font-bold text-green-600' }, stats.active)
      ),
      
      h('div', { className: 'bg-white rounded-lg shadow p-6' },
        h('div', { className: 'text-sm text-gray-600' }, 'Pacotes Teste'),
        h('div', { className: 'text-3xl font-bold text-blue-600' }, stats.trial)
      )
    ),

    selectedDomain && h('div', { className: 'bg-white rounded-lg shadow overflow-hidden' },
      h('div', { className: 'px-6 py-4 border-b' },
        h('h2', { className: 'text-xl font-semibold' }, 'Lista de Pacotes')
      ),

      loading ? 
        h('div', { className: 'text-center py-12' },
          h('div', { className: 'inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600' }),
          h('p', { className: 'mt-4 text-gray-600' }, 'Carregando pacotes...')
        ) : packages.length === 0 ?
        h('div', { className: 'text-center py-12 text-gray-500' },
          'Nenhum pacote encontrado. Clique em "Carregar Pacotes" para buscar.'
        ) :
        h('div', { className: 'overflow-x-auto' },
          h('table', { className: 'w-full' },
            h('thead', { className: 'bg-gray-50' },
              h('tr', null,
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'ID'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Nome'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Servidor'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Duração'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Conexões'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Status'),
                h('th', { className: 'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase' }, 'Tipo')
              )
            ),
            h('tbody', { className: 'divide-y divide-gray-200' },
              packages.map((pkg) =>
                h('tr', { key: pkg.id, className: 'hover:bg-gray-50' },
                  h('td', { className: 'px-6 py-4 text-sm font-mono text-gray-600' }, pkg.id),
                  h('td', { className: 'px-6 py-4 text-sm font-medium text-gray-800' }, pkg.nome),
                  h('td', { className: 'px-6 py-4 text-sm text-gray-600' }, pkg.servidor_nome || '-'),
                  h('td', { className: 'px-6 py-4 text-sm text-gray-600' },
                    `${pkg.duracao} ${pkg.duracao_tipo === 'MONTHS' ? 'meses' : pkg.duracao_tipo === 'DAYS' ? 'dias' : pkg.duracao_tipo}`
                  ),
                  h('td', { className: 'px-6 py-4 text-sm text-gray-600' }, pkg.conexoes),
                  h('td', { className: 'px-6 py-4' },
                    h('span', { 
                      className: `px-2 py-1 text-xs rounded-full ${
                        pkg.status === 'ACTIVE' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`
                    }, pkg.status || 'N/A')
                  ),
                  h('td', { className: 'px-6 py-4' },
                    pkg.is_teste === 'YES' && h('span', { className: 'px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 mr-1' }, 'Teste'),
                    pkg.is_mag === 'YES' && h('span', { className: 'px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 mr-1' }, 'MAG')
                  )
                )
              )
            )
          )
        )
    )
  );
}