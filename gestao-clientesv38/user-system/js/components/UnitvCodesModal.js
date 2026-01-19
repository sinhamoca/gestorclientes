/* ========================================
   UNITV CODES MODAL COMPONENT
   Gerenciamento de códigos UniTV de 16 dígitos
   SEM JSX - Usando React.createElement
   ======================================== */

function UnitvCodesModal({ onClose, onRefresh }) {
  const { useState, useEffect, createElement: h } = React;
  
  // 🔔 Toast Hook
  const toast = useToast();
  
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState({ total: 0, available: 0, delivered: 0 });
  const [loading, setLoading] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [showBulkForm, setShowBulkForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadCodes();
  }, [statusFilter, page]);

  const loadCodes = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      
      const data = await api.getUnitvCodes(params);
      setCodes(data.codes);
      setStats(data.stats);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error('Erro ao carregar códigos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async (e) => {
    e.preventDefault();
    
    if (!bulkText.trim()) {
      toast.warning('Digite pelo menos um código');
      return;
    }
    
    setLoading(true);
    
    try {
      const lines = bulkText.split('\n');
      const result = await api.addUnitvCodesBulk(lines);
      
      let message = `${result.inserted} códigos adicionados!`;
      
      if (result.duplicates > 0) {
        message += ` (${result.duplicates} duplicados ignorados)`;
      }
      
      if (result.errors > 0) {
        toast.warning(message + ` ${result.errors} erros.`);
        console.log('Erros:', result.errorDetails);
      } else {
        toast.success(message);
      }
      
      setBulkText('');
      setShowBulkForm(false);
      loadCodes();
      
    } catch (error) {
      toast.error('Erro ao adicionar códigos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    if (!confirm(`Marcar código como ${newStatus === 'available' ? 'DISPONÍVEL' : 'ENTREGUE'}?`)) {
      return;
    }
    
    try {
      await api.updateUnitvCodeStatus(id, newStatus);
      toast.success('Status atualizado!');
      loadCodes();
    } catch (error) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('⚠️  ATENÇÃO: Tem certeza que deseja DELETAR este código?\n\nEsta ação é IRREVERSÍVEL!')) {
      return;
    }
    
    try {
      await api.deleteUnitvCode(id);
      toast.success('Código deletado!');
      loadCodes();
    } catch (error) {
      toast.error('Erro ao deletar código: ' + error.message);
    }
  };

  const formatCode = (code) => {
    return code.match(/.{1,4}/g).join('-');
  };

  // Componente principal
  return h('div', {
    className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
  },
    h('div', {
      className: 'bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto'
    },
      // Header
      h('div', {
        className: 'p-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-600 to-purple-700'
      },
        h('div', null,
          h('h3', { className: 'text-xl font-bold text-white' }, '🎫 Códigos UniTV'),
          h('p', { className: 'text-purple-100 text-sm mt-1' }, 'Gerenciar códigos de ativação')
        ),
        h('button', {
          onClick: onClose,
          className: 'text-white hover:text-gray-200 text-2xl'
        }, '×')
      ),

      // Stats
      h('div', { className: 'p-6 bg-gray-50 border-b' },
        h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
          h('div', { className: 'bg-white p-4 rounded-lg border-l-4 border-blue-500' },
            h('div', { className: 'text-sm text-gray-600' }, 'Total de Códigos'),
            h('div', { className: 'text-2xl font-bold text-gray-800' }, stats.total)
          ),
          h('div', { className: 'bg-white p-4 rounded-lg border-l-4 border-green-500' },
            h('div', { className: 'text-sm text-gray-600' }, 'Disponíveis'),
            h('div', { className: 'text-2xl font-bold text-green-600' }, stats.available)
          ),
          h('div', { className: 'bg-white p-4 rounded-lg border-l-4 border-orange-500' },
            h('div', { className: 'text-sm text-gray-600' }, 'Entregues'),
            h('div', { className: 'text-2xl font-bold text-orange-600' }, stats.delivered)
          )
        )
      ),

      // Actions Bar
      h('div', {
        className: 'p-4 bg-white border-b flex flex-wrap gap-3 items-center justify-between'
      },
        h('div', { className: 'flex gap-3 items-center' },
          h('button', {
            onClick: () => setShowBulkForm(!showBulkForm),
            className: 'px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium'
          }, showBulkForm ? '❌ Cancelar' : '➕ Adicionar Códigos'),
          
          h('select', {
            value: statusFilter,
            onChange: (e) => { setStatusFilter(e.target.value); setPage(1); },
            className: 'px-4 py-2 border rounded-lg'
          },
            h('option', { value: '' }, 'Todos os Status'),
            h('option', { value: 'available' }, '✅ Disponíveis'),
            h('option', { value: 'delivered' }, '📦 Entregues')
          )
        ),
        
        h('button', {
          onClick: loadCodes,
          disabled: loading,
          className: 'px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700'
        }, '🔄 Atualizar')
      ),

      // Bulk Add Form
      showBulkForm && h('div', { className: 'p-6 bg-blue-50 border-b' },
        h('form', { onSubmit: handleBulkAdd },
          h('div', { className: 'mb-4' },
            h('label', { className: 'block text-sm font-medium mb-2' },
              '📝 Cole os códigos (um por linha)'
            ),
            h('textarea', {
              value: bulkText,
              onChange: (e) => setBulkText(e.target.value),
              className: 'w-full px-4 py-3 border rounded-lg font-mono text-sm',
              rows: 8,
              placeholder: '0000000000000000\n1111111111111111\n2222222222222222\n\nPode colar com ou sem hífens:\n0000-0000-0000-0000\n1111-1111-1111-1111',
              required: true
            }),
            h('p', { className: 'text-xs text-gray-600 mt-2' },
              '💡 Dica: Cole um código por linha. O sistema aceita com ou sem hífens e remove automaticamente espaços e caracteres especiais.'
            )
          ),
          
          h('div', { className: 'flex gap-3' },
            h('button', {
              type: 'submit',
              disabled: loading,
              className: 'px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium'
            }, loading ? 'Adicionando...' : '✅ Adicionar Códigos'),
            h('button', {
              type: 'button',
              onClick: () => { setBulkText(''); setShowBulkForm(false); },
              className: 'px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400'
            }, 'Cancelar')
          )
        )
      ),

      // Codes List
      h('div', { className: 'p-6' },
        loading && codes.length === 0 ? 
          h('div', { className: 'text-center py-8' },
            h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600' }),
            h('p', { className: 'mt-2 text-gray-600' }, 'Carregando códigos...')
          )
        : codes.length === 0 ?
          h('div', { className: 'text-center py-12' },
            h('div', { className: 'text-6xl mb-4' }, '📦'),
            h('p', { className: 'text-gray-600 text-lg' }, 'Nenhum código cadastrado'),
            h('p', { className: 'text-gray-500 text-sm mt-2' }, 'Clique em "Adicionar Códigos" para começar')
          )
        :
          h('div', { className: 'overflow-x-auto' },
            h('table', { className: 'w-full' },
              h('thead', { className: 'bg-gray-100' },
                h('tr', null,
                  h('th', { className: 'px-4 py-3 text-left text-sm font-semibold' }, 'Código'),
                  h('th', { className: 'px-4 py-3 text-left text-sm font-semibold' }, 'Status'),
                  h('th', { className: 'px-4 py-3 text-left text-sm font-semibold' }, 'Cliente'),
                  h('th', { className: 'px-4 py-3 text-left text-sm font-semibold' }, 'Entregue Em'),
                  h('th', { className: 'px-4 py-3 text-center text-sm font-semibold' }, 'Ações')
                )
              ),
              h('tbody', null,
                codes.map(code =>
                  h('tr', { key: code.id, className: 'border-b hover:bg-gray-50' },
                    h('td', { className: 'px-4 py-3' },
                      h('span', { className: 'font-mono text-sm bg-gray-100 px-2 py-1 rounded' },
                        formatCode(code.code)
                      )
                    ),
                    h('td', { className: 'px-4 py-3' },
                      code.status === 'available' ?
                        h('span', { className: 'px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium' },
                          '✅ Disponível'
                        )
                      :
                        h('span', { className: 'px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium' },
                          '📦 Entregue'
                        )
                    ),
                    h('td', { className: 'px-4 py-3 text-sm' },
                      code.delivered_to_client_name || '-'
                    ),
                    h('td', { className: 'px-4 py-3 text-sm text-gray-600' },
                      code.delivered_at 
                        ? new Date(code.delivered_at).toLocaleString('pt-BR')
                        : '-'
                    ),
                    h('td', { className: 'px-4 py-3' },
                      h('div', { className: 'flex gap-2 justify-center' },
                        code.status === 'delivered' ?
                          h('button', {
                            onClick: () => handleUpdateStatus(code.id, 'available'),
                            className: 'px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs',
                            title: 'Marcar como disponível'
                          }, '♻️ Disponível')
                        :
                          h('button', {
                            onClick: () => handleUpdateStatus(code.id, 'delivered'),
                            className: 'px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-xs',
                            title: 'Marcar como entregue'
                          }, '📦 Entregue'),
                        h('button', {
                          onClick: () => handleDelete(code.id),
                          className: 'px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs',
                          title: 'Deletar código'
                        }, '🗑️')
                      )
                    )
                  )
                )
              )
            )
          ),

        // Pagination
        totalPages > 1 && h('div', { className: 'flex justify-center gap-2 mt-6' },
          h('button', {
            onClick: () => setPage(p => Math.max(1, p - 1)),
            disabled: page === 1,
            className: 'px-4 py-2 bg-gray-200 rounded disabled:opacity-50'
          }, '← Anterior'),
          h('span', { className: 'px-4 py-2' },
            `Página ${page} de ${totalPages}`
          ),
          h('button', {
            onClick: () => setPage(p => Math.min(totalPages, p + 1)),
            disabled: page === totalPages,
            className: 'px-4 py-2 bg-gray-200 rounded disabled:opacity-50'
          }, 'Próxima →')
        )
      ),

      // Footer
      h('div', { className: 'p-4 bg-gray-50 border-t' },
        h('button', {
          onClick: onClose,
          className: 'w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700'
        }, 'Fechar')
      )
    )
  );
}

// Exportar para escopo global
window.UnitvCodesModal = UnitvCodesModal;