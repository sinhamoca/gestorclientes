/* ========================================
   DATE RANGE FILTER COMPONENT
   Filtro de período de vencimento
   ======================================== */

(function() {
  'use strict';

  function DateRangeFilter({ startDate, endDate, onChange, onClear }) {
    const { createElement: h } = React;

    return h('div', { className: 'flex flex-col sm:flex-row gap-2 items-start sm:items-center' },
      // Label
      h('span', { className: 'text-xs font-medium text-gray-600 whitespace-nowrap' }, 
        'Período de vencimento:'
      ),
      
      // Container dos inputs
      h('div', { className: 'flex items-center gap-2 flex-wrap' },
        // Data início
        h('input', {
          type: 'date',
          value: startDate,
          onChange: (e) => onChange('start', e.target.value),
          className: 'px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500',
          placeholder: 'Data inicial'
        }),
        
        // Separador
        h('span', { className: 'text-gray-500' }, '→'),
        
        // Data fim
        h('input', {
          type: 'date',
          value: endDate,
          onChange: (e) => onChange('end', e.target.value),
          className: 'px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500',
          placeholder: 'Data final'
        }),
        
        // Botão limpar (só aparece se tem filtro ativo)
        (startDate || endDate) && h('button', {
          onClick: onClear,
          className: 'px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition',
          title: 'Limpar filtro de data'
        }, '✕')
      )
    );
  }

  // Exportar para o escopo global
  window.DateRangeFilter = DateRangeFilter;
  
  console.log('✅ DateRangeFilter carregado');
  
})();
