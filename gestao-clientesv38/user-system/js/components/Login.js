/* ========================================
   LOGIN COMPONENT - VERSÃO MODERNA
   
   CONFIGURAÇÃO DE IMAGENS:
   - Logo: ./images/logo.png
   - Background: ./images/login-bg.png
   
   Para trocar, basta substituir os arquivos na pasta images/
   ======================================== */

// ========== CONFIGURAÇÕES (FÁCIL DE ALTERAR) ==========
const LOGIN_CONFIG = {
  // Imagens
  logo: './images/logo.png',
  background: './images/login-bg.png',
  
  // Textos
  title: 'Bem-vindo',
  subtitle: 'Sistema de Gestão de Clientes',
  
  // Cores do botão (gradiente)
  buttonGradient: 'from-blue-500 to-purple-600',
  buttonHoverGradient: 'from-blue-600 to-purple-700',
  
  // Tamanho da logo
  logoSize: 100, // pixels
};

function Login({ onLogin }) {
  const { useState, useEffect } = React;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = await api.login(email, password);
      
      // Bloqueia admins
      if (data.user.role === 'admin') {
        setError('Administradores devem usar o painel admin');
        return;
      }
      
      // Salva no localStorage
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
      localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
      
      // Callback para app
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fallback da logo caso a imagem não carregue
  const LogoFallback = () => (
    <div 
      className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold"
      style={{ width: LOGIN_CONFIG.logoSize, height: LOGIN_CONFIG.logoSize }}
    >
      GC
    </div>
  );

  return (
    <div className="login-page">
      {/* ========== ESTILOS INLINE ========== */}
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          position: relative;
          overflow: hidden;
        }
        
        .login-background {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-image: url('${LOGIN_CONFIG.background}');
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          z-index: 0;
        }
        
        .login-background::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.3);
          z-index: 1;
        }
        
        .login-card {
          position: relative;
          z-index: 10;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          box-shadow: 
            0 25px 50px -12px rgba(0, 0, 0, 0.4),
            0 0 0 1px rgba(255, 255, 255, 0.1);
          padding: 2.5rem;
          width: 100%;
          max-width: 420px;
          animation: slideUp 0.5s ease-out;
        }
        
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .login-logo {
          width: ${LOGIN_CONFIG.logoSize}px;
          height: ${LOGIN_CONFIG.logoSize}px;
          object-fit: contain;
          margin: 0 auto;
          display: block;
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1));
          transition: transform 0.3s ease;
        }
        
        .login-logo:hover {
          transform: scale(1.05);
        }
        
        .login-title {
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
          text-align: center;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        
        .login-subtitle {
          color: #6b7280;
          text-align: center;
          font-size: 0.95rem;
          margin-bottom: 2rem;
        }
        
        .login-input-group {
          margin-bottom: 1.25rem;
        }
        
        .login-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.5rem;
        }
        
        .login-input-wrapper {
          position: relative;
        }
        
        .login-input {
          width: 100%;
          padding: 0.875rem 1rem;
          padding-left: 2.75rem;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.2s ease;
          background: #f9fafb;
        }
        
        .login-input:focus {
          outline: none;
          border-color: #6366f1;
          background: white;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
        }
        
        .login-input-icon {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
          width: 20px;
          height: 20px;
        }
        
        .login-password-toggle {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .login-password-toggle:hover {
          color: #6b7280;
        }
        
        .login-button {
          width: 100%;
          padding: 0.95rem;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          color: white;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-top: 0.5rem;
          position: relative;
          overflow: hidden;
        }
        
        .login-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s ease;
        }
        
        .login-button:hover::before {
          left: 100%;
        }
        
        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .login-error {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          color: #dc2626;
          padding: 1rem;
          border-radius: 8px;
          margin-bottom: 1.5rem;
          font-size: 0.9rem;
          animation: shake 0.5s ease;
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .login-footer {
          text-align: center;
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid #e5e7eb;
        }
        
        .login-footer-text {
          font-size: 0.8rem;
          color: #9ca3af;
        }

        /* Responsivo */
        @media (max-width: 480px) {
          .login-card {
            padding: 1.5rem;
            margin: 0.5rem;
          }
          
          .login-title {
            font-size: 1.5rem;
          }
        }
      `}</style>

      {/* ========== BACKGROUND ========== */}
      <div className="login-background"></div>

      {/* ========== CARD DE LOGIN ========== */}
      <div className="login-card">
        {/* Logo */}
        <div className="text-center">
          {!logoError ? (
            <img 
              src={LOGIN_CONFIG.logo}
              alt="Logo"
              className="login-logo"
              onError={() => setLogoError(true)}
            />
          ) : (
            <LogoFallback />
          )}
        </div>

        {/* Título */}
        <h1 className="login-title">{LOGIN_CONFIG.title}</h1>
        <p className="login-subtitle">{LOGIN_CONFIG.subtitle}</p>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          {/* Erro */}
          {error && (
            <div className="login-error">
              <strong>Ops!</strong> {error}
            </div>
          )}

          {/* Email */}
          <div className="login-input-group">
            <label className="login-label">Email</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-input"
                placeholder="seu@email.com"
                required
                autoComplete="email"
              />
            </div>
          </div>

          {/* Senha */}
          <div className="login-input-group">
            <label className="login-label">Senha</label>
            <div className="login-input-wrapper">
              <svg className="login-input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-input"
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Botão */}
          <button
            type="submit"
            disabled={loading}
            className={`login-button bg-gradient-to-r ${LOGIN_CONFIG.buttonGradient} hover:${LOGIN_CONFIG.buttonHoverGradient}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Entrando...
              </span>
            ) : (
              'Entrar'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="login-footer">
          <p className="login-footer-text">
            © {new Date().getFullYear()} • Sistema de Gestão de Clientes
          </p>
        </div>
      </div>
    </div>
  );
}