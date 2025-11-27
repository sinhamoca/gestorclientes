const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'gestao_db',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'gestao_clientes',
  user: process.env.DB_USER || 'gestao_user',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL (gestao_clientes)');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no PostgreSQL:', err);
  process.exit(-1);
});

module.exports = pool;
