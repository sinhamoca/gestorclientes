// gestao-clientesv2/src/config/database.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gestao_user:Gestao_DB_Pass_2025!@postgres-gestao:5432/gestao_clientes',
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

    // Adiciona coluna messages_per_minute se não existir
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'messages_per_minute'
        ) THEN
          ALTER TABLE users ADD COLUMN messages_per_minute INTEGER DEFAULT 5;
        END IF;
      END $$;
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
        
        name VARCHAR(100) NOT NULL,
        whatsapp_number VARCHAR(20) NOT NULL,
        plan_id INTEGER REFERENCES plans(id) ON DELETE RESTRICT,
        server_id INTEGER REFERENCES servers(id) ON DELETE RESTRICT,
        price_value DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        
        username VARCHAR(100),
        password VARCHAR(100),
        mac_address VARCHAR(50),
        device_key VARCHAR(100),
        notes TEXT,
        
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Remove constraint UNIQUE de whatsapp_number se existir
    await query(`
      DO $$ 
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'clients_user_id_whatsapp_number_key'
        ) THEN
          ALTER TABLE clients DROP CONSTRAINT clients_user_id_whatsapp_number_key;
        END IF;
      END $$;
    `);

    // Tabela de Templates de Mensagens
    await query(`
      CREATE TABLE IF NOT EXISTS message_templates (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // Tabela de Lembretes
    await query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        template_id INTEGER REFERENCES message_templates(id) ON DELETE CASCADE,
        days_offset INTEGER NOT NULL,
        send_time TIME DEFAULT '09:00:00',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela de Log de Mensagens Enviadas
    await query(`
      CREATE TABLE IF NOT EXISTS message_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        reminder_id INTEGER REFERENCES reminders(id) ON DELETE SET NULL,
        template_id INTEGER REFERENCES message_templates(id) ON DELETE SET NULL,
        message_sent TEXT NOT NULL,
        whatsapp_number VARCHAR(20) NOT NULL,
        sent_at TIMESTAMP DEFAULT NOW(),
        status VARCHAR(20) DEFAULT 'pending',
        error_message TEXT
      );
    `);

    // Tabela de Instâncias WhatsApp
    await query(`
      CREATE TABLE IF NOT EXISTS whatsapp_instances (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        instance_name VARCHAR(100) NOT NULL UNIQUE,
        instance_id VARCHAR(100),
        phone_number VARCHAR(20),
        status VARCHAR(20) DEFAULT 'disconnected',
        qr_code TEXT,
        qr_code_updated_at TIMESTAMP,
        connected_at TIMESTAMP,
        last_ping TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela de Fila de Mensagens (NOVA)
    await query(`
      CREATE TABLE IF NOT EXISTS message_queue (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        instance_name VARCHAR(100) NOT NULL,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        reminder_id INTEGER REFERENCES reminders(id) ON DELETE CASCADE,
        template_id INTEGER REFERENCES message_templates(id) ON DELETE CASCADE,
        whatsapp_number VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        priority INTEGER DEFAULT 0,
        scheduled_for TIMESTAMP NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP
      );
    `);

    // ========== ÍNDICES ==========
    
    await query(`CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_clients_due_date ON clients(due_date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_templates_user_id ON message_templates(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_message_logs_client_id ON message_logs(client_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs(sent_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);`);
    
    // Índices da fila (NOVOS)
    await query(`CREATE INDEX IF NOT EXISTS idx_queue_status_scheduled ON message_queue(status, scheduled_for);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_queue_user_status ON message_queue(user_id, status);`);

    // Criar admin padrão se não existir
    const adminCheck = await query(
      "SELECT * FROM users WHERE email = 'admin@sistema.com'"
    );

    if (adminCheck.rows.length === 0) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('admin123', 10);
      
      await query(`
        INSERT INTO users (name, email, password_hash, role, is_active, messages_per_minute)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['Administrador', 'admin@sistema.com', hash, 'admin', true, 10]);
      
      console.log('✅ Admin criado: admin@sistema.com / admin123');
    }

    console.log('✅ Database initialized with Queue System');
  } catch (error) {
    console.error('❌ Database init error:', error);
    throw error;
  }
}