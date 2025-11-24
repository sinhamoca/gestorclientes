/* ========================================
   ENCRYPTION SETUP COMPONENT
   Modal para configurar criptografia
   ======================================== */

function EncryptionSetup({ onComplete }) {
  const { useState } = React;
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('check'); // 'check', 'setup', 'validate', 'complete'
  const [encryptionKey, setEncryptionKey] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [hasEncryption, setHasEncryption] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  // Verifica se já tem criptografia configurada
  React.useEffect(() => {
    checkEncryptionStatus();
  }, []);

  const checkEncryptionStatus = async () => {
    try {
      const result = await api.encryption.checkStatus();
      setHasEncryption(result.hasEncryption);
      
      if (result.hasEncryption) {
        // Verifica se tem chave no localStorage
        const savedKey = localStorage.getItem('encryption_key');
        if (savedKey && savedKey.length === 64) {
          // Valida a chave
          try {
            const validation = await api.encryption.validate(savedKey);
            if (validation.valid) {
              // Chave válida, pode prosseguir
              onComplete();
              return;
            }
          } catch (error) {
            console.error('Chave inválida:', error);
          }
        }
        setStep('validate');
      } else {
        setStep('setup');
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      setStep('setup');
    }
  };

  const handleSetup = async () => {
    if (!confirm('Configurar criptografia? Esta ação gerará uma chave única que você deve guardar em local seguro.')) {
      return;
    }

    setLoading(true);
    try {
      const result = await api.encryption.setup();
      setEncryptionKey(result.encryptionKey);
      setStep('complete');
    } catch (error) {
      alert(`Erro ao configurar criptografia: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(encryptionKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 3000);
  };

  const handleSaveKey = () => {
    if (!keyCopied) {
      alert('⚠️ Por favor, copie a chave antes de continuar!');
      return;
    }

    localStorage.setItem('encryption_key', encryptionKey);
    alert('✅ Chave salva! Você pode acessar o sistema agora.');
    onComplete();
  };

  const handleValidateKey = async () => {
    if (inputKey.length !== 64) {
      alert('Chave inválida! Deve ter 64 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const result = await api.encryption.validate(inputKey);
      
      console.log('Resultado da validação:', result); // Debug
      
      if (result && result.valid) {
        localStorage.setItem('encryption_key', inputKey);
        alert('✅ Chave validada com sucesso!');
        onComplete();
      } else {
        alert('❌ Chave incorreta! Tente novamente.');
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      alert(`❌ Erro ao validar chave: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'check') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando configuração de segurança...</p>
        </div>
      </div>
    );
  }

  if (step === 'setup') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-lg w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">🔐 Configurar Criptografia</h2>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-blue-900 mb-2">Por que configurar?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Seus dados serão criptografados de ponta a ponta</li>
              <li>• Apenas você terá acesso aos dados sensíveis</li>
              <li>• Nem o administrador poderá ver seus dados</li>
              <li>• Máxima privacidade e segurança</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-yellow-900 mb-2">⚠️ IMPORTANTE</h3>
            <p className="text-sm text-yellow-800">
              Você receberá uma chave única de 64 caracteres. <strong>GUARDE-A EM LOCAL SEGURO!</strong> Sem ela, você não poderá acessar seus dados.
            </p>
          </div>

          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Configurando...' : 'Configurar Criptografia'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'validate') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-lg w-full">
          <h2 className="text-2xl font-bold mb-4 text-center">🔑 Digite sua Chave de Criptografia</h2>
          
          <p className="text-gray-600 mb-6 text-center">
            Para acessar o sistema, você precisa fornecer sua chave de criptografia de 64 caracteres.
          </p>

          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder="Cole sua chave aqui (64 caracteres)"
            className="w-full border rounded-lg px-4 py-3 mb-4 font-mono text-sm"
            maxLength={64}
          />

          <p className="text-sm text-gray-500 mb-6">
            Caracteres: {inputKey.length}/64
          </p>

          <button
            onClick={handleValidateKey}
            disabled={loading || inputKey.length !== 64}
            className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Validando...' : 'Validar Chave'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'complete') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 max-w-2xl w-full">
          <h2 className="text-2xl font-bold mb-4 text-center text-green-600">✅ Criptografia Configurada!</h2>
          
          <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-red-900 mb-3 text-lg">🚨 GUARDE ESTA CHAVE!</h3>
            <p className="text-red-800 mb-4">
              Esta é a ÚNICA vez que você verá esta chave. Guarde-a em um gerenciador de senhas ou local seguro.
            </p>
            
            <div className="bg-white p-4 rounded border-2 border-red-300 mb-4">
              <code className="text-sm break-all font-mono">{encryptionKey}</code>
            </div>

            <button
              onClick={handleCopyKey}
              className={`w-full py-3 rounded-lg font-semibold ${
                keyCopied 
                  ? 'bg-green-600 text-white' 
                  : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {keyCopied ? '✅ Chave Copiada!' : '📋 Copiar Chave'}
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <h4 className="font-bold text-yellow-900 mb-2">⚠️ Sem esta chave:</h4>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Você não poderá acessar seus dados</li>
              <li>• Nem o administrador pode recuperá-la</li>
              <li>• Você perderá acesso permanente aos dados criptografados</li>
            </ul>
          </div>

          <button
            onClick={handleSaveKey}
            disabled={!keyCopied}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
          >
            Confirmar e Acessar Sistema
          </button>
        </div>
      </div>
    );
  }

  return null;
}