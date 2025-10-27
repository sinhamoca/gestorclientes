/* ========================================
   DATABASE - SQLITE SETUP
   IPTV Manager - Banco de Dados Local
   ======================================== */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa banco de dados
const dbPath = path.join(__dirname, '../data/iptv_manager.db');
const db = new Database(dbPath);

// Habilita foreign keys
db.pragma('foreign_keys = ON');

console.log('📦 [DB] Conectado ao SQLite:', dbPath);

// ============= TABELAS =============

// Tabela de credenciais do CloudNation por usuário
db.exec(`
  CREATE TABLE IF NOT EXISTS cloudnation_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabela de clientes importados do CloudNation
db.exec(`
  CREATE TABLE IF NOT EXISTS cloudnation_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    creation_date TEXT,
    expiration_date TEXT NOT NULL,
    expiration_timestamp INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES cloudnation_credentials(user_id) ON DELETE CASCADE,
    UNIQUE(user_id, client_id)
  )
`);

// Índices para performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_cloudnation_clients_user_id 
  ON cloudnation_clients(user_id);
  
  CREATE INDEX IF NOT EXISTS idx_cloudnation_clients_is_active 
  ON cloudnation_clients(is_active);
  
  CREATE INDEX IF NOT EXISTS idx_cloudnation_clients_expiration 
  ON cloudnation_clients(expiration_timestamp);
`);

console.log('✅ [DB] Tabelas criadas/verificadas');

// ============= FUNÇÕES HELPERS =============

/**
 * Salvar ou atualizar credenciais do CloudNation
 */
export function saveCredentials(userId, username, password) {
  const stmt = db.prepare(`
    INSERT INTO cloudnation_credentials (user_id, username, password)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, username, password);
}

/**
 * Buscar credenciais do CloudNation de um usuário
 */
export function getCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, username, password, created_at, updated_at
    FROM cloudnation_credentials
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

/**
 * Salvar clientes importados do CloudNation
 */
export function saveClients(userId, clients) {
  const stmt = db.prepare(`
    INSERT INTO cloudnation_clients 
    (user_id, client_id, client_name, creation_date, expiration_date, expiration_timestamp, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, client_id) DO UPDATE SET
      client_name = excluded.client_name,
      creation_date = excluded.creation_date,
      expiration_date = excluded.expiration_date,
      expiration_timestamp = excluded.expiration_timestamp,
      is_active = excluded.is_active,
      imported_at = CURRENT_TIMESTAMP
  `);
  
  const transaction = db.transaction((clientsList) => {
    for (const client of clientsList) {
      stmt.run(
        userId,
        client.id,
        client.nome,
        client.dataCriacao || null,
        client.dataVencimento,
        client.vencimentoTimestamp,
        client.isActive ? 1 : 0
      );
    }
  });
  
  return transaction(clients);
}

/**
 * Buscar clientes de um usuário
 */
export function getClients(userId, activeOnly = false) {
  let query = `
    SELECT 
      id, user_id, client_id, client_name, 
      creation_date, expiration_date, expiration_timestamp,
      is_active, imported_at
    FROM cloudnation_clients
    WHERE user_id = ?
  `;
  
  if (activeOnly) {
    query += ' AND is_active = 1';
  }
  
  query += ' ORDER BY expiration_timestamp ASC';
  
  const stmt = db.prepare(query);
  return stmt.all(userId);
}

/**
 * Buscar estatísticas de clientes
 */
export function getClientStats(userId) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
      MAX(imported_at) as last_import
    FROM cloudnation_clients
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

/**
 * Deletar credenciais e todos os clientes de um usuário
 */
export function deleteUserData(userId) {
  const stmt = db.prepare('DELETE FROM cloudnation_credentials WHERE user_id = ?');
  return stmt.run(userId);
}

export default db;
