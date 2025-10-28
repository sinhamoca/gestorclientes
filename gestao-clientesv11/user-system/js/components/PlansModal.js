/* ========================================
   PLANS MODAL COMPONENT - COM EDIÇÃO E PLANO SIGMA
   ======================================== */

function PlansModal({ plans, onClose, onRefresh }) {
  const { useState } = React;
  const [formData, setFormData] = useState({ 
    name: '', 
    duration_months: '1',
    num_screens: '1',
    is_sigma_plan: false,
    sigma_plan_code: '',
    sigma_domain: ''  // NOVO CAMPO!
  });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        // Editar plano existente
        await api.updatePlan(editingId, formData);
      } else {
        // Criar novo plano
        await api.createPlan(formData);
      }
      setFormData({ 
        name: '', 
        duration_months: '1', 
        num_screens: '1', 
        is_sigma_plan: false, 
        sigma_plan_code: '',
        sigma_domain: ''
      });
      setEditingId(null);
      onRefresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (plan) => {
    setFormData({
      name: plan.name,
      duration_months: plan.duration_months.toString(),
      num_screens: (plan.num_screens || 1).toString(),
      is_sigma_plan: plan.is_sigma_plan || false,
      sigma_plan_code: plan.sigma_plan_code || '',
      sigma_domain: plan.sigma_domain || ''  // NOVO CAMPO!
    });
    setEditingId(plan.id);
  };

  const handleCancelEdit = () => {
    setFormData({ 
      name: '', 
      duration_months: '1', 
      num_screens: '1', 
      is_sigma_plan: false, 
      sigma_plan_code: '',
      sigma_domain: ''
    });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este plano?')) return;
    try {
      await api.deletePlan(id);
      onRefresh();
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">Gerenciar Planos</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
            {editingId && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  ✏️ <strong>Modo de Edição:</strong> Você está editando um plano existente
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Plano *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: Mensal Premium"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Duração (meses) *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.duration_months}
                  onChange={(e) => setFormData({...formData, duration_months: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Quantidade de Telas *</label>
                <input
                  type="number"
                  min="1"
                  value={formData.num_screens}
                  onChange={(e) => setFormData({...formData, num_screens: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: 2"
                  required
                />
              </div>
            </div>

            {/* Checkbox Plano Sigma */}
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_sigma_plan}
                  onChange={(e) => setFormData({...formData, is_sigma_plan: e.target.checked})}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano Sigma?</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_sigma_plan ? (
                      <span className="text-purple-700">
                        ✅ Este é um Plano Sigma. O código e domínio do plano serão necessários.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano Sigma
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* Campos Código e Domínio (apenas se Plano Sigma estiver marcado) */}
            {formData.is_sigma_plan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Código do Plano *</label>
                  <input
                    type="text"
                    value={formData.sigma_plan_code}
                    onChange={(e) => setFormData({...formData, sigma_plan_code: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg border-purple-300 focus:border-purple-500 focus:ring-purple-500 bg-gray-100"
                    placeholder="Ex: XYgD9JWr6V"
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-purple-600 mt-1">
                    📋 Preenchido automaticamente ao sincronizar
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Domínio Sigma *</label>
                  <input
                    type="text"
                    value={formData.sigma_domain}
                    onChange={(e) => setFormData({...formData, sigma_domain: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg border-purple-300 focus:border-purple-500 focus:ring-purple-500 bg-gray-100"
                    placeholder="Ex: https://starpainel.site"
                    readOnly
                    disabled
                  />
                  <p className="text-xs text-purple-600 mt-1">
                    🌐 Preenchido automaticamente ao sincronizar
                  </p>
                </div>
              </div>
            )}
            
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
                {loading ? 'Salvando...' : (editingId ? 'Atualizar Plano' : 'Adicionar Plano')}
              </button>
            </div>
          </form>

          <div className="space-y-2">
            <h4 className="font-semibold mb-3">Planos Cadastrados</h4>
            {plans.map(plan => (
              <div key={plan.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{plan.name}</p>
                    {plan.is_sigma_plan && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">
                        ⚡ SIGMA
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'} 
                    {' • '}
                    {plan.num_screens || 1} {(plan.num_screens || 1) === 1 ? 'tela' : 'telas'}
                  </p>
                  {plan.is_sigma_plan && (
                    <div className="text-xs text-purple-600 mt-1 space-y-0.5">
                      {plan.sigma_plan_code && (
                        <p>📋 Código: {plan.sigma_plan_code}</p>
                      )}
                      {plan.sigma_domain && (
                        <p>🌐 Domínio: {plan.sigma_domain}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <p className="text-gray-500 text-center py-4">Nenhum plano cadastrado</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}