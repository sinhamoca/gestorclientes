/* ========================================
   SIGMA SYNC MODAL - VERSÃO ATUALIZADA
   Modal com detecção de conflitos e escolha do usuário
   ======================================== */

function SigmaSyncModal() {
  const { useState, useEffect, createElement: h } = React;
  
  const [isOpen, setIsOpen] = useState(false);
  const [credentials, setCredentials] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [packages, setPackages] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  
  // Novos estados para resolução de conflitos
  const [conflicts, setConflicts] = useState([]);
  const [newPackages, setNewPackages] = useState([]);
  const [existingPlans, setExistingPlans] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    if (isOpen) {
      loadCredentials();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedDomain) {
      loadPackages();
    }
  }, [selectedDomain]);

  async function loadCredentials() {
    try {
      const data = await sigmaAPI.listCredentials();
      setCredentials(data);
      
      if (data.length > 0) {
        setSelectedDomain(data[0].domain);
      }
    } catch (error) {
      alert('Erro ao carregar credenciais: ' + error.message);
    }
  }

  async function loadPackages() {
    if (!selectedDomain) return;

    try {
      setLoading(true);
      const data = await sigmaAPI.listPackages(selectedDomain);
      setPackages(data.packages || []);
      setSelectedPackages([]);
    } catch (error) {
      alert('Erro ao carregar pacotes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  function togglePackage(packageId) {
    setSelectedPackages(prev => {
      if (prev.includes(packageId)) {
        return prev.filter(id => id !== packageId);
      } else {
        return [...prev, packageId];
      }
    });
  }

  function toggleAll() {
    if (selectedPackages.length === packages.length) {
      setSelectedPackages([]);
    } else {
      setSelectedPackages(packages.map(p => p.id));
    }
  }

  // NOVA FUNÇÃO: Verificar conflitos antes de sincronizar
  async function handleSyncCheck() {
    if (selectedPackages.length === 0) {
      alert('Selecione pelo menos um pacote');
      return;
    }

    try {
      setSyncing(true);
      
      // Chamar a API para verificar conflitos
      const result = await sigmaAPI.checkSyncConflicts(selectedDomain, selectedPackages);
      
      setConflicts(result.conflicts || []);
      setNewPackages(result.new_packages || []);
      setExistingPlans(result.existing_plans || []);
      
      // Inicializar resoluções
      const initialResolutions = {};
      
      // Pacotes novos: ação padrão é criar
      result.new_packages.forEach(pkg => {
        initialResolutions[pkg.id] = { action: 'create' };
      });
      
      // Conflitos: deixar sem decisão para forçar escolha do usuário
      result.conflicts.forEach(conflict => {
        initialResolutions[conflict.package.id] = { 
          action: '', 
          plan_id: null 
        };
      });
      
      setResolutions(initialResolutions);
      
      // Se não houver conflitos, sincronizar direto
      if (result.conflicts.length === 0) {
        await executeSyncWithResolutions(initialResolutions);
      } else {
        // Mostrar modal de resolução de conflitos
        setShowConflictModal(true);
      }
      
    } catch (error) {
      alert('Erro ao verificar conflitos: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }

  // NOVA FUNÇÃO: Executar sincronização com as resoluções definidas
  async function executeSyncWithResolutions(finalResolutions) {
    try {
      setSyncing(true);
      setShowConflictModal(false);
      
      const result = await sigmaAPI.syncPackagesWithResolutions(
        selectedDomain, 
        selectedPackages,
        finalResolutions
      );
      
      const { created, updated, errors } = result.results;
      
      let message = `✅ Sincronização concluída!\n\n`;
      message += `➕ Criados: ${created}\n`;
      message += `🔄 Substituídos: ${updated}\n`;
      
      if (errors.length > 0) {
        message += `\n⚠️ Erros: ${errors.length}`;
      }
      
      alert(message);
      setSelectedPackages([]);
      setConflicts([]);
      setNewPackages([]);
      setResolutions({});
      
    } catch (error) {
      alert('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }

  // NOVA FUNÇÃO: Confirmar resoluções e sincronizar
  function handleConfirmResolutions() {
    // Validar se todos os conflitos foram resolvidos
    const unresolvedConflicts = conflicts.filter(conflict => {
      const resolution = resolutions[conflict.package.id];
      return !resolution || 
             !resolution.action || 
             (resolution.action === 'replace' && !resolution.plan_id);
    });
    
    if (unresolvedConflicts.length > 0) {
      alert(`Por favor, resolva todos os conflitos antes de continuar.\n${unresolvedConflicts.length} conflito(s) pendente(s).`);
      return;
    }
    
    executeSyncWithResolutions(resolutions);
  }

  // NOVA FUNÇÃO: Atualizar resolução de um pacote
  function updateResolution(packageId, action, planId = null) {
    setResolutions(prev => ({
      ...prev,
      [packageId]: { action, plan_id: planId }
    }));
  }

  // Renderizar modal de conflitos
  function renderConflictModal() {
    if (!showConflictModal) return null;
    
    return h('div', { 
      className: 'fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50' 
    },
      h('div', { 
        className: 'bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto' 
      },
        h('div', { className: 'p-6 border-b bg-yellow-50' },
          h('h2', { className: 'text-2xl font-bold text-gray-800 flex items-center gap-2' }, 
            '⚠️ Conflitos Detectados'
          ),
          h('p', { className: 'text-sm text-gray-600 mt-2' }, 
            `Encontramos ${conflicts.length} pacote(s) que já existem. Por favor, escolha como deseja proceder:`
          )
        ),
        
        h('div', { className: 'p-6 space-y-6' },
          // Lista de conflitos
          conflicts.length > 0 && h('div', { className: 'space-y-4' },
            h('h3', { className: 'font-bold text-lg text-red-600' }, '🔴 Pacotes Conflitantes'),
            conflicts.map(conflict => 
              h('div', { 
                key: conflict.package.id,
                className: 'p-4 border-2 border-red-200 rounded-lg bg-red-50'
              },
                h('div', { className: 'mb-3' },
                  h('p', { className: 'font-semibold text-lg' }, `📦 ${conflict.package.nome}`),
                  h('p', { className: 'text-sm text-gray-600' }, 
                    `Código: ${conflict.package.id} | ${conflict.package.duracao} mês(es) | ${conflict.package.conexoes} tela(s)`
                  ),
                  h('p', { className: 'text-sm text-red-600 mt-1 font-medium' }, 
                    `⚠️ Conflito com plano existente: "${conflict.existing_plan.name}"`
                  )
                ),
                
                h('div', { className: 'space-y-3' },
                  h('p', { className: 'font-medium text-sm' }, 'Escolha uma ação:'),
                  
                  // Opção 1: Criar novo
                  h('label', { className: 'flex items-start gap-3 p-3 border rounded cursor-pointer hover:bg-blue-50' },
                    h('input', {
                      type: 'radio',
                      name: `resolution-${conflict.package.id}`,
                      checked: resolutions[conflict.package.id]?.action === 'create',
                      onChange: () => updateResolution(conflict.package.id, 'create'),
                      className: 'mt-1'
                    }),
                    h('div', null,
                      h('p', { className: 'font-medium text-blue-700' }, '➕ Adicionar como novo plano'),
                      h('p', { className: 'text-xs text-gray-600' }, 
                        'Criar um novo plano sem substituir nenhum existente'
                      )
                    )
                  ),
                  
                  // Opção 2: Substituir plano existente
                  h('div', { className: 'border rounded p-3 space-y-2' },
                    h('label', { className: 'flex items-start gap-3 cursor-pointer' },
                      h('input', {
                        type: 'radio',
                        name: `resolution-${conflict.package.id}`,
                        checked: resolutions[conflict.package.id]?.action === 'replace',
                        onChange: () => updateResolution(conflict.package.id, 'replace'),
                        className: 'mt-1'
                      }),
                      h('div', { className: 'flex-1' },
                        h('p', { className: 'font-medium text-orange-700' }, '🔄 Substituir plano existente'),
                        h('p', { className: 'text-xs text-gray-600' }, 
                          'Escolha qual plano será substituído:'
                        )
                      )
                    ),
                    
                    // Dropdown de planos (só aparece se "substituir" estiver selecionado)
                    resolutions[conflict.package.id]?.action === 'replace' && h('select', {
                      value: resolutions[conflict.package.id]?.plan_id || '',
                      onChange: (e) => updateResolution(conflict.package.id, 'replace', parseInt(e.target.value)),
                      className: 'w-full px-3 py-2 border rounded-lg ml-7 focus:ring-2 focus:ring-orange-500'
                    },
                      h('option', { value: '' }, 'Selecione um plano...'),
                      existingPlans.map(plan => 
                        h('option', { key: plan.id, value: plan.id },
                          `${plan.name} (${plan.duration_months} mês, ${plan.num_screens} telas)${plan.is_sigma_plan ? ' - SIGMA' : ''}`
                        )
                      )
                    )
                  )
                )
              )
            )
          ),
          
          // Lista de pacotes novos
          newPackages.length > 0 && h('div', { className: 'space-y-2' },
            h('h3', { className: 'font-bold text-lg text-green-600' }, '✅ Pacotes Novos'),
            h('p', { className: 'text-sm text-gray-600 mb-3' }, 
              'Estes pacotes serão adicionados automaticamente:'
            ),
            newPackages.map(pkg => 
              h('div', { 
                key: pkg.id,
                className: 'p-3 border border-green-200 rounded bg-green-50'
              },
                h('p', { className: 'font-medium' }, `📦 ${pkg.nome}`),
                h('p', { className: 'text-sm text-gray-600' }, 
                  `Código: ${pkg.id} | ${pkg.duracao} mês(es) | ${pkg.conexoes} tela(s)`
                )
              )
            )
          )
        ),
        
        // Botões de ação
        h('div', { className: 'p-6 border-t bg-gray-50 flex gap-3 justify-end' },
          h('button', {
            onClick: () => {
              setShowConflictModal(false);
              setConflicts([]);
              setNewPackages([]);
              setResolutions({});
            },
            className: 'px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100'
          }, '❌ Cancelar'),
          
          h('button', {
            onClick: handleConfirmResolutions,
            disabled: syncing,
            className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
          }, syncing ? '⏳ Sincronizando...' : '✅ Confirmar e Sincronizar')
        )
      )
    );
  }

  if (!isOpen) {
    return h('button', {
      onClick: () => setIsOpen(true),
      className: 'px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2'
    }, '🔄 Sincronizar Planos Sigma');
  }

  return h('div', null,
    renderConflictModal(),
    
    h('div', { 
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40' 
    },
      h('div', { 
        className: 'bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto' 
      },
        h('div', { className: 'flex items-center justify-between p-6 border-b' },
          h('div', null,
            h('h2', { className: 'text-2xl font-bold text-gray-800' }, '🔄 Sincronizar Planos Sigma'),
            h('p', { className: 'text-sm text-gray-600 mt-1' }, 
              'Selecione os pacotes que deseja adicionar ao gestao-clientes'
            )
          ),
          h('button', {
            onClick: () => {
              setIsOpen(false);
              setConflicts([]);
              setNewPackages([]);
              setResolutions({});
            },
            className: 'text-gray-500 hover:text-gray-700 text-2xl'
          }, '×')
        ),

        h('div', { className: 'p-6' },
          h('div', { className: 'mb-6' },
            h('label', { className: 'block text-sm font-medium mb-2' }, 'Selecionar Domínio'),
            h('select', {
              value: selectedDomain,
              onChange: (e) => setSelectedDomain(e.target.value),
              className: 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500',
              disabled: loading || syncing
            },
              h('option', { value: '' }, 'Selecione um domínio'),
              credentials.map((cred) =>
                h('option', { key: cred.domain, value: cred.domain }, cred.domain)
              )
            )
          ),

          credentials.length === 0 && h('div', { className: 'p-4 bg-yellow-50 border border-yellow-200 rounded-lg' },
            h('p', { className: 'text-yellow-800' },
              '⚠️ Nenhuma credencial cadastrada. Cadastre uma credencial primeiro.'
            )
          ),

          selectedDomain && (
            loading ? 
              h('div', { className: 'text-center py-8' },
                h('div', { className: 'inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' }),
                h('p', { className: 'mt-2 text-gray-600' }, 'Carregando pacotes...')
              ) : packages.length === 0 ?
              h('div', { className: 'text-center py-8 text-gray-500' },
                'Nenhum pacote encontrado. Carregue os pacotes primeiro na página "Pacotes Sigma".'
              ) :
              h('div', null,
                h('div', { className: 'flex items-center justify-between mb-4' },
                  h('h3', { className: 'font-semibold' }, 
                    `Pacotes Disponíveis (${packages.length})`
                  ),
                  h('button', {
                    onClick: toggleAll,
                    className: 'text-sm text-blue-600 hover:text-blue-800'
                  }, selectedPackages.length === packages.length ? 'Desmarcar Todos' : 'Selecionar Todos')
                ),

                h('div', { className: 'space-y-2 max-h-96 overflow-y-auto' },
                  packages.map(pkg =>
                    h('label', {
                      key: pkg.id,
                      className: 'flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50'
                    },
                      h('input', {
                        type: 'checkbox',
                        checked: selectedPackages.includes(pkg.id),
                        onChange: () => togglePackage(pkg.id),
                        className: 'w-4 h-4'
                      }),
                      h('div', { className: 'flex-1' },
                        h('p', { className: 'font-medium' }, pkg.nome),
                        h('p', { className: 'text-sm text-gray-600' },
                          `${pkg.duracao} ${pkg.duracao === 1 ? 'mês' : 'meses'} • ${pkg.conexoes} ${pkg.conexoes === 1 ? 'tela' : 'telas'} • ${pkg.id}`
                        )
                      ),
                      pkg.status === 'ACTIVE' && h('span', { className: 'text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full' }, '✅ Ativo')
                    )
                  )
                ),

                h('div', { className: 'mt-6 flex gap-3' },
                  h('button', {
                    onClick: () => setIsOpen(false),
                    className: 'flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50'
                  }, 'Cancelar'),
                  h('button', {
                    onClick: handleSyncCheck, // MUDANÇA: Agora chama verificação de conflitos
                    disabled: selectedPackages.length === 0 || syncing,
                    className: 'flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
                  }, syncing ? '⏳ Verificando...' : `Sincronizar (${selectedPackages.length})`)
                )
              )
          )
        )
      )
    )
  );
}