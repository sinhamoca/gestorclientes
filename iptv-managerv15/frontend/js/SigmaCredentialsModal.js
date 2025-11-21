/* ========================================
   SIGMA CREDENTIALS MODAL
   Modal para gerenciar credenciais Sigma
   ======================================== */

function SigmaCredentialsModal() {
  const { useState, useEffect, createElement: h } = React;
  
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    domain: '',
    username: '',
    password: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

  async function loadCredentials() {
    try {
      setLoading(true);
      const data = await sigmaAPI.listCredentials();
      setCredentials(data);
    } catch (error) {
      alert('Erro ao carregar credenciais: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.domain || !formData.username || !formData.password) {
      alert('Preencha todos os campos');
      return;
    }

    if (!formData.domain.startsWith('http://') && !formData.domain.startsWith('https://')) {
      alert('Domínio deve começar com http:// ou https://');
      return;
    }

    try {
      setLoading(true);
      await sigmaAPI.saveCredential(formData.domain, formData.username, formData.password);
      
      alert('Credencial salva com sucesso!');
      setFormData({ domain: '', username: '', password: '' });
      setShowForm(false);
      await loadCredentials();
    } catch (error) {
      alert('Erro ao salvar credencial: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(domain) {
    if (!confirm(`Deseja realmente deletar as credenciais de ${domain}?`)) {
      return;
    }

    try {
      setLoading(true);
      await sigmaAPI.deleteCredential(domain);
      alert('Credencial deletada com sucesso!');
      await loadCredentials();
    } catch (error) {
      alert('Erro ao deletar credencial: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return h('button', {
      onClick: () => setIsOpen(true),
      className: 'px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2'
    }, '🔑 Credenciais Sigma');
  }

  return h('div', { 
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' 
  },
    h('div', { 
      className: 'bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto' 
    },
      h('div', { className: 'flex items-center justify-between p-6 border-b' },
        h('h2', { className: 'text-2xl font-bold text-gray-800' }, '🔑 Credenciais Sigma'),
        h('button', {
          onClick: () => setIsOpen(false),
          className: 'text-gray-500 hover:text-gray-700 text-2xl'
        }, '×')
      ),

      h('div', { className: 'p-6' },
        !showForm && h('button', {
          onClick: () => setShowForm(true),
          className: 'mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2'
        }, '➕ Adicionar Credencial'),

        showForm && h('form', { 
          onSubmit: handleSubmit, 
          className: 'mb-6 p-4 bg-gray-50 rounded-lg' 
        },
          h('h3', { className: 'font-semibold mb-4' }, 'Nova Credencial'),
          
          h('div', { className: 'space-y-3' },
            h('div', null,
              h('label', { className: 'block text-sm font-medium mb-1' }, 'Domínio'),
              h('input', {
                type: 'text',
                value: formData.domain,
                onChange: (e) => setFormData({...formData, domain: e.target.value}),
                placeholder: 'https://dash.turbox.tv.br',
                className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500',
                disabled: loading
              })
            ),

            h('div', null,
              h('label', { className: 'block text-sm font-medium mb-1' }, 'Usuário'),
              h('input', {
                type: 'text',
                value: formData.username,
                onChange: (e) => setFormData({...formData, username: e.target.value}),
                placeholder: 'seu_usuario',
                className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500',
                disabled: loading
              })
            ),

            h('div', null,
              h('label', { className: 'block text-sm font-medium mb-1' }, 'Senha'),
              h('input', {
                type: 'password',
                value: formData.password,
                onChange: (e) => setFormData({...formData, password: e.target.value}),
                placeholder: 'sua_senha',
                className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500',
                disabled: loading
              })
            )
          ),

          h('div', { className: 'flex gap-2 mt-4' },
            h('button', {
              type: 'submit',
              disabled: loading,
              className: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50'
            }, loading ? 'Salvando...' : 'Salvar'),
            h('button', {
              type: 'button',
              onClick: () => setShowForm(false),
              className: 'px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400',
              disabled: loading
            }, 'Cancelar')
          )
        ),

        loading && credentials.length === 0 ? 
          h('div', { className: 'text-center py-8' },
            h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600' }),
            h('p', { className: 'mt-2 text-gray-600' }, 'Carregando...')
          ) : credentials.length === 0 ? 
          h('div', { className: 'text-center py-8 text-gray-500' }, 'Nenhuma credencial cadastrada') :
          h('div', { className: 'space-y-3' },
            credentials.map((cred) =>
              h('div', { 
                key: cred.id, 
                className: 'flex items-center justify-between p-4 bg-gray-50 rounded-lg' 
              },
                h('div', { className: 'flex-1' },
                  h('div', { className: 'font-semibold text-gray-800' }, cred.domain),
                  h('div', { className: 'text-sm text-gray-600' }, `Usuário: ${cred.username}`),
                  h('div', { className: 'text-xs text-gray-500 mt-1' },
                    `Criado em: ${new Date(cred.created_at).toLocaleString('pt-BR')}`
                  )
                ),
                
                h('button', {
                  onClick: () => handleDelete(cred.domain),
                  disabled: loading,
                  className: 'px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50'
                }, '🗑️ Deletar')
              )
            )
          )
      ),

      h('div', { className: 'p-6 border-t bg-gray-50 flex justify-end' },
        h('button', {
          onClick: () => setIsOpen(false),
          className: 'px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700'
        }, 'Fechar')
      )
    )
  );
}