/* ========================================
   POSTGRES - Conexão com DB Principal
   Para buscar clientes do sistema principal
   ======================================== */

import pkg from 'pg';
const { Pool } = pkg;

// Configuração da conexão PostgreSQL
const pgPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres-gestao',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'gestao_clientes',
  user: process.env.POSTGRES_USER || 'gestao_user',
  password: process.env.POSTGRES_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testar conexão
pgPool.on('connect', () => {
  console.log('✅ [PG] Conectado ao PostgreSQL principal');
});

pgPool.on('error', (err) => {
  console.error('❌ [PG] Erro no PostgreSQL:', err);
});

/**
 * Query helper
 */
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pgPool.query(text, params);
    const duration = Date.now() - start;
    console.log(`🔍 [PG] Query executada em ${duration}ms`);
    return res;
  } catch (error) {
    console.error('❌ [PG] Erro na query:', error);
    throw error;
  }
}

/**
 * Buscar clientes do usuário logado
 */
export async function getClientsByUser(userId) {
  const result = await query(`
    SELECT 
      c.id,
      c.name,
      c.whatsapp_number,
      c.username,
      c.password,
      c.due_date,
      c.is_active,
      c.user_id,
      p.name as plan_name,
      p.duration_months,
      s.name as server_name
    FROM clients c
    LEFT JOIN plans p ON c.plan_id = p.id
    LEFT JOIN servers s ON c.server_id = s.id
    WHERE c.user_id = $1
    ORDER BY c.due_date ASC
  `, [userId]);

  return result.rows;
}

/**
 * Buscar estatísticas de clientes do usuário
 */
export async function getClientStatsByUser(userId) {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) as inactive,
      SUM(CASE WHEN due_date < CURRENT_DATE THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 1 ELSE 0 END) as expiring_soon
    FROM clients
    WHERE user_id = $1
  `, [userId]);

  return result.rows[0];
}

/**
 * Sincronizar cliente com CloudNation (atualiza username)
 */
export async function syncClientWithCloudNation(clientId, userId, cloudnationId) {
  const result = await query(`
    UPDATE clients 
    SET username = $1, updated_at = NOW()
    WHERE id = $2 AND user_id = $3
    RETURNING *
  `, [cloudnationId, clientId, userId]);

  return result.rows[0];
}

export default pgPool;
