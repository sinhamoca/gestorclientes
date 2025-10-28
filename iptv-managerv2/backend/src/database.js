/* ========================================
   DATABASE - SQLITE SETUP - COM SIGMA
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

// ========== NOVAS TABELAS SIGMA ==========

// Tabela de credenciais Sigma (múltiplos domínios)
db.exec(`
  CREATE TABLE IF NOT EXISTS sigma_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, domain)
  )
`);

// Tabela de pacotes Sigma capturados
db.exec(`
  CREATE TABLE IF NOT EXISTS sigma_packages (
    id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    nome TEXT NOT NULL,
    duracao INTEGER NOT NULL,
    duracao_tipo TEXT NOT NULL,
    conexoes INTEGER NOT NULL,
    servidor_id TEXT,
    servidor_nome TEXT,
    status TEXT,
    preco REAL,
    creditos INTEGER,
    is_teste TEXT,
    is_mag TEXT,
    is_restreamer TEXT,
    raw_json TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, domain, id)
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
  
  CREATE INDEX IF NOT EXISTS idx_sigma_credentials_user_id
  ON sigma_credentials(user_id);
  
  CREATE INDEX IF NOT EXISTS idx_sigma_packages_user_domain
  ON sigma_packages(user_id, domain);
  
  CREATE INDEX IF NOT EXISTS idx_sigma_packages_status
  ON sigma_packages(status);
`);

console.log('✅ [DB] Tabelas criadas/verificadas (CloudNation + Sigma)');

// ============= FUNÇÕES HELPERS - CLOUDNATION =============

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

export function getCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, username, password, created_at, updated_at
    FROM cloudnation_credentials
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

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

export function deleteUserData(userId) {
  const stmt = db.prepare('DELETE FROM cloudnation_credentials WHERE user_id = ?');
  return stmt.run(userId);
}

// ============= FUNÇÕES HELPERS - SIGMA =============

/**
 * Salvar credencial Sigma
 */
export function saveSigmaCredential(userId, domain, username, password) {
  const stmt = db.prepare(`
    INSERT INTO sigma_credentials (user_id, domain, username, password)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, domain) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, domain, username, password);
}

/**
 * Buscar todas as credenciais Sigma de um usuário
 */
export function getSigmaCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, domain, username, password, created_at, updated_at
    FROM sigma_credentials
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(userId);
}

/**
 * Buscar credencial específica por domínio
 */
export function getSigmaCredentialByDomain(userId, domain) {
  const stmt = db.prepare(`
    SELECT id, user_id, domain, username, password, created_at, updated_at
    FROM sigma_credentials
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.get(userId, domain);
}

/**
 * Deletar credencial Sigma
 */
export function deleteSigmaCredential(userId, domain) {
  const stmt = db.prepare('DELETE FROM sigma_credentials WHERE user_id = ? AND domain = ?');
  return stmt.run(userId, domain);
}

/**
 * Salvar pacotes Sigma (substitui pacotes antigos do mesmo domínio)
 */
export function saveSigmaPackages(userId, domain, packages) {
  // Deletar pacotes antigos deste domínio
  const deleteStmt = db.prepare('DELETE FROM sigma_packages WHERE user_id = ? AND domain = ?');
  deleteStmt.run(userId, domain);
  
  // Inserir novos pacotes
  const insertStmt = db.prepare(`
    INSERT INTO sigma_packages 
    (id, user_id, domain, nome, duracao, duracao_tipo, conexoes, servidor_id, servidor_nome, 
     status, preco, creditos, is_teste, is_mag, is_restreamer, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((pkgList) => {
    for (const pkg of pkgList) {
      insertStmt.run(
        pkg.id,
        userId,
        domain,
        pkg.nome,
        pkg.duracao,
        pkg.duracao_tipo,
        pkg.conexoes,
        pkg.servidor_id || null,
        pkg.servidor_nome || null,
        pkg.status || null,
        pkg.preco || 0,
        pkg.creditos || 0,
        pkg.is_teste || 'NO',
        pkg.is_mag || 'NO',
        pkg.is_restreamer || 'NO',
        JSON.stringify(pkg)
      );
    }
  });
  
  return transaction(packages);
}

/**
 * Buscar pacotes Sigma por domínio
 */
export function getSigmaPackages(userId, domain) {
  const stmt = db.prepare(`
    SELECT 
      id, user_id, domain, nome, duracao, duracao_tipo, conexoes,
      servidor_id, servidor_nome, status, preco, creditos,
      is_teste, is_mag, is_restreamer, captured_at
    FROM sigma_packages
    WHERE user_id = ? AND domain = ?
    ORDER BY nome ASC
  `);
  
  return stmt.all(userId, domain);
}

/**
 * Buscar estatísticas de pacotes Sigma
 */
export function getSigmaPackageStats(userId, domain) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN is_teste = 'YES' THEN 1 ELSE 0 END) as trial,
      MAX(captured_at) as last_capture
    FROM sigma_packages
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.get(userId, domain);
}

/**
 * Buscar domínios Sigma com pacotes
 */
export function getSigmaDomainsWithPackages(userId) {
  const stmt = db.prepare(`
    SELECT DISTINCT domain, COUNT(*) as package_count, MAX(captured_at) as last_capture
    FROM sigma_packages
    WHERE user_id = ?
    GROUP BY domain
    ORDER BY last_capture DESC
  `);
  
  return stmt.all(userId);
}

export default db;
