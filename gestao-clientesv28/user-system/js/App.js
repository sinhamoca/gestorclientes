function App() {
  const { useState, useEffect } = React;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsEncryptionSetup, setNeedsEncryptionSetup] = useState(false); // 🔐 NOVO

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const user = await api.getMe();
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      
      // 🔐 NOVO: Verificar se precisa configurar criptografia
      const encryptionKey = localStorage.getItem('encryption_key');
      if (!encryptionKey) {
        setNeedsEncryptionSetup(true);
        setLoading(false);
        return;
      }
      
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    
    const encryptionKey = localStorage.getItem('encryption_key');
    if (!encryptionKey) {
      setNeedsEncryptionSetup(true);
      setLoading(false);
    } else {
      try {
        const user = await api.getMe();
        console.log('✅ Usuário carregado no login:', user);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
        setIsAuthenticated(true);
      } catch (error) {
        console.error('❌ Erro ao carregar usuário no login:', error);
        setNeedsEncryptionSetup(true);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    // 🔐 IMPORTANTE: NÃO remover a encryption_key no logout!
    // localStorage.removeItem('encryption_key'); // ❌ NÃO FAZER ISSO
    setIsAuthenticated(false);
  };

  // 🔐 NOVO: Handler quando completar setup de criptografia
  const handleEncryptionComplete = async () => {
    setNeedsEncryptionSetup(false);
    setLoading(true); // ✅ Mostrar loading
    
    // ✅ Pequeno delay para garantir que o localStorage foi atualizado
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      // ✅ Recarregar dados do usuário COM a chave de criptografia
      const user = await api.getMe();
      console.log('✅ Usuário carregado:', user);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      
      // ✅ Outro pequeno delay antes de mostrar o Dashboard
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setIsAuthenticated(true);
    } catch (error) {
      console.error('❌ Erro ao carregar usuário:', error);
      alert('Erro ao carregar dados do usuário. Faça login novamente.');
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // 🔐 NOVO: Mostrar setup de criptografia se necessário
  if (needsEncryptionSetup) {
    return <EncryptionSetup onComplete={handleEncryptionComplete} />;
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  // ✅ Buscar user do localStorage e passar como prop
  const userData = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
  
  return <Dashboard user={userData} onLogout={handleLogout} />;
}

ReactDOM.render(<App />, document.getElementById('root'));