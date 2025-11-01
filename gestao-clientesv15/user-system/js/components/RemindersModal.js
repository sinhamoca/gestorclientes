/* ========================================
   REMINDERS MODAL COMPONENT
   ======================================== */

function RemindersModal({ reminders, templates, onClose, onRefresh }) {
  const { useState } = React;
  const [formData, setFormData] = useState({
    name: '',
    template_id: '',
    days_offset: '0',
    send_time: '09:00',
    send_once: false  // ← ADICIONAR
  });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateReminder(editingId, {...formData, is_active: true});
        setEditingId(null);
      } else {
        await api.createReminder(formData);
      }
      setFormData({ name: '', template_id: '', days_offset: '0', send_time: '09:00', send_once: false });
      onRefresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (reminder) => {
    setFormData({
      name: reminder.name,
      template_id: reminder.template_id,
      days_offset: reminder.days_offset,
      send_time: reminder.send_time.substring(0, 5),
      send_once: reminder.send_once || false  // ← ADICIONAR
    });
    setEditingId(reminder.id);
  };

  const handleCancelEdit = () => {
    setFormData({ name: '', template_id: '', days_offset: '0', send_time: '09:00', send_once: false });
    setEditingId(null);
  };

  const handleToggleActive = async (id, currentStatus) => {
    try {
      const reminder = reminders.find(r => r.id === id);
      await api.updateReminder(id, {
        name: reminder.name,
        template_id: reminder.template_id,
        days_offset: reminder.days_offset,
        send_time: reminder.send_time,
        send_once: reminder.send_once || false,
        is_active: !currentStatus
      });
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este lembrete?')) return;
    try {
      await api.deleteReminder(id);
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Gerenciar Lembretes Automáticos</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Lembrete</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Aviso 3 dias antes"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Template</label>
                <select
                  value={formData.template_id}
                  onChange={(e) => setFormData({...formData, template_id: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Selecione um template</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Dias antes do vencimento</label>
                <input
                  type="number"
                  value={formData.days_offset}
                  onChange={(e) => setFormData({...formData, days_offset: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="0 = no dia, -1 = 1 dia antes, -3 = 3 dias antes"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Use números negativos para dias antes</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Horário de Envio</label>
                <input
                  type="time"
                  value={formData.send_time}
                  onChange={(e) => setFormData({...formData, send_time: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div className="border-t pt-4 mt-4 md:col-span-2"> 
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.send_once}
                    onChange={(e) => setFormData({...formData, send_once: e.target.checked})}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      Enviar apenas uma vez por cliente
                    </span>
                    <p className="text-xs text-gray-500">
                      Útil para pesquisas de satisfação. O lembrete será enviado apenas na primeira vez que a condição for atendida.
                    </p>
                  </div>
                </label>
              </div>
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
                {loading ? 'Salvando...' : (editingId ? 'Atualizar Lembrete' : 'Adicionar Lembrete')}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="font-semibold mb-3">Lembretes Configurados</h4>
            {reminders.map(reminder => (
              <div key={reminder.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{reminder.name}</p>
                      <span className={`text-xs px-2 py-1 rounded ${reminder.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                        {reminder.is_active ? 'Ativo' : 'Inativo'}
                      </span>
                      {reminder.send_once && (
                        <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700">
                          Uma vez
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Template: {reminder.template_name}</p>
                    <p className="text-sm text-gray-600">
                      {reminder.days_offset === 0 ? 'No dia do vencimento' : 
                       reminder.days_offset < 0 ? `${Math.abs(reminder.days_offset)} dia(s) antes` : 
                       `${reminder.days_offset} dia(s) depois`}
                      {' '}às {reminder.send_time.substring(0, 5)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleActive(reminder.id, reminder.is_active)}
                      className={`text-sm ${reminder.is_active ? 'text-yellow-600 hover:text-yellow-800' : 'text-green-600 hover:text-green-800'}`}
                    >
                      {reminder.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => handleEdit(reminder)} className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
                    <button onClick={() => handleDelete(reminder.id)} className="text-red-600 hover:text-red-800 text-sm">Excluir</button>
                  </div>
                </div>
              </div>
            ))}
            {reminders.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhum lembrete configurado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
