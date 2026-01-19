/* ========================================
   SERVERS MODAL COMPONENT - COM EDIÇÃO E MULTIPLICADOR
   ======================================== */

function ServersModal({ servers, onClose, onRefresh }) {
  const { useState } = React;
  const [formData, setFormData] = useState({ 
    name: '', 
    cost_per_screen: '',
    multiply_by_screens: true 
  });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        // Editar servidor existente
        await api.updateServer(editingId, formData);
      } else {
        // Criar novo servidor
        await api.createServer(formData);
      }
      setFormData({ name: '', cost_per_screen: '', multiply_by_screens: true });
      setEditingId(null);
      onRefresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (server) => {
    setFormData({
      name: server.name,
      cost_per_screen: server.cost_per_screen.toString(),
      multiply_by_screens: server.multiply_by_screens !== false
    });
    setEditingId(server.id);
  };

  const handleCancelEdit = () => {
    setFormData({ name: '', cost_per_screen: '', multiply_by_screens: true });
    setEditingId(null);
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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header fixo */}
        <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold">Gerenciar Servidores</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="p-6 flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            {editingId && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  ✏️ <strong>Modo de Edição:</strong> Você está editando um servidor existente
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Servidor *</label>
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
                <label className="block text-sm font-medium mb-2">Custo Base (R$) *</label>
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

            {/* Checkbox de Multiplicar por Telas */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.multiply_by_screens}
                  onChange={(e) => setFormData({...formData, multiply_by_screens: e.target.checked})}
                  className="mt-1 w-4 h-4"
                />
                <div>
                  <span className="font-medium text-sm">Multiplicar custo por quantidade de telas?</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.multiply_by_screens ? (
                      <span className="text-green-700">
                        ✅ <strong>Ativado:</strong> Cliente com 2 telas pagará 2× o custo (Ex: R$ 5,00 × 2 = R$ 10,00)
                      </span>
                    ) : (
                      <span className="text-orange-700">
                        ⚠️ <strong>Desativado:</strong> Cliente pagará sempre o custo base, independente da quantidade de telas
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            <div className="flex gap-3">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit" 
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Salvando...' : (editingId ? 'Atualizar Servidor' : 'Adicionar Servidor')}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="font-semibold mb-3">Servidores Cadastrados</h4>
            {servers.map(server => (
              <div key={server.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-gray-600">
                    R$ {parseFloat(server.cost_per_screen).toFixed(2)}
                    {server.multiply_by_screens ? (
                      <span className="text-green-600 ml-2">× por tela</span>
                    ) : (
                      <span className="text-orange-600 ml-2">(fixo)</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(server)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(server.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Excluir
                  </button>
                </div>
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