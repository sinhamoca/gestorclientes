/* ========================================
   SUBSCRIPTION RENEWAL MODAL COMPONENT
   Salvar em: user-system/js/components/SubscriptionRenewalModal.js
   ======================================== */

function SubscriptionRenewalModal({ user, onClose, onRenewalSuccess }) {
  const { useState, useEffect } = React;
  
  const [loading, setLoading] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [currentPaymentId, setCurrentPaymentId] = useState(null);

  // Buscar informações da assinatura ao abrir
  useEffect(() => {
    loadSubscriptionInfo();
  }, []);

  // Verificar pagamento em loop quando PIX for gerado
  useEffect(() => {
    if (currentPaymentId && checkingPayment) {
      const interval = setInterval(() => {
        checkPayment(currentPaymentId);
      }, 5000); // Verifica a cada 5 segundos

      return () => clearInterval(interval);
    }
  }, [currentPaymentId, checkingPayment]);

  const loadSubscriptionInfo = async () => {
    try {
      const data = await api.getSubscriptionInfo();
      setSubscriptionInfo(data);
    } catch (error) {
      console.error('Erro ao carregar info:', error);
    }
  };

  const handleGeneratePix = async () => {
    setLoading(true);
    try {
      const data = await api.createSubscriptionPayment();
      setPixData(data);
      setCurrentPaymentId(data.payment_id);
      setCheckingPayment(true);
    } catch (error) {
      alert('Erro ao gerar PIX: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkPayment = async (paymentId) => {
    try {
      const data = await api.checkSubscriptionPaymentStatus(paymentId);
      if (data.approved) {
        setCheckingPayment(false);
        alert('✅ Pagamento confirmado! Sua assinatura foi renovada.');
        if (onRenewalSuccess) onRenewalSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
    }
  };

  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      alert('✅ Código PIX copiado!');
    }
  };

  const getStatusBadge = () => {
    if (!subscriptionInfo) return null;

    if (subscriptionInfo.is_expired) {
      return (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded">
          <p className="text-red-700 font-semibold">❌ Assinatura Vencida</p>
          <p className="text-red-600 text-sm mt-1">Renove para continuar usando o sistema</p>
        </div>
      );
    }

    if (subscriptionInfo.is_expiring_soon) {
      return (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded">
          <p className="text-orange-700 font-semibold">
            ⚠️ Vence em {subscriptionInfo.days_remaining} dia(s)
          </p>
          <p className="text-orange-600 text-sm mt-1">Renove agora para não perder o acesso</p>
        </div>
      );
    }

    return (
      <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded">
        <p className="text-green-700 font-semibold">
          ✅ {subscriptionInfo.days_remaining} dia(s) restantes
        </p>
        <p className="text-green-600 text-sm mt-1">Sua assinatura está ativa</p>
      </div>
    );
  };

  if (!subscriptionInfo) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-center mt-4">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto fade-in">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-white">💳 Renovar Assinatura</h3>
            <button 
              onClick={onClose} 
              className="text-white hover:text-gray-200 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          
          {/* Status da Assinatura */}
          {getStatusBadge()}

          {/* Informações */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">👤 Nome:</span>
              <span className="font-semibold">{subscriptionInfo.name}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">📧 Email:</span>
              <span className="font-semibold">{subscriptionInfo.email}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">📅 Vencimento Atual:</span>
              <span className="font-semibold">
                {subscriptionInfo.subscription_end 
                  ? new Date(subscriptionInfo.subscription_end).toLocaleDateString('pt-BR')
                  : 'Não definido'}
              </span>
            </div>
          </div>

          {/* Detalhes da Renovação */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-900 mb-3">📋 Detalhes da Renovação</h4>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-blue-700">Período:</span>
                <span className="font-bold text-blue-900">
                  +{subscriptionInfo.renewal_days} dias
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-blue-700">Valor:</span>
                <span className="text-2xl font-bold text-blue-900">
                  R$ {subscriptionInfo.renewal_price.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-600">Nova data de vencimento:</span>
                <span className="font-semibold text-blue-800">
                  {(() => {
                    const currentEnd = subscriptionInfo.subscription_end 
                      ? new Date(subscriptionInfo.subscription_end)
                      : new Date();
                    const today = new Date();
                    const baseDate = currentEnd > today ? currentEnd : today;
                    const newEnd = new Date(baseDate);
                    newEnd.setDate(newEnd.getDate() + subscriptionInfo.renewal_days);
                    return newEnd.toLocaleDateString('pt-BR');
                  })()}
                </span>
              </div>
            </div>
          </div>

          {/* Botão Gerar PIX ou Exibir QR Code */}
          {!pixData ? (
            <button
              onClick={handleGeneratePix}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Gerando PIX...' : '📱 Gerar PIX para Pagamento'}
            </button>
          ) : (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6 text-center">
                <h4 className="font-bold text-gray-800 mb-4">Escaneie o QR Code</h4>
                <img 
                  src={`data:image/png;base64,${pixData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="mx-auto max-w-xs"
                />
              </div>

              {/* Pix Copia e Cola */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2 text-center">
                  Ou copie o código Pix Copia e Cola:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pixData.qr_code}
                    readOnly
                    className="flex-1 p-3 border rounded text-sm font-mono bg-white"
                  />
                  <button
                    onClick={copyPixCode}
                    className="bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 transition font-semibold"
                  >
                    📋 Copiar
                  </button>
                </div>
              </div>

              {/* Status de Verificação */}
              {checkingPayment && (
                <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 text-center">
                  <div className="animate-pulse">
                    <p className="font-semibold text-yellow-800">⏳ Aguardando pagamento...</p>
                    <p className="text-sm text-yellow-700 mt-1">
                      Verificando automaticamente a cada 5 segundos
                    </p>
                  </div>
                </div>
              )}

              {/* Botão para gerar novo PIX */}
              <button
                onClick={() => {
                  setPixData(null);
                  setCheckingPayment(false);
                  setCurrentPaymentId(null);
                }}
                className="w-full bg-gray-200 text-gray-700 py-2 px-4 rounded hover:bg-gray-300 transition"
              >
                Gerar Novo PIX
              </button>
            </div>
          )}

          {/* Informações Importantes */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Importante:</strong> Após a confirmação do pagamento, 
              os {subscriptionInfo.renewal_days} dias serão adicionados automaticamente 
              à sua data de vencimento atual.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
