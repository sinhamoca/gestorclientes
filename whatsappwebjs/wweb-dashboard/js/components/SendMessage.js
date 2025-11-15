function SendMessage() {
  const { useState, useEffect } = React;
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const result = await api.listSessions();
      setSessions(result.sessions || []);
      if (result.sessions?.length > 0) {
        setSelectedSession(result.sessions[0].sessionId);
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Enviar Mensagem</h2>
        <p className="text-gray-600">Teste o envio de mensagens via API</p>
      </div>

      {sessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Nenhuma Sessão Ativa</h3>
          <p className="text-gray-600 mb-4">
            Você precisa criar e conectar uma sessão antes de enviar mensagens
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-8">
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setResult(null);

            try {
              await api.sendMessage(selectedSession, recipient, message);
              
              setResult({
                type: 'success',
                message: '✅ Mensagem enviada com sucesso!'
              });
              
              setRecipient('');
              setMessage('');
            } catch (error) {
              setResult({
                type: 'error',
                message: `❌ Erro: ${error.message}`
              });
            } finally {
              setLoading(false);
            }
          }} className="space-y-6">
            {/* Sessão */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sessão WhatsApp
              </label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                {sessions.map((session) => (
                  <option key={session.sessionId} value={session.sessionId}>
                    {session.sessionId}
                  </option>
                ))}
              </select>
            </div>

            {/* Destinatário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do Destinatário
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="5511999999999"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Formato: código do país + DDD + número (sem espaços ou caracteres especiais)
              </p>
            </div>

            {/* Mensagem */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mensagem
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Digite sua mensagem aqui..."
                rows="6"
                required
              />
            </div>

            {/* Resultado */}
            {result && (
              <div className={`p-4 rounded-lg ${
                result.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {result.message}
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-green-600 to-green-500 text-white py-3 rounded-lg font-medium hover:from-green-700 hover:to-green-600 transition disabled:opacity-50 flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Enviando...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Enviar Mensagem</span>
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Exemplos de Uso da API */}
      <div className="mt-8 bg-gray-50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Exemplo de Uso da API
        </h3>
        
        <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST ${API_URL}/api/message/send \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: SUA_API_KEY" \\
  -d '{
    "sessionId": "${selectedSession || 'sua-sessao'}",
    "to": "5511999999999",
    "message": "Olá! Esta é uma mensagem de teste."
  }'`}
        </pre>
      </div>
    </div>
  );
}