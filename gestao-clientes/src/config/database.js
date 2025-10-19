import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

export const query = (text, params) => pool.query(text, params);

export async function initDatabase() {
  try {
    // Tabela de usuários
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role VARCHAR(20) DEFAULT 'user',
        
        subscription_start DATE,
        subscription_end DATE,
        is_active BOOLEAN DEFAULT true,
        
        max_clients INTEGER DEFAULT 100,
        max_instances INTEGER DEFAULT 1,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela de planos
    await query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        duration_months INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // Tabela de valores (opcional - para usar no futuro)
    await query(`
      CREATE TABLE IF NOT EXISTS prices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        value DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela de servidores
    await query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        cost_per_screen DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // Tabela de clientes
    await query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Campos obrigatórios
        name VARCHAR(100) NOT NULL,
        whatsapp_number VARCHAR(20) NOT NULL,
        plan_id INTEGER REFERENCES plans(id) ON DELETE RESTRICT,
        server_id INTEGER REFERENCES servers(id) ON DELETE RESTRICT,
        price_value DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        
        -- Campos opcionais
        username VARCHAR(100),
        password VARCHAR(100),
        mac_address VARCHAR(50),
        device_key VARCHAR(100),
        notes TEXT,
        
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        UNIQUE(user_id, whatsapp_number)
      );
    `);

    // Índices para performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_clients_due_date ON clients(due_date);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);
    `);

    // Criar admin padrão se não existir
    const adminCheck = await query(
      "SELECT * FROM users WHERE email = 'admin@sistema.com'"
    );

    if (adminCheck.rows.length === 0) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('admin123', 10);
      
      await query(`
        INSERT INTO users (name, email, password_hash, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
      `, ['Administrador', 'admin@sistema.com', hash, 'admin', true]);
      
      console.log('✅ Admin criado: admin@sistema.com / admin123');
    }

    console.log('✅ Database initialized');
  } catch (error) {
    console.error('❌ Database init error:', error);
    throw error;
  }
}