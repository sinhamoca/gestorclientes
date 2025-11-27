/* ========================================
   ACTIVITY LOGS PAGE - TEMA DARK
   Salvar em: user-system/js/components/ActivityLogsPage.js
   
   Visual consistente com o sistema principal
   ======================================== */

function ActivityLogsPage() {
  const { useState, useEffect, useCallback } = React;
  
  // Estados
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Filtros
  const [activeTab, setActiveTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateRange, setDateRange] = useState('7');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const ITEMS_PER_PAGE = 50;

  // Inicializar ícones Lucide
  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [logs, loading]);

  // Carregar estatísticas
  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const data = await api.getActivityStats();
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Carregar logs
  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      
      let startDate = null;
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const start = new Date();
        start.setDate(start.getDate() - days);
        startDate = start.toISOString().split('T')[0];
      }
      
      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        ...(activeTab !== 'all' && { type: activeTab }),
        ...(statusFilter && { status: statusFilter }),
        ...(startDate && { startDate })
      };
      
      const data = await api.getActivityLogs(params);
      setLogs(data.logs || []);
      setPagination(data.pagination || null);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, dateRange, currentPage]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { setCurrentPage(1); }, [activeTab, statusFilter, dateRange]);

  // Formatadores
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins}min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays}d`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatFullDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };

  // Helpers visuais
  const getTypeIcon = (type) => {
    switch (type) {
      case 'whatsapp': return '📱';
      case 'payment': return '💰';
      case 'renewal': return '🔄';
      default: return '📋';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <span className="badge-success px-3 py-1 rounded-full text-xs font-bold">✓ Sucesso</span>;
      case 'error':
        return <span className="badge-error px-3 py-1 rounded-full text-xs font-bold">✗ Erro</span>;
      case 'pending':
        return <span className="badge-pending px-3 py-1 rounded-full text-xs font-bold">⏳ Pendente</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-700 text-slate-300">{status}</span>;
    }
  };

  const getTypeName = (type) => {
    switch (type) {
      case 'whatsapp': return 'WhatsApp';
      case 'payment': return 'Pagamento';
      case 'renewal': return 'Renovação';
      default: return type;
    }
  };

  // Filtrar logs
  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.client_name && log.client_name.toLowerCase().includes(term)) ||
      (log.title && log.title.toLowerCase().includes(term)) ||
      (log.description && log.description.toLowerCase().includes(term))
    );
  });

  const goBack = () => { window.location.href = '/'; };

  const tabs = [
    { id: 'all', label: 'Todos', icon: '📋' },
    { id: 'whatsapp', label: 'WhatsApp', icon: '📱' },
    { id: 'payment', label: 'Pagamentos', icon: '💰' },
    { id: 'renewal', label: 'Renovações', icon: '🔄' }
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
                <span className="text-2xl">📋</span>
                Logs de Atividades
              </h1>
            </div>
            
            <button
              onClick={() => { loadStats(); loadLogs(); }}
              className="nav-btn flex items-center gap-2"
            >
              <i data-lucide="refresh-cw" className="w-4 h-4"></i>
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total */}
          <div className="gradient-card-blue rounded-2xl p-6 stat-card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total de Logs</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {statsLoading ? '...' : (stats?.stats?.total?.total || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <i data-lucide="file-text" className="w-6 h-6 text-white"></i>
              </div>
            </div>
          </div>

          {/* WhatsApp */}
          <div className="gradient-card-green rounded-2xl p-6 stat-card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">WhatsApp</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {statsLoading ? '...' : (stats?.stats?.whatsapp?.total || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <i data-lucide="message-circle" className="w-6 h-6 text-white"></i>
              </div>
            </div>
          </div>

          {/* Pagamentos */}
          <div className="gradient-card-purple rounded-2xl p-6 stat-card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Pagamentos</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {statsLoading ? '...' : (stats?.stats?.payment?.total || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <i data-lucide="credit-card" className="w-6 h-6 text-white"></i>
              </div>
            </div>
          </div>

          {/* Erros */}
          <div className="gradient-card-red rounded-2xl p-6 stat-card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Erros</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {statsLoading ? '...' : (stats?.stats?.total?.error || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <i data-lucide="alert-triangle" className="w-6 h-6 text-white"></i>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs de Tipo */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`nav-btn flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Busca */}
          <div className="flex-1 relative">
            <i data-lucide="search" className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
            <input
              type="text"
              placeholder="Buscar por cliente ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-dark w-full pl-12"
            />
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-dark min-w-[150px]"
          >
            <option value="">Todos status</option>
            <option value="success">✓ Sucesso</option>
            <option value="error">✗ Erro</option>
            <option value="pending">⏳ Pendente</option>
          </select>

          {/* Período */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input-dark min-w-[150px]"
          >
            <option value="1">Últimas 24h</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="all">Todo período</option>
          </select>
        </div>

        {/* Tabela de Logs */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="loader mx-auto mb-4"></div>
                <p className="text-slate-400">Carregando logs...</p>
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-lg font-semibold text-white mb-2">Nenhum log encontrado</h3>
              <p className="text-slate-400">
                {searchTerm ? 'Tente buscar com outros termos' : 'Os logs aparecerão aqui conforme as atividades ocorrerem'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table-dark w-full">
                  <thead>
                    <tr className="text-left text-slate-400 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Tipo</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Cliente</th>
                      <th className="px-6 py-4 font-semibold">Descrição</th>
                      <th className="px-6 py-4 font-semibold">Valor</th>
                      <th className="px-6 py-4 font-semibold">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{getTypeIcon(log.type)}</span>
                            <span className="text-slate-300 font-medium">{getTypeName(log.type)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(log.status)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-white font-medium">{log.client_name || '-'}</span>
                        </td>
                        <td className="px-6 py-4 max-w-md">
                          <div className="text-slate-300">{log.title}</div>
                          {log.error_details && (
                            <div className="text-red-400 text-xs mt-1 truncate" title={log.error_details}>
                              ⚠️ {log.error_details}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {log.amount ? (
                            <span className="text-emerald-400 font-bold">
                              R$ {parseFloat(log.amount).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-white" title={formatFullDate(log.created_at)}>
                            {formatRelativeTime(log.created_at)}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {formatFullDate(log.created_at)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {filteredLogs.map(log => (
                  <div key={log.id} className="mobile-card p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{getTypeIcon(log.type)}</span>
                        {getStatusBadge(log.status)}
                      </div>
                      <span className="text-xs text-slate-400">{formatRelativeTime(log.created_at)}</span>
                    </div>
                    <div className="ml-10">
                      <p className="font-semibold text-white">{log.client_name || 'Sistema'}</p>
                      <p className="text-sm text-slate-400 mt-1">{log.title}</p>
                      {log.error_details && (
                        <p className="text-xs text-red-400 mt-1">⚠️ {log.error_details}</p>
                      )}
                      {log.amount && (
                        <p className="text-sm font-bold text-emerald-400 mt-2">
                          R$ {parseFloat(log.amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {pagination && pagination.total_pages > 1 && (
                <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-400">
                      Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, pagination.total)} de {pagination.total}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="nav-btn px-3 py-2 disabled:opacity-30"
                      >
                        ««
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={!pagination.has_prev}
                        className="nav-btn px-3 py-2 disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <span className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
                        {currentPage} / {pagination.total_pages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(pagination.total_pages, p + 1))}
                        disabled={!pagination.has_next}
                        className="nav-btn px-3 py-2 disabled:opacity-30"
                      >
                        ›
                      </button>
                      <button
                        onClick={() => setCurrentPage(pagination.total_pages)}
                        disabled={currentPage === pagination.total_pages}
                        className="nav-btn px-3 py-2 disabled:opacity-30"
                      >
                        »»
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Legenda */}
        <div className="mt-6 text-center text-sm text-slate-500">
          <p>💡 Os logs são armazenados por 90 dias. Estatísticas consideram os últimos 30 dias.</p>
        </div>
      </main>
    </div>
  );
}

window.ActivityLogsPage = ActivityLogsPage;