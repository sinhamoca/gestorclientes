function Logs() {
  const { useEffect } = React;

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">📋 Logs do Sistema</h2>
        <p className="text-gray-600 mb-6">Visualização de logs em tempo real</p>
        
        <div className="bg-gray-900 rounded-xl p-6 text-green-400 font-mono text-sm">
          <p className="mb-2">[{new Date().toISOString()}] Sistema inicializado</p>
          <p className="mb-2">[{new Date().toISOString()}] API WhatsApp disponível</p>
          <p className="mb-2">[{new Date().toISOString()}] Dashboard carregado</p>
          <p className="text-gray-500">...</p>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          💡 Logs detalhados disponíveis no servidor via: docker logs whatsapp_service
        </p>
      </div>
    </div>
  );
}
