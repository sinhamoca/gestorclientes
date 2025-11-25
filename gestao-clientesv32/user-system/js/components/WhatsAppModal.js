/* ========================================
   WHATSAPP MODAL COMPONENT - CORRIGIDO
   ======================================== */

function WhatsAppModal({ onClose }) {
  const { useState, useEffect } = React;
  const [status, setStatus] = useState('loading');
  const [qrCode, setQrCode] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 🆕 Provider states
  const [providers, setProviders] = useState([]);
  const [currentProvider, setCurrentProvider] = useState(null);
  const [canChangeProvider, setCanChangeProvider] = useState(true); // ← COMEÇA TRUE
  const [providersLoaded, setProvidersLoaded] = useState(false); // ← NOVO FLAG

  // 🔥 CARREGAR TUDO DE UMA VEZ
  useEffect(() => {
    initializeModal();
  }, []);

  // 🔥 FUNÇÃO QUE CARREGA TUDO
  const initializeModal = async () => {
    try {
      // 1. Carregar providers PRIMEIRO
      await loadProviders();
      
      // 2. Depois verificar status
      await initialCheck();
      
    } catch (error) {
      console.error('Erro ao inicializar modal:', error);
      setStatus('disconnected');
    }
  };

  const [profileInfo, setProfileInfo] = useState({
    phoneNumber: null,
    pushname: null,
    platform: null
  });

  // Carregar providers disponíveis
  const loadProviders = async () => {
    try {
      console.log('🔍 Carregando providers...');
      const data = await api.getProviders();
      
      console.log('📦 Providers recebidos:', data);
      
      setProviders(data.providers || []);
      setCurrentProvider(data.currentProvider || 'wppconnect');
      setCanChangeProvider(data.canChangeProvider !== false);
      setProvidersLoaded(true);
      
      console.log('✅ Providers carregados:', {
        count: data.providers?.length,
        current: data.currentProvider,
        canChange: data.canChangeProvider
      });
      
    } catch (error) {
      console.error('❌ Erro ao carregar providers:', error);
      // Fallback: se falhar, assume WPP Connect
      setProviders([
        {
          id: 'wppconnect',
          name: 'WPP Connect',
          icon: '✅',
          status: 'active',
          description: 'Estável e recomendado'
        }
      ]);
      setCurrentProvider('wppconnect');
      setCanChangeProvider(true);
      setProvidersLoaded(true);
    }
  };

  // Selecionar provider
  const handleSelectProvider = async (providerId) => {
    try {
      console.log('🏭 Selecionando provider:', providerId);
      await api.setProvider(providerId);
      setCurrentProvider(providerId);
      alert(`API ${getProviderName(providerId)} selecionada!`);
    } catch (error) {
      console.error('❌ Erro ao selecionar provider:', error);
      alert(error.message || 'Erro ao selecionar API');
      loadProviders(); // Recarregar
    }
  };

  // Helper para obter nome do provider
  const getProviderName = (providerId) => {
    const provider = providers.find(p => p.id === providerId);
    return provider ? provider.name : providerId;
  };

  // Helper para obter label do status
  const getStatusLabel = (status) => {
    const labels = {
      'active': 'Disponível',
      'coming_soon': 'Em breve',
      'development': 'Em desenvolvimento'
    };
    return labels[status] || status;
  };

  // Polling para verificar conexão
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
        setCanChangeProvider(false);
        
        // 🆕 SALVAR INFORMAÇÕES DO PERFIL
        setProfileInfo({
          phoneNumber: data.phoneNumber,
          pushname: data.pushname,
          platform: data.platform
        });
      } else {
        setStatus('disconnected');
        setCanChangeProvider(true);
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStatus('disconnected');
      setCanChangeProvider(true);
    }
  };

  const checkIfConnected = async () => {
    try {
      const data = await api.getQRCode();
      if (data.connected) {
        setStatus('connected');
        setPhoneNumber(data.phoneNumber);
        setQrCode(null);
        setCanChangeProvider(false);
        
        // 🆕 Buscar informações completas após conectar
        const statusData = await api.checkWhatsAppStatus();
        setProfileInfo({
          phoneNumber: statusData.phoneNumber,
          pushname: statusData.pushname,
          platform: statusData.platform
        });
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
        setCanChangeProvider(false);
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
      setCanChangeProvider(true);
      alert('Instância excluída com sucesso!');
      
      // Recarregar providers
      await loadProviders();
      
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
      setCanChangeProvider(true);
      alert('Desconectado com sucesso!');
      
      // Recarregar providers
      await loadProviders();
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 DEBUG: Mostrar estados no console
  console.log('🎯 WhatsAppModal render:', {
    status,
    canChangeProvider,
    providersCount: providers.length,
    providersLoaded,
    currentProvider
  });

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

          {/* 🆕 PROVIDER SELECTOR - Só mostra se: desconectado + pode trocar + providers carregados */}
          {status === 'disconnected' && canChangeProvider && providersLoaded && providers.length > 0 && (
            <div className="mb-6 bg-gray-50 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-2">🔌 Escolha a API WhatsApp</h4>
              <p className="text-sm text-gray-600 mb-4">Selecione qual serviço deseja usar</p>
              
              <div className="space-y-3">
                {providers.map(provider => (
                  <div 
                    key={provider.id}
                    className={`
                      border-2 rounded-lg p-4 cursor-pointer transition
                      ${currentProvider === provider.id ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}
                      ${provider.status !== 'active' ? 'opacity-60 cursor-not-allowed' : 'hover:border-green-400'}
                    `}
                    onClick={() => provider.status === 'active' && handleSelectProvider(provider.id)}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="provider"
                        value={provider.id}
                        checked={currentProvider === provider.id}
                        disabled={provider.status !== 'active'}
                        onChange={() => handleSelectProvider(provider.id)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{provider.icon}</span>
                          <span className="font-semibold">{provider.name}</span>
                          <span className={`
                            text-xs px-2 py-1 rounded-full
                            ${provider.status === 'active' ? 'bg-green-100 text-green-700' : 
                              provider.status === 'coming_soon' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-blue-100 text-blue-700'}
                          `}>
                            {getStatusLabel(provider.status)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{provider.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
              {/* 🆕 FOTO DE PERFIL */}
              <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl shadow-lg">
                {profileInfo.pushname ? (
                  <span className="text-white font-bold text-3xl">
                    {profileInfo.pushname.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <span className="text-white">✅</span>
                )}
              </div>
              
              <h4 className="text-lg font-semibold mb-2 text-green-600">WhatsApp Conectado!</h4>
              
              {/* 🆕 INFORMAÇÕES DO PERFIL */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left max-w-sm mx-auto">
                {profileInfo.pushname && (
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-3">👤</span>
                    <div>
                      <p className="text-xs text-gray-500">Nome</p>
                      <p className="font-semibold text-gray-800">{profileInfo.pushname}</p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center mb-2">
                  <span className="text-2xl mr-3">📱</span>
                  <div>
                    <p className="text-xs text-gray-500">Número</p>
                    <p className="font-semibold text-gray-800">{phoneNumber || 'Carregando...'}</p>
                  </div>
                </div>
                
                {profileInfo.platform && (
                  <div className="flex items-center">
                    <span className="text-2xl mr-3">
                      {profileInfo.platform.toLowerCase().includes('android') ? '🤖' : 
                      profileInfo.platform.toLowerCase().includes('iphone') ? '🍎' : '💻'}
                    </span>
                    <div>
                      <p className="text-xs text-gray-500">Plataforma</p>
                      <p className="font-semibold text-gray-800 capitalize">{profileInfo.platform}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-500 mb-6">Pronto para enviar mensagens automáticas</p>
              
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