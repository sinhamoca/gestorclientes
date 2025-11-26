/* ========================================
   CLIENT MODAL COMPONENT
   COM CAMPOS DE PLAYER TYPE E DOMAIN
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
    // NOVOS CAMPOS DE PLAYER
    player_type: client?.player_type || '',
    player_domain: client?.player_domain || '',
    notes: client?.notes || '',
    is_active: client?.is_active ?? true
  });

  // Estado para controlar se o domínio é customizado
  const [customDomain, setCustomDomain] = useState(
    client?.player_domain && 
    !['iboiptv.com', 'bobplayer.com'].includes(client?.player_domain)
  );

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
      onClose();
      
    } catch (error) {
      alert(`❌ Erro ao salvar: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handler para mudança do tipo de player
  const handlePlayerTypeChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({
      ...prev,
      player_type: newType,
      // Limpa o domínio se não for iboplayer
      player_domain: newType === 'iboplayer' ? prev.player_domain : ''
    }));
    
    // Reset custom domain flag se mudar de tipo
    if (newType !== 'iboplayer') {
      setCustomDomain(false);
    }
  };

  // Handler para mudança do domínio
  const handleDomainChange = (e) => {
    const value = e.target.value;
    
    if (value === 'custom') {
      setCustomDomain(true);
      setFormData(prev => ({ ...prev, player_domain: '' }));
    } else {
      setCustomDomain(false);
      setFormData(prev => ({ ...prev, player_domain: value }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-screen overflow-y-auto">
        <div className="p-6 border-b flex justify-between items-center">
          <h3 className="text-xl font-bold">{isEdit ? '✏️ Editar Cliente' : '➕ Novo Cliente'}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Dados Básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nome *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">WhatsApp *</label>
              <input
                type="text"
                value={formData.whatsapp_number}
                onChange={(e) => setFormData({...formData, whatsapp_number: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="5511999999999"
                required
              />
            </div>
          </div>

          {/* Plano e Servidor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Plano *</label>
              <select
                value={formData.plan_id}
                onChange={(e) => setFormData({...formData, plan_id: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione um plano</option>
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
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecione um servidor</option>
                {servers.map(server => (
                  <option key={server.id} value={server.id}>{server.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Valor e Vencimento */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Valor (R$) *</label>
              <input
                type="number"
                step="0.01"
                value={formData.price_value}
                onChange={(e) => setFormData({...formData, price_value: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Data de Vencimento *</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Credenciais de Acesso */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">Credenciais de Acesso</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Usuário</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Senha</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">MAC Address</label>
                <input
                  type="text"
                  value={formData.mac_address}
                  onChange={(e) => setFormData({...formData, mac_address: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="00:1A:79:XX:XX:XX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Device Key</label>
                <input
                  type="text"
                  value={formData.device_key}
                  onChange={(e) => setFormData({...formData, device_key: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ========== NOVA SEÇÃO: APLICATIVO DE PLAYER ========== */}
          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3">📺 Aplicativo de Player</h4>
            <p className="text-sm text-gray-500 mb-3">
              Selecione o aplicativo utilizado pelo cliente para gerenciar playlists
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tipo de Player */}
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Aplicativo</label>
                <select
                  value={formData.player_type}
                  onChange={handlePlayerTypeChange}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Não definido</option>
                  <option value="iboplayer">IBOPlayer / BOBPlayer</option>
                  <option value="ibopro">IBOPro</option>
                  <option value="vuplayer">VU Player</option>
                </select>
              </div>

              {/* Domínio (apenas para IBOPlayer) */}
              {formData.player_type === 'iboplayer' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Domínio do Player</label>
                  {!customDomain ? (
                    <select
                      value={formData.player_domain || ''}
                      onChange={handleDomainChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Selecione o domínio</option>
                      <option value="iboiptv.com">iboiptv.com</option>
                      <option value="bobplayer.com">bobplayer.com</option>
                      <option value="custom">Outro domínio...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formData.player_domain}
                        onChange={(e) => setFormData({...formData, player_domain: e.target.value})}
                        className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="exemplo.com"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCustomDomain(false);
                          setFormData({...formData, player_domain: ''});
                        }}
                        className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                        title="Voltar para lista"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* ========== FIM NOVA SEÇÃO ========== */}

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium mb-2">Observações</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="is_active" className="text-sm font-medium">Cliente ativo</label>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-100 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar Cliente')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}