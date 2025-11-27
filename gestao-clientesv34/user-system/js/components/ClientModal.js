/* ========================================
   CLIENT MODAL COMPONENT
   COM VALIDAÇÃO DE WHATSAPP BRASILEIRO
   ======================================== */

function ClientModal({ client, plans, servers, onClose, onSave }) {
  const { useState, useEffect } = React;
  const isEdit = !!client;
  const [loading, setLoading] = useState(false);
  
  // ========================================
  // ESTADOS DO FORMULÁRIO
  // ========================================
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
    player_type: client?.player_type || '',
    player_domain: client?.player_domain || '',
    notes: client?.notes || '',
    is_active: client?.is_active ?? true
  });

  // ========================================
  // ESTADO DE VALIDAÇÃO DO WHATSAPP
  // ========================================
  const [whatsappError, setWhatsappError] = useState('');
  const [whatsappFormatted, setWhatsappFormatted] = useState('');

  // Estado para controlar se o domínio é customizado
  const [customDomain, setCustomDomain] = useState(
    client?.player_domain && 
    !['iboiptv.com', 'bobplayer.com'].includes(client?.player_domain)
  );

  // ========================================
  // FUNÇÕES DE VALIDAÇÃO DE WHATSAPP
  // ========================================

  /**
   * Formata e valida número de WhatsApp brasileiro
   * Retorna { valid: boolean, number: string, error: string }
   */
  const validateWhatsAppNumber = (input) => {
    if (!input || input.trim() === '') {
      return { valid: false, number: '', error: 'WhatsApp é obrigatório' };
    }

    // Remove tudo que não é número
    let cleaned = input.replace(/\D/g, '');
    
    // Se começar com 0, remove (alguns digitam 085...)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Se não começar com 55, adiciona
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    // Validar tamanho
    // 55 (2) + DDD (2) + Número (8 ou 9) = 12 ou 13 dígitos
    if (cleaned.length < 12) {
      return { 
        valid: false, 
        number: cleaned, 
        error: `Número incompleto (${cleaned.length} dígitos). Mínimo: 12 dígitos` 
      };
    }

    if (cleaned.length > 13) {
      return { 
        valid: false, 
        number: cleaned, 
        error: `Número muito longo (${cleaned.length} dígitos). Máximo: 13 dígitos` 
      };
    }

    // Validar DDD (11-99)
    const ddd = parseInt(cleaned.substring(2, 4));
    if (ddd < 11 || ddd > 99) {
      return { 
        valid: false, 
        number: cleaned, 
        error: `DDD inválido: ${ddd}. Use um DDD válido (11-99)` 
      };
    }

    // Se tem 13 dígitos, o 5º deve ser 9 (celular)
    if (cleaned.length === 13) {
      const fifthDigit = cleaned.charAt(4);
      if (fifthDigit !== '9') {
        return { 
          valid: false, 
          number: cleaned, 
          error: `Celular de 13 dígitos deve ter 9 como 5º dígito` 
        };
      }
    }

    return { valid: true, number: cleaned, error: '' };
  };

  /**
   * Formata número para exibição amigável
   */
  const formatWhatsAppDisplay = (number) => {
    if (!number || number.length < 12) return number;
    
    // 55 85 9 9402-1963 ou 55 85 9402-1963
    const countryCode = number.substring(0, 2);
    const ddd = number.substring(2, 4);
    
    if (number.length === 13) {
      const part1 = number.substring(4, 5);
      const part2 = number.substring(5, 9);
      const part3 = number.substring(9, 13);
      return `+${countryCode} (${ddd}) ${part1} ${part2}-${part3}`;
    } else {
      const part1 = number.substring(4, 8);
      const part2 = number.substring(8, 12);
      return `+${countryCode} (${ddd}) ${part1}-${part2}`;
    }
  };

  /**
   * Handler para mudança no campo WhatsApp
   */
  const handleWhatsAppChange = (e) => {
    const inputValue = e.target.value;
    
    // Permite digitar livremente
    setFormData({ ...formData, whatsapp_number: inputValue });
    
    // Valida em tempo real
    const validation = validateWhatsAppNumber(inputValue);
    setWhatsappError(validation.error);
    setWhatsappFormatted(validation.valid ? formatWhatsAppDisplay(validation.number) : '');
  };

  /**
   * Handler para quando o campo perde foco (blur)
   * Auto-formata o número
   */
  const handleWhatsAppBlur = () => {
    const validation = validateWhatsAppNumber(formData.whatsapp_number);
    
    if (validation.valid) {
      // Auto-formata para o número limpo
      setFormData({ ...formData, whatsapp_number: validation.number });
      setWhatsappError('');
      setWhatsappFormatted(formatWhatsAppDisplay(validation.number));
    }
  };

  // ========================================
  // SUBMIT DO FORMULÁRIO
  // ========================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar WhatsApp antes de enviar
    const whatsappValidation = validateWhatsAppNumber(formData.whatsapp_number);
    if (!whatsappValidation.valid) {
      setWhatsappError(whatsappValidation.error);
      alert(`❌ Número de WhatsApp inválido:\n${whatsappValidation.error}`);
      return;
    }

    setLoading(true);
    
    try {
      // Usar o número limpo/validado
      const dataToSend = {
        ...formData,
        whatsapp_number: whatsappValidation.number
      };

      if (client) {
        await api.updateClient(client.id, dataToSend);
        alert('✅ Cliente atualizado com sucesso!');
      } else {
        await api.createClient(dataToSend);
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

  // ========================================
  // HANDLERS DE PLAYER
  // ========================================
  const handlePlayerTypeChange = (e) => {
    const newType = e.target.value;
    setFormData(prev => ({
      ...prev,
      player_type: newType,
      player_domain: newType === 'iboplayer' ? prev.player_domain : ''
    }));
    
    if (newType !== 'iboplayer') {
      setCustomDomain(false);
    }
  };

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

  // ========================================
  // VALIDAÇÃO INICIAL (ao editar)
  // ========================================
  useEffect(() => {
    if (client?.whatsapp_number) {
      const validation = validateWhatsAppNumber(client.whatsapp_number);
      if (validation.valid) {
        setWhatsappFormatted(formatWhatsAppDisplay(validation.number));
      }
    }
  }, [client]);

  // ========================================
  // RENDER
  // ========================================
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
            
            {/* ========================================
                CAMPO WHATSAPP COM VALIDAÇÃO
                ======================================== */}
            <div>
              <label className="block text-sm font-medium mb-2">
                WhatsApp * 
                <span className="text-xs text-gray-500 ml-2">(apenas números)</span>
              </label>
              <input
                type="text"
                value={formData.whatsapp_number}
                onChange={handleWhatsAppChange}
                onBlur={handleWhatsAppBlur}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 ${
                  whatsappError 
                    ? 'border-red-500 focus:ring-red-500 bg-red-50' 
                    : whatsappFormatted 
                      ? 'border-green-500 focus:ring-green-500 bg-green-50'
                      : 'focus:ring-blue-500'
                }`}
                placeholder="Ex: 85999999999 ou 5585999999999"
                required
              />
              
              {/* Feedback de validação */}
              {whatsappError && (
                <p className="text-red-500 text-xs mt-1 flex items-center">
                  <span className="mr-1">❌</span> {whatsappError}
                </p>
              )}
              
              {whatsappFormatted && !whatsappError && (
                <p className="text-green-600 text-xs mt-1 flex items-center">
                  <span className="mr-1">✅</span> {whatsappFormatted}
                </p>
              )}
              
              {/* Dica */}
              <p className="text-gray-400 text-xs mt-1">
                Formato: 55 + DDD + Número (12 ou 13 dígitos)
              </p>
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

          {/* Credenciais */}
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
          </div>

          {/* MAC e Device Key */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">MAC Address</label>
              <input
                type="text"
                value={formData.mac_address}
                onChange={(e) => setFormData({...formData, mac_address: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="XX:XX:XX:XX:XX:XX"
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

          {/* Player Type e Domain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de Player</label>
              <select
                value={formData.player_type}
                onChange={handlePlayerTypeChange}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Nenhum</option>
                <option value="iboplayer">iboPlayer</option>
                <option value="smartersplayer">SmartersPlayer</option>
                <option value="implayer">ImPlayer</option>
                <option value="xciptv">XCIPTV</option>
              </select>
            </div>
            
            {formData.player_type === 'iboplayer' && (
              <div>
                <label className="block text-sm font-medium mb-2">Domínio iboPlayer</label>
                {!customDomain ? (
                  <select
                    value={formData.player_domain}
                    onChange={handleDomainChange}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
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
                      placeholder="meudominio.com"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomDomain(false)}
                      className="px-3 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      ↩️
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

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

          {/* Status (apenas em edição) */}
          {isEdit && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm">Cliente ativo</label>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || whatsappError}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : (isEdit ? 'Atualizar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}