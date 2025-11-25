/* ========================================
   PAGINATION COMPONENT
   Componente de paginação moderno
   ======================================== */

(function() {
  'use strict';
  
  function Pagination({ currentPage, totalPages, onPageChange }) {
    const { createElement: h } = React;
    
    // Validação
    if (!currentPage || !totalPages || !onPageChange || totalPages <= 1) {
      return h('div', { style: { display: 'none' } });
    }

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      if (totalPages <= maxVisible) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 5; i++) pages.push(i);
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
        } else {
          pages.push(1);
          pages.push('...');
          pages.push(currentPage - 1);
          pages.push(currentPage);
          pages.push(currentPage + 1);
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    const pageNumbers = getPageNumbers();

    return h('div', { 
      className: 'flex items-center justify-between border-t bg-white px-4 py-3 sm:px-6 rounded-b-lg mt-4'
    },
      
      // Info mobile
      h('div', { className: 'flex flex-1 justify-between sm:hidden' },
        h('button', {
          onClick: () => onPageChange(currentPage - 1),
          disabled: currentPage === 1,
          className: 'relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
        }, 'Anterior'),
        h('button', {
          onClick: () => onPageChange(currentPage + 1),
          disabled: currentPage === totalPages,
          className: 'relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
        }, 'Próximo')
      ),

      // Info desktop
      h('div', { className: 'hidden sm:flex sm:flex-1 sm:items-center sm:justify-between' },
        h('div', null,
          h('p', { className: 'text-sm text-gray-700' },
            'Página ',
            h('span', { className: 'font-medium' }, currentPage),
            ' de ',
            h('span', { className: 'font-medium' }, totalPages)
          )
        ),
        
        // Botões de paginação
        h('div', null,
          h('nav', { className: 'isolate inline-flex -space-x-px rounded-md shadow-sm' },
            
            // Botão Anterior
            h('button', {
              onClick: () => onPageChange(currentPage - 1),
              disabled: currentPage === 1,
              className: 'relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed'
            },
              h('span', { className: 'sr-only' }, 'Anterior'),
              h('svg', { className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' },
                h('path', { 
                  fillRule: 'evenodd', 
                  d: 'M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z',
                  clipRule: 'evenodd'
                })
              )
            ),
            
            // Números de página
            ...pageNumbers.map((page, index) => {
              if (page === '...') {
                return h('span', {
                  key: `ellipsis-${index}`,
                  className: 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300'
                }, '...');
              }
              
              const isActive = page === currentPage;
              return h('button', {
                key: page,
                onClick: () => onPageChange(page),
                className: isActive
                  ? 'relative z-10 inline-flex items-center bg-blue-600 px-4 py-2 text-sm font-semibold text-white focus:z-20'
                  : 'relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20'
              }, page);
            }),
            
            // Botão Próximo
            h('button', {
              onClick: () => onPageChange(currentPage + 1),
              disabled: currentPage === totalPages,
              className: 'relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 disabled:opacity-50 disabled:cursor-not-allowed'
            },
              h('span', { className: 'sr-only' }, 'Próximo'),
              h('svg', { className: 'h-5 w-5', viewBox: '0 0 20 20', fill: 'currentColor' },
                h('path', { 
                  fillRule: 'evenodd', 
                  d: 'M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z',
                  clipRule: 'evenodd'
                })
              )
            )
          )
        )
      )
    );
  }
  
  // EXPORTAR PARA O ESCOPO GLOBAL
  window.Pagination = Pagination;
  
  console.log('✅ Pagination carregado e exportado para window.Pagination');
  
})();