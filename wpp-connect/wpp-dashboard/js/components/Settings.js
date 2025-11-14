function Settings({ onLogout }) {
  const { useState, useEffect } = React;
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    setApiKey(getApiKey() || '');
    if (window.lucide) window.lucide.createIcons();
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">⚙️ Configurações</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">API Key</label>
            <input
              type="password"
              value={apiKey}
              readOnly
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-2">Sua API Key está armazenada localmente</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Endpoint da API</label>
            <input
              type="text"
              value={API_URL}
              readOnly
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50"
            />
          </div>

          <div className="pt-4 border-t">
            <button
              onClick={onLogout}
              className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition flex items-center justify-center space-x-2"
            >
              <i data-lucide="log-out" className="w-5 h-5"></i>
              <span>Sair do Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
