/* ========================================
   KOFFICE CLIENT CAPTURE MODAL
   Modal para capturar clientes de domínios Koffice
   
   INSTRUÇÕES:
   Adicionar este arquivo em: iptv-managerv5/frontend/js/KofficeClientCaptureModal.js
   ======================================== */

function KofficeClientCaptureModal({ isOpen, onClose, onCapture, capturing }) {
  const { useState, useEffect, createElement: h } = React;
  
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDomains();
    }
  }, [isOpen]);

  async function loadDomains() {
    try {
      setLoading(true);
      const data = await kofficeAPI.listCredentials();
      setDomains(data);
      if (data.length > 0) {
        setSelectedDomain(data[0].domain);
      }
    } catch (error) {
      alert('Erro ao carregar domínios: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCapture() {
    if (!selectedDomain) {
      alert('Selecione um domínio');
      return;
    }
    onCapture(selectedDomain);
  }

  if (!isOpen) return null;

  return h('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
    onClick: () => !capturing && onClose()
  },
    h('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-md w-full mx-4',
      onClick: (e) => e.stopPropagation()
    },
      // Header
      h('div', { className: 'p-6 border-b' },
        h('h2', { className: 'text-xl font-bold text-gray-800' }, '👥 Capturar Clientes Koffice')
      ),

      // Body
      h('div', { className: 'p-6' },
        loading ? 
          h('div', { className: 'text-center py-8' },
            h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600' }),
            h('p', { className: 'mt-2 text-gray-600' }, 'Carregando domínios...')
          ) :
        domains.length === 0 ?
          h('div', { className: 'text-center py-8' },
            h('p', { className: 'text-3xl mb-2' }, '⚠️'),
            h('p', { className: 'text-gray-600' }, 'Nenhum domínio cadastrado'),
            h('p', { className: 'text-sm text-gray-500 mt-2' }, 'Cadastre credenciais primeiro')
          ) :
          h('div', null,
            h('div', { className: 'mb-4' },
              h('label', { className: 'block text-sm font-medium text-gray-700 mb-2' }, 
                'Selecione o Domínio'
              ),
              h('select', {
                value: selectedDomain,
                onChange: (e) => setSelectedDomain(e.target.value),
                className: 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent',
                disabled: capturing
              },
                domains.map(domain =>
                  h('option', {
                    key: domain.domain,
                    value: domain.domain
                  }, `${domain.domain} (Reseller: ${domain.reseller_id})`)
                )
              )
            ),

            h('div', { className: 'bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4' },
              h('p', { className: 'text-sm text-blue-800' },
                '⚠️ ',
                h('strong', null, 'Atenção: '),
                'A captura pode demorar alguns minutos, especialmente se o painel tiver hCaptcha ou muitos clientes.'
              )
            ),

            selectedDomain && h('div', { className: 'bg-gray-50 rounded-lg p-3 text-sm' },
              h('div', { className: 'flex items-start gap-2' },
                h('span', null, '🌐'),
                h('div', { className: 'flex-1' },
                  h('p', { className: 'font-medium text-gray-800' }, 'Domínio Selecionado:'),
                  h('p', { className: 'text-gray-600 break-all' }, selectedDomain),
                  h('p', { className: 'text-gray-500 mt-1 text-xs' }, 
                    domains.find(d => d.domain === selectedDomain)?.reseller_id && 
                    `Reseller ID: ${domains.find(d => d.domain === selectedDomain).reseller_id}`
                  )
                )
              )
            )
          )
      ),

      // Footer
      h('div', { className: 'p-6 border-t flex gap-2' },
        h('button', {
          onClick: handleCapture,
          disabled: capturing || loading || !selectedDomain,
          className: 'flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition flex items-center justify-center gap-2'
        },
          capturing && h('div', { className: 'animate-spin rounded-full h-4 w-4 border-b-2 border-white' }),
          capturing ? 'Capturando...' : '📥 Capturar Clientes'
        ),
        h('button', {
          onClick: onClose,
          disabled: capturing,
          className: 'px-4 py-2 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-700 rounded-lg font-medium transition'
        }, 'Cancelar')
      )
    )
  );
}
