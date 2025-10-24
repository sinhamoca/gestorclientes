// gestao-clientesv4/src/config/database.js
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
    console.log('🔄 Inicializando banco de dados...');

    // ========== TABELA DE USUÁRIOS ==========
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
        messages_per_minute INTEGER DEFAULT 5,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ========== TABELA DE PLANOS ==========
    await query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        duration_months INTEGER NOT NULL,
        num_screens INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // ========== TABELA DE SERVIDORES ==========
    await query(`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        cost_per_screen DECIMAL(10,2) NOT NULL,
        multiply_by_screens BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // ========== TABELA DE CLIENTES ==========
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

    // Adiciona coluna payment_token se não existir (para bancos existentes)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'payment_token'
        ) THEN
          ALTER TABLE clients ADD COLUMN payment_token VARCHAR(100) UNIQUE;
        END IF;
      END $$;
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

    // ========== TABELA DE TEMPLATES DE MENSAGENS ==========
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

    // ========== TABELA DE LEMBRETES ==========
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

    // ========== TABELA DE LOG DE MENSAGENS ENVIADAS ==========
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

    // ========== TABELA DE INSTÂNCIAS WHATSAPP ==========
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

    // ========== TABELA DE FILA DE MENSAGENS ==========
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

    // ========== TABELA DE TRANSAÇÕES FINANCEIRAS ==========
    await query(`
      CREATE TABLE IF NOT EXISTS financial_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        
        type VARCHAR(20) NOT NULL,
        
        amount_received DECIMAL(10,2) NOT NULL,
        server_cost DECIMAL(10,2) NOT NULL,
        net_profit DECIMAL(10,2) NOT NULL,
        
        due_date DATE NOT NULL,
        paid_date DATE,
        status VARCHAR(20) DEFAULT 'pending',
        
        payment_method VARCHAR(50),
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Adiciona colunas de pagamento se não existirem (para bancos existentes)
    await query(`
      DO $$ 
      BEGIN
        -- payment_gateway
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'financial_transactions' AND column_name = 'payment_gateway'
        ) THEN
          ALTER TABLE financial_transactions ADD COLUMN payment_gateway VARCHAR(50);
        END IF;
        
        -- gateway_payment_id
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'financial_transactions' AND column_name = 'gateway_payment_id'
        ) THEN
          ALTER TABLE financial_transactions ADD COLUMN gateway_payment_id VARCHAR(255);
        END IF;
        
        -- payment_session_id
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'financial_transactions' AND column_name = 'payment_session_id'
        ) THEN
          ALTER TABLE financial_transactions ADD COLUMN payment_session_id INTEGER;
        END IF;
      END $$;
    `);

    // ========== TABELA DE SESSÕES DE PAGAMENTO ==========
    await query(`
      CREATE TABLE IF NOT EXISTS payment_sessions (
        id SERIAL PRIMARY KEY,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        payment_token VARCHAR(100) NOT NULL,
        session_token VARCHAR(100) UNIQUE NOT NULL,
        
        mercadopago_preference_id VARCHAR(255),
        mercadopago_payment_id VARCHAR(255),
        mercadopago_init_point TEXT,
        
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'BRL',
        
        status VARCHAR(20) DEFAULT 'pending',
        payment_method VARCHAR(50),
        
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP,
        paid_at TIMESTAMP,
        
        metadata JSONB
      );
    `);

    // ========== TABELA DE CONFIGURAÇÕES DE PAGAMENTO ==========
    await query(`
      CREATE TABLE IF NOT EXISTS payment_settings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
        
        mercadopago_enabled BOOLEAN DEFAULT false,
        mercadopago_access_token TEXT,
        mercadopago_public_key TEXT,
        
        payment_domain VARCHAR(255),
        session_expiration_hours INTEGER DEFAULT 24,
        
        send_confirmation_whatsapp BOOLEAN DEFAULT true,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ========== FUNÇÃO PARA GERAR TOKEN ÚNICO ==========
    await query(`
      CREATE OR REPLACE FUNCTION generate_payment_token()
      RETURNS VARCHAR(100) AS $$
      DECLARE
        new_token VARCHAR(100);
        token_exists BOOLEAN;
      BEGIN
        LOOP
          new_token := md5(random()::text || clock_timestamp()::text);
          SELECT EXISTS(SELECT 1 FROM clients WHERE payment_token = new_token) INTO token_exists;
          IF NOT token_exists THEN
            RETURN new_token;
          END IF;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ========== TRIGGER PARA GERAR TOKEN AUTOMATICAMENTE ==========
    await query(`
      CREATE OR REPLACE FUNCTION set_payment_token()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.payment_token IS NULL THEN
          NEW.payment_token := generate_payment_token();
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await query(`
      DROP TRIGGER IF EXISTS trigger_set_payment_token ON clients;
    `);

    await query(`
      CREATE TRIGGER trigger_set_payment_token
      BEFORE INSERT ON clients
      FOR EACH ROW
      EXECUTE FUNCTION set_payment_token();
    `);

    // ========== GERAR TOKENS PARA CLIENTES EXISTENTES ==========
    await query(`
      UPDATE clients 
      SET payment_token = md5(random()::text || id::text || NOW()::text)
      WHERE payment_token IS NULL;
    `);

    // ========== ADICIONAR FOREIGN KEY NA FINANCIAL_TRANSACTIONS ==========
    // (Só depois de criar payment_sessions E adicionar a coluna!)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_payment_session' AND table_name = 'financial_transactions'
        ) THEN
          ALTER TABLE financial_transactions
          ADD CONSTRAINT fk_payment_session
          FOREIGN KEY (payment_session_id) REFERENCES payment_sessions(id);
        END IF;
      END $$;
    `);

    // ========== ÍNDICES PARA PERFORMANCE ==========
    
    // Índices de clientes
    await query(`CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_clients_due_date ON clients(due_date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_clients_payment_token ON clients(payment_token);`);
    
    // Índices de planos e servidores
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);`);
    
    // Índices de templates e lembretes
    await query(`CREATE INDEX IF NOT EXISTS idx_templates_user_id ON message_templates(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);`);
    
    // Índices de logs
    await query(`CREATE INDEX IF NOT EXISTS idx_message_logs_client_id ON message_logs(client_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_message_logs_sent_at ON message_logs(sent_at);`);
    
    // Índices de WhatsApp
    await query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_user_id ON whatsapp_instances(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_status ON whatsapp_instances(status);`);
    
    // Índices da fila
    await query(`CREATE INDEX IF NOT EXISTS idx_queue_status_scheduled ON message_queue(status, scheduled_for);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_queue_user_status ON message_queue(user_id, status);`);
    
    // Índices de transações financeiras
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON financial_transactions(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_paid_date ON financial_transactions(paid_date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON financial_transactions(status);`);
    
    // Índices de sessões de pagamento
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_sessions_client_id ON payment_sessions(client_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_sessions_payment_token ON payment_sessions(payment_token);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_sessions_session_token ON payment_sessions(session_token);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_payment_sessions_mercadopago_payment_id ON payment_sessions(mercadopago_payment_id);`);

    // ========== TABELA DE PAGAMENTOS DE RENOVAÇÃO DE USUÁRIOS ==========
    await query(`
      CREATE TABLE IF NOT EXISTS user_subscription_payments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Dados do pagamento
        mercadopago_payment_id VARCHAR(255) UNIQUE,
        amount DECIMAL(10,2) NOT NULL,
        days_added INTEGER NOT NULL DEFAULT 30,
        
        -- Status
        status VARCHAR(20) DEFAULT 'pending',
        payment_method VARCHAR(50) DEFAULT 'pix',
        
        -- Datas
        created_at TIMESTAMP DEFAULT NOW(),
        paid_at TIMESTAMP,
        
        -- Info adicional
        previous_subscription_end DATE,
        new_subscription_end DATE,
        
        metadata JSONB
      );
    `);

    // ========== ÍNDICES PARA RENOVAÇÃO DE USUÁRIOS ==========
    await query(`CREATE INDEX IF NOT EXISTS idx_user_subscription_payments_user_id ON user_subscription_payments(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_subscription_payments_status ON user_subscription_payments(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_subscription_payments_mp_id ON user_subscription_payments(mercadopago_payment_id);`);

  // ========================================
  // E ATUALIZE O CONSOLE.LOG NO FINAL para incluir a nova tabela:
  // ========================================

    console.log('✅ Database initialized successfully!');
    console.log('   📊 Tabelas criadas: users, plans, servers, clients');
    console.log('   📧 Tabelas criadas: message_templates, reminders, message_logs, message_queue');
    console.log('   💬 Tabelas criadas: whatsapp_instances');
    console.log('   💰 Tabelas criadas: financial_transactions');
    console.log('   💳 Tabelas criadas: payment_sessions, payment_settings');
    console.log('   🔄 Tabelas criadas: user_subscription_payments'); // ← ADICIONE ESTA LINHA
    console.log('   🔧 Funções criadas: generate_payment_token(), set_payment_token()');
    console.log('   ⚡ Triggers criados: trigger_set_payment_token');
    console.log('');
    console.log('🎉 Sistema 100% pronto! Banco, Pagamentos e Automação!');

    // ========== CRIAR ADMIN PADRÃO ==========
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

    console.log('✅ Database initialized successfully!');
    console.log('   📊 Tabelas criadas: users, plans, servers, clients');
    console.log('   📧 Tabelas criadas: message_templates, reminders, message_logs, message_queue');
    console.log('   💬 Tabelas criadas: whatsapp_instances');
    console.log('   💰 Tabelas criadas: financial_transactions');
    console.log('   💳 Tabelas criadas: payment_sessions, payment_settings');
    console.log('   🔧 Funções criadas: generate_payment_token(), set_payment_token()');
    console.log('   ⚡ Triggers criados: trigger_set_payment_token');
    console.log('');
    console.log('🎉 Sistema 100% pronto! Banco, Pagamentos e Automação!');

  } catch (error) {
    console.error('❌ Database init error:', error);
    throw error;
  }
}