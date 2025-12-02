/* ========================================
   FINANCIAL PAGE - TEMA DARK
   Salvar em: user-system/js/components/FinancialPage.js
   
   Página completa para Dashboard Financeiro
   Visual consistente com o sistema principal
   ======================================== */

function FinancialPage() {
  const { useState, useEffect, useCallback } = React;
  
  // Estados
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Abas
  const [activeTab, setActiveTab] = useState('overview');

  // Meses
  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Anos disponíveis
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  // Inicializar ícones Lucide
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [data, loading]);

  // Carregar dados
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.request(`/financial/dashboard?month=${selectedMonth}&year=${selectedYear}`);
      setData(response);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Formatadores
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  // Navegação
  const goBack = () => {
    window.location.href = '/';
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  // Tabs
  const tabs = [
    { id: 'overview', label: 'Visão Geral', icon: '📊' },
    { id: 'details', label: 'Detalhes', icon: '📋' },
    { id: 'evolution', label: 'Evolução', icon: '📈' }
  ];

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors nav-btn"
              >
                <i data-lucide="arrow-left" className="w-5 h-5"></i>
                <span className="hidden sm:inline">Voltar</span>
              </button>
              <div className="h-6 w-px bg-slate-600 hidden sm:block"></div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <span className="hidden sm:inline">Dashboard Financeiro</span>
                <span className="sm:hidden">Financeiro</span>
              </h1>
            </div>
            
            <button
              onClick={loadData}
              className="nav-btn flex items-center gap-2"
            >
              <i data-lucide="refresh-cw" className="w-4 h-4"></i>
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros de Período */}
        <div className="bg-slate-800/50 rounded-2xl p-4 mb-6 border border-slate-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousMonth}
                className="nav-btn px-3 py-2"
              >
                <i data-lucide="chevron-left" className="w-5 h-5"></i>
              </button>
              
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-4 py-2 rounded-lg text-sm"
                >
                  {months.map((month, idx) => (
                    <option key={idx} value={idx + 1}>{month}</option>
                  ))}
                </select>
                
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 rounded-lg text-sm"
                >
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={goToNextMonth}
                className="nav-btn px-3 py-2"
              >
                <i data-lucide="chevron-right" className="w-5 h-5"></i>
              </button>
            </div>
            
            <div className="text-slate-400 text-sm">
              {loading ? 'Carregando...' : `Dados de ${months[selectedMonth - 1]} de ${selectedYear}`}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-btn flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="loader mx-auto mb-4"></div>
              <p className="text-slate-400">Carregando dados financeiros...</p>
            </div>
          </div>
        ) : data ? (
          <>
            {/* Tab: Visão Geral */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Cards Principais - Linha 1 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Receita Bruta */}
                  <div className="gradient-card-green rounded-2xl p-6 stat-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm font-medium">Receita Bruta</p>
                        <p className="text-2xl lg:text-3xl font-bold text-white mt-1">
                          {formatCurrency(data.summary?.gross_revenue)}
                        </p>
                        <p className="text-green-200 text-xs mt-2">
                          {data.summary?.total_clients || 0} clientes
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <i data-lucide="trending-up" className="w-6 h-6 text-white"></i>
                      </div>
                    </div>
                  </div>

                  {/* Custos */}
                  <div className="gradient-card-red rounded-2xl p-6 stat-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-100 text-sm font-medium">Custos Totais</p>
                        <p className="text-2xl lg:text-3xl font-bold text-white mt-1">
                          {formatCurrency(data.summary?.total_cost)}
                        </p>
                        <p className="text-red-200 text-xs mt-2">
                          Servidores
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <i data-lucide="server" className="w-6 h-6 text-white"></i>
                      </div>
                    </div>
                  </div>

                  {/* Lucro Previsto */}
                  <div className="gradient-card-blue rounded-2xl p-6 stat-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm font-medium">Lucro Previsto</p>
                        <p className="text-2xl lg:text-3xl font-bold text-white mt-1">
                          {formatCurrency(data.summary?.net_profit)}
                        </p>
                        <p className="text-blue-200 text-xs mt-2">
                          Margem: {formatPercent(data.summary?.profit_margin)}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <i data-lucide="target" className="w-6 h-6 text-white"></i>
                      </div>
                    </div>
                  </div>

                  {/* Já Recebido */}
                  <div className="gradient-card-purple rounded-2xl p-6 stat-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm font-medium">Já Recebido</p>
                        <p className="text-2xl lg:text-3xl font-bold text-white mt-1">
                          {formatCurrency(data.received?.amount)}
                        </p>
                        <p className="text-purple-200 text-xs mt-2">
                          {data.received?.count || 0} pagamentos
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                        <i data-lucide="check-circle" className="w-6 h-6 text-white"></i>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cards de Lucro - Linha 2 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Lucro Líquido Atual */}
                  <div className="gradient-card-indigo rounded-2xl p-6 stat-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-indigo-100 text-sm font-medium">💎 Lucro Líquido Atual (Mês)</p>
                        <p className="text-3xl lg:text-4xl font-bold text-white mt-2">
                          {formatCurrency(data.current_profit?.amount)}
                        </p>
                        <p className="text-indigo-200 text-sm mt-2">
                          Já Recebido ({formatCurrency(data.received?.amount)}) menos custos dos que pagaram
                        </p>
                      </div>
                      <div className="text-6xl opacity-20">💰</div>
                    </div>
                  </div>

                  {/* Lucro Líquido Anual */}
                  <div className="gradient-card-teal rounded-2xl p-6 stat-card-hover">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-teal-100 text-sm font-medium">🏆 Lucro Líquido Anual ({data.year})</p>
                        <p className="text-3xl lg:text-4xl font-bold text-white mt-2">
                          {formatCurrency(data.yearly_profit?.net_profit)}
                        </p>
                        <div className="flex gap-4 mt-2 text-sm text-teal-200">
                          <span>💰 Recebido: {formatCurrency(data.yearly_profit?.total_received)}</span>
                          <span>📊 Custos: {formatCurrency(data.yearly_profit?.total_cost)}</span>
                        </div>
                      </div>
                      <div className="text-6xl opacity-20">📅</div>
                    </div>
                  </div>
                </div>

                {/* Pendentes e Vencidos - Linha 3 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Pendentes */}
                  <div className="bg-slate-800/50 rounded-2xl p-6 border-l-4 border-yellow-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-yellow-400 font-semibold flex items-center gap-2">
                          <span>⏳</span> Pendentes
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">
                          {formatCurrency(data.pending?.amount)}
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          {data.pending?.count || 0} clientes aguardando pagamento
                        </p>
                      </div>
                      <div className="text-5xl opacity-30">⏳</div>
                    </div>
                    
                    {/* Barra de progresso */}
                    {data.summary?.gross_revenue > 0 && (
                      <div className="mt-4">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill bg-yellow-500"
                            style={{ 
                              width: `${Math.min(100, (data.pending?.amount / data.summary?.gross_revenue) * 100)}%` 
                            }}
                          ></div>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {((data.pending?.amount / data.summary?.gross_revenue) * 100).toFixed(1)}% da receita esperada
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Vencidos */}
                  <div className="bg-slate-800/50 rounded-2xl p-6 border-l-4 border-red-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-red-400 font-semibold flex items-center gap-2">
                          <span>🚨</span> Vencidos
                        </p>
                        <p className="text-3xl font-bold text-white mt-2">
                          {formatCurrency(data.overdue?.amount)}
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          {data.overdue?.count || 0} clientes em atraso
                        </p>
                      </div>
                      <div className="text-5xl opacity-30">🚨</div>
                    </div>
                    
                    {/* Alerta se houver vencidos */}
                    {data.overdue?.count > 0 && (
                      <div className="mt-4 bg-red-500/10 rounded-lg p-3">
                        <p className="text-red-400 text-sm">
                          ⚠️ Atenção: Você tem clientes com pagamentos em atraso. Considere enviar lembretes.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Detalhes */}
            {activeTab === 'details' && (
              <div className="space-y-6">
                {/* Top Planos */}
                {data.top_plans && data.top_plans.length > 0 && (
                  <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <span>🏆</span> Receita por Plano
                    </h3>
                    <div className="space-y-3">
                      {data.top_plans.map((plan, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold
                              ${idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-600' : 'bg-slate-600'}`}
                            >
                              {idx + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{plan.plan_name}</p>
                              <p className="text-slate-400 text-sm">
                                {plan.client_count} {plan.client_count === 1 ? 'cliente' : 'clientes'} • {plan.num_screens} {plan.num_screens === 1 ? 'tela' : 'telas'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-400 text-lg">{formatCurrency(plan.total_revenue)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resumo Detalhado */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span>📊</span> Resumo Detalhado
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                        <span className="text-slate-400">Receita Bruta Esperada</span>
                        <span className="text-white font-semibold">{formatCurrency(data.summary?.gross_revenue)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                        <span className="text-slate-400">Custos de Servidores</span>
                        <span className="text-red-400 font-semibold">- {formatCurrency(data.summary?.total_cost)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                        <span className="text-emerald-400 font-semibold">Lucro Líquido Previsto</span>
                        <span className="text-emerald-400 font-bold text-lg">{formatCurrency(data.summary?.net_profit)}</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                        <span className="text-slate-400">Total de Clientes</span>
                        <span className="text-white font-semibold">{data.summary?.total_clients || 0}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                        <span className="text-slate-400">Margem de Lucro</span>
                        <span className="text-blue-400 font-semibold">{formatPercent(data.summary?.profit_margin)}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                        <span className="text-slate-400">Ticket Médio</span>
                        <span className="text-purple-400 font-semibold">
                          {formatCurrency(data.summary?.total_clients > 0 ? data.summary?.gross_revenue / data.summary?.total_clients : 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Evolução */}
            {activeTab === 'evolution' && (
              <div className="space-y-6">
                {/* Gráfico de Evolução (representação visual simples) */}
                {data.evolution && data.evolution.length > 0 ? (
                  <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                      <span>📈</span> Evolução dos Últimos 6 Meses
                    </h3>
                    
                    {/* Cards de evolução */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {data.evolution.map((item, idx) => {
                        const maxRevenue = Math.max(...data.evolution.map(e => parseFloat(e.revenue) || 0));
                        const barHeight = maxRevenue > 0 ? (parseFloat(item.revenue) / maxRevenue) * 100 : 0;
                        
                        return (
                          <div key={idx} className="bg-slate-900/50 rounded-xl p-4 text-center">
                            <p className="text-slate-400 text-sm mb-2">{item.month}</p>
                            
                            {/* Mini bar chart */}
                            <div className="h-24 flex items-end justify-center mb-3">
                              <div 
                                className="w-8 bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all duration-500"
                                style={{ height: `${Math.max(10, barHeight)}%` }}
                              ></div>
                            </div>
                            
                            <p className="text-emerald-400 font-bold text-sm">{formatCurrency(item.revenue)}</p>
                            <p className="text-blue-400 text-xs mt-1">Lucro: {formatCurrency(item.profit)}</p>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Totais */}
                    <div className="mt-6 pt-6 border-t border-slate-700">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-slate-400 text-sm">Total Receita (6 meses)</p>
                          <p className="text-2xl font-bold text-emerald-400">
                            {formatCurrency(data.evolution.reduce((sum, e) => sum + parseFloat(e.revenue || 0), 0))}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-sm">Total Lucro (6 meses)</p>
                          <p className="text-2xl font-bold text-blue-400">
                            {formatCurrency(data.evolution.reduce((sum, e) => sum + parseFloat(e.profit || 0), 0))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-lg font-semibold text-white mb-2">Sem dados de evolução</h3>
                    <p className="text-slate-400">
                      Os dados de evolução aparecerão conforme os pagamentos forem registrados.
                    </p>
                  </div>
                )}

                {/* Lucro Anual */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span>📅</span> Resumo Anual ({data.year})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-emerald-500/10 rounded-xl p-4 text-center border border-emerald-500/30">
                      <p className="text-emerald-400 text-sm">Total Recebido</p>
                      <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.yearly_profit?.total_received)}</p>
                    </div>
                    <div className="bg-red-500/10 rounded-xl p-4 text-center border border-red-500/30">
                      <p className="text-red-400 text-sm">Total Custos</p>
                      <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.yearly_profit?.total_cost)}</p>
                    </div>
                    <div className="bg-blue-500/10 rounded-xl p-4 text-center border border-blue-500/30">
                      <p className="text-blue-400 text-sm">Lucro Líquido</p>
                      <p className="text-2xl font-bold text-white mt-1">{formatCurrency(data.yearly_profit?.net_profit)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-white mb-2">Nenhum dado encontrado</h3>
            <p className="text-slate-400">
              Não há dados financeiros para o período selecionado.
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>💡 <strong>Dica:</strong> Os valores de Receita, Custos e Lucro Previsto são baseados nos clientes ativos com vencimento no mês selecionado.</p>
        </div>
      </main>
    </div>
  );
}

window.FinancialPage = FinancialPage;
