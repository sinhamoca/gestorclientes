/* ========================================
   RENEWAL MODAL COMPONENT - COM SUPORTE UNITV
   Modal moderno para renovação de clientes
   
   ATUALIZAÇÃO: Agora suporta UniTV na renovação manual!
   ======================================== */

function RenewalModal({ client, onClose, onSuccess }) {
  const { useState, createElement: h } = React;
  
  const [loading, setLoading] = useState(false);
  const [renewOptions, setRenewOptions] = useState({
    register_payment: true,
    renew_in_iptv: false
  });

  // ========== VERIFICAR SE TEM INTEGRAÇÃO ATIVA ==========
  // ✅ ADICIONADO: is_unitv_plan
  const hasIntegration = client.is_sigma_plan || 
                        client.is_live21_plan || 
                        client.is_koffice_plan || 
                        client.is_uniplay_plan ||
                        client.is_unitv_plan ||
                        client.is_club_plan ||
                        client.is_painelfoda_plan ||
                        client.is_rush_plan;  // ← ADICIONAR
  
  // ========== NOME DA INTEGRAÇÃO ==========
  // ✅ ADICIONADO: UniTV
  const integrationName = client.is_sigma_plan ? 'Sigma' : 
                          client.is_koffice_plan ? 'Koffice' :
                          client.is_uniplay_plan ? 'Uniplay' :
                          client.is_unitv_plan ? 'UniTV' :
                          client.is_club_plan ? 'Club' :
                          client.is_painelfoda_plan ? 'PainelFoda' :
                          client.is_rush_plan ? 'Rush' :  // ← ADICIONAR
                          'CloudNation (Live21)';

  // ========== ÍCONE DA INTEGRAÇÃO ==========
  // ✅ ADICIONADO: 🎫 para UniTV
  const integrationIcon = client.is_sigma_plan ? '⚡' :
                          client.is_koffice_plan ? '🟠' :
                          client.is_uniplay_plan ? '🔵' :
                          client.is_unitv_plan ? '🎫' :
                          client.is_club_plan ? '🎯' :
                          client.is_painelfoda_plan ? '🔥' :
                          client.is_rush_plan ? '🟠' :  // ← ADICIONAR
                          '🌐';

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
          // ✅ MODIFICADO: Mensagem específica para UniTV
          if (client.is_unitv_plan) {
            message += `\n🎫 Código(s) UniTV entregue(s): ✅ Sucesso!`;
            if (response.iptv_renewal.codes && response.iptv_renewal.codes.length > 0) {
              message += `\n   Códigos: ${response.iptv_renewal.codes.join(', ')}`;
            }
          } else {
            message += `\n🌐 Renovado no ${integrationName}: ✅ Sucesso!`;
          }
        } else if (response.iptv_renewal.skipped) {
          // ✅ ADICIONADO: Tratamento para quando não há códigos disponíveis
          if (client.is_unitv_plan && response.iptv_renewal.reason === 'no_codes_available') {
            message += `\n⚠️ Sem códigos UniTV disponíveis`;
            message += `\n   Cliente renovado apenas no sistema`;
            message += `\n   💡 Adicione códigos em: Menu → Códigos UniTV`;
          } else {
            message += `\n⚠️ Renovação no ${integrationName} pulada: ${response.iptv_renewal.reason}`;
          }
        } else {
          message += `\n⚠️ Falha ao ${client.is_unitv_plan ? 'entregar código' : 'renovar no'} ${integrationName}`;
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
    // Modal container
    h('div', { 
      className: 'bg-white rounded-lg shadow-2xl max-w-sm w-full max-h-[90vh] overflow-y-auto',
      onClick: (e) => e.stopPropagation()
    },
      
      // Header
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

      // Body
      h('div', { className: 'p-4 space-y-3' },
        
        // Info do Cliente
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
              `${integrationName} ${integrationIcon}`  // ← MODIFICADO: usa integrationIcon
            )
          )
        ),

        // Opções de Renovação
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

          // Opção 2: Renovar no Painel / Entregar Código
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
                // ✅ MODIFICADO: Texto diferenciado para UniTV
                h('span', { className: 'font-medium text-gray-800 text-sm' }, 
                  client.is_unitv_plan 
                    ? `🎫 Entregar Código UniTV`
                    : `${integrationIcon} Renovar no ${integrationName}`
                ),
                h('p', { className: 'text-xs text-gray-600 mt-0.5' }, 
                  client.is_unitv_plan
                    ? 'Vincula código(s) disponível ao cliente'
                    : 'Renova no painel externo'
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
                h('p', { className: 'text-xs text-gray-400 mt-0.5' }, 'Configure Sigma, Live21, Koffice, Uniplay ou UniTV')
              )
            )
        ),

        // Aviso
        h('div', { className: 'bg-blue-50 border-l-4 border-blue-500 p-2 rounded' },
          h('p', { className: 'text-xs text-blue-800' },
            h('strong', null, 'ℹ️ '),
            'Cliente será renovado no banco independente das opções.'
          )
        ),

        // ✅ NOVO: Aviso específico para UniTV
        client.is_unitv_plan && renewOptions.renew_in_iptv && h('div', { className: 'bg-purple-50 border-l-4 border-purple-500 p-2 rounded' },
          h('p', { className: 'text-xs text-purple-800' },
            h('strong', null, '🎫 '),
            'Códigos serão vinculados ao cliente e estarão disponíveis na página de pagamento.'
          )
        )
      ),

      // Footer
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