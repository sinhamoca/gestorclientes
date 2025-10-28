/* ========================================
   APP COMPONENT (ROOT)
   ======================================== */

function App() {
  const { useState, useEffect } = React;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (token && userData) {
      try {
        const parsed = JSON.parse(userData);
        if (parsed.role !== 'admin') {
          setUser(parsed);
        } else {
          handleLogout();
        }
      } catch (error) {
        handleLogout();
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => setUser(userData);
  
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login onLogin={handleLogin} />;
  return <Dashboard user={user} onLogout={handleLogout} />;
}

// Inicialização
ReactDOM.render(<App />, document.getElementById('root'));
