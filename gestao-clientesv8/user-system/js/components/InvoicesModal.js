/* ========================================
   INVOICES MODAL COMPONENT
   Modal para exibir histórico de faturas
   ======================================== */

function InvoicesModal({ client, onClose }) {
  const { useState, useEffect } = React;
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${window.API_URL}/clients/${client.id}/invoices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('user_token')}` // ← CORRIGIDO!
        }
      });
      
      if (!response.ok) throw new Error('Erro ao carregar faturas');
      
      const data = await response.json();
      setInvoices(data.invoices || []);
    } catch (error) {
      console.error('Erro ao carregar faturas:', error);
      alert('Erro ao carregar faturas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodIcon = (method) => {
    if (method === 'pix' || method?.toLowerCase().includes('pix')) return '📱 PIX';
    if (method === 'credit_card' || method?.toLowerCase().includes('credit') || method?.toLowerCase().includes('card')) return '💳 Cartão';
    if (method === 'boleto') return '📄 Boleto';
    return '💰 ' + (method || 'Outros');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-white">📜 Faturas Pagas</h3>
              <p className="text-blue-100 mt-1">{client.name}</p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Carregando faturas...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Nenhuma fatura encontrada</h3>
              <p className="text-gray-500">Este cliente ainda não possui faturas pagas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div 
                  key={invoice.id} 
                  className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-blue-500 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        R$ {parseFloat(invoice.amount_received).toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {formatDate(invoice.paid_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded-full">
                        {getPaymentMethodIcon(invoice.payment_method)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Gateway</p>
                      <p className="text-sm font-medium text-gray-700">
                        {invoice.payment_gateway === 'mercadopago' ? '🛒 Mercado Pago' : invoice.payment_gateway || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">ID da Transação</p>
                      <p className="text-sm font-medium text-gray-700 font-mono">
                        {invoice.gateway_payment_id || invoice.id}
                      </p>
                    </div>
                  </div>

                  {invoice.server_cost && parseFloat(invoice.server_cost) > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Custo Servidor</p>
                          <p className="font-semibold text-orange-600">R$ {parseFloat(invoice.server_cost).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Valor Recebido</p>
                          <p className="font-semibold text-blue-600">R$ {parseFloat(invoice.amount_received).toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Lucro Líquido</p>
                          <p className="font-semibold text-green-600">R$ {parseFloat(invoice.net_profit).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && invoices.length > 0 && (
          <div className="p-4 border-t bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <strong>{invoices.length}</strong> {invoices.length === 1 ? 'fatura encontrada' : 'faturas encontradas'}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Recebido</p>
                <p className="text-lg font-bold text-green-600">
                  R$ {invoices.reduce((sum, inv) => sum + parseFloat(inv.amount_received), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
