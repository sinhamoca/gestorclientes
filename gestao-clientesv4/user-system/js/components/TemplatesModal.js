/* ========================================
   TEMPLATES MODAL COMPONENT
   ======================================== */

function TemplatesModal({ templates, onClose, onRefresh }) {
  const { useState } = React;
  const [formData, setFormData] = useState({ 
    name: '', 
    type: 'vencimento_dia', 
    message: '' 
  });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await api.updateTemplate(editingId, formData);
        setEditingId(null);
      } else {
        await api.createTemplate(formData);
      }
      setFormData({ name: '', type: 'vencimento_dia', message: '' });
      onRefresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template) => {
    setFormData({
      name: template.name,
      type: template.type,
      message: template.message
    });
    setEditingId(template.id);
  };

  const handleCancelEdit = () => {
    setFormData({ name: '', type: 'vencimento_dia', message: '' });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este template?')) return;
    try {
      await api.deleteTemplate(id);
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  const insertVariable = (variable) => {
    const textarea = document.querySelector('textarea[name="message"]');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.message;
      const newText = text.substring(0, start) + variable + text.substring(end);
      setFormData({...formData, message: newText});
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Gerenciar Templates de Mensagens</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Template</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Lembrete de Vencimento"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tipo</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="vencimento_dia">Vencimento no Dia</option>
                  <option value="pre_vencimento">Pré-Vencimento</option>
                  <option value="pos_vencimento">Pós-Vencimento</option>
                  <option value="boas_vindas">Boas-vindas</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Mensagem</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg"
                rows="6"
                placeholder="Digite sua mensagem aqui..."
                required
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={() => insertVariable('{{nome}}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">{'{{nome}}'}</button>
                <button type="button" onClick={() => insertVariable('{{vencimento}}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">{'{{vencimento}}'}</button>
                <button type="button" onClick={() => insertVariable('{{valor}}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">{'{{valor}}'}</button>
                <button type="button" onClick={() => insertVariable('{{plano}}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">{'{{plano}}'}</button>
                <button type="button" onClick={() => insertVariable('{{servidor}}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">{'{{servidor}}'}</button>
                <button type="button" onClick={() => insertVariable('{{dias}}')} className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">{'{{dias}}'}</button>
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
                {loading ? 'Salvando...' : (editingId ? 'Atualizar Template' : 'Adicionar Template')}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="font-semibold mb-3">Templates Cadastrados</h4>
            {templates.map(template => (
              <div key={template.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <span className="text-xs text-gray-600 bg-gray-200 px-2 py-1 rounded">{template.type}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(template)} className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
                    <button onClick={() => handleDelete(template.id)} className="text-red-600 hover:text-red-800 text-sm">Excluir</button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{template.message}</p>
              </div>
            ))}
            {templates.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhum template cadastrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
