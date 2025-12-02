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
       
    // ========== CONFIGURAR TIMEZONE PARA BRASIL ==========
    await query(`SET timezone = 'America/Sao_Paulo';`);
    console.log('🌎 Timezone configurado: America/Sao_Paulo (UTC-3)');

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

    // ========== ADICIONAR CAMPOS DE CRIPTOGRAFIA NA TABELA USERS ==========
    await query(`
      DO $$ 
      BEGIN
        -- encryption_salt
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'encryption_salt'
        ) THEN
          ALTER TABLE users ADD COLUMN encryption_salt VARCHAR(32);
          RAISE NOTICE '✅ Coluna encryption_salt adicionada à tabela users';
        END IF;
        
        -- test_encrypted
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'test_encrypted'
        ) THEN
          ALTER TABLE users ADD COLUMN test_encrypted TEXT;
          RAISE NOTICE '✅ Coluna test_encrypted adicionada à tabela users';
        END IF;
      END $$;
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_users_encryption_salt ON users(encryption_salt);`);
    console.log('🔐 Campos de criptografia verificados na tabela users');

    // ========== TABELA DE PLANOS ==========
    await query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        duration_months INTEGER NOT NULL,
        num_screens INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, name)
      );
    `);

    // ========== ADICIONAR COLUNAS PLANO SIGMA E LIVE21 (SE NÃO EXISTIREM) ==========
    await query(`
      DO $$ 
      BEGIN
        -- is_sigma_plan
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'is_sigma_plan'
        ) THEN
          ALTER TABLE plans ADD COLUMN is_sigma_plan BOOLEAN DEFAULT false;
        END IF;
        
        -- sigma_plan_code
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'sigma_plan_code'
        ) THEN
          ALTER TABLE plans ADD COLUMN sigma_plan_code VARCHAR(100);
        END IF;
        
        -- sigma_domain
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'sigma_domain'
        ) THEN
          ALTER TABLE plans ADD COLUMN sigma_domain VARCHAR(255);
        END IF;
        
        -- is_live21_plan (CloudNation) ← ADICIONE ESTE BLOCO AQUI
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'is_live21_plan'
        ) THEN
          ALTER TABLE plans ADD COLUMN is_live21_plan BOOLEAN DEFAULT false;
        END IF;

        -- is_koffice_plan (Koffice)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'is_koffice_plan'
        ) THEN
          ALTER TABLE plans ADD COLUMN is_koffice_plan BOOLEAN DEFAULT false;
        END IF;

        -- is_uniplay_plan (Uniplay)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'is_uniplay_plan'
        ) THEN
          ALTER TABLE plans ADD COLUMN is_uniplay_plan BOOLEAN DEFAULT false;
        END IF;

        -- is_club_plan (Club/Dashboard.bz)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'is_club_plan'
        ) THEN
          ALTER TABLE plans ADD COLUMN is_club_plan BOOLEAN DEFAULT false;
        END IF;
        
        -- is_rush_plan (Rush/RushPlay)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'is_rush_plan'
        ) THEN
          ALTER TABLE plans ADD COLUMN is_rush_plan BOOLEAN DEFAULT false;
        END IF;

        -- rush_type (IPTV ou P2P)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'rush_type'
        ) THEN
          ALTER TABLE plans ADD COLUMN rush_type VARCHAR(10);
        END IF;

        -- updated_at
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'updated_at'
        ) THEN
          ALTER TABLE plans ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
        END IF;

        -- koffice_domain
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'plans' AND column_name = 'koffice_domain'
        ) THEN
          ALTER TABLE plans ADD COLUMN koffice_domain VARCHAR(255);
        END IF;
      END $$;
    `);

    // Criar índices para buscar planos sigma e live21
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_is_sigma ON plans(is_sigma_plan);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_is_live21 ON plans(is_live21_plan);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_is_koffice ON plans(is_koffice_plan);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_is_uniplay ON plans(is_uniplay_plan);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_is_club ON plans(is_club_plan);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_plans_is_rush ON plans(is_rush_plan);`);

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
        suffix VARCHAR(255),
        password VARCHAR(100),
        mac_address VARCHAR(50),
        device_key VARCHAR(100),
        notes TEXT,
        
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ========== ADICIONAR CAMPOS DE CRIPTOGRAFIA NA TABELA CLIENTS ==========
    await query(`
      DO $$ 
      BEGIN
        -- whatsapp_number_encrypted (E2E - chave do usuário)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'whatsapp_number_encrypted'
        ) THEN
          ALTER TABLE clients ADD COLUMN whatsapp_number_encrypted TEXT;
          RAISE NOTICE '✅ Coluna whatsapp_number_encrypted adicionada à tabela clients';
        END IF;
        
        -- whatsapp_number_internal (Sistema - chave do backend) 🔐 NOVO
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'whatsapp_number_internal'
        ) THEN
          ALTER TABLE clients ADD COLUMN whatsapp_number_internal TEXT;
          RAISE NOTICE '✅ Coluna whatsapp_number_internal adicionada à tabela clients';
        END IF;

        -- suffix (para Uniplay/Rush/PainelFoda)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'suffix'
        ) THEN
          ALTER TABLE clients ADD COLUMN suffix VARCHAR(255);
        END IF;
        
        -- phone_encrypted
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'phone_encrypted'
        ) THEN
          ALTER TABLE clients ADD COLUMN phone_encrypted TEXT;
          RAISE NOTICE '✅ Coluna phone_encrypted adicionada à tabela clients';
        END IF;
        
        -- Remover constraint NOT NULL do whatsapp_number
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' 
          AND column_name = 'whatsapp_number' 
          AND is_nullable = 'NO'
        ) THEN
          ALTER TABLE clients ALTER COLUMN whatsapp_number DROP NOT NULL;
          RAISE NOTICE '✅ Constraint NOT NULL removida de whatsapp_number';
        END IF;
      END $$;
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_encrypted ON clients(whatsapp_number_encrypted);`);
    console.log('🔐 Campos de criptografia verificados na tabela clients');

    // ========== ADICIONAR CAMPOS DE PLAYER (PLAYLIST MANAGER) ==========
    await query(`
      DO $$ 
      BEGIN
        -- player_type (tipo do aplicativo: iboplayer, ibopro, vuplayer)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'player_type'
        ) THEN
          ALTER TABLE clients ADD COLUMN player_type VARCHAR(20);
          RAISE NOTICE '✅ Coluna player_type adicionada à tabela clients';
        END IF;
        
        -- player_domain (domínio do IBOPlayer: iboiptv.com, bobplayer.com, etc)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'clients' AND column_name = 'player_domain'
        ) THEN
          ALTER TABLE clients ADD COLUMN player_domain VARCHAR(100);
          RAISE NOTICE '✅ Coluna player_domain adicionada à tabela clients';
        END IF;
      END $$;
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_clients_player_type ON clients(player_type);`);
    console.log('📺 Campos de player verificados na tabela clients');

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
        send_once BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Adicionar coluna send_once se não existir (para bancos existentes)
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'reminders' AND column_name = 'send_once'
        ) THEN
          ALTER TABLE reminders ADD COLUMN send_once BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);

    // ========== TABELA DE LOG DE LEMBRETES ENVIADOS ==========
    await query(`
      CREATE TABLE IF NOT EXISTS reminder_sent_log (
        id SERIAL PRIMARY KEY,
        reminder_id INTEGER REFERENCES reminders(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
        sent_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(reminder_id, client_id)
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_reminder_sent_log_reminder ON reminder_sent_log(reminder_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reminder_sent_log_client ON reminder_sent_log(client_id);`);

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


    // ========== ADICIONAR COLUNA PROVIDER (MULTI-API WHATSAPP) ==========
    await query(`
      DO $$ 
      BEGIN
        -- Adicionar coluna provider se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'whatsapp_instances' AND column_name = 'provider'
        ) THEN
          ALTER TABLE whatsapp_instances 
          ADD COLUMN provider VARCHAR(50) DEFAULT 'wppconnect';
          
          RAISE NOTICE '✅ Coluna provider adicionada à tabela whatsapp_instances';
        END IF;
      END $$;
    `);

    // Criar índice para busca por provider
    await query(`
      CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_provider 
      ON whatsapp_instances(provider);
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

    // Adicionar coluna send_once na fila
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'message_queue' AND column_name = 'send_once'
        ) THEN
          ALTER TABLE message_queue ADD COLUMN send_once BOOLEAN DEFAULT false;
        END IF;
      END $$;
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
        paid_date TIMESTAMP,
        status VARCHAR(20) DEFAULT 'pending',
        
        payment_method VARCHAR(50),
        payment_gateway VARCHAR(50),
        gateway_payment_id VARCHAR(255),
        payment_session_id INTEGER,
        unitv_code_id INTEGER,
        notes TEXT,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ========== FOREIGN KEYS DE TRANSAÇÕES ==========
    await query(`
      DO $$ 
      BEGIN
        -- FK para payment_sessions
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'fk_payment_session' 
          AND table_name = 'financial_transactions'
        ) THEN
          ALTER TABLE financial_transactions
          ADD CONSTRAINT fk_payment_session
          FOREIGN KEY (payment_session_id) 
          REFERENCES payment_sessions(id) 
          ON DELETE SET NULL;
        END IF;

        -- FK para unitv_codes (se tabela existir)
        IF EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'unitv_codes'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_unitv_code' 
            AND table_name = 'financial_transactions'
          ) THEN
            ALTER TABLE financial_transactions
            ADD CONSTRAINT fk_unitv_code
            FOREIGN KEY (unitv_code_id) 
            REFERENCES unitv_codes(id) 
            ON DELETE SET NULL;
          END IF;
        END IF;
      END $$;
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

        -- ← ADICIONAR ESTE BLOCO AQUI:
        -- unitv_code_id (vínculo com código UniTV entregue)
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'financial_transactions' AND column_name = 'unitv_code_id'
        ) THEN
          ALTER TABLE financial_transactions ADD COLUMN unitv_code_id INTEGER REFERENCES unitv_codes(id) ON DELETE SET NULL;
          RAISE NOTICE '✅ Coluna unitv_code_id adicionada';
        END IF;
      END $$;
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_financial_transactions_unitv_code ON financial_transactions(unitv_code_id);`);

    // ========== TABELA DE RELACIONAMENTO TRANSAÇÃO <-> CÓDIGOS UNITV ==========
    // Permite vincular múltiplos códigos UniTV a uma única transação
    await query(`
      CREATE TABLE IF NOT EXISTS transaction_unitv_codes (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER NOT NULL REFERENCES financial_transactions(id) ON DELETE CASCADE,
        unitv_code_id INTEGER NOT NULL REFERENCES unitv_codes(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(transaction_id, unitv_code_id)
      );
    `);

    await query(`CREATE INDEX IF NOT EXISTS idx_transaction_codes_transaction ON transaction_unitv_codes(transaction_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transaction_codes_code ON transaction_unitv_codes(unitv_code_id);`);

    console.log('✅ Tabela transaction_unitv_codes verificada');

    // ========== CORREÇÃO: FK client_id com SET NULL (não CASCADE) ==========
    await query(`
      DO $$ 
      BEGIN
        -- Adicionar coluna client_name se não existir
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'financial_transactions' AND column_name = 'client_name'
        ) THEN
          ALTER TABLE financial_transactions ADD COLUMN client_name VARCHAR(255);
          RAISE NOTICE '✅ Coluna client_name adicionada em financial_transactions';
        END IF;

        -- Verificar se a FK existe com CASCADE e corrigir para SET NULL
        IF EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'financial_transactions_client_id_fkey' 
          AND confdeltype = 'c'  -- 'c' = CASCADE
        ) THEN
          -- Remover FK antiga (CASCADE)
          ALTER TABLE financial_transactions 
          DROP CONSTRAINT financial_transactions_client_id_fkey;
          
          -- Adicionar FK nova (SET NULL)
          ALTER TABLE financial_transactions 
          ADD CONSTRAINT financial_transactions_client_id_fkey 
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;
          
          RAISE NOTICE '✅ FK client_id alterada de CASCADE para SET NULL';
        END IF;

        -- Garantir que client_id permite NULL
        ALTER TABLE financial_transactions 
        ALTER COLUMN client_id DROP NOT NULL;
        
      END $$;
    `);

    // Preencher client_name para transações existentes que não têm
    await query(`
      UPDATE financial_transactions ft
      SET client_name = c.name
      FROM clients c
      WHERE ft.client_id = c.id
      AND ft.client_name IS NULL;
    `);

    console.log('💰 Tabela financial_transactions verificada (FK SET NULL + client_name)');


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
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON financial_transactions(client_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_paid_date ON financial_transactions(paid_date);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON financial_transactions(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_gateway_payment_id ON financial_transactions(gateway_payment_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_transactions_unitv_code_id ON financial_transactions(unitv_code_id);`);

    
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


    // ========== TABELA DE LOGS DE ATIVIDADES (NOTIFICAÇÕES) ==========
    await query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        
        -- Tipo do log: 'whatsapp', 'payment', 'renewal'
        type VARCHAR(30) NOT NULL,
        
        -- Status: 'success', 'error', 'pending'
        status VARCHAR(20) NOT NULL,
        
        -- Título curto do evento
        title VARCHAR(200) NOT NULL,
        
        -- Descrição detalhada
        description TEXT,
        
        -- Referência ao cliente (opcional)
        client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
        client_name VARCHAR(100),
        
        -- Para pagamentos
        amount DECIMAL(10,2),
        
        -- Detalhes do erro (para WhatsApp principalmente)
        error_details TEXT,
        
        -- Dados extras em JSON (provider, payment_method, etc)
        metadata JSONB,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // ========== ÍNDICES PARA ACTIVITY_LOGS ==========
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_type ON activity_logs(type);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs(status);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_client_id ON activity_logs(client_id);`);
    
    // Índice composto para busca por usuário + tipo
    await query(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_type ON activity_logs(user_id, type);`);

    console.log('📋 Tabela activity_logs criada');


  // ========================================
  // E ATUALIZE O CONSOLE.LOG NO FINAL para incluir a nova tabela:
  // ========================================

    console.log('✅ Database initialized successfully!');
    console.log('   📊 Tabelas criadas: users, plans, servers, clients');
    console.log('   📧 Tabelas criadas: message_templates, reminders, message_logs, message_queue');
    console.log('   💬 Tabelas criadas: whatsapp_instances');
    console.log('   💰 Tabelas criadas: financial_transactions');
    console.log('   💳 Tabelas criadas: payment_sessions, payment_settings');
    console.log('   🔄 Tabelas criadas: user_subscription_payments');
    console.log('   📋 Tabelas criadas: activity_logs');  // ← ADICIONAR ESTA LINHA
    console.log('   🔧 Funções criadas: generate_payment_token(), set_payment_token()');
    console.log('   ⚡ Triggers criados: trigger_set_payment_token');
    console.log('');
    console.log('🎉 Sistema 100% pronto! Banco, Pagamentos, Automação e Logs!');

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