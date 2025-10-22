/* ========================================
   WHATSAPP MODAL COMPONENT
   ======================================== */

function WhatsAppModal({ onClose }) {
  const { useState, useEffect } = React;
  const [status, setStatus] = useState('loading');
  const [qrCode, setQrCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initialCheck();
  }, []);

  useEffect(() => {
    if (status === 'connecting' && qrCode) {
      const interval = setInterval(checkIfConnected, 3000);
      return () => clearInterval(interval);
    }
  }, [status, qrCode]);

  const initialCheck = async () => {
    try {
      const data = await api.checkWhatsAppStatus();
      if (data.connected) {
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);
      } else {
        setStatus('disconnected');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus('disconnected');
    }
  };

  const checkIfConnected = async () => {
    try {
      const data = await api.getQRCode();
      if (data.connected) {
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);
        setQrCode(null);
      }
    } catch (error) {
      console.error('Erro ao verificar conexão:', error);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    setQrCode(null);
    
    try {
      const data = await api.connectWhatsApp();
      
      if (data.connected) {
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);
        setQrCode(null);
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
        setStatus('connecting');
      } else {
        throw new Error('QR Code não foi gerado');
      }
    } catch (error) {
      setError(error.message);
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteInstance = async () => {
    if (!confirm('⚠️ ATENÇÃO: Isso irá excluir completamente a instância do WhatsApp. Você precisará escanear o QR Code novamente. Deseja continuar?')) return;
    setLoading(true);
    try {
      await api.deleteWhatsAppInstance();
      setStatus('disconnected');
      setQrCode(null);
      setPhoneNumber(null);
      alert('Instância excluída com sucesso!');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar WhatsApp?')) return;
    setLoading(true);
    try {
      await api.disconnectWhatsApp();
      setStatus('disconnected');
      setQrCode(null);
      setPhoneNumber(null);
      alert('Desconectado com sucesso!');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">📱 Configuração WhatsApp</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <p className="font-semibold">❌ Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center py-12">
              <div className="loader mx-auto mb-4"></div>
              <p className="text-gray-600">Verificando status...</p>
            </div>
          )}

          {status === 'disconnected' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
                📱
              </div>
              <h4 className="text-lg font-semibold mb-2">WhatsApp Desconectado</h4>
              <p className="text-gray-600 mb-6">Conecte seu WhatsApp para enviar lembretes automáticos</p>
              <button 
                onClick={handleConnect}
                disabled={loading}
                className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Gerando QR Code...' : '🔗 Conectar WhatsApp'}
              </button>
            </div>
          )}

          {status === 'connecting' && qrCode && (
            <div className="text-center py-8">
              <h4 className="text-lg font-semibold mb-4">📲 Escaneie o QR Code</h4>
              <div className="bg-white p-4 rounded-lg inline-block shadow-lg mb-4">
                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
              </div>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-left mb-4">
                <p className="font-semibold text-blue-800 mb-2">Como conectar:</p>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em Mais opções (⋮) e selecione "Aparelhos conectados"</li>
                  <li>Toque em "Conectar um aparelho"</li>
                  <li>Aponte seu celular para esta tela para escanear o código QR</li>
                </ol>
              </div>
              <p className="text-sm text-gray-500 mb-2">
                ✨ A conexão será detectada automaticamente
              </p>
              <button 
                onClick={handleConnect}
                disabled={loading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
              >
                {loading ? 'Gerando...' : '🔄 Gerar Novo QR Code'}
              </button>
            </div>
          )}

          {status === 'connected' && (
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl">
                ✅
              </div>
              <h4 className="text-lg font-semibold mb-2 text-green-600">WhatsApp Conectado!</h4>
              <p className="text-gray-600 mb-2">Número: <strong>{phoneNumber}</strong></p>
              <p className="text-sm text-gray-500 mb-6">Seu WhatsApp está pronto para enviar mensagens automáticas</p>
              <div className="flex gap-3 justify-center">
                <button 
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-semibold"
                >
                  {loading ? 'Desconectando...' : 'Desconectar'}
                </button>
                <button 
                  onClick={handleDeleteInstance}
                  disabled={loading}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
                >
                  {loading ? 'Excluindo...' : '🗑️ Excluir Instância'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
