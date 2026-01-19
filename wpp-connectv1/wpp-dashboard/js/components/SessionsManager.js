/* ========================================
   SESSIONS MANAGER COMPONENT
   Gerenciar sessões WhatsApp com QR Code
   ======================================== */

function SessionsManager() {
  const { useState, useEffect } = React;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSessionId, setNewSessionId] = useState('');
  const [qrCodeModal, setQrCodeModal] = useState(null);
  const [statusData, setStatusData] = useState({});

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const loadSessions = async () => {
    try {
      const data = await api.sessions.list();
      setSessions(data.sessions || []);
      
      // Buscar status de cada sessão
      for (const session of data.sessions || []) {
        try {
          const status = await api.sessions.status(session.sessionId);
          setStatusData(prev => ({
            ...prev,
            [session.sessionId]: status
          }));
        } catch (error) {
          console.error(`Erro ao buscar status de ${session.sessionId}:`, error);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.sessions.create(newSessionId);
      
      if (result.needsQR && result.qrCode) {
        setQrCodeModal({
          sessionId: newSessionId,
          qrCode: result.qrCode,
          attempts: result.attempts
        });
      }
      
      setNewSessionId('');
      setShowModal(false);
      await loadSessions();
    } catch (error) {
      alert('Erro ao criar sessão: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (sessionId) => {
    if (!confirm(`Desconectar sessão ${sessionId}?`)) return;
    
    try {
      await api.sessions.disconnect(sessionId);
      await loadSessions();
    } catch (error) {
      alert('Erro ao desconectar: ' + error.message);
    }
  };

  const handleDelete = async (sessionId) => {
    if (!confirm(`EXCLUIR permanentemente a sessão ${sessionId}?\n\nIsso removerá todos os tokens!`)) return;
    
    try {
      await api.sessions.delete(sessionId);
      await loadSessions();
    } catch (error) {
      alert('Erro ao excluir: ' + error.message);
    }
  };

  const handleReconnect = async (sessionId) => {
    try {
      const result = await api.sessions.create(sessionId);
      
      if (result.needsQR && result.qrCode) {
        setQrCodeModal({
          sessionId,
          qrCode: result.qrCode,
          attempts: result.attempts
        });
      }
      
      await loadSessions();
    } catch (error) {
      alert('Erro ao reconectar: ' + error.message);
    }
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando sessões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gerenciar Sessões</h2>
          <p className="text-gray-600 mt-1">Total: {sessions.length} sessões</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg flex items-center space-x-2 transition"
        >
          <i data-lucide="plus-circle" className="w-5 h-5"></i>
          <span>Nova Sessão</span>
        </button>
      </div>

      {/* Lista de Sessões */}
      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i data-lucide="inbox" className="w-10 h-10 text-gray-400"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma sessão criada</h3>
          <p className="text-gray-600 mb-6">Crie sua primeira sessão WhatsApp para começar!</p>
          <button
            onClick={() => setShowModal(true)}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl transition"
          >
            Criar Primeira Sessão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions.map((session) => {
            const status = statusData[session.sessionId];
            const isConnected = status?.connected;
            
            return (
              <div key={session.sessionId} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
                {/* Header do Card */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 pulse-slow' : 'bg-gray-300'}`}></div>
                    <h3 className="font-bold text-gray-800">{session.sessionId}</h3>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>

                {/* Informações */}
                {isConnected && status ? (
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center text-gray-600">
                      <i data-lucide="phone" className="w-4 h-4 mr-2"></i>
                      <span>{status.phoneNumber || 'N/A'}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <i data-lucide="smartphone" className="w-4 h-4 mr-2"></i>
                      <span className="capitalize">{status.platform || 'N/A'}</span>
                    </div>
                    {status.pushname && (
                      <div className="flex items-center text-gray-600">
                        <i data-lucide="user" className="w-4 h-4 mr-2"></i>
                        <span>{status.pushname}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mb-4">
                    <p className="text-sm text-gray-500">Sessão desconectada</p>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2">
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(session.sessionId)}
                      className="flex-1 px-4 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg font-medium text-sm transition flex items-center justify-center space-x-2"
                    >
                      <i data-lucide="log-out" className="w-4 h-4"></i>
                      <span>Desconectar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReconnect(session.sessionId)}
                      className="flex-1 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium text-sm transition flex items-center justify-center space-x-2"
                    >
                      <i data-lucide="refresh-cw" className="w-4 h-4"></i>
                      <span>Reconectar</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(session.sessionId)}
                    className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium text-sm transition"
                  >
                    <i data-lucide="trash-2" className="w-4 h-4"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Criar Sessão */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md slide-in">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Nova Sessão WhatsApp</h3>
            
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ID da Sessão
                </label>
                <input
                  type="text"
                  value={newSessionId}
                  onChange={(e) => setNewSessionId(e.target.value)}
                  placeholder="Ex: user_123"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  required
                />
                <p className="text-xs text-gray-500 mt-2">
                  💡 Use IDs únicos como: user_123, cliente_456, etc
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Sessão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {qrCodeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg slide-in">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">📲 Escaneie o QR Code</h3>
              <p className="text-gray-600 mb-6">Sessão: <strong>{qrCodeModal.sessionId}</strong></p>
              
              {/* QR Code */}
              <div className="bg-white p-6 rounded-2xl inline-block shadow-lg mb-6">
                <img 
                  src={qrCodeModal.qrCode} 
                  alt="QR Code" 
                  className="w-64 h-64 mx-auto"
                />
              </div>

              {/* Instruções */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-left mb-6 rounded-lg">
                <p className="font-semibold text-blue-800 mb-2">Como conectar:</p>
                <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                  <li>Abra o WhatsApp no seu celular</li>
                  <li>Toque em <strong>Mais opções (⋮)</strong> e selecione <strong>"Aparelhos conectados"</strong></li>
                  <li>Toque em <strong>"Conectar um aparelho"</strong></li>
                  <li>Aponte seu celular para esta tela para escanear o código QR</li>
                </ol>
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Tentativa {qrCodeModal.attempts} de 5
              </p>

              <button
                onClick={() => {
                  setQrCodeModal(null);
                  loadSessions();
                }}
                className="w-full px-6 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl font-semibold transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
