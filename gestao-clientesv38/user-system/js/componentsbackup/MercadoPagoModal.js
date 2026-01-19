/* ========================================
   MERCADO PAGO MODAL COMPONENT
   COM SUPORTE A CHAVE PIX MANUAL
   ======================================== */

function MercadoPagoModal({ onClose, onSuccess }) {
  const { useState, useEffect } = React;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const [settings, setSettings] = useState({
    access_token_masked: null,
    public_key_masked: null,
    pix_key: null,
    pix_key_holder: null,
    pix_key_type: null
  });
  
  const [formData, setFormData] = useState({
    access_token: '',
    public_key: ''
  });

  // 🆕 STATE PARA PIX MANUAL
  const [pixData, setPixData] = useState({
    pix_key: '',
    pix_key_holder: '',
    pix_key_type: 'random'
  });
  const [savingPix, setSavingPix] = useState(false);
  const [showPixForm, setShowPixForm] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await api.getPaymentSettings();
      
      if (data.configured) {
        setConfigured(true);
        setEnabled(data.mercadopago_enabled);
        setSettings({
          access_token_masked: data.access_token_masked,
          public_key_masked: data.public_key_masked,
          payment_domain: data.payment_domain,
          // 🆕 PIX
          pix_key: data.pix_key,
          pix_key_holder: data.pix_key_holder,
          pix_key_type: data.pix_key_type
        });
        // Preencher formulário PIX se existir
        if (data.pix_key) {
          setPixData({
            pix_key: data.pix_key,
            pix_key_holder: data.pix_key_holder || '',
            pix_key_type: data.pix_key_type || 'random'
          });
        }
      } else {
        setConfigured(false);
        setShowForm(true);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = async () => {
    if (!formData.access_token || !formData.public_key) {
      setError('Preencha Access Token e Public Key');
      return;
    }

    try {
      setTesting(true);
      setError(null);
      setSuccess(null);

      const result = await api.testMercadoPagoCredentials({
        access_token: formData.access_token,
        public_key: formData.public_key
      });

      if (result.valid) {
        setSuccess('✅ Credenciais válidas! Pode salvar agora.');
      } else {
        setError('❌ Credenciais inválidas. Verifique seus dados.');
      }
    } catch (error) {
      setError(error.message || 'Erro ao testar credenciais');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.access_token || !formData.public_key) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await api.savePaymentSettings(formData);
      
      setSuccess('✅ Configurações salvas com sucesso!');
      setShowForm(false);
      loadSettings();
      
      if (onSuccess) onSuccess();
    } catch (error) {
      setError(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  // 🆕 SALVAR CHAVE PIX
  const handleSavePix = async () => {
    if (!pixData.pix_key) {
      setError('Preencha a chave PIX');
      return;
    }

    try {
      setSavingPix(true);
      setError(null);

      await api.savePixKey(pixData);
      
      setSuccess('✅ Chave PIX salva com sucesso!');
      setShowPixForm(false);
      loadSettings();
    } catch (error) {
      setError(error.message || 'Erro ao salvar chave PIX');
    } finally {
      setSavingPix(false);
    }
  };

  const handleToggle = async () => {
    try {
      await api.toggleMercadoPago({ enabled: !enabled });
      setEnabled(!enabled);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('⚠️ Tem certeza que deseja remover as credenciais do Mercado Pago? Os links de pagamento existentes deixarão de funcionar.')) {
      return;
    }

    try {
      await api.deletePaymentSettings();
      setConfigured(false);
      setSettings({});
      setShowForm(true);
      setSuccess('Configurações removidas!');
    } catch (error) {
      setError(error.message);
    }
  };

  // Tipo de chave PIX formatado
  const getPixTypeLabel = (type) => {
    const types = {
      'cpf': 'CPF',
      'cnpj': 'CNPJ',
      'email': 'E-mail',
      'phone': 'Telefone',
      'random': 'Chave Aleatória'
    };
    return types[type] || type;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="text-center mt-4">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-green-500 to-blue-600">
          <div className="flex justify-between items-center">
            <h3 className="text-2xl font-bold text-white">💳 Configurações de Pagamento</h3>
            <button 
              onClick={onClose}
              className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Mensagens */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {/* ========== SEÇÃO 1: MERCADO PAGO ========== */}
          <div className="mb-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🔷</span>
              Mercado Pago (Link Automático)
            </h4>
            
            {configured && !showForm ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    <span className="font-semibold">{enabled ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={handleToggle}
                      className="sr-only"
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`}></div>
                    </div>
                  </label>
                </div>

                <div className="space-y-2 text-sm">
                  <p><strong>Access Token:</strong> <span className="font-mono text-xs bg-white px-2 py-1 rounded">{settings.access_token_masked || '***'}</span></p>
                  <p><strong>Public Key:</strong> <span className="font-mono text-xs bg-white px-2 py-1 rounded">{settings.public_key_masked || '***'}</span></p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    ✏️ Alterar Credenciais
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    🗑️ Remover
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>Como obter as credenciais:</strong><br/>
                    1. Acesse: <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" className="underline">Mercado Pago Developers</a><br/>
                    2. Crie ou selecione sua aplicação<br/>
                    3. Copie o <strong>Access Token</strong> e <strong>Public Key</strong>
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Access Token <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.access_token}
                      onChange={(e) => setFormData({...formData, access_token: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                      placeholder="APP_USR-xxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Public Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.public_key}
                      onChange={(e) => setFormData({...formData, public_key: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
                      placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    {configured && (
                      <button
                        onClick={() => {
                          setShowForm(false);
                          setFormData({ access_token: '', public_key: '' });
                        }}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        ← Cancelar
                      </button>
                    )}
                    <button
                      onClick={handleTestCredentials}
                      disabled={testing || !formData.access_token || !formData.public_key}
                      className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {testing ? '🔄 Testando...' : '🔍 Testar'}
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving || !formData.access_token || !formData.public_key}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? '💾 Salvando...' : '💾 Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========== SEÇÃO 2: PIX MANUAL ========== */}
          <div className="border-t pt-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">🔶</span>
              Chave PIX Manual
              <span className="text-xs font-normal bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                Para clientes sem link
              </span>
            </h4>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-orange-800">
                <strong>ℹ️ Como funciona:</strong><br/>
                Configure uma chave PIX para clientes que preferem pagamento manual.
                Use a variável <code className="bg-white px-2 py-0.5 rounded font-mono">{'{pix}'}</code> nos templates de mensagem.
              </p>
            </div>

            {settings.pix_key && !showPixForm ? (
              <div className="bg-white border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                  <span className="font-semibold text-orange-700">Chave PIX Configurada</span>
                </div>

                <div className="space-y-2 text-sm bg-orange-50 p-3 rounded-lg">
                  <p>
                    <strong>Tipo:</strong> {getPixTypeLabel(settings.pix_key_type)}
                  </p>
                  <p>
                    <strong>Chave:</strong> 
                    <span className="font-mono bg-white px-2 py-1 rounded ml-2">{settings.pix_key}</span>
                  </p>
                  {settings.pix_key_holder && (
                    <p>
                      <strong>Titular:</strong> {settings.pix_key_holder}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => setShowPixForm(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"
                  >
                    ✏️ Alterar Chave PIX
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-orange-200 rounded-lg p-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Tipo da Chave PIX
                    </label>
                    <select
                      value={pixData.pix_key_type}
                      onChange={(e) => setPixData({...pixData, pix_key_type: e.target.value})}
                      className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Chave Aleatória</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Chave PIX <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={pixData.pix_key}
                      onChange={(e) => setPixData({...pixData, pix_key: e.target.value})}
                      className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 font-mono"
                      placeholder={
                        pixData.pix_key_type === 'cpf' ? '000.000.000-00' :
                        pixData.pix_key_type === 'cnpj' ? '00.000.000/0000-00' :
                        pixData.pix_key_type === 'email' ? 'seu@email.com' :
                        pixData.pix_key_type === 'phone' ? '+5511999999999' :
                        'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Nome do Titular
                    </label>
                    <input
                      type="text"
                      value={pixData.pix_key_holder}
                      onChange={(e) => setPixData({...pixData, pix_key_holder: e.target.value})}
                      className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
                      placeholder="Nome completo do titular"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use a variável <code className="bg-gray-100 px-1 rounded">{'{pix_titular}'}</code> para exibir nos templates
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    {settings.pix_key && (
                      <button
                        onClick={() => {
                          setShowPixForm(false);
                          setPixData({
                            pix_key: settings.pix_key,
                            pix_key_holder: settings.pix_key_holder || '',
                            pix_key_type: settings.pix_key_type || 'random'
                          });
                        }}
                        className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                      >
                        ← Cancelar
                      </button>
                    )}
                    <button
                      onClick={handleSavePix}
                      disabled={savingPix || !pixData.pix_key}
                      className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                    >
                      {savingPix ? '💾 Salvando...' : '💾 Salvar Chave PIX'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ========== SEÇÃO 3: VARIÁVEIS DISPONÍVEIS ========== */}
          <div className="border-t pt-6 mt-6">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="text-2xl">📝</span>
              Variáveis para Templates
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="font-semibold text-blue-800 mb-2">🔷 Link Automático</p>
                <code className="text-sm bg-white px-2 py-1 rounded block mb-1">{'{fatura}'}</code>
                <code className="text-sm bg-white px-2 py-1 rounded block">{'{link_pagamento}'}</code>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="font-semibold text-orange-800 mb-2">🔶 PIX Manual</p>
                <code className="text-sm bg-white px-2 py-1 rounded block mb-1">{'{pix}'}</code>
                <code className="text-sm bg-white px-2 py-1 rounded block">{'{pix_titular}'}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}