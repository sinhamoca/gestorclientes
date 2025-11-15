function Navbar({ onLogout }) {
  return (
    <nav className="bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <i data-lucide="message-circle" className="w-8 h-8"></i>
            <div>
              <h1 className="text-xl font-bold">WhatsApp-Web.js</h1>
              <p className="text-xs text-green-100">Dashboard Admin</p>
            </div>
          </div>
          
          <button
            onClick={onLogout}
            className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
          >
            <i data-lucide="log-out" className="w-4 h-4"></i>
            <span>Sair</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
