/* ========================================
   MERCADO PAGO MODAL COMPONENT
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
    public_key_masked: null
  });
  
  const [formData, setFormData] = useState({
    access_token: '',
    public_key: ''
  });

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
          payment_domain: data.payment_domain
        });
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
      setTimeout(() => {
        loadSettings();
        setShowForm(false);
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (error) {
      setError(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    try {
      setLoading(true);
      await api.toggleMercadoPago(!enabled);
      setEnabled(!enabled);
      setSuccess(enabled ? 'Mercado Pago desativado' : 'Mercado Pago ativado');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('⚠️ Tem certeza que deseja remover todas as configurações do Mercado Pago?\n\nIsso irá desativar os pagamentos automáticos.')) {
      return;
    }

    try {
      setLoading(true);
      await api.deletePaymentSettings();
      setSuccess('✅ Configurações removidas!');
      setTimeout(() => {
        loadSettings();
      }, 1500);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">💳</span>
            Configuração Mercado Pago
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-200 text-2xl">×</button>
        </div>

        <div className="p-6">
          {/* Alertas */}
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <p className="font-semibold">❌ Erro</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded">
              <p className="font-semibold">✅ Sucesso</p>
              <p className="text-sm">{success}</p>
            </div>
          )}

          {/* Loading */}
          {loading && !configured && (
            <div className="text-center py-12">
              <div className="loader mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando configurações...</p>
            </div>
          )}

          {/* Estado: NÃO CONFIGURADO */}
          {!loading && !configured && showForm && (
            <div>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ Como obter suas credenciais:</strong><br/>
                  1. Acesse: <a href="https://www.mercadopago.com.br/developers/panel" target="_blank" className="underline">Mercado Pago Developers</a><br/>
                  2. Crie ou selecione sua aplicação<br/>
                  3. Copie o <strong>Access Token</strong> e <strong>Public Key</strong><br/>
                  4. Cole abaixo e teste a conexão
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

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>ℹ️ Domínio de Pagamento:</strong> Os links de pagamento sempre usarão<br/>
                    <code className="bg-white px-2 py-1 rounded">https://pagamentos.comprarecarga.shop</code>
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleTestCredentials}
                    disabled={testing || !formData.access_token || !formData.public_key}
                    className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-semibold"
                  >
                    {testing ? '🔄 Testando...' : '🔍 Testar Conexão'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.access_token || !formData.public_key}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    {saving ? '💾 Salvando...' : '💾 Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Estado: CONFIGURADO */}
          {!loading && configured && !showForm && (
            <div className="text-center py-8">
              <div className={`w-24 h-24 ${enabled ? 'bg-green-100' : 'bg-gray-100'} rounded-full mx-auto mb-4 flex items-center justify-center text-4xl`}>
                {enabled ? '✅' : '⚪'}
              </div>
              
              <h4 className={`text-lg font-semibold mb-2 ${enabled ? 'text-green-600' : 'text-gray-600'}`}>
                {enabled ? 'Mercado Pago Conectado!' : 'Mercado Pago Desativado'}
              </h4>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Status:</span>
                    <span className={`font-semibold ${enabled ? 'text-green-600' : 'text-gray-600'}`}>
                      {enabled ? '✅ Ativo' : '⚪ Inativo'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Access Token:</span>
                    <span className="font-mono text-xs">{settings.access_token_masked}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Public Key:</span>
                    <span className="font-mono text-xs">{settings.public_key_masked}</span>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-6">
                {enabled 
                  ? '🎉 Seus clientes podem realizar pagamentos automáticos!' 
                  : 'Ative o Mercado Pago para aceitar pagamentos'}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleToggle}
                  disabled={loading}
                  className={`px-6 py-3 ${enabled ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg disabled:opacity-50 font-semibold`}
                >
                  {enabled ? '⏸️ Desativar Mercado Pago' : '▶️ Ativar Mercado Pago'}
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                  >
                    ✏️ Editar Credenciais
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
                  >
                    🗑️ Remover
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Estado: EDITANDO */}
          {!loading && configured && showForm && (
            <div>
              <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6 rounded">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Atenção:</strong> Você está editando suas credenciais. As alterações serão aplicadas imediatamente após salvar.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Novo Access Token <span className="text-red-500">*</span>
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
                    Nova Public Key <span className="text-red-500">*</span>
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
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setFormData({ access_token: '', public_key: '' });
                    }}
                    className="flex-1 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold"
                  >
                    ← Cancelar
                  </button>
                  <button
                    onClick={handleTestCredentials}
                    disabled={testing || !formData.access_token || !formData.public_key}
                    className="flex-1 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-semibold"
                  >
                    {testing ? '🔄 Testando...' : '🔍 Testar'}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !formData.access_token || !formData.public_key}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold"
                  >
                    {saving ? '💾 Salvando...' : '💾 Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Informações de Segurança */}
          <div className="mt-6 pt-6 border-t">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-xs text-blue-800">
                <strong>🔒 Segurança:</strong> Suas credenciais são criptografadas antes de serem salvas no banco de dados usando AES-256.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}