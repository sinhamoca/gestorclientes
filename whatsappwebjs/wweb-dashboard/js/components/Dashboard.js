function Dashboard() {
  const { useState, useEffect } = React;
  const [stats, setStats] = useState({
    totalSessions: 0,
    connectedSessions: 0,
    apiStatus: 'checking'
  });

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, CONFIG.refreshInterval);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const checkStatus = async () => {
    try {
      const health = await api.health();
      const sessions = await api.listSessions();
      
      setStats({
        totalSessions: sessions.sessions?.length || 0,
        connectedSessions: sessions.sessions?.length || 0,
        apiStatus: 'online'
      });
    } catch (error) {
      setStats(prev => ({ ...prev, apiStatus: 'offline' }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Dashboard</h2>
        <p className="text-gray-600">Visão geral do sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Status da API */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Status da API</p>
              <p className="text-2xl font-bold text-gray-800">
                {stats.apiStatus === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              stats.apiStatus === 'online' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <i data-lucide={stats.apiStatus === 'online' ? 'check-circle' : 'x-circle'} 
                 className={`w-6 h-6 ${stats.apiStatus === 'online' ? 'text-green-600' : 'text-red-600'}`}></i>
            </div>
          </div>
        </div>

        {/* Total de Sessões */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total de Sessões</p>
              <p className="text-2xl font-bold text-gray-800">{stats.totalSessions}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <i data-lucide="message-circle" className="w-6 h-6 text-blue-600"></i>
            </div>
          </div>
        </div>

        {/* Sessões Conectadas */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Conectadas</p>
              <p className="text-2xl font-bold text-gray-800">{stats.connectedSessions}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <i data-lucide="wifi" className="w-6 h-6 text-green-600"></i>
            </div>
          </div>
        </div>
      </div>

      {/* Instruções */}
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
          <i data-lucide="book-open" className="w-5 h-5 mr-2"></i>
          Como usar
        </h3>
        
        <div className="space-y-4 text-gray-700">
          <div className="flex items-start">
            <span className="bg-green-100 text-green-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 text-sm font-bold">1</span>
            <p>Vá para a aba <strong>"Sessões"</strong> para criar e gerenciar suas instâncias do WhatsApp</p>
          </div>
          
          <div className="flex items-start">
            <span className="bg-green-100 text-green-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 text-sm font-bold">2</span>
            <p>Clique em <strong>"Nova Sessão"</strong> e escaneie o QR Code com seu WhatsApp</p>
          </div>
          
          <div className="flex items-start">
            <span className="bg-green-100 text-green-700 rounded-full w-6 h-6 flex items-center justify-center mr-3 mt-0.5 flex-shrink-0 text-sm font-bold">3</span>
            <p>Use a aba <strong>"Enviar Mensagem"</strong> para testar o envio de mensagens</p>
          </div>
        </div>
      </div>

      {/* Informações Técnicas */}
      <div className="mt-6 bg-gray-50 rounded-xl p-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Informações do Sistema</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Versão</p>
            <p className="font-mono text-gray-800">{CONFIG.version}</p>
          </div>
          <div>
            <p className="text-gray-600">API URL</p>
            <p className="font-mono text-gray-800 truncate">{API_URL}</p>
          </div>
          <div>
            <p className="text-gray-600">Biblioteca</p>
            <p className="font-mono text-gray-800">whatsapp-web.js</p>
          </div>
          <div>
            <p className="text-gray-600">Auto-refresh</p>
            <p className="font-mono text-gray-800">{CONFIG.refreshInterval / 1000}s</p>
          </div>
        </div>
      </div>
    </div>
  );
}
