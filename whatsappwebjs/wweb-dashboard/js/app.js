function App() {
  const { useState, useEffect } = React;
  const [authenticated, setAuthenticated] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');

  useEffect(() => {
    // Verificar se está autenticado
    const isAuth = localStorage.getItem(STORAGE_KEYS.AUTH) === 'true';
    const hasApiKey = localStorage.getItem(STORAGE_KEYS.API_KEY);
    
    if (isAuth && hasApiKey) {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const handleLogin = () => {
    setAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH);
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
    setAuthenticated(false);
    setCurrentPage('dashboard');
  };

  if (!authenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onLogout={handleLogout} />
      
      {/* Menu de Navegação */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setCurrentPage('dashboard')}
              className={`py-4 px-3 border-b-2 font-medium text-sm transition ${
                currentPage === 'dashboard'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i data-lucide="layout-dashboard" className="w-4 h-4 inline mr-2"></i>
              Dashboard
            </button>
            
            <button
              onClick={() => setCurrentPage('sessions')}
              className={`py-4 px-3 border-b-2 font-medium text-sm transition ${
                currentPage === 'sessions'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i data-lucide="message-circle" className="w-4 h-4 inline mr-2"></i>
              Sessões
            </button>
            
            <button
              onClick={() => setCurrentPage('send')}
              className={`py-4 px-3 border-b-2 font-medium text-sm transition ${
                currentPage === 'send'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i data-lucide="send" className="w-4 h-4 inline mr-2"></i>
              Enviar Mensagem
            </button>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="py-6">
        {currentPage === 'dashboard' && <Dashboard />}
        {currentPage === 'sessions' && <Sessions />}
        {currentPage === 'send' && <SendMessage />}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            WhatsApp-Web.js Service v{CONFIG.version} • Desenvolvido para automação WhatsApp
          </p>
        </div>
      </footer>
    </div>
  );
}

// Renderizar aplicação
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
