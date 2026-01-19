/* ========================================
   🔔 TOAST CONTEXT
   Sistema completo de notificações Toast
   
   Arquivo: user-system/js/contexts/ToastContext.js
   ======================================== */

(function() {
  'use strict';
  
  const { useState, useEffect, useCallback, useMemo, useContext, createContext, createElement: h } = React;
  
  // Context
  const ToastContext = createContext(null);
  
  // ID counter
  let toastId = 0;

  // ==========================================
  // TOAST PROVIDER
  // ==========================================
  function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [exitingIds, setExitingIds] = useState(new Set());

    // Adicionar toast
    const addToast = useCallback((type, title, message, options = {}) => {
      const id = ++toastId;
      const duration = options.duration ?? (type === 'error' ? 5000 : 3000);
      
      setToasts(prev => [...prev, { id, type, title, message, duration }]);
      
      // Auto-remove
      if (duration > 0) {
        setTimeout(() => removeToast(id), duration);
      }
      
      return id;
    }, []);

    // Remover toast (com animação)
    const removeToast = useCallback((id) => {
      setExitingIds(prev => new Set([...prev, id]));
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
        setExitingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    }, []);

    // API pública
    const toast = useMemo(() => ({
      success: (msg, opts = {}) => addToast('success', opts.title || 'Sucesso!', msg, opts),
      error: (msg, opts = {}) => addToast('error', opts.title || 'Erro!', msg, opts),
      warning: (msg, opts = {}) => addToast('warning', opts.title || 'Atenção!', msg, opts),
      info: (msg, opts = {}) => addToast('info', opts.title || 'Info', msg, opts),
      dismiss: (id) => removeToast(id),
      dismissAll: () => setToasts([])
    }), [addToast, removeToast]);

    // Registrar globalmente
    useEffect(() => {
      window.toast = toast;
    }, [toast]);

    return h(ToastContext.Provider, { value: { toasts, toast, removeToast } },
      children,
      h(ToastContainer, { toasts, exitingIds, onClose: removeToast })
    );
  }

  // ==========================================
  // TOAST CONTAINER
  // ==========================================
  function ToastContainer({ toasts, exitingIds, onClose }) {
    if (toasts.length === 0) return null;

    return h('div', { className: 'toast-container' },
      toasts.map(t => h(ToastItem, {
        key: t.id,
        toast: t,
        isExiting: exitingIds.has(t.id),
        onClose: () => onClose(t.id)
      }))
    );
  }

  // ==========================================
  // TOAST ITEM
  // ==========================================
  function ToastItem({ toast, isExiting, onClose }) {
    const { id, type, title, message, duration } = toast;

    // Ícones SVG
    const icons = {
      success: h('svg', { viewBox: '0 0 24 24' },
        h('polyline', { points: '20 6 9 17 4 12' })
      ),
      error: h('svg', { viewBox: '0 0 24 24' },
        h('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
        h('line', { x1: '6', y1: '6', x2: '18', y2: '18' })
      ),
      warning: h('svg', { viewBox: '0 0 24 24' },
        h('path', { d: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z' })
      ),
      info: h('svg', { viewBox: '0 0 24 24' },
        h('circle', { cx: '12', cy: '12', r: '10' }),
        h('line', { x1: '12', y1: '16', x2: '12', y2: '12' }),
        h('line', { x1: '12', y1: '8', x2: '12.01', y2: '8' })
      )
    };

    const className = `toast toast-${type}${isExiting ? ' toast-exiting' : ''}`;

    return h('div', { className, role: 'alert' },
      // Ícone
      h('div', { className: 'toast-icon' }, icons[type]),
      
      // Conteúdo
      h('div', { className: 'toast-content' },
        h('div', { className: 'toast-title' }, title),
        message && h('div', { className: 'toast-message' }, message)
      ),
      
      // Fechar
      h('button', { 
        className: 'toast-close', 
        onClick: onClose,
        'aria-label': 'Fechar'
      }, '×'),
      
      // Progresso
      duration > 0 && h('div', { 
        className: 'toast-progress',
        style: { '--toast-duration': `${duration}ms` }
      })
    );
  }

  // ==========================================
  // HOOK
  // ==========================================
  function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
      console.warn('useToast: ToastProvider não encontrado, usando fallback global');
      return window.toast || {
        success: () => {},
        error: () => {},
        warning: () => {},
        info: () => {},
        dismiss: () => {},
        dismissAll: () => {}
      };
    }
    return context.toast;
  }

  // ==========================================
  // EXPORTS GLOBAIS
  // ==========================================
  window.ToastContext = ToastContext;
  window.ToastProvider = ToastProvider;
  window.useToast = useToast;

  // Fallback toast (antes do Provider montar)
  if (!window.toast) {
    window.toast = {
      success: (msg) => console.log('✅', msg),
      error: (msg) => console.error('❌', msg),
      warning: (msg) => console.warn('⚠️', msg),
      info: (msg) => console.info('ℹ️', msg),
      dismiss: () => {},
      dismissAll: () => {}
    };
  }

})();
