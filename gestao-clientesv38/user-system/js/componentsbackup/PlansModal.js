/* ========================================
   PLANS MODAL COMPONENT - COM SUPORTE PAINELFODA
   Arquivo COMPLETO modificado com PainelFoda
   ======================================== */

function PlansModal({ plans, onClose, onRefresh }) {
  const { useState } = React;
  
  // ========== STATE (MODIFICADO - ADICIONADO PAINELFODA) ==========
  const [formData, setFormData] = useState({ 
    name: '', 
    duration_months: '1',
    num_screens: '1',
    is_sigma_plan: false,
    sigma_plan_code: '',
    sigma_domain: '',
    is_live21_plan: false,
    is_koffice_plan: false,
    koffice_domain: '',
    is_uniplay_plan: false,
    is_unitv_plan: false,
    is_club_plan: false,
    // ← NOVO: PAINELFODA
    is_painelfoda_plan: false,
    painelfoda_domain: '',
    painelfoda_username: '',
    painelfoda_password: '',
    painelfoda_package_id: '',
    is_rush_plan: false,
    rush_type: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // ← NOVO: States para captura de packages
  const [capturingPackages, setCapturingPackages] = useState(false);
  const [capturedPackages, setCapturedPackages] = useState(null);
  const [showPackagesModal, setShowPackagesModal] = useState(false);
  const [searchPlan, setSearchPlan] = useState('');

  const filteredPlans = plans.filter(plan => 
    plan.name.toLowerCase().includes(searchPlan.toLowerCase())
  );

  // ========== FUNÇÃO DE CAPTURAR PACKAGES (NOVA) ==========
  const handleCapturePackages = async () => {
    // Validar campos
    if (!formData.painelfoda_domain || !formData.painelfoda_username || !formData.painelfoda_password) {
      alert('❌ Preencha domínio, usuário e senha antes de capturar os packages');
      return;
    }

    setCapturingPackages(true);
    setCapturedPackages(null);

    try {
      const response = await fetch(`${API_URL}/painelfoda/capture-packages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.TOKEN) || localStorage.getItem('user_token')}`
        },
        body: JSON.stringify({
          domain: formData.painelfoda_domain,
          username: formData.painelfoda_username,
          password: formData.painelfoda_password
        })
      });

      const data = await response.json();

      if (data.success) {
        setCapturedPackages(data.packages);
        setShowPackagesModal(true);
        console.log('✅ Packages capturados:', data.packages);
      } else {
        alert(`❌ Erro: ${data.error || data.message}`);
        console.error('Erro ao capturar packages:', data);
      }

    } catch (error) {
      alert(`❌ Erro ao capturar packages: ${error.message}`);
      console.error('Erro:', error);
    } finally {
      setCapturingPackages(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Preparar dados (incluindo PainelFoda)
      const dataToSend = {
        ...formData,
        // Encodar senha em base64 apenas se foi preenchida
        painelfoda_password: formData.painelfoda_password 
          ? btoa(formData.painelfoda_password) 
          : (editingId && plans.find(p => p.id === editingId)?.painelfoda_password) || null
      };

      if (editingId) {
        await api.updatePlan(editingId, dataToSend);
      } else {
        await api.createPlan(dataToSend);
      }
      
      // Reset form (incluindo campos PainelFoda)
      setFormData({ 
        name: '', 
        duration_months: '1', 
        num_screens: '1', 
        is_sigma_plan: false, 
        sigma_plan_code: '',
        sigma_domain: '',
        is_live21_plan: false,
        is_koffice_plan: false,
        koffice_domain: '',
        is_uniplay_plan: false,
        is_unitv_plan: false,
        is_club_plan: false,
        // ← RESET PAINELFODA
        is_painelfoda_plan: false,
        painelfoda_domain: '',
        painelfoda_username: '',
        painelfoda_password: '',
        painelfoda_package_id: '',
        is_rush_plan: false,
        rush_type: ''
      });
      setEditingId(null);
      setCapturedPackages(null); // Limpar packages capturados
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
      sigma_domain: plan.sigma_domain || '',
      is_uniplay_plan: plan.is_uniplay_plan || false,
      is_live21_plan: plan.is_live21_plan || false,
      is_koffice_plan: plan.is_koffice_plan || false,
      koffice_domain: plan.koffice_domain || '',
      is_unitv_plan: plan.is_unitv_plan || false,
      is_club_plan: plan.is_club_plan || false,
      // ← EDIÇÃO PAINELFODA (senha fica vazia por segurança)
      is_painelfoda_plan: plan.is_painelfoda_plan || false,
      painelfoda_domain: plan.painelfoda_domain || '',
      painelfoda_username: plan.painelfoda_username || '',
      painelfoda_password: '', // Sempre vazio por segurança
      painelfoda_package_id: plan.painelfoda_package_id || '',
      is_rush_plan: plan.is_rush_plan || false,
      rush_type: plan.rush_type || ''
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
      sigma_domain: '',
      is_uniplay_plan: false,
      is_live21_plan: false,
      is_koffice_plan: false,
      koffice_domain: '',
      is_unitv_plan: false,
      is_club_plan: false,
      // ← CANCELAR PAINELFODA
      is_painelfoda_plan: false,
      painelfoda_domain: '',
      painelfoda_username: '',
      painelfoda_password: '',
      painelfoda_package_id: '',
      is_rush_plan: false,
      rush_type: ''
    });
    setEditingId(null);
    setCapturedPackages(null);
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

  // ========== MODAL DE PACKAGES (NOVO) ==========
  const PackagesModal = () => {
    if (!showPackagesModal || !capturedPackages) return null;

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowPackagesModal(false);
          }
        }}
      >
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="text-lg font-bold">📦 Packages Disponíveis</h3>
            <button
              onClick={() => setShowPackagesModal(false)}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="p-4 max-h-96 overflow-y-auto">
            <div className="space-y-2 mb-4">
              {capturedPackages.map(pkg => (
                <div 
                  key={pkg.id} 
                  className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100"
                >
                  <span className="font-mono font-bold text-gray-700">ID: {pkg.id}</span>
                  <span className="text-gray-600">{pkg.nome}</span>
                </div>
              ))}
            </div>
            
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ℹ️ Copie o <strong>ID</strong> do package desejado e cole no campo "Package ID" abaixo
              </p>
            </div>
          </div>
          
          <div className="p-4 border-t">
            <button
              onClick={() => setShowPackagesModal(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Igual aos outros modais */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-white">📋 Gerenciar Planos</h3>
              <p className="text-blue-100 mt-1">{plans.length} plano(s) cadastrado(s)</p>
            </div>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body com scroll */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
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
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_sigma_plan: isChecked,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan  // ← ADICIONAR
                    });
                  }}
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

            {/* Checkbox Plano Live21 */}
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_live21_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_live21_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan  // ← ADICIONAR
                    });
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano Live21 (CloudNation)?</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_live21_plan ? (
                      <span className="text-green-700">
                        ✅ Este é um Plano Live21 com renovação automatizada.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano Live21
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* Checkbox Plano Koffice */}
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_koffice_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_koffice_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan  // ← ADICIONAR
                    });
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano Koffice?</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_koffice_plan ? (
                      <span className="text-orange-700">
                        ✅ Este é um Plano Koffice. O domínio será necessário.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano Koffice
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* Checkbox Plano Uniplay */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_uniplay_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_uniplay_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan  // ← ADICIONAR
                    });
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano Uniplay? 🔵</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_uniplay_plan ? (
                      <span className="text-blue-700">
                        ✅ Este é um Plano Uniplay com renovação automatizada.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano Uniplay
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* Checkbox Plano UniTV */}
            <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_unitv_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_unitv_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan  // ← ADICIONAR
                    });
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano UniTV? 🎫</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_unitv_plan ? (
                      <span className="text-purple-700">
                        ✅ Este é um Plano UniTV com entrega de código automatizada.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano UniTV
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* Checkbox Plano Club */}
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_club_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_club_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan  // ← ADICIONAR
                    });
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano Club (Dashboard.bz)? 🎯</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_club_plan ? (
                      <span className="text-yellow-700">
                        ✅ Este é um Plano Club com renovação automatizada.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano Club
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* ========== CHECKBOX RUSH ========== */}
            <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_rush_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_rush_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_painelfoda_plan: isChecked ? false : formData.is_painelfoda_plan,
                      rush_type: isChecked ? 'IPTV' : ''
                    });
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">Plano Rush (RushPlay)? 🟠</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_rush_plan ? (
                      <span className="text-orange-700">
                        ✅ Este é um Plano Rush com renovação automatizada.
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano Rush
                      </span>
                    )}
                  </p>
                </div>
              </label>

              {/* Select tipo IPTV/P2P */}
              {formData.is_rush_plan && (
                <div className="mt-3 ml-7">
                  <label className="block text-sm font-medium mb-2">
                    Tipo do Plano Rush *
                  </label>
                  <select
                    value={formData.rush_type}
                    onChange={(e) => setFormData({...formData, rush_type: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    <option value="IPTV">📺 IPTV (com telas)</option>
                    <option value="P2P">📱 P2P (sem telas)</option>
                  </select>
                  <p className="text-xs text-orange-600 mt-1">
                    {formData.rush_type === 'IPTV' 
                      ? '📺 IPTV usa a quantidade de telas configurada no plano'
                      : '📱 P2P não usa quantidade de telas'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* ========== NOVO: CHECKBOX PAINELFODA ========== */}
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_painelfoda_plan}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData({
                      ...formData,
                      is_painelfoda_plan: isChecked,
                      is_sigma_plan: isChecked ? false : formData.is_sigma_plan,
                      is_live21_plan: isChecked ? false : formData.is_live21_plan,
                      is_koffice_plan: isChecked ? false : formData.is_koffice_plan,
                      is_uniplay_plan: isChecked ? false : formData.is_uniplay_plan,
                      is_unitv_plan: isChecked ? false : formData.is_unitv_plan,
                      is_club_plan: isChecked ? false : formData.is_club_plan,
                      is_rush_plan: isChecked ? false : formData.is_rush_plan
                    });
                    if (!isChecked) {
                      // Limpar campos PainelFoda ao desmarcar
                      setFormData(prev => ({
                        ...prev,
                        painelfoda_domain: '',
                        painelfoda_username: '',
                        painelfoda_password: '',
                        painelfoda_package_id: ''
                      }));
                      setCapturedPackages(null);
                    }
                  }}
                  className="mt-1 w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-sm">É plano PainelFoda? 🚀</span>
                  <p className="text-xs text-gray-600 mt-1">
                    {formData.is_painelfoda_plan ? (
                      <span className="text-red-700">
                        ✅ Este é um Plano PainelFoda com renovação automatizada.
                        <br/>
                        • Credenciais individuais por plano
                        <br/>
                        • Captura automática de packages
                        <br/>
                        • Suporte a múltiplas telas
                      </span>
                    ) : (
                      <span className="text-gray-600">
                        Marque esta opção se este for um Plano PainelFoda
                      </span>
                    )}
                  </p>
                </div>
              </label>
            </div>

            {/* ========== CAMPOS PAINELFODA (aparecem quando checkbox marcado) ========== */}
            {formData.is_painelfoda_plan && (
              <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                <h4 className="font-medium text-sm mb-3 text-red-800">🎯 Configuração PainelFoda</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Domínio */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Domínio *
                    </label>
                    <input
                      type="text"
                      value={formData.painelfoda_domain}
                      onChange={(e) => setFormData({...formData, painelfoda_domain: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg border-red-300 focus:border-red-500 focus:ring-red-500"
                      placeholder="Ex: painel.xyz.com"
                      required={formData.is_painelfoda_plan}
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      Digite apenas o domínio, sem https://
                    </p>
                  </div>

                  {/* Usuário */}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Usuário *
                    </label>
                    <input
                      type="text"
                      value={formData.painelfoda_username}
                      onChange={(e) => setFormData({...formData, painelfoda_username: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg border-red-300 focus:border-red-500 focus:ring-red-500"
                      placeholder="Ex: revendedor1"
                      required={formData.is_painelfoda_plan}
                    />
                  </div>
                </div>

                {/* Senha */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Senha *
                    {editingId && (
                      <span className="text-xs text-gray-500 ml-2">
                        (deixe vazio para manter a senha atual)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={formData.painelfoda_password}
                    onChange={(e) => setFormData({...formData, painelfoda_password: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg border-red-300 focus:border-red-500 focus:ring-red-500"
                    placeholder="Digite a senha"
                    required={formData.is_painelfoda_plan && !editingId}
                  />
                </div>

                {/* Botão Capturar Packages */}
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={handleCapturePackages}
                    disabled={capturingPackages || !formData.painelfoda_domain || !formData.painelfoda_username || !formData.painelfoda_password}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {capturingPackages ? '⏳ Capturando...' : '📦 Capturar Packages Disponíveis'}
                  </button>
                  <p className="text-xs text-gray-600 mt-1">
                    Clique para descobrir os packages disponíveis no seu painel
                  </p>
                </div>

                {/* Package ID */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Package ID *
                    {capturedPackages && (
                      <span className="text-xs text-green-600 ml-2">
                        (✓ Packages capturados)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formData.painelfoda_package_id}
                    onChange={(e) => setFormData({...formData, painelfoda_package_id: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg border-red-300 focus:border-red-500 focus:ring-red-500"
                    placeholder="Ex: 1"
                    required={formData.is_painelfoda_plan}
                  />
                  <p className="text-xs text-gray-600 mt-1">
                    Digite o ID do package copiado da lista acima
                  </p>
                </div>
              </div>
            )}

            {/* Campo Domínio Koffice (apenas se checkbox marcado) */}
            {formData.is_koffice_plan && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  Domínio Koffice *
                  <span className="text-orange-600 ml-1">(Obrigatório)</span>
                </label>
                <input
                  type="text"
                  value={formData.koffice_domain}
                  onChange={(e) => setFormData({...formData, koffice_domain: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg border-orange-300 focus:border-orange-500 focus:ring-orange-500"
                  placeholder="Ex: https://daily3.news"
                  required={formData.is_koffice_plan}
                />
                <p className="text-xs text-orange-600 mt-1">
                  🌐 Digite o domínio completo do painel Koffice (incluindo https://)
                </p>
              </div>
            )}

            {/* Campos Código e Domínio Sigma (apenas se Plano Sigma estiver marcado) */}
            {formData.is_sigma_plan && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Código do Plano *</label>
                  <input
                    type="text"
                    value={formData.sigma_plan_code}
                    onChange={(e) => setFormData({...formData, sigma_plan_code: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Ex: XYgD9JWr6V"
                    required={formData.is_sigma_plan}
                  />
                  <p className="text-xs text-purple-600 mt-1">
                    📋 Preencha manualmente ou sincronize do iptv-manager
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Domínio Sigma *</label>
                  <input
                    type="text"
                    value={formData.sigma_domain}
                    onChange={(e) => setFormData({...formData, sigma_domain: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg border-purple-300 focus:border-purple-500 focus:ring-purple-500"
                    placeholder="Ex: https://starpainel.site"
                    required={formData.is_sigma_plan}
                  />
                  <p className="text-xs text-purple-600 mt-1">
                    🌐 Preencha manualmente ou sincronize do iptv-manager
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
            <h4 className="font-semibold mb-3">Planos Cadastrados ({filteredPlans.length})</h4>
            
            {/* 🔍 Barra de Pesquisa */}
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="🔍 Pesquisar plano por nome..."
                value={searchPlan}
                onChange={(e) => setSearchPlan(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchPlan && (
                <button
                  onClick={() => setSearchPlan('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Limpar pesquisa"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Lista de Planos */}
            {filteredPlans.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-4xl mb-2">🔍</p>
                <p>Nenhum plano encontrado{searchPlan && ` para "${searchPlan}"`}</p>
              </div>
            ) : (
              filteredPlans.map(plan => (
              <div key={plan.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{plan.name}</p>
                    
                    {plan.is_sigma_plan && (
                      <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">
                        ⚡ SIGMA
                      </span>
                    )}
                    
                    {plan.is_live21_plan && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                        🌐 LIVE21
                      </span>
                    )}
                    
                    {plan.is_koffice_plan && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                        ✓ Koffice
                      </span>
                    )}
                    
                    {plan.is_uniplay_plan && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        🔵 Uniplay
                      </span>
                    )}
                    
                    {plan.is_unitv_plan && (
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        🎫 UniTV
                      </span>
                    )}
                    
                    {plan.is_club_plan && (
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        🎯 CLUB
                      </span>
                    )}

                    {plan.is_rush_plan && (
                      <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                        🟠 RUSH {plan.rush_type}
                      </span>
                    )}
                    
                    {/* ← TAG PAINELFODA (NOVO) */}
                    {plan.is_painelfoda_plan && (
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                        🚀 PAINELFODA
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600">
                    {plan.duration_months} {plan.duration_months === 1 ? 'mês' : 'meses'} 
                    {' • '}
                    {plan.num_screens || 1} {(plan.num_screens || 1) === 1 ? 'tela' : 'telas'}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleEdit(plan)}
                    className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(plan.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    🗑️ Excluir
                  </button>
                </div>
              </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ← RENDERIZAR MODAL DE PACKAGES */}
      <PackagesModal />
    </div>
  );
}