/* ========================================
   CLIENT MODAL COMPONENT
   ======================================== */

function ClientModal({ client, plans, servers, onClose, onSave }) {
  const { useState } = React;
  const isEdit = !!client;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: client?.name || '',
    whatsapp_number: client?.whatsapp_number || '',
    plan_id: client?.plan_id || '',
    server_id: client?.server_id || '',
    price_value: client?.price_value || '',
    due_date: client?.due_date ? client.due_date.split('T')[0] : '',
    username: client?.username || '',
    password: client?.password || '',
    mac_address: client?.mac_address || '',
    device_key: client?.device_key || '',
    notes: client?.notes || '',
    is_active: client?.is_active ?? true
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (client) {
        await api.updateClient(client.id, formData);
        alert('✅ Cliente atualizado com sucesso!');
      } else {
        await api.createClient(formData);
        alert('✅ Cliente criado com sucesso!');
      }
      
      onSave();
      onClose();  // ← ISSO FECHA O MODAL
      
    } catch (error) {
      alert(`❌ Erro ao salvar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">WhatsApp *</label>
                <input
                  type="text"
                  value={formData.whatsapp_number}
                  onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="5585999999999"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Plano *</label>
                <select
                  value={formData.plan_id}
                  onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Selecione</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Servidor *</label>
                <select
                  value={formData.server_id}
                  onChange={(e) => setFormData({...formData, server_id: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Selecione</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>{server.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Valor (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_value}
                  onChange={(e) => setFormData({...formData, price_value: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Data de Vencimento *</label>
                <input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3">Credenciais de Acesso</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Usuário</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Senha</label>
                  <input
                    type="text"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">MAC Address</label>
                  <input
                    type="text"
                    value={formData.mac_address}
                    onChange={(e) => setFormData({...formData, mac_address: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Device Key</label>
                  <input
                    type="text"
                    value={formData.device_key}
                    onChange={(e) => setFormData({...formData, device_key: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Observações</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
                rows="3"
              ></textarea>
            </div>

            {isEdit && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <label className="ml-2 text-sm font-medium">Cliente ativo</label>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
