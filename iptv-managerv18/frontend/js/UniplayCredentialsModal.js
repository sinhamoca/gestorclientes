/* ========================================
   UNIPLAY CREDENTIALS MODAL
   Modal para gerenciar credenciais Uniplay
   
   ARQUIVO: iptv-managerv8/frontend/js/UniplayCredentialsModal.js
   ======================================== */

function UniplayCredentialsModal() {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
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
      const response = await uniplayAPI.getCredentials();
      
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
        await uniplayAPI.updateCredential(formData.username, formData.password);
        setMessage({
          type: 'success',
          text: '✅ Credenciais atualizadas com sucesso!'
        });
      } else {
        await uniplayAPI.saveCredential(formData.username, formData.password);
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

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja remover as credenciais Uniplay?')) {
      return;
    }

    setLoading(true);
    
    try {
      await uniplayAPI.deleteCredential();
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
      className: 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition'
    }, '🔵 Credenciais Uniplay'),

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
        h('div', { className: 'p-6 border-b flex justify-between items-center bg-blue-50' },
          h('div', null,
            h('h3', { className: 'text-xl font-bold text-blue-800' }, '🔵 Credenciais Uniplay'),
            h('p', { className: 'text-sm text-blue-600 mt-1' }, 'GesAPIOffice - gesapioffice.com')
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
          h('div', { className: 'bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6' },
            h('h4', { className: 'font-semibold text-blue-800 mb-2 text-sm' }, '📌 Informações Importantes'),
            h('ul', { className: 'text-xs text-blue-700 space-y-1' },
              h('li', null, '• Domínio fixo: gesapioffice.com'),
              h('li', null, '• Identificação: Por nome do cliente'),
              h('li', null, '• Busca automática em P2P e IPTV'),
              h('li', null, '• Renovação: 1 mês = 1 crédito'),
              h('li', null, '• Proxy: Ativado automaticamente')
            )
          ),

          // Formulário
          h('form', { onSubmit: handleSubmit },
            
            // Username
            h('div', { className: 'mb-4' },
              h('label', { className: 'block text-sm font-medium mb-2' }, 
                'Usuário Uniplay ',
                h('span', { className: 'text-red-500' }, '*')
              ),
              h('input', {
                type: 'text',
                value: formData.username,
                onChange: (e) => setFormData({ ...formData, username: e.target.value }),
                className: 'w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                placeholder: 'Seu usuário do GesAPIOffice',
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
                  className: 'w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                  placeholder: hasCredentials ? 'Nova senha (deixe em branco para manter)' : 'Sua senha do GesAPIOffice',
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
            h('div', { className: 'flex gap-3' },
              h('button', {
                type: 'submit',
                disabled: loading,
                className: `flex-1 py-2 px-4 rounded-lg font-medium transition ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`
              }, loading ? '⏳ Salvando...' : (hasCredentials ? '💾 Atualizar' : '💾 Salvar')),

              hasCredentials && h('button', {
                type: 'button',
                onClick: handleDelete,
                disabled: loading,
                className: 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition disabled:bg-gray-400'
              }, '🗑️ Remover')
            )
          ),

          // Como usar
          h('div', { className: 'mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg' },
            h('h4', { className: 'font-semibold text-gray-800 mb-2 text-sm' }, '🚀 Como usar'),
            h('ol', { className: 'text-xs text-gray-700 space-y-1 list-decimal list-inside' },
              h('li', null, 'Configure as credenciais acima'),
              h('li', null, 'No sistema, crie um plano marcando "Plano Uniplay?"'),
              h('li', null, 'Cadastre clientes com esse plano'),
              h('li', null, 'O nome do cliente deve estar EXATO ao do Uniplay'),
              h('li', null, 'A renovação será automática após pagamento')
            )
          )
        )
      )
    )
  );
}
