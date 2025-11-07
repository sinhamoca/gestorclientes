/* ========================================
   RENEWAL MODAL COMPONENT - COM SUPORTE KOFFICE
   Modal moderno para renovação de clientes
   
   ARQUIVO: gestao-clientesv14/user-system/js/components/RenewalModal.js
   SUBSTITUA O ARQUIVO COMPLETO POR ESTE
   ======================================== */

/* ========================================
   RENEWAL MODAL COMPONENT - VERSÃO OTIMIZADA
   Modal compacto para renovação de clientes
   ======================================== */

function RenewalModal({ client, onClose, onSuccess }) {
  const { useState, createElement: h } = React;
  
  const [loading, setLoading] = useState(false);
  const [renewOptions, setRenewOptions] = useState({
    register_payment: true,
    renew_in_iptv: false
  });

  // Verificar se o cliente tem integração ativa
  const hasIntegration = client.is_sigma_plan || client.is_live21_plan || client.is_koffice_plan || client.is_uniplay_plan;
  
  // Nome da integração
  const integrationName = client.is_sigma_plan ? 'Sigma' : 
                          client.is_koffice_plan ? 'Koffice' :
                          client.is_uniplay_plan ? 'Uniplay' :
                          'CloudNation (Live21)';

  const handleRenew = async () => {
    setLoading(true);
    
    try {
      const response = await api.renewClient(client.id, { 
        register_payment: renewOptions.register_payment,
        renew_in_iptv: renewOptions.renew_in_iptv,
        payment_method: 'pix' 
      });
      
      // Construir mensagem de sucesso
      let message = `✅ Cliente renovado com sucesso!\n\n`;
      message += `📅 Nova data: ${new Date(response.client.due_date).toLocaleDateString('pt-BR')}\n`;
      
      if (renewOptions.register_payment && response.transaction) {
        message += `💰 Valor: R$ ${response.transaction.amount_received}\n`;
      }
      
      if (renewOptions.renew_in_iptv && response.iptv_renewal) {
        if (response.iptv_renewal.success) {
          message += `\n🌐 Renovado no ${integrationName}: ✅ Sucesso!`;
        } else {
          message += `\n⚠️ Falha ao renovar no ${integrationName}`;
        }
      }
      
      alert(message);
      onSuccess();
      onClose();
      
    } catch (error) {
      alert(`❌ Erro ao renovar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Background overlay
  return h('div', { 
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50',
    onClick: onClose
  },
    // Modal container - REDUZIDO DE max-w-md PARA max-w-sm E ADICIONADO max-h-[90vh]
    h('div', { 
      className: 'bg-white rounded-lg shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto',
      onClick: (e) => e.stopPropagation()
    },
      
      // Header - PADDING REDUZIDO
      h('div', { className: 'p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700' },
        h('div', { className: 'flex justify-between items-center' },
          h('div', null,
            h('h3', { className: 'text-lg font-bold text-white' }, '🔄 Renovar Cliente'),
            h('p', { className: 'text-blue-100 text-xs mt-1' }, client.name)
          ),
          h('button', { 
            onClick: onClose,
            className: 'text-white hover:text-gray-200 transition'
          },
            h('svg', { className: 'w-5 h-5', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' })
            )
          )
        )
      ),

      // Body - PADDING E ESPAÇAMENTO REDUZIDOS
      h('div', { className: 'p-4 space-y-3' },
        
        // Info do Cliente - MAIS COMPACTA
        h('div', { className: 'bg-gray-50 rounded-lg p-3 space-y-1.5' },
          h('div', { className: 'flex justify-between text-xs' },
            h('span', { className: 'text-gray-600' }, '📋 Plano:'),
            h('span', { className: 'font-medium' }, client.plan_name || 'N/A')
          ),
          h('div', { className: 'flex justify-between text-xs' },
            h('span', { className: 'text-gray-600' }, '📅 Vencimento:'),
            h('span', { className: 'font-medium' }, new Date(client.due_date).toLocaleDateString('pt-BR'))
          ),
          h('div', { className: 'flex justify-between text-xs' },
            h('span', { className: 'text-gray-600' }, '💰 Valor:'),
            h('span', { className: 'font-medium' }, `R$ ${parseFloat(client.price_value).toFixed(2)}`)
          ),
          hasIntegration && h('div', { className: 'flex justify-between text-xs' },
            h('span', { className: 'text-gray-600' }, '🔌 Integração:'),
            h('span', { className: 'font-medium text-green-600' }, 
              `${integrationName} ${client.is_sigma_plan ? '⚡' : client.is_koffice_plan ? '🟠' : client.is_uniplay_plan ? '🔵' : '🌐'}`
            )
          )
        ),

        // Opções de Renovação - MAIS COMPACTAS
        h('div', { className: 'space-y-2' },
          h('h4', { className: 'font-semibold text-gray-800 text-sm' }, 'Opções:'),
          
          // Opção 1: Registrar Pagamento
          h('label', { className: 'flex items-start gap-2 p-2.5 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition' },
            h('input', {
              type: 'checkbox',
              checked: renewOptions.register_payment,
              onChange: (e) => setRenewOptions({
                ...renewOptions,
                register_payment: e.target.checked
              }),
              className: 'mt-0.5 w-4 h-4'
            }),
            h('div', { className: 'flex-1' },
              h('span', { className: 'font-medium text-gray-800 text-sm' }, '💰 Registrar Pagamento'),
              h('p', { className: 'text-xs text-gray-600 mt-0.5' }, 'Registra a transação financeira')
            )
          ),

          // Opção 2: Renovar no IPTV Manager
          hasIntegration ? 
            h('label', { className: 'flex items-start gap-2 p-2.5 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition border-green-300 bg-green-50' },
              h('input', {
                type: 'checkbox',
                checked: renewOptions.renew_in_iptv,
                onChange: (e) => setRenewOptions({
                  ...renewOptions,
                  renew_in_iptv: e.target.checked
                }),
                className: 'mt-0.5 w-4 h-4'
              }),
              h('div', { className: 'flex-1' },
                h('span', { className: 'font-medium text-gray-800 text-sm' }, 
                  `${client.is_sigma_plan ? '⚡' : client.is_koffice_plan ? '🟠' : '🌐'} Renovar no ${integrationName}`
                ),
                h('p', { className: 'text-xs text-gray-600 mt-0.5' }, 
                  `Renova no painel externo`
                ),
                h('p', { className: 'text-xs text-green-700 mt-0.5' }, '✅ Integração ativa')
              )
            )
          :
            h('div', { className: 'flex items-start gap-2 p-2.5 border-2 border-dashed rounded-lg bg-gray-50 opacity-60' },
              h('input', {
                type: 'checkbox',
                disabled: true,
                className: 'mt-0.5 w-4 h-4'
              }),
              h('div', { className: 'flex-1' },
                h('span', { className: 'font-medium text-gray-500 text-sm' }, '🔌 Renovar no IPTV'),
                h('p', { className: 'text-xs text-gray-500 mt-0.5' }, '⚠️ Sem integração ativa'),
                h('p', { className: 'text-xs text-gray-400 mt-0.5' }, 'Configure Sigma, Live21, Koffice ou Uniplay')
              )
            )
        ),

        // Aviso - MAIS COMPACTO
        h('div', { className: 'bg-blue-50 border-l-4 border-blue-500 p-2 rounded' },
          h('p', { className: 'text-xs text-blue-800' },
            h('strong', null, 'ℹ️ '),
            'Cliente será renovado no banco independente das opções.'
          )
        )
      ),

      // Footer - PADDING REDUZIDO
      h('div', { className: 'p-4 border-t bg-gray-50 flex gap-2' },
        h('button', {
          onClick: onClose,
          disabled: loading,
          className: 'flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50 text-sm'
        }, 'Cancelar'),
        h('button', {
          onClick: handleRenew,
          disabled: loading,
          className: 'flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed text-sm'
        }, loading ? 
          h('span', null,
            h('span', { className: 'inline-block animate-spin mr-2' }, '⏳'),
            'Renovando...'
          )
          : '✅ Renovar'
        )
      )
    )
  );
}