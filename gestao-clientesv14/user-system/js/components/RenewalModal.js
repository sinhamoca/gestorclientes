/* ========================================
   RENEWAL MODAL COMPONENT
   Modal moderno para renovação de clientes
   Salvar em: user-system/js/components/RenewalModal.js
   ======================================== */

function RenewalModal({ client, onClose, onSuccess }) {
  const { useState, createElement: h } = React;
  
  const [loading, setLoading] = useState(false);
  const [renewOptions, setRenewOptions] = useState({
    register_payment: true,
    renew_in_iptv: false
  });

  // Verificar se o cliente tem integração ativa
  const hasIntegration = client.is_sigma_plan || client.is_live21_plan;
  const integrationName = client.is_sigma_plan ? 'Sigma' : 'CloudNation (Live21)';

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
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50' 
  },
    // Modal container
    h('div', { className: 'bg-white rounded-lg shadow-2xl max-w-md w-full' },
      
      // Header
      h('div', { className: 'p-6 border-b bg-gradient-to-r from-blue-600 to-blue-700' },
        h('div', { className: 'flex justify-between items-center' },
          h('div', null,
            h('h3', { className: 'text-xl font-bold text-white' }, '🔄 Renovar Cliente'),
            h('p', { className: 'text-blue-100 text-sm mt-1' }, client.name)
          ),
          h('button', { 
            onClick: onClose,
            className: 'text-white hover:text-gray-200 transition'
          },
            h('svg', { className: 'w-6 h-6', fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' },
              h('path', { strokeLinecap: 'round', strokeLinejoin: 'round', strokeWidth: 2, d: 'M6 18L18 6M6 6l12 12' })
            )
          )
        )
      ),

      // Body
      h('div', { className: 'p-6 space-y-4' },
        
        // Info do Cliente
        h('div', { className: 'bg-gray-50 rounded-lg p-4 space-y-2' },
          h('div', { className: 'flex justify-between text-sm' },
            h('span', { className: 'text-gray-600' }, '📋 Plano:'),
            h('span', { className: 'font-medium' }, client.plan_name || 'N/A')
          ),
          h('div', { className: 'flex justify-between text-sm' },
            h('span', { className: 'text-gray-600' }, '📅 Vencimento atual:'),
            h('span', { className: 'font-medium' }, new Date(client.due_date).toLocaleDateString('pt-BR'))
          ),
          h('div', { className: 'flex justify-between text-sm' },
            h('span', { className: 'text-gray-600' }, '💰 Valor:'),
            h('span', { className: 'font-medium' }, `R$ ${parseFloat(client.price_value).toFixed(2)}`)
          ),
          hasIntegration && h('div', { className: 'flex justify-between text-sm' },
            h('span', { className: 'text-gray-600' }, '🔌 Integração:'),
            h('span', { className: 'font-medium text-green-600' }, 
              `${integrationName} ${client.is_sigma_plan ? '⚡' : '🌐'}`
            )
          )
        ),

        // Opções de Renovação
        h('div', { className: 'space-y-3' },
          h('h4', { className: 'font-semibold text-gray-800' }, 'Opções de Renovação:'),
          
          // Opção 1: Registrar Pagamento
          h('label', { className: 'flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition' },
            h('input', {
              type: 'checkbox',
              checked: renewOptions.register_payment,
              onChange: (e) => setRenewOptions({
                ...renewOptions,
                register_payment: e.target.checked
              }),
              className: 'mt-1 w-5 h-5'
            }),
            h('div', { className: 'flex-1' },
              h('span', { className: 'font-medium text-gray-800' }, '💰 Registrar Pagamento'),
              h('p', { className: 'text-sm text-gray-600 mt-1' }, 'Registra a transação financeira no sistema')
            )
          ),

          // Opção 2: Renovar no IPTV Manager
          hasIntegration ? 
            h('label', { className: 'flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition border-green-300 bg-green-50' },
              h('input', {
                type: 'checkbox',
                checked: renewOptions.renew_in_iptv,
                onChange: (e) => setRenewOptions({
                  ...renewOptions,
                  renew_in_iptv: e.target.checked
                }),
                className: 'mt-1 w-5 h-5'
              }),
              h('div', { className: 'flex-1' },
                h('span', { className: 'font-medium text-gray-800' }, 
                  `${client.is_sigma_plan ? '⚡' : '🌐'} Renovar no ${integrationName}`
                ),
                h('p', { className: 'text-sm text-gray-600 mt-1' }, 
                  `Renova o cliente no painel externo ${integrationName}`
                ),
                h('p', { className: 'text-xs text-green-700 mt-1' }, '✅ Integração ativa neste plano')
              )
            )
          :
            h('div', { className: 'flex items-start gap-3 p-3 border-2 border-dashed rounded-lg bg-gray-50 opacity-60' },
              h('input', {
                type: 'checkbox',
                disabled: true,
                className: 'mt-1 w-5 h-5'
              }),
              h('div', { className: 'flex-1' },
                h('span', { className: 'font-medium text-gray-500' }, '🔌 Renovar no IPTV Manager'),
                h('p', { className: 'text-sm text-gray-500 mt-1' }, '⚠️ Este plano não tem integração ativa'),
                h('p', { className: 'text-xs text-gray-400 mt-1' }, 'Configure Sigma ou Live21 no plano para habilitar')
              )
            )
        ),

        // Aviso
        h('div', { className: 'bg-blue-50 border-l-4 border-blue-500 p-3 rounded' },
          h('p', { className: 'text-sm text-blue-800' },
            h('strong', null, 'ℹ️ Nota: '),
            'O cliente será renovado no banco de dados independente das opções selecionadas.'
          )
        )
      ),

      // Footer
      h('div', { className: 'p-6 border-t bg-gray-50 flex gap-3' },
        h('button', {
          onClick: onClose,
          disabled: loading,
          className: 'flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50'
        }, 'Cancelar'),
        h('button', {
          onClick: handleRenew,
          disabled: loading,
          className: 'flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed'
        }, loading ? 
          h('span', null,
            h('span', { className: 'inline-block animate-spin mr-2' }, '⏳'),
            'Renovando...'
          )
          : '✅ Renovar Cliente'
        )
      )
    )
  );
}
