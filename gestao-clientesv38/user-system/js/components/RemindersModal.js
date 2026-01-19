/* ========================================
   REMINDERS MODAL COMPONENT
   Com funcionalidade "ENVIAR AGORA"
   ======================================== */

function RemindersModal({ reminders, templates, onClose, onRefresh }) {
  const { useState, useEffect } = React;
  
  // 🔔 Toast Hook
  const toast = useToast();
  
  // Estados do formulário
  const [formData, setFormData] = useState({
    name: '',
    template_id: '',
    days_offset: '0',
    send_time: '09:00',
    send_once: false
  });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // ========== ESTADOS DO "ENVIAR AGORA" ==========
  const [showSendNow, setShowSendNow] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState([]);
  const [sendNowLoading, setSendNowLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Carregar preview quando abrir o modal ou mudar seleção
  useEffect(() => {
    if (showSendNow) {
      loadPreview();
    }
  }, [showSendNow, selectedReminders]);

  // Carregar preview de quantos clientes serão afetados
  const loadPreview = async () => {
    if (selectedReminders.length === 0) {
      setPreviewData(null);
      return;
    }
    
    try {
      setPreviewLoading(true);
      const data = await api.previewSendNow(selectedReminders);
      setPreviewData(data);
    } catch (error) {
      console.error('Erro ao carregar preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Toggle seleção de lembrete
  const toggleReminderSelection = (reminderId) => {
    setSelectedReminders(prev => {
      if (prev.includes(reminderId)) {
        return prev.filter(id => id !== reminderId);
      } else {
        return [...prev, reminderId];
      }
    });
  };

  // Selecionar/deselecionar todos
  const toggleSelectAll = () => {
    const activeReminders = reminders.filter(r => r.is_active);
    if (selectedReminders.length === activeReminders.length) {
      setSelectedReminders([]);
    } else {
      setSelectedReminders(activeReminders.map(r => r.id));
    }
  };

  // Executar envio imediato
  const handleSendNow = async () => {
    if (selectedReminders.length === 0) {
      toast.warning('Selecione pelo menos um lembrete para enviar.');
      return;
    }

    const activeSelected = reminders.filter(r => selectedReminders.includes(r.id) && r.is_active);
    
    if (activeSelected.length === 0) {
      toast.warning('Nenhum lembrete ativo selecionado.');
      return;
    }

    const totalClientes = previewData?.total_clients || 0;
    
    if (totalClientes === 0) {
      toast.info('Nenhum cliente será afetado pelos lembretes selecionados hoje.');
      return;
    }

    if (!confirm(`Enviar ${totalClientes} mensagem(s) agora?\n\nLembretes: ${activeSelected.map(r => r.name).join(', ')}\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      setSendNowLoading(true);
      const result = await api.sendRemindersNow(selectedReminders);
      
      toast.success(result.message, { title: 'Envio Iniciado!', duration: 5000 });
      
      setShowSendNow(false);
      setSelectedReminders([]);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSendNowLoading(false);
    }
  };

  // ========== FUNÇÕES EXISTENTES ==========
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const wasEditing = !!editingId;
    try {
      if (editingId) {
        await api.updateReminder(editingId, {...formData, is_active: true});
        setEditingId(null);
      } else {
        await api.createReminder(formData);
      }
      setFormData({ name: '', template_id: '', days_offset: '0', send_time: '09:00', send_once: false });
      onRefresh();
      toast.success(wasEditing ? 'Lembrete atualizado!' : 'Lembrete criado!');
    } catch (error) {
      toast.error(error.message);
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
      send_once: reminder.send_once || false
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
      toast.success(!currentStatus ? 'Lembrete ativado!' : 'Lembrete desativado!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este lembrete?')) return;
    try {
      await api.deleteReminder(id);
      onRefresh();
      toast.success('Lembrete excluído!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Descrição do days_offset
  // Lógica: positivo = antes do vencimento, negativo = depois (vencido)
  const getDaysDescription = (days) => {
    if (days === 0) return 'No dia do vencimento';
    if (days > 0) return `${days} dia(s) antes do vencimento`;
    return `${Math.abs(days)} dia(s) após vencido`;
  };

  // Lembretes ativos
  const activeReminders = reminders.filter(r => r.is_active);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header fixo */}
        <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
          <h3 className="text-xl font-bold">Gerenciar Lembretes Automáticos</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>

        {/* Conteúdo com scroll */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* ========== BOTÃO ENVIAR AGORA ========== */}
          {!showSendNow && activeReminders.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-red-800 flex items-center gap-2">
                    ⚡ Envio Manual
                  </h4>
                  <p className="text-sm text-red-600 mt-1">
                    API caiu? Envie os lembretes de hoje manualmente, sem esperar o horário programado.
                  </p>
                </div>
                <button
                  onClick={() => setShowSendNow(true)}
                  className="px-6 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors shadow-lg"
                >
                  🚀 ENVIAR AGORA
                </button>
              </div>
            </div>
          )}

          {/* ========== PAINEL ENVIAR AGORA ========== */}
          {showSendNow && (
            <div className="mb-6 p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-red-800 text-lg flex items-center gap-2">
                  🚀 Enviar Lembretes Agora
                </h4>
                <button
                  onClick={() => {
                    setShowSendNow(false);
                    setSelectedReminders([]);
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  ✕ Cancelar
                </button>
              </div>

              <p className="text-sm text-red-700 mb-4">
                Selecione os lembretes que deseja enviar. Serão enviados apenas para os clientes 
                que se enquadram nas condições de cada lembrete <strong>hoje</strong>.
              </p>

              {/* Selecionar todos */}
              <div className="mb-3 pb-3 border-b border-red-200">
                <div className="flex items-center gap-2">
                  <CustomCheckbox
                    checked={selectedReminders.length === activeReminders.length && activeReminders.length > 0}
                    onChange={toggleSelectAll}
                    color="red"
                  />
                  <span className="font-medium text-red-800 cursor-pointer" onClick={toggleSelectAll}>
                    Selecionar todos ({activeReminders.length} ativos)
                  </span>
                </div>
              </div>

              {/* Lista de lembretes com checkbox */}
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {reminders.map(reminder => (
                  <div
                    key={reminder.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      reminder.is_active 
                        ? selectedReminders.includes(reminder.id)
                          ? 'bg-red-100 border-2 border-red-400'
                          : 'bg-white border border-gray-200 hover:border-red-300'
                        : 'bg-gray-100 opacity-50 cursor-not-allowed'
                    }`}
                    onClick={() => reminder.is_active && toggleReminderSelection(reminder.id)}
                  >
                    <CustomCheckbox
                      checked={selectedReminders.includes(reminder.id)}
                      onChange={() => toggleReminderSelection(reminder.id)}
                      disabled={!reminder.is_active}
                      color="red"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{reminder.name}</span>
                        {!reminder.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-gray-300 text-gray-600 rounded">
                            Inativo
                          </span>
                        )}
                        {reminder.send_once && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            Uma vez
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        {getDaysDescription(reminder.days_offset)} • {reminder.send_time?.substring(0, 5)}
                      </p>
                    </div>
                    {selectedReminders.includes(reminder.id) && previewData?.by_reminder?.[reminder.id] !== undefined && (
                      <span className="text-sm font-bold text-red-600">
                        {previewData.by_reminder[reminder.id]} cliente(s)
                      </span>
                    )}
                  </div>
                ))}

                {reminders.length === 0 && (
                  <p className="text-center text-gray-500 py-4">
                    Nenhum lembrete configurado
                  </p>
                )}
              </div>

              {/* Preview do total */}
              {selectedReminders.length > 0 && (
                <div className="p-4 bg-white border border-red-200 rounded-lg mb-4">
                  {previewLoading ? (
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                      <span className="animate-spin">⏳</span>
                      Calculando...
                    </div>
                  ) : previewData ? (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">
                        {previewData.total_clients} mensagem(s)
                      </p>
                      <p className="text-sm text-gray-600">
                        serão enviadas para {previewData.total_clients} cliente(s)
                      </p>
                      {previewData.total_clients === 0 && (
                        <p className="text-xs text-yellow-600 mt-2">
                          ⚠️ Nenhum cliente se enquadra nas condições dos lembretes selecionados hoje
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-gray-500">
                      Selecione lembretes para ver o preview
                    </p>
                  )}
                </div>
              )}

              {/* Botão de envio */}
              <button
                onClick={handleSendNow}
                disabled={sendNowLoading || selectedReminders.length === 0 || previewData?.total_clients === 0}
                className={`w-full py-4 font-bold text-lg rounded-lg transition-colors ${
                  sendNowLoading || selectedReminders.length === 0 || previewData?.total_clients === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
                }`}
              >
                {sendNowLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    Enviando...
                  </span>
                ) : (
                  `🚀 ENVIAR ${previewData?.total_clients || 0} MENSAGEM(S) AGORA`
                )}
              </button>

              <p className="text-xs text-center text-red-600 mt-2">
                ⚠️ Esta ação não pode ser desfeita. Acompanhe o envio na página de Logs.
              </p>
            </div>
          )}

          {/* ========== FORMULÁRIO DE CRIAÇÃO/EDIÇÃO ========== */}
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
                <label className="block text-sm font-medium mb-2">Dias em relação ao vencimento</label>
                <input
                  type="number"
                  value={formData.days_offset}
                  onChange={(e) => setFormData({...formData, days_offset: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Ex: 3 = 3 dias antes, 0 = no dia, -1 = 1 dia após"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Positivo = dias antes do vencimento | Negativo = dias após vencido
                </p>
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
                <div className="flex items-start gap-3">
                  <CustomCheckbox
                    checked={formData.send_once}
                    onChange={(e) => setFormData({...formData, send_once: e.target.checked})}
                    color="purple"
                  />
                  <div className="cursor-pointer" onClick={() => setFormData({...formData, send_once: !formData.send_once})}>
                    <span className="text-sm font-medium">
                      Enviar apenas uma vez por cliente
                    </span>
                    <p className="text-xs text-gray-500">
                      Útil para pesquisas de satisfação. O lembrete será enviado apenas na primeira vez que a condição for atendida.
                    </p>
                  </div>
                </div>
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

          {/* ========== LISTA DE LEMBRETES ========== */}
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
                      {getDaysDescription(reminder.days_offset)}
                      {' '}às {reminder.send_time?.substring(0, 5)}
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