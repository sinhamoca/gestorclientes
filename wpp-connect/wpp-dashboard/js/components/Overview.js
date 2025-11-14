/* ========================================
   OVERVIEW COMPONENT - Visão Geral
   ======================================== */

function Overview() {
  const { useState, useEffect } = React;
  const [health, setHealth] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, CONFIG.refreshInterval);
    return () => clearInterval(interval);
  }, []);

  // Inicializar ícones
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const loadData = async () => {
    try {
      const [healthData, sessionsData] = await Promise.all([
        api.health(),
        api.sessions.list()
      ]);
      setHealth(healthData);
      setSessions(sessionsData.sessions || []);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const uptimeFormatted = health?.uptime 
    ? `${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`
    : '--';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Status do Serviço */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Status do Serviço</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {health?.status === 'healthy' ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <i data-lucide="activity" className="w-6 h-6 text-green-600"></i>
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${health?.status === 'healthy' ? 'bg-green-500 pulse-slow' : 'bg-red-500'}`}></div>
            <span className="text-xs text-gray-500">Uptime: {uptimeFormatted}</span>
          </div>
        </div>

        {/* Total de Sessões */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total de Sessões</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{sessions.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <i data-lucide="users" className="w-6 h-6 text-blue-600"></i>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-gray-500">
              Máximo: {CONFIG.maxSessions}
            </span>
          </div>
        </div>

        {/* Sessões Ativas */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Sessões Ativas</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {sessions.filter(s => s.active).length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <i data-lucide="check-circle" className="w-6 h-6 text-purple-600"></i>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${sessions.length > 0 ? (sessions.filter(s => s.active).length / sessions.length) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Versão */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Versão</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{CONFIG.version}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <i data-lucide="code" className="w-6 h-6 text-orange-600"></i>
            </div>
          </div>
          <div className="mt-4">
            <span className="text-xs text-gray-500">WPPConnect Admin</span>
          </div>
        </div>
      </div>

      {/* Informações do Sistema */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <i data-lucide="info" className="w-5 h-5 mr-2 text-blue-500"></i>
          Informações do Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 font-medium mb-1">Serviço</p>
            <p className="text-gray-800 font-semibold">{health?.service || 'whatsapp-service'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 font-medium mb-1">Endpoint</p>
            <p className="text-gray-800 font-semibold text-xs break-all">{API_URL}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-gray-600 font-medium mb-1">Última Atualização</p>
            <p className="text-gray-800 font-semibold">{new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      </div>

      {/* Sessões Recentes */}
      {sessions.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <i data-lucide="clock" className="w-5 h-5 mr-2 text-purple-500"></i>
            Sessões Recentes
          </h3>
          <div className="space-y-3">
            {sessions.slice(0, 5).map((session, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${session.active ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <span className="font-medium text-gray-800">{session.sessionId}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {session.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
