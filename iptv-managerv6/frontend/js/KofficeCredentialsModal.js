/* ========================================
   KOFFICE CREDENTIALS MODAL
   Modal para gerenciar credenciais Koffice
   
   INSTRUÇÕES:
   Adicionar este arquivo em: iptv-managerv5/frontend/js/KofficeCredentialsModal.js
   ======================================== */

function KofficeCredentialsModal() {
  const { useState, useEffect, createElement: h } = React;
  
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    domain: '',
    username: '',
    password: '',
    reseller_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

  async function loadCredentials() {
    try {
      setLoading(true);
      const data = await kofficeAPI.listCredentials();
      setCredentials(data);
    } catch (error) {
      alert('Erro ao carregar credenciais: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!formData.domain || !formData.username || !formData.password || !formData.reseller_id) {
      alert('Preencha todos os campos');
      return;
    }

    if (!formData.domain.startsWith('http://') && !formData.domain.startsWith('https://')) {
      alert('Domínio deve começar com http:// ou https://');
      return;
    }

    try {
      setLoading(true);
      
      if (editingId) {
        // Atualizar
        await kofficeAPI.updateCredential(
          editingId,
          formData.username,
          formData.password,
          formData.reseller_id
        );
        alert('Credencial atualizada com sucesso!');
      } else {
        // Criar
        await kofficeAPI.saveCredential(
          formData.domain,
          formData.username,
          formData.password,
          formData.reseller_id
        );
        alert('Credencial salva com sucesso!');
      }
      
      setFormData({ domain: '', username: '', password: '', reseller_id: '' });
      setShowForm(false);
      setEditingId(null);
      await loadCredentials();
    } catch (error) {
      alert('Erro ao salvar credencial: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleEdit(credential) {
    setFormData({
      domain: credential.domain,
      username: credential.username,
      password: '',
      reseller_id: credential.reseller_id
    });
    setEditingId(credential.id);
    setShowForm(true);
  }

  async function handleDelete(id, domain) {
    if (!confirm(`Deseja realmente deletar as credenciais de ${domain}?`)) {
      return;
    }

    try {
      setLoading(true);
      await kofficeAPI.deleteCredential(id);
      alert('Credencial deletada com sucesso!');
      await loadCredentials();
    } catch (error) {
      alert('Erro ao deletar credencial: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setShowForm(false);
    setEditingId(null);
    setFormData({ domain: '', username: '', password: '', reseller_id: '' });
  }

  return h('div', null,
    // Botão para abrir modal
    h('button', {
      onClick: () => setIsOpen(true),
      className: 'px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg flex items-center gap-2 transition'
    }, '🔑 Credenciais Koffice'),

    // Modal
    isOpen && h('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
      onClick: () => !loading && setIsOpen(false)
    },
      h('div', {
        className: 'bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] overflow-y-auto',
        onClick: (e) => e.stopPropagation()
      },
        // Header
        h('div', { className: 'p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10' },
          h('h2', { className: 'text-xl font-bold text-gray-800' }, '🔑 Credenciais Koffice'),
          h('button', {
            onClick: () => !loading && setIsOpen(false),
            className: 'text-gray-400 hover:text-gray-600 text-2xl',
            disabled: loading
          }, '×')
        ),

        // Body
        h('div', { className: 'p-6' },
          // Botão adicionar
          !showForm && h('button', {
            onClick: () => setShowForm(true),
            disabled: loading,
            className: 'mb-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50'
          }, '➕ Adicionar Credencial'),

          // Formulário
          showForm && h('form', {
            onSubmit: handleSubmit,
            className: 'mb-6 p-4 border rounded-lg bg-gray-50'
          },
            h('h3', { className: 'font-bold mb-3 text-lg' }, 
              editingId ? '✏️ Editar Credencial' : '➕ Nova Credencial'
            ),

            h('div', { className: 'grid grid-cols-1 gap-3' },
              // Domínio
              h('div', null,
                h('label', { className: 'block text-sm font-medium mb-1' }, 
                  'Domínio', 
                  editingId && h('span', { className: 'text-gray-500 ml-2' }, '(não editável)')
                ),
                h('input', {
                  type: 'text',
                  value: formData.domain,
                  onChange: (e) => setFormData({...formData, domain: e.target.value}),
                  placeholder: 'https://daily3.news',
                  className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500',
                  disabled: loading || editingId,
                  required: true
                })
              ),

              // Username
              h('div', null,
                h('label', { className: 'block text-sm font-medium mb-1' }, 'Usuário'),
                h('input', {
                  type: 'text',
                  value: formData.username,
                  onChange: (e) => setFormData({...formData, username: e.target.value}),
                  placeholder: 'admin',
                  className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500',
                  disabled: loading,
                  required: true
                })
              ),

              // Password
              h('div', null,
                h('label', { className: 'block text-sm font-medium mb-1' }, 
                  'Senha',
                  editingId && h('span', { className: 'text-gray-500 ml-2' }, '(deixe vazio para manter)')
                ),
                h('input', {
                  type: 'password',
                  value: formData.password,
                  onChange: (e) => setFormData({...formData, password: e.target.value}),
                  placeholder: editingId ? '(opcional)' : 'senha123',
                  className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500',
                  disabled: loading,
                  required: !editingId
                })
              ),

              // Reseller ID
              h('div', null,
                h('label', { className: 'block text-sm font-medium mb-1' }, 'Reseller ID'),
                h('input', {
                  type: 'text',
                  value: formData.reseller_id,
                  onChange: (e) => setFormData({...formData, reseller_id: e.target.value}),
                  placeholder: '8186',
                  className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500',
                  disabled: loading,
                  required: true
                })
              )
            ),

            h('div', { className: 'flex gap-2 mt-4' },
              h('button', {
                type: 'submit',
                disabled: loading,
                className: 'px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50'
              }, loading ? 'Salvando...' : (editingId ? 'Atualizar' : 'Salvar')),
              h('button', {
                type: 'button',
                onClick: handleCancel,
                className: 'px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400',
                disabled: loading
              }, 'Cancelar')
            )
          ),

          // Lista de credenciais
          loading && credentials.length === 0 ? 
            h('div', { className: 'text-center py-8' },
              h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600' }),
              h('p', { className: 'mt-2 text-gray-600' }, 'Carregando...')
            ) : credentials.length === 0 ?
            h('div', { className: 'text-center py-12 bg-gray-50 rounded-lg' },
              h('p', { className: 'text-3xl mb-2' }, '📭'),
              h('p', { className: 'text-gray-600' }, 'Nenhuma credencial cadastrada'),
              h('p', { className: 'text-sm text-gray-500 mt-1' }, 'Adicione suas primeiras credenciais Koffice')
            ) :
            h('div', { className: 'space-y-3' },
              credentials.map(cred => 
                h('div', {
                  key: cred.id,
                  className: 'p-4 border rounded-lg hover:shadow-md transition bg-white'
                },
                  h('div', { className: 'flex justify-between items-start' },
                    h('div', { className: 'flex-1' },
                      h('div', { className: 'flex items-center gap-2 mb-2' },
                        h('span', { className: 'text-lg' }, '🌐'),
                        h('span', { className: 'font-semibold text-gray-800' }, cred.domain)
                      ),
                      h('div', { className: 'grid grid-cols-2 gap-2 text-sm' },
                        h('div', null,
                          h('span', { className: 'text-gray-600' }, '👤 Usuário: '),
                          h('span', { className: 'font-medium' }, cred.username)
                        ),
                        h('div', null,
                          h('span', { className: 'text-gray-600' }, '🆔 Reseller: '),
                          h('span', { className: 'font-medium' }, cred.reseller_id)
                        )
                      ),
                      h('div', { className: 'text-xs text-gray-500 mt-2' },
                        'Cadastrado em: ', new Date(cred.created_at).toLocaleDateString('pt-BR')
                      )
                    ),
                    h('div', { className: 'flex gap-2' },
                      h('button', {
                        onClick: () => handleEdit(cred),
                        disabled: loading,
                        className: 'px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm'
                      }, '✏️ Editar'),
                      h('button', {
                        onClick: () => handleDelete(cred.id, cred.domain),
                        disabled: loading,
                        className: 'px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-sm'
                      }, '🗑️ Deletar')
                    )
                  )
                )
              )
            )
        ),

        // Footer
        h('div', { className: 'p-4 border-t bg-gray-50' },
          h('p', { className: 'text-sm text-gray-600 text-center' },
            '💡 Dica: Um domínio pode ter apenas uma credencial cadastrada'
          )
        )
      )
    )
  );
}
