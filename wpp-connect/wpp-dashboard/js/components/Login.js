/* ========================================
   LOGIN COMPONENT
   ======================================== */

function Login({ onLogin }) {
  const { useState } = React;
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validar API Key
      const isValid = await api.validateKey(apiKey);
      
      if (!isValid) {
        throw new Error('API Key inválida');
      }

      // Salvar no localStorage
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
      localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
      
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md slide-in">
        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl">📱</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-800">WPPConnect Admin</h1>
          <p className="text-gray-600 mt-2">Gerenciador de Sessões WhatsApp</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <div className="flex items-center">
                <i data-lucide="alert-circle" className="w-5 h-5 mr-2"></i>
                <span>{error}</span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Digite sua API Key"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Encontre sua API Key no arquivo .env do servidor
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50 shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Conectando...
              </span>
            ) : (
              'Acessar Dashboard'
            )}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔐 Sua API Key é armazenada localmente e de forma segura
          </p>
        </div>
      </div>
    </div>
  );
}
