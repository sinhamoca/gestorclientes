/* ========================================
   APP COMPONENT - Dashboard Principal
   ======================================== */

function App() {
  const { useState, useEffect } = React;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = localStorage.getItem(STORAGE_KEYS.AUTH);
    const apiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    
    if (auth === 'true' && apiKey) {
      setIsAuthenticated(true);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    setIsAuthenticated(false);
    setCurrentView('overview');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-white font-semibold">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // Menu de navegação
  const menuItems = [
    { id: 'overview', label: 'Visão Geral', icon: 'layout-dashboard' },
    { id: 'sessions', label: 'Sessões', icon: 'smartphone' },
    { id: 'messages', label: 'Mensagens', icon: 'message-square' },
    { id: 'logs', label: 'Logs', icon: 'file-text' },
    { id: 'settings', label: 'Configurações', icon: 'settings' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="gradient-bg shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">WPPConnect Admin</h1>
                <p className="text-sm text-white/80">Gerenciador de Sessões</p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="glass px-4 py-2 rounded-xl text-white font-semibold hover:bg-white/20 transition flex items-center space-x-2"
            >
              <i data-lucide="log-out" className="w-4 h-4"></i>
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                  currentView === item.id
                    ? 'bg-green-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <i data-lucide={item.icon} className="w-4 h-4"></i>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'overview' && <Overview />}
        {currentView === 'sessions' && <SessionsManager />}
        {currentView === 'messages' && <TestMessages />}
        {currentView === 'logs' && <Logs />}
        {currentView === 'settings' && <Settings onLogout={handleLogout} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500">
            <p>WPPConnect Admin Dashboard v{CONFIG.version}</p>
            <p className="mt-1">Desenvolvido com ❤️ para gerenciamento profissional de WhatsApp</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Inicializar React App
ReactDOM.render(<App />, document.getElementById('root'));
