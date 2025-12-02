/* ========================================
   FINANCIAL DASHBOARD COMPONENT - CORRIGIDO
   ======================================== */

function FinancialDashboard({ onClose }) {
  const { useState, useEffect } = React;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadData();
  }, [selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.request(`/financial/dashboard?month=${selectedMonth}&year=${selectedYear}`);
      setData(response);
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      alert('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6 md:p-8">
          <div className="text-center">
            <div className="loader mx-auto mb-2"></div>
            <p className="text-sm md:text-base">Carregando dados financeiros...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl my-4 mx-2 md:mx-4 md:my-8">
        {/* Header */}
        <div className="p-3 md:p-2 border-b flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-lg gap-3 md:gap-0">
          <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <span className="text-xl md:text-1xl">💰</span>
            <span className="hidden sm:inline">Dashboard Financeiro</span>
            <span className="sm:hidden">Financeiro</span>
          </h3>
          <button onClick={onClose} className="absolute top-2 right-4 md:relative md:top-0 md:right-0 text-white hover:text-gray-200 text-3xl leading-none">×</button>
        </div>

        <div className="p-3 md:p-2">
          {/* Filtro Mês/Ano - Responsivo */}
          <div className="mb-3 md:mb-2 flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full sm:w-auto px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base"
            >
              {months.map((month, idx) => (
                <option key={idx} value={idx + 1}>{month}</option>
              ))}
            </select>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full sm:w-auto px-3 md:px-4 py-2 border rounded-lg text-sm md:text-base"
            >
              {[2024, 2025, 2026].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {data && (
            <>
              {/* Cards Principais - LINHA 1: 4 Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-2 mb-3 md:mb-2">
                {/* Receita Bruta */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-3 md:p-2 text-white">
                  <p className="text-xs md:text-sm opacity-90">Receita Bruta</p>
                  <p className="text-xl md:text-1xl font-bold mt-1 break-words">{formatCurrency(data.summary.gross_revenue)}</p>
                  <p className="text-xs mt-1 opacity-75">{data.summary.total_clients} clientes</p>
                </div>

                {/* Custos */}
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-3 md:p-2 text-white">
                  <p className="text-xs md:text-sm opacity-90">Custos Totais</p>
                  <p className="text-xl md:text-1xl font-bold mt-1 break-words">{formatCurrency(data.summary.total_cost)}</p>
                  <p className="text-xs mt-1 opacity-75">Servidores</p>
                </div>

                {/* Lucro Líquido Previsto */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-3 md:p-2 text-white">
                  <p className="text-xs md:text-sm opacity-90">Lucro Previsto</p>
                  <p className="text-xl md:text-1xl font-bold mt-1 break-words">{formatCurrency(data.summary.net_profit)}</p>
                  <p className="text-xs mt-1 opacity-75">Margem: {data.summary.profit_margin}%</p>
                </div>

                {/* Já Recebido */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-3 md:p-2 text-white">
                  <p className="text-xs md:text-sm opacity-90">Já Recebido</p>
                  <p className="text-xl md:text-1xl font-bold mt-1 break-words">{formatCurrency(data.received.amount)}</p>
                  <p className="text-xs mt-1 opacity-75">{data.received.count} pagamentos</p>
                </div>
              </div>

              {/* LINHA 2: Lucro Líquido Atual (NOVO CARD) */}
              <div className="mb-3 md:mb-2">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-3 md:p-2 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm opacity-90 mb-1">💎 Lucro Líquido Atual (Mês)</p>
                      <p className="text-xl md:text-1xl font-bold">{formatCurrency(data.current_profit.amount)}</p>
                      <p className="text-xs mt-1 opacity-75">
                        Já Recebido ({formatCurrency(data.received.amount)}) menos custos dos que pagaram
                      </p>
                    </div>
                    <div className="text-3xl md:text-2xl opacity-20">💰</div>
                  </div>
                </div>
              </div>

              {/* LINHA 3: Lucro Líquido Anual (NOVO CARD) */}
              <div className="mb-3 md:mb-2">
                <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-lg shadow-lg p-3 md:p-2 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs md:text-sm opacity-90 mb-1">🏆 Lucro Líquido Anual ({data.year})</p>
                      <p className="text-xl md:text-1xl font-bold">{formatCurrency(data.yearly_profit.net_profit)}</p>
                      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-xs mt-2 opacity-90">
                        <span>💰 Recebido: {formatCurrency(data.yearly_profit.total_received)}</span>
                        <span>📊 Custos: {formatCurrency(data.yearly_profit.total_cost)}</span>
                      </div>
                    </div>
                    <div className="text-3xl md:text-2xl opacity-20">📅</div>
                  </div>
                </div>
              </div>

              {/* Pendentes e Atrasados - Stack em Mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-2 mb-3 md:mb-2">
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 rounded">
                  <p className="font-semibold text-yellow-800 text-sm flex items-center gap-2">
                    <span>⏳</span>
                    <span>Pendentes</span>
                  </p>
                  <p className="text-xl md:text-1xl font-bold text-yellow-900 mt-1">{formatCurrency(data.pending.amount)}</p>
                  <p className="text-xs text-yellow-700 mt-1">{data.pending.count} clientes ainda não renovaram</p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                  <p className="font-semibold text-red-800 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Vencidos</span>
                  </p>
                  <p className="text-xl md:text-1xl font-bold text-red-900 mt-1">{formatCurrency(data.overdue.amount)}</p>
                  <p className="text-xs text-red-700 mt-1">{data.overdue.count} clientes atrasados</p>
                </div>
              </div>

              {/* Top Planos - Cards em Mobile */}
              {data.top_plans && data.top_plans.length > 0 && (
                <div className="bg-white border rounded-lg p-3 md:p-2 mb-3 md:mb-2">
                  <h4 className="text-sm md:text-base font-bold mb-2 md:mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span className="hidden sm:inline">Top 5 Planos Mais Rentáveis</span>
                    <span className="sm:hidden">Top Planos</span>
                  </h4>
                  <div className="space-y-2">
                    {data.top_plans.map((plan, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-gray-50 rounded gap-1">
                        <div className="w-full sm:w-auto">
                          <span className="font-medium text-xs md:text-sm">{plan.plan_name}</span>
                          <span className="text-xs text-gray-600 ml-2">
                            ({plan.client_count} clientes • {plan.num_screens || 1} {(plan.num_screens || 1) === 1 ? 'tela' : 'telas'})
                          </span>
                        </div>
                        <span className="font-bold text-green-600 text-xs md:text-sm">{formatCurrency(plan.total_revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evolução Mensal - Compacto em Mobile */}
              {data.evolution && data.evolution.length > 0 && (
                <div className="bg-white border rounded-lg p-3 md:p-2">
                  <h4 className="text-sm md:text-base font-bold mb-2 md:mb-3 flex items-center gap-2">
                    <span>📈</span>
                    <span className="hidden sm:inline">Evolução (Últimos 6 Meses)</span>
                    <span className="sm:hidden">Evolução</span>
                  </h4>
                  <div className="space-y-2">
                    {data.evolution.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-2 bg-gray-50 rounded gap-1">
                        <span className="font-medium text-xs md:text-sm">{item.month}</span>
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 text-xs">
                          <span className="text-green-600">💰 {formatCurrency(item.revenue)}</span>
                          <span className="text-blue-600">📊 {formatCurrency(item.profit)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Responsivo */}
        <div className="p-3 md:p-2 border-t bg-gray-50 rounded-b-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <p className="text-xs text-gray-600">
              <span className="hidden sm:inline">💡 <strong>Dica:</strong> Os valores de Receita, Custos e Lucro Previsto são fixos durante todo o mês!</span>
              <span className="sm:hidden">💡 Valores fixos no mês!</span>
            </p>
            <button onClick={onClose} className="w-full md:w-auto px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm md:text-base">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}