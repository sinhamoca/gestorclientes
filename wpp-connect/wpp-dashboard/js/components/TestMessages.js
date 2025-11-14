/* ========================================
   TEST MESSAGES COMPONENT
   Enviar mensagens de teste
   ======================================== */

function TestMessages() {
  const { useState, useEffect } = React;
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  // Inicializar ícones apenas uma vez após mount
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, []);

  // Re-inicializar ícones quando result mudar (para ícones dinâmicos)
  useEffect(() => {
    if (result && window.lucide) {
      setTimeout(() => window.lucide.createIcons(), 100);
    }
  }, [result]);

  const loadSessions = async () => {
    try {
      const data = await api.sessions.list();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const response = await api.messages.send(selectedSession, phoneNumber, message);
      setResult({ success: true, data: response });
      setPhoneNumber('');
      setMessage('');
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">💬 Enviar Mensagem de Teste</h2>
        <p className="text-gray-600 mb-6">Teste o envio de mensagens para qualquer número</p>

        <form onSubmit={handleSend} className="space-y-4">
          {/* Selecionar Sessão */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Sessão WhatsApp
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            >
              <option value="">Selecione uma sessão...</option>
              {sessions.map((session) => (
                <option key={session.sessionId} value={session.sessionId}>
                  {session.sessionId}
                </option>
              ))}
            </select>
          </div>

          {/* Número */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Número de Destino
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="5585999999999"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 Formato: DDI + DDD + Número (sem espaços ou símbolos)
            </p>
          </div>

          {/* Mensagem */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Mensagem
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows="5"
              placeholder="Digite sua mensagem aqui..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              required
            ></textarea>
          </div>

          {/* Botão Enviar */}
          <button
            type="submit"
            disabled={sending || !selectedSession}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <i data-lucide="send" className="w-5 h-5"></i>
                <span>Enviar Mensagem</span>
              </>
            )}
          </button>
        </form>

        {/* Resultado */}
        {result && (
          <div key={`result-${Date.now()}`} className={`mt-6 p-4 rounded-xl border-l-4 ${result.success ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
            <div className="flex items-start">
              <i data-lucide={result.success ? 'check-circle' : 'alert-circle'} className={`w-5 h-5 mr-2 flex-shrink-0 ${result.success ? 'text-green-600' : 'text-red-600'}`}></i>
              <div className="flex-1">
                <p className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                  {result.success ? '✅ Mensagem enviada com sucesso!' : '❌ Erro ao enviar mensagem'}
                </p>
                {result.success ? (
                  <p className="text-sm text-green-700 mt-1">
                    Message ID: {result.data.messageId}
                  </p>
                ) : (
                  <p className="text-sm text-red-700 mt-1">{result.error}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}