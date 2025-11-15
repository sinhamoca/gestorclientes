function Sessions() {
  const { useState, useEffect } = React;
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSessionId, setNewSessionId] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [qrSessionId, setQrSessionId] = useState('');

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, CONFIG.refreshInterval);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const loadSessions = async () => {
    try {
      const result = await api.listSessions();
      setSessions(result.sessions || []);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await api.createSession(newSessionId);
      
      if (result.needsQR) {
        setQrCode(result.qr);
        setQrSessionId(newSessionId);
        setShowCreateModal(false);
        
        // Monitorar status da sessão
        const checkInterval = setInterval(async () => {
          try {
            const status = await api.getSessionStatus(newSessionId);
            if (status.connected) {
              setQrCode(null);
              setQrSessionId('');
              clearInterval(checkInterval);
              loadSessions();
              alert('✅ Sessão conectada com sucesso!');
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error);
          }
        }, 3000);

        // Parar de verificar após 2 minutos
        setTimeout(() => clearInterval(checkInterval), 120000);
      } else {
        alert('✅ Sessão criada com sucesso!');
        loadSessions();
      }
      
      setNewSessionId('');
    } catch (error) {
      alert(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (sessionId) => {
    if (!confirm(`Desconectar sessão ${sessionId}?`)) return;

    try {
      await api.disconnectSession(sessionId);
      alert('✅ Sessão desconectada!');
      loadSessions();
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  const handleShowQR = async (sessionId) => {
    try {
      const result = await api.getQRCode(sessionId);
      setQrCode(result.qr);
      setQrSessionId(sessionId);
    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Sessões WhatsApp</h2>
          <p className="text-gray-600">Gerencie suas instâncias do WhatsApp</p>
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gradient-to-r from-green-600 to-green-500 text-white px-6 py-3 rounded-lg font-medium hover:from-green-700 hover:to-green-600 transition flex items-center space-x-2 shadow-lg"
        >
          <i data-lucide="plus" className="w-5 h-5"></i>
          <span>Nova Sessão</span>
        </button>
      </div>

      {/* Lista de Sessões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl shadow-lg p-12 text-center">
            <i data-lucide="inbox" className="w-16 h-16 text-gray-300 mx-auto mb-4"></i>
            <p className="text-gray-500">Nenhuma sessão criada ainda</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-green-600 hover:text-green-700 font-medium"
            >
              Criar primeira sessão
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <div key={session.sessionId} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <i data-lucide="message-circle" className="w-6 h-6 text-green-600"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800">{session.sessionId}</h3>
                    <p className="text-xs text-gray-500">Sessão WhatsApp</p>
                  </div>
                </div>
                
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  session.hasQR 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {session.hasQR ? 'Aguardando QR' : 'Ativa'}
                </span>
              </div>

              <div className="space-y-2">
                {session.hasQR && (
                  <button
                    onClick={() => handleShowQR(session.sessionId)}
                    className="w-full bg-yellow-50 hover:bg-yellow-100 text-yellow-700 py-2 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center space-x-2"
                  >
                    <i data-lucide="qr-code" className="w-4 h-4"></i>
                    <span>Ver QR Code</span>
                  </button>
                )}
                
                <button
                  onClick={() => handleDisconnect(session.sessionId)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-2 px-4 rounded-lg text-sm font-medium transition flex items-center justify-center space-x-2"
                >
                  <i data-lucide="trash-2" className="w-4 h-4"></i>
                  <span>Desconectar</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal: Criar Sessão */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Nova Sessão</h3>
            
            <form onSubmit={handleCreateSession}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID da Sessão
                </label>
                <input
                  type="text"
                  value={newSessionId}
                  onChange={(e) => setNewSessionId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="ex: client123"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use um identificador único para esta sessão
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-500 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-green-600 transition disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QR Code */}
      {qrCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">QR Code</h3>
            <p className="text-gray-600 mb-6">Sessão: {qrSessionId}</p>
            
            <div className="qr-container mx-auto mb-6">
              <img src={qrCode} alt="QR Code" className="w-64 h-64 mx-auto" />
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              Escaneie este QR Code com o WhatsApp do seu celular
            </p>

            <button
              onClick={() => { setQrCode(null); setQrSessionId(''); }}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
