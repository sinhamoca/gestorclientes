/* ========================================
   CUSTOM CHECKBOX COMPONENT - Jelly Effect
   Componente reutilizável com animação
   ======================================== */

/**
 * CustomCheckbox - Checkbox com efeito jelly
 * 
 * @param {boolean} checked - Estado do checkbox
 * @param {function} onChange - Callback ao mudar (recebe evento)
 * @param {string} label - Texto do label (opcional)
 * @param {string} description - Descrição abaixo do label (opcional)
 * @param {string} id - ID único (gerado automaticamente se não fornecido)
 * @param {boolean} disabled - Se está desabilitado
 * @param {string} color - Cor do checkbox: 'blue' | 'green' | 'red' | 'orange' | 'purple' (default: 'blue')
 * @param {string} size - Tamanho: 'small' | 'normal' | 'large' (default: 'normal')
 * @param {string} className - Classes adicionais para o container
 */
function CustomCheckbox({ 
  checked, 
  onChange, 
  label, 
  description,
  id,
  disabled = false,
  color = 'blue',
  size = 'normal',
  className = ''
}) {
  // Gerar ID único se não fornecido
  const checkboxId = id || `jelly-cbx-${Math.random().toString(36).substr(2, 9)}`;
  
  // Classes de cor
  const colorClasses = {
    blue: 'jelly-checkbox-blue',
    green: 'jelly-checkbox-green',
    red: 'jelly-checkbox-red',
    orange: 'jelly-checkbox-orange',
    purple: 'jelly-checkbox-purple'
  };

  // Classes de tamanho
  const sizeClasses = {
    small: 'jelly-checkbox-small',
    normal: '',
    large: 'jelly-checkbox-large'
  };

  return (
    <div className={`jelly-checkbox-wrapper ${className}`}>
      <label className={`jelly-checkbox ${colorClasses[color] || ''} ${sizeClasses[size] || ''} ${disabled ? 'disabled' : ''}`}>
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
        />
        <span className="jelly-checkmark"></span>
      </label>
      {(label || description) && (
        <label htmlFor={checkboxId} className={`jelly-checkbox-label ${disabled ? 'disabled' : ''}`}>
          {label && <span className="jelly-label-text">{label}</span>}
          {description && <span className="jelly-label-description">{description}</span>}
        </label>
      )}
    </div>
  );
}

// Exportar para uso global
window.CustomCheckbox = CustomCheckbox;
