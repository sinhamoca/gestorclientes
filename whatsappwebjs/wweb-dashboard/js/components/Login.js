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
      // Salvar API Key temporariamente
      localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);

      // Testar conexão
      const result = await api.health();
      
      if (result.status === 'ok') {
        localStorage.setItem(STORAGE_KEYS.AUTH, 'true');
        onLogin();
      } else {
        throw new Error('Serviço indisponível');
      }
    } catch (err) {
      setError('API Key inválida ou serviço offline');
      localStorage.removeItem(STORAGE_KEYS.API_KEY);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <i data-lucide="message-circle" className="w-8 h-8 text-green-600"></i>
          </div>
          <h2 className="text-3xl font-bold text-gray-800">WhatsApp-Web.js</h2>
          <p className="text-gray-600 mt-2">Dashboard Admin</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Digite sua API Key"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-green-600 transition disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-6">
          💡 A API Key está configurada no arquivo .env do servidor
        </p>
      </div>
    </div>
  );
}
