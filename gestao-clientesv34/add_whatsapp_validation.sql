-- ==========================================
-- MIGRATION: WHATSAPP VALIDATION
-- Arquivo: add_whatsapp_validation.sql
-- 
-- FASE 3: Adiciona colunas para rastrear
-- status de validação do WhatsApp
-- ==========================================

-- 1. ADICIONAR COLUNAS NA TABELA CLIENTS
-- ==========================================

-- Coluna para indicar se WhatsApp é válido
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'whatsapp_valid'
  ) THEN
    ALTER TABLE clients ADD COLUMN whatsapp_valid BOOLEAN DEFAULT true;
    RAISE NOTICE '✅ Coluna whatsapp_valid adicionada';
  ELSE
    RAISE NOTICE '⏭️  Coluna whatsapp_valid já existe';
  END IF;
END $$;

-- Coluna para armazenar mensagem de erro
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'whatsapp_error'
  ) THEN
    ALTER TABLE clients ADD COLUMN whatsapp_error TEXT;
    RAISE NOTICE '✅ Coluna whatsapp_error adicionada';
  ELSE
    RAISE NOTICE '⏭️  Coluna whatsapp_error já existe';
  END IF;
END $$;

-- Coluna para data da última verificação
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'whatsapp_checked_at'
  ) THEN
    ALTER TABLE clients ADD COLUMN whatsapp_checked_at TIMESTAMP;
    RAISE NOTICE '✅ Coluna whatsapp_checked_at adicionada';
  ELSE
    RAISE NOTICE '⏭️  Coluna whatsapp_checked_at já existe';
  END IF;
END $$;

-- Coluna para número validado do WhatsApp (número correto)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'clients' AND column_name = 'whatsapp_validated_number'
  ) THEN
    ALTER TABLE clients ADD COLUMN whatsapp_validated_number VARCHAR(20);
    RAISE NOTICE '✅ Coluna whatsapp_validated_number adicionada';
  ELSE
    RAISE NOTICE '⏭️  Coluna whatsapp_validated_number já existe';
  END IF;
END $$;

-- 2. CRIAR ÍNDICES PARA PERFORMANCE
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_valid 
ON clients(whatsapp_valid);

CREATE INDEX IF NOT EXISTS idx_clients_whatsapp_valid_user 
ON clients(user_id, whatsapp_valid);

-- 3. CRIAR VIEW PARA CLIENTES COM PROBLEMAS
-- ==========================================

CREATE OR REPLACE VIEW vw_clients_invalid_whatsapp AS
SELECT 
  c.id,
  c.user_id,
  c.name,
  c.whatsapp_number,
  c.whatsapp_error,
  c.whatsapp_checked_at,
  c.is_active,
  c.due_date
FROM clients c
WHERE c.whatsapp_valid = false
ORDER BY c.whatsapp_checked_at DESC;

-- 4. FUNÇÃO PARA RESETAR STATUS DE VALIDAÇÃO
-- ==========================================

CREATE OR REPLACE FUNCTION reset_whatsapp_validation(p_client_id INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE clients 
  SET 
    whatsapp_valid = true,
    whatsapp_error = NULL,
    whatsapp_checked_at = NULL,
    whatsapp_validated_number = NULL
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

-- 5. VERIFICAR RESULTADO
-- ==========================================

DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns 
  WHERE table_name = 'clients' 
  AND column_name IN ('whatsapp_valid', 'whatsapp_error', 'whatsapp_checked_at', 'whatsapp_validated_number');
  
  RAISE NOTICE '';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '✅ MIGRATION CONCLUÍDA!';
  RAISE NOTICE '==========================================';
  RAISE NOTICE 'Colunas adicionadas: %/4', col_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Novas colunas:';
  RAISE NOTICE '  - whatsapp_valid (BOOLEAN)';
  RAISE NOTICE '  - whatsapp_error (TEXT)';
  RAISE NOTICE '  - whatsapp_checked_at (TIMESTAMP)';
  RAISE NOTICE '  - whatsapp_validated_number (VARCHAR)';
  RAISE NOTICE '';
  RAISE NOTICE 'View criada: vw_clients_invalid_whatsapp';
  RAISE NOTICE 'Função criada: reset_whatsapp_validation(client_id)';
  RAISE NOTICE '==========================================';
END $$;
