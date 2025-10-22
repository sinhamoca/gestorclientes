/* ========================================
   FINANCIAL DASHBOARD COMPONENT (Mobile-Friendly)
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6 md:p-8">
          <div className="text-center">
            <div className="loader mx-auto mb-4"></div>
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
        <div className="p-4 md:p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-lg gap-3 md:gap-0">
          <h3 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <span className="text-2xl md:text-3xl">💰</span>
            <span className="hidden sm:inline">Dashboard Financeiro</span>
            <span className="sm:hidden">Financeiro</span>
          </h3>
          <button onClick={onClose} className="absolute top-4 right-4 md:relative md:top-0 md:right-0 text-white hover:text-gray-200 text-3xl leading-none">×</button>
        </div>

        <div className="p-4 md:p-6">
          {/* Filtro Mês/Ano - Responsivo */}
          <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
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
              {/* Cards Principais - Grid Responsivo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                {/* Receita Bruta */}
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-3 md:p-6 text-white col-span-2 md:col-span-1">
                  <p className="text-xs md:text-sm opacity-90">Receita Bruta</p>
                  <p className="text-xl md:text-3xl font-bold mt-1 md:mt-2 break-words">{formatCurrency(data.summary.gross_revenue)}</p>
                  <p className="text-xs mt-1 md:mt-2 opacity-75">{data.summary.total_clients} clientes</p>
                </div>

                {/* Custos */}
                <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg p-3 md:p-6 text-white">
                  <p className="text-xs md:text-sm opacity-90">Custos</p>
                  <p className="text-xl md:text-3xl font-bold mt-1 md:mt-2 break-words">{formatCurrency(data.summary.total_cost)}</p>
                  <p className="text-xs mt-1 md:mt-2 opacity-75">Servidores</p>
                </div>

                {/* Lucro Líquido */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-3 md:p-6 text-white">
                  <p className="text-xs md:text-sm opacity-90">Lucro Líquido</p>
                  <p className="text-xl md:text-3xl font-bold mt-1 md:mt-2 break-words">{formatCurrency(data.summary.net_profit)}</p>
                  <p className="text-xs mt-1 md:mt-2 opacity-75">Margem: {data.summary.profit_margin}%</p>
                </div>

                {/* Já Recebido */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-3 md:p-6 text-white col-span-2 md:col-span-1">
                  <p className="text-xs md:text-sm opacity-90">Já Recebido</p>
                  <p className="text-xl md:text-3xl font-bold mt-1 md:mt-2 break-words">{formatCurrency(data.received.amount)}</p>
                  <p className="text-xs mt-1 md:mt-2 opacity-75">{data.received.count} pagamentos</p>
                </div>
              </div>

              {/* Pendentes e Atrasados - Stack em Mobile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4 md:mb-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 md:p-4 rounded">
                  <p className="font-semibold text-yellow-800 text-sm md:text-base flex items-center gap-2">
                    <span>⏳</span>
                    <span>Pendentes</span>
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-yellow-900 mt-2">{formatCurrency(data.pending.amount)}</p>
                  <p className="text-xs md:text-sm text-yellow-700 mt-1">{data.pending.count} clientes ainda não renovaram</p>
                </div>

                <div className="bg-red-50 border-l-4 border-red-500 p-3 md:p-4 rounded">
                  <p className="font-semibold text-red-800 text-sm md:text-base flex items-center gap-2">
                    <span>⚠️</span>
                    <span>Vencidos</span>
                  </p>
                  <p className="text-xl md:text-2xl font-bold text-red-900 mt-2">{formatCurrency(data.overdue.amount)}</p>
                  <p className="text-xs md:text-sm text-red-700 mt-1">{data.overdue.count} clientes atrasados</p>
                </div>
              </div>

              {/* Top Planos - Cards em Mobile */}
              {data.top_plans && data.top_plans.length > 0 && (
                <div className="bg-white border rounded-lg p-4 md:p-6 mb-4 md:mb-6">
                  <h4 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2">
                    <span>📊</span>
                    <span className="hidden sm:inline">Top 5 Planos Mais Rentáveis</span>
                    <span className="sm:hidden">Top Planos</span>
                  </h4>
                  <div className="space-y-2">
                    {data.top_plans.map((plan, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 rounded gap-2">
                        <div className="w-full sm:w-auto">
                          <span className="font-medium text-sm md:text-base">{plan.plan_name}</span>
                          <span className="text-xs md:text-sm text-gray-600 ml-2">({plan.client_count} clientes)</span>
                        </div>
                        <span className="font-bold text-green-600 text-sm md:text-base">{formatCurrency(plan.total_revenue)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evolução Mensal - Compacto em Mobile */}
              {data.evolution && data.evolution.length > 0 && (
                <div className="bg-white border rounded-lg p-4 md:p-6">
                  <h4 className="text-base md:text-lg font-bold mb-3 md:mb-4 flex items-center gap-2">
                    <span>📈</span>
                    <span className="hidden sm:inline">Evolução (Últimos 6 Meses)</span>
                    <span className="sm:hidden">Evolução</span>
                  </h4>
                  <div className="space-y-2">
                    {data.evolution.map((item, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-gray-50 rounded gap-2">
                        <span className="font-medium text-sm md:text-base">{item.month}</span>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs md:text-sm">
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
        <div className="p-4 md:p-6 border-t bg-gray-50 rounded-b-lg">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <p className="text-xs md:text-sm text-gray-600">
              <span className="hidden sm:inline">💡 <strong>Dica:</strong> Mantenha seus custos sempre atualizados para cálculos precisos!</span>
              <span className="sm:hidden">💡 Mantenha custos atualizados!</span>
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
