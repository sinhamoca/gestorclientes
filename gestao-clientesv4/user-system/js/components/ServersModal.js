/* ========================================
   SERVERS MODAL COMPONENT
   ======================================== */

function ServersModal({ servers, onClose, onRefresh }) {
  const { useState } = React;
  const [formData, setFormData] = useState({ name: '', cost_per_screen: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createServer(formData);
      setFormData({ name: '', cost_per_screen: '' });
      onRefresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este servidor?')) return;
    try {
      await api.deleteServer(id);
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Gerenciar Servidores</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Servidor</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Netflix Premium"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Custo por Tela (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost_per_screen}
                  onChange={(e) => setFormData({...formData, cost_per_screen: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Adicionar Servidor'}
            </button>
          </form>

          <div className="space-y-2">
            <h4 className="font-semibold mb-3">Servidores Cadastrados</h4>
            {servers.map(server => (
              <div key={server.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-gray-600">R$ {parseFloat(server.cost_per_screen).toFixed(2)} por tela</p>
                </div>
                <button
                  onClick={() => handleDelete(server.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Excluir
                </button>
              </div>
            ))}
            {servers.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhum servidor cadastrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
