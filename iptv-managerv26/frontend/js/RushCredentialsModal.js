/* ========================================
   RUSH CREDENTIALS MODAL
   Modal para gerenciar credenciais Rush
   
   ARQUIVO: frontend/js/RushCredentialsModal.js
   ======================================== */

function RushCredentialsModal() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Carregar credenciais ao abrir modal
  useEffect(() => {
    if (showModal) {
      loadCredentials();
    }
  }, [showModal]);

  async function loadCredentials() {
    try {
      setLoading(true);
      const response = await rushAPI.getCredentials();
      
      if (response.has_credentials) {
        setFormData({
          username: response.username,
          password: ''
        });
        setHasCredentials(true);
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      setMessage({
        type: 'error',
        text: 'Preencha usuário e senha'
      });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (hasCredentials) {
        await rushAPI.updateCredential(formData.username, formData.password);
        setMessage({
          type: 'success',
          text: '✅ Credenciais atualizadas com sucesso!'
        });
      } else {
        await rushAPI.saveCredential(formData.username, formData.password);
        setMessage({
          type: 'success',
          text: '✅ Credenciais salvas com sucesso!'
        });
        setHasCredentials(true);
      }
      
      // Limpar senha após salvar
      setFormData({ ...formData, password: '' });
      
    } catch (error) {
      setMessage({
        type: 'error',
        text: '❌ Erro ao salvar: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setMessage({ type: '', text: '' });

    try {
      const result = await rushAPI.testConnection();
      setMessage({
        type: 'success',
        text: `✅ Conexão OK! Usuário: ${result.user_data?.name || formData.username}`
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: '❌ Falha na conexão: ' + error.message
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja remover as credenciais Rush?')) {
      return;
    }

    setLoading(true);
    
    try {
      await rushAPI.deleteCredential();
      setFormData({ username: '', password: '' });
      setHasCredentials(false);
      setMessage({
        type: 'success',
        text: '✅ Credenciais removidas!'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: '❌ Erro ao remover: ' + error.message
      });
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setShowModal(false);
    setMessage({ type: '', text: '' });
    setShowPassword(false);
  }

  return h('div', null,
    // Botão para abrir modal
    h('button', {
      onClick: () => setShowModal(true),
      className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition'
    }, '🟠 Credenciais Rush'),

    // Modal
    showModal && h('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50',
      onClick: (e) => {
        if (e.target === e.currentTarget) handleClose();
      }
    },
      h('div', {
        className: 'bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
        onClick: (e) => e.stopPropagation()
      },
        // Header
        h('div', { className: 'p-6 border-b flex justify-between items-center bg-orange-50' },
          h('div', null,
            h('h3', { className: 'text-xl font-bold text-orange-800' }, '🟠 Credenciais Rush'),
            h('p', { className: 'text-sm text-orange-600 mt-1' }, 'RushPlay - paineloffice.click')
          ),
          h('button', {
            onClick: handleClose,
            className: 'text-gray-500 hover:text-gray-700 text-2xl leading-none',
            disabled: loading
          }, '×')
        ),

        // Body
        h('div', { className: 'p-6' },
          
          // Info Box
          h('div', { className: 'bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6' },
            h('h4', { className: 'font-semibold text-orange-800 mb-2 text-sm' }, '📌 Informações Importantes'),
            h('ul', { className: 'text-xs text-orange-700 space-y-1' },
              h('li', null, '• Domínio: api-new.paineloffice.click'),
              h('li', null, '• Suporta: IPTV e P2P'),
              h('li', null, '• Identificação: Por nome do cliente'),
              h('li', null, '• Renovação: Multi-mês em 1 requisição'),
              h('li', null, '• Sem captcha, sem proxy')
            )
          ),

          // Formulário
          h('form', { onSubmit: handleSubmit },
            
            // Username
            h('div', { className: 'mb-4' },
              h('label', { className: 'block text-sm font-medium mb-2' }, 
                'Usuário Rush ',
                h('span', { className: 'text-red-500' }, '*')
              ),
              h('input', {
                type: 'text',
                value: formData.username,
                onChange: (e) => setFormData({ ...formData, username: e.target.value }),
                className: 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
                placeholder: 'Seu usuário do RushPlay',
                required: true,
                disabled: loading
              })
            ),

            // Password
            h('div', { className: 'mb-4' },
              h('label', { className: 'block text-sm font-medium mb-2' }, 
                'Senha ',
                h('span', { className: 'text-red-500' }, '*')
              ),
              h('div', { className: 'relative' },
                h('input', {
                  type: showPassword ? 'text' : 'password',
                  value: formData.password,
                  onChange: (e) => setFormData({ ...formData, password: e.target.value }),
                  className: 'w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500',
                  placeholder: hasCredentials ? 'Nova senha (deixe em branco para manter)' : 'Sua senha do RushPlay',
                  required: !hasCredentials,
                  disabled: loading
                }),
                h('button', {
                  type: 'button',
                  onClick: () => setShowPassword(!showPassword),
                  className: 'absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700',
                  disabled: loading
                }, showPassword ? '👁️' : '👁️‍🗨️')
              ),
              hasCredentials && h('p', { className: 'text-xs text-gray-500 mt-1' }, 
                '💡 Deixe em branco para manter a senha atual'
              )
            ),

            // Status
            hasCredentials && h('div', { className: 'mb-4 p-3 bg-green-50 border border-green-200 rounded-lg' },
              h('div', { className: 'flex items-center gap-2' },
                h('div', { className: 'w-2 h-2 bg-green-500 rounded-full' }),
                h('span', { className: 'text-sm text-green-700' }, 
                  `✅ Credenciais configuradas para: ${formData.username}`
                )
              )
            ),

            // Mensagem
            message.text && h('div', {
              className: `mb-4 p-3 rounded-lg ${
                message.type === 'success' 
                  ? 'bg-green-50 border border-green-200 text-green-700' 
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`
            }, message.text),

            // Botões
            h('div', { className: 'flex gap-3 flex-wrap' },
              // Salvar
              h('button', {
                type: 'submit',
                disabled: loading || testing,
                className: `flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  loading || testing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`
              }, loading ? '⏳ Salvando...' : (hasCredentials ? '💾 Atualizar' : '💾 Salvar')),

              // Testar Conexão
              hasCredentials && h('button', {
                type: 'button',
                onClick: handleTestConnection,
                disabled: loading || testing,
                className: `px-4 py-2 rounded-lg font-medium transition ${
                  loading || testing
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`
              }, testing ? '⏳ Testando...' : '🔌 Testar'),

              // Remover
              hasCredentials && h('button', {
                type: 'button',
                onClick: handleDelete,
                disabled: loading || testing,
                className: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:bg-gray-400'
              }, '🗑️ Remover')
            )
          ),

          // Como usar
          h('div', { className: 'mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg' },
            h('h4', { className: 'font-semibold text-gray-800 mb-2 text-sm' }, '🚀 Como usar'),
            h('ol', { className: 'text-xs text-gray-700 space-y-1 list-decimal list-inside' },
              h('li', null, 'Configure as credenciais acima'),
              h('li', null, 'No sistema principal, crie um plano marcando "Plano Rush?"'),
              h('li', null, 'Escolha o tipo: IPTV ou P2P'),
              h('li', null, 'Cadastre clientes com esse plano'),
              h('li', null, 'O nome do cliente deve estar EXATO ao do painel Rush'),
              h('li', null, 'A renovação será automática após pagamento')
            )
          ),

          // Dica sobre múltiplas telas
          h('div', { className: 'mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg' },
            h('h4', { className: 'font-semibold text-yellow-800 mb-2 text-sm' }, '💡 Múltiplas Telas'),
            h('p', { className: 'text-xs text-yellow-700' }, 
              'Para renovar múltiplas telas, use o campo "Username" do cliente com os sufixos separados por vírgula. '
            ),
            h('p', { className: 'text-xs text-yellow-700 mt-2' }, 
              'Exemplo: Se o nome é "João Silva" e o username é "tela 1, tela 2", o sistema vai buscar e renovar "João Silva tela 1" e "João Silva tela 2".'
            )
          )
        )
      )
    )
  );
}
