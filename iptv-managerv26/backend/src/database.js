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

// Tabela de Credenciais Rush
db.prepare(`
  CREATE TABLE IF NOT EXISTS rush_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log('  ✅ rush_credentials');

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

// Tabela de clientes Sigma capturados (NOVA!)
db.exec(`
  CREATE TABLE IF NOT EXISTS sigma_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    id_interno TEXT NOT NULL,
    id_externo TEXT NOT NULL,
    nome TEXT NOT NULL,
    senha TEXT,
    status TEXT,
    expira_em TEXT,
    conexoes INTEGER,
    pacote TEXT,
    servidor TEXT,
    revendedor TEXT,
    tipo_conexao TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, domain, id_interno)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS koffice_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    reseller_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, domain)
  )
`);

// Tabela de Credenciais Uniplay
db.prepare(`
  CREATE TABLE IF NOT EXISTS uniplay_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log('  ✅ uniplay_credentials');

db.exec(`
  CREATE TABLE IF NOT EXISTS koffice_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    reseller_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT,
    client_name TEXT,
    created_date TEXT,
    expiry_date TEXT,
    screens INTEGER,
    reseller TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, domain, reseller_id, client_id)
  )
`);

// Tabela de Sessões Koffice (para persistência)
db.exec(`
  CREATE TABLE IF NOT EXISTS koffice_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    cookies_json TEXT,
    status TEXT DEFAULT 'active',
    login_count INTEGER DEFAULT 0,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, domain)
  )
`);

console.log('  ✅ koffice_sessions');

// Tabela para sessões CloudNation (Session Keeper)
db.exec(`
  CREATE TABLE IF NOT EXISTS cloudnation_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    domain TEXT NOT NULL,
    session_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, domain)
  )
`);

console.log('✅ Tabela cloudnation_sessions criada/verificada');

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
  
  CREATE INDEX IF NOT EXISTS idx_sigma_clients_user_domain 
  ON sigma_clients(user_id, domain);
  
  CREATE INDEX IF NOT EXISTS idx_sigma_clients_status 
  ON sigma_clients(status);
  
  CREATE INDEX IF NOT EXISTS idx_sigma_clients_id_externo 
  ON sigma_clients(id_externo);
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_koffice_credentials_user_id
  ON koffice_credentials(user_id);
  
  CREATE INDEX IF NOT EXISTS idx_koffice_credentials_domain
  ON koffice_credentials(domain);
  
  CREATE INDEX IF NOT EXISTS idx_koffice_clients_user_domain
  ON koffice_clients(user_id, domain);
  
  CREATE INDEX IF NOT EXISTS idx_koffice_clients_reseller
  ON koffice_clients(reseller_id);
  
  CREATE INDEX IF NOT EXISTS idx_koffice_clients_expiry
  ON koffice_clients(expiry_date);
`);

console.log('✅ [DB] Tabelas criadas/verificadas (CloudNation + Sigma + Sigma Clients)');

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

// ============= FUNÇÕES DE CLIENTES SIGMA (ADICIONAR NO FINAL) =============

/**
 * Salvar clientes Sigma (substitui clientes antigos do mesmo domínio)
 */
export function saveSigmaClients(userId, domain, clients) {
  // Deletar clientes antigos deste domínio
  const deleteStmt = db.prepare('DELETE FROM sigma_clients WHERE user_id = ? AND domain = ?');
  deleteStmt.run(userId, domain);
  
  // Inserir novos clientes
  const insertStmt = db.prepare(`
    INSERT INTO sigma_clients 
    (user_id, domain, id_interno, id_externo, nome, senha, status, expira_em, 
     conexoes, pacote, servidor, revendedor, tipo_conexao)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((clientList) => {
    for (const client of clientList) {
      insertStmt.run(
        userId,
        domain,
        client.id_interno,
        client.id_externo,
        client.nome,
        client.senha || null,
        client.status || null,
        client.expira_em || null,
        client.conexoes || 0,
        client.pacote || null,
        client.servidor || null,
        client.revendedor || null,
        client.tipo_conexao || null
      );
    }
  });
  
  return transaction(clients);
}

/**
 * Buscar clientes Sigma por domínio
 */
export function getSigmaClients(userId, domain) {
  const stmt = db.prepare(`
    SELECT 
      id, user_id, domain, id_interno, id_externo, nome, senha,
      status, expira_em, conexoes, pacote, servidor, revendedor,
      tipo_conexao, captured_at
    FROM sigma_clients
    WHERE user_id = ? AND domain = ?
    ORDER BY nome ASC
  `);
  
  return stmt.all(userId, domain);
}

/**
 * Buscar estatísticas de clientes Sigma
 */
export function getSigmaClientStats(userId, domain) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status != 'ACTIVE' OR status IS NULL THEN 1 ELSE 0 END) as inactive,
      MAX(captured_at) as last_capture
    FROM sigma_clients
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.get(userId, domain);
}

/**
 * Buscar domínios Sigma com clientes
 */
export function getSigmaDomainsWithClients(userId) {
  const stmt = db.prepare(`
    SELECT DISTINCT domain, COUNT(*) as client_count, MAX(captured_at) as last_capture
    FROM sigma_clients
    WHERE user_id = ?
    GROUP BY domain
    ORDER BY last_capture DESC
  `);
  
  return stmt.all(userId);
}

/**
 * Buscar cliente Sigma por id_interno
 */
export function getSigmaClientByIdInterno(userId, domain, idInterno) {
  const stmt = db.prepare(`
    SELECT *
    FROM sigma_clients
    WHERE user_id = ? AND domain = ? AND id_interno = ?
  `);
  
  return stmt.get(userId, domain, idInterno);
}

/**
 * Salvar credencial Koffice
 */
export function saveKofficeCredential(userId, domain, username, password, resellerId) {
  const stmt = db.prepare(`
    INSERT INTO koffice_credentials (user_id, domain, username, password, reseller_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, domain) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      reseller_id = excluded.reseller_id,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, domain, username, password, resellerId);
}

/**
 * Buscar todas as credenciais Koffice de um usuário
 */
export function getKofficeCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, domain, username, password, reseller_id, created_at, updated_at
    FROM koffice_credentials
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  
  return stmt.all(userId);
}

/**
 * Buscar credencial específica por ID
 */
export function getKofficeCredentialById(userId, id) {
  const stmt = db.prepare(`
    SELECT id, user_id, domain, username, password, reseller_id, created_at, updated_at
    FROM koffice_credentials
    WHERE user_id = ? AND id = ?
  `);
  
  return stmt.get(userId, id);
}

/**
 * Atualizar credencial Koffice
 */
export function updateKofficeCredential(userId, id, username, password, resellerId) {
  const stmt = db.prepare(`
    UPDATE koffice_credentials
    SET username = ?, password = ?, reseller_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND id = ?
  `);
  
  return stmt.run(username, password, resellerId, userId, id);
}

/**
 * Deletar credencial Koffice
 */
export function deleteKofficeCredential(userId, id) {
  const stmt = db.prepare('DELETE FROM koffice_credentials WHERE user_id = ? AND id = ?');
  return stmt.run(userId, id);
}

/**
 * Salvar clientes Koffice (substitui clientes antigos do mesmo domínio/reseller)
 */
export function saveKofficeClients(userId, domain, resellerId, clients) {
  // Deletar clientes antigos deste domínio + reseller
  const deleteStmt = db.prepare('DELETE FROM koffice_clients WHERE user_id = ? AND domain = ? AND reseller_id = ?');
  deleteStmt.run(userId, domain, resellerId);
  
  // Inserir novos clientes
  const insertStmt = db.prepare(`
    INSERT INTO koffice_clients 
    (user_id, domain, reseller_id, client_id, username, password, client_name,
     created_date, expiry_date, screens, reseller)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const transaction = db.transaction((clientList) => {
    for (const client of clientList) {
      insertStmt.run(
        userId,
        domain,
        resellerId,
        client.id,
        client.username,
        client.password || null,
        client.client_name || null,
        client.created_date || null,
        client.expiry_date || null,
        client.screens || 1,
        client.reseller || null
      );
    }
  });
  
  return transaction(clients);
}

/**
 * Buscar clientes Koffice por domínio
 */
export function getKofficeClients(userId, domain) {
  const stmt = db.prepare(`
    SELECT 
      id, user_id, domain, reseller_id, client_id, username, password,
      client_name, created_date, expiry_date, screens, reseller, captured_at
    FROM koffice_clients
    WHERE user_id = ? AND domain = ?
    ORDER BY client_name ASC
  `);
  
  return stmt.all(userId, domain);
}

/**
 * Buscar estatísticas de clientes Koffice
 */
export function getKofficeClientStats(userId, domain) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN DATE(expiry_date) >= DATE('now') THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN DATE(expiry_date) < DATE('now') THEN 1 ELSE 0 END) as inactive,
      MAX(captured_at) as last_capture
    FROM koffice_clients
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.get(userId, domain);
}

/**
 * Buscar domínios Koffice com clientes
 */
export function getKofficeDomainsWithClients(userId) {
  const stmt = db.prepare(`
    SELECT DISTINCT 
      domain, 
      reseller_id,
      COUNT(*) as client_count, 
      MAX(captured_at) as last_capture
    FROM koffice_clients
    WHERE user_id = ?
    GROUP BY domain, reseller_id
    ORDER BY last_capture DESC
  `);
  
  return stmt.all(userId);
}

/**
 * Salvar credencial Uniplay
 * OBS: Uniplay tem 1 credencial por usuário (domínio fixo: gesapioffice.com)
 */
export function saveUniplayCredential(userId, username, password) {
  const stmt = db.prepare(`
    INSERT INTO uniplay_credentials (user_id, username, password)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, username, password);
}

/**
 * Buscar credencial Uniplay de um usuário
 * Retorna: { id, user_id, username, password, created_at, updated_at } ou undefined
 */
export function getUniplayCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, username, password, created_at, updated_at
    FROM uniplay_credentials
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

/**
 * Atualizar credencial Uniplay
 */
export function updateUniplayCredential(userId, username, password) {
  const stmt = db.prepare(`
    UPDATE uniplay_credentials
    SET username = ?, password = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);
  
  return stmt.run(username, password, userId);
}

/**
 * Deletar credencial Uniplay
 */
export function deleteUniplayCredential(userId) {
  const stmt = db.prepare('DELETE FROM uniplay_credentials WHERE user_id = ?');
  return stmt.run(userId);
}

/**
 * Verificar se usuário tem credencial Uniplay cadastrada
 */
export function hasUniplayCredential(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM uniplay_credentials WHERE user_id = ?');
  const result = stmt.get(userId);
  return result.count > 0;
}

/**
 * Buscar cliente Koffice por client_id
 */
export function getKofficeClientByClientId(userId, domain, clientId) {
  const stmt = db.prepare(`
    SELECT *
    FROM koffice_clients
    WHERE user_id = ? AND domain = ? AND client_id = ?
  `);
  
  return stmt.get(userId, domain, clientId);
}

// Tabela de Credenciais Uniplay
db.prepare(`
  CREATE TABLE IF NOT EXISTS uniplay_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log('  ✅ uniplay_credentials');

// ============= TABELAS CLUB =============

// Tabela de credenciais Club
db.exec(`
  CREATE TABLE IF NOT EXISTS club_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Tabela de clientes Club capturados
db.exec(`
  CREATE TABLE IF NOT EXISTS club_clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    client_id TEXT NOT NULL,
    username TEXT NOT NULL,
    reseller_notes TEXT,
    status TEXT,
    exp_date TEXT,
    member_id TEXT,
    conexoes TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, client_id)
  )
`);

// Índices para performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_club_credentials_user_id
  ON club_credentials(user_id);
  
  CREATE INDEX IF NOT EXISTS idx_club_clients_user_id
  ON club_clients(user_id);
  
  CREATE INDEX IF NOT EXISTS idx_club_clients_username
  ON club_clients(username);
`);

console.log('  ✅ club_credentials');
console.log('  ✅ club_clients');

// ============= FUNÇÕES HELPERS - CLUB =============

/**
 * Salvar credenciais Club
 */
export function saveClubCredentials(userId, username, password) {
  const stmt = db.prepare(`
    INSERT INTO club_credentials (user_id, username, password)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, username, password);
}

/**
 * Buscar credenciais Club
 */
export function getClubCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, username, password, created_at, updated_at
    FROM club_credentials
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

/**
 * Deletar credenciais Club
 */
export function deleteClubCredentials(userId) {
  const stmt = db.prepare('DELETE FROM club_credentials WHERE user_id = ?');
  return stmt.run(userId);
}

/**
 * Verificar se usuário tem credenciais Club
 */
export function hasClubCredentials(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM club_credentials WHERE user_id = ?');
  const result = stmt.get(userId);
  return result.count > 0;
}

/**
 * Salvar clientes Club
 */
export function saveClubClients(userId, clients) {
  const stmt = db.prepare(`
    INSERT INTO club_clients 
    (user_id, client_id, username, reseller_notes, status, exp_date, member_id, conexoes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, client_id) DO UPDATE SET
      username = excluded.username,
      reseller_notes = excluded.reseller_notes,
      status = excluded.status,
      exp_date = excluded.exp_date,
      member_id = excluded.member_id,
      conexoes = excluded.conexoes,
      captured_at = CURRENT_TIMESTAMP
  `);
  
  const transaction = db.transaction((clientsList) => {
    for (const client of clientsList) {
      stmt.run(
        userId,
        client.id,
        client.username,
        client.reseller_notes || '',
        client.status || '',
        client.exp_date || '',
        client.member_id || '',
        client.conexoes || ''
      );
    }
  });
  
  return transaction(clients);
}

/**
 * Buscar clientes Club
 */
export function getClubClients(userId) {
  const stmt = db.prepare(`
    SELECT 
      id, user_id, client_id, username, reseller_notes,
      status, exp_date, member_id, conexoes, captured_at
    FROM club_clients
    WHERE user_id = ?
    ORDER BY captured_at DESC
  `);
  
  return stmt.all(userId);
}

/**
 * Buscar cliente Club por ID
 */
export function getClubClientById(userId, clientId) {
  const stmt = db.prepare(`
    SELECT *
    FROM club_clients
    WHERE user_id = ? AND client_id = ?
  `);
  
  return stmt.get(userId, clientId);
}

/**
 * Buscar cliente Club por username
 */
export function getClubClientByUsername(userId, username) {
  const stmt = db.prepare(`
    SELECT *
    FROM club_clients
    WHERE user_id = ? AND username = ?
  `);
  
  return stmt.get(userId, username);
}

/**
 * Contar clientes Club
 */
export function getClubClientStats(userId) {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      MAX(captured_at) as last_capture
    FROM club_clients
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

/**
 * Salvar/Atualizar sessão Koffice
 */
export function saveKofficeSession(userId, domain, cookiesJson, status = 'active', loginCount = 1) {
  const normalizedDomain = domain.replace(/\/$/, '');
  
  const stmt = db.prepare(`
    INSERT INTO koffice_sessions (user_id, domain, cookies_json, status, login_count, last_heartbeat, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, domain) DO UPDATE SET
      cookies_json = excluded.cookies_json,
      status = excluded.status,
      login_count = excluded.login_count,
      last_heartbeat = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, normalizedDomain, cookiesJson, status, loginCount);
}

/**
 * Obter sessão Koffice
 */
export function getKofficeSession(userId, domain) {
  const normalizedDomain = domain.replace(/\/$/, '');
  
  const stmt = db.prepare(`
    SELECT * FROM koffice_sessions 
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.get(userId, normalizedDomain);
}

/**
 * Atualizar status da sessão
 */
export function updateKofficeSessionStatus(userId, domain, status) {
  const normalizedDomain = domain.replace(/\/$/, '');
  
  const stmt = db.prepare(`
    UPDATE koffice_sessions 
    SET status = ?, last_heartbeat = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.run(status, userId, normalizedDomain);
}

/**
 * Deletar sessão Koffice
 */
export function deleteKofficeSession(userId, domain) {
  const normalizedDomain = domain.replace(/\/$/, '');
  
  const stmt = db.prepare(`
    DELETE FROM koffice_sessions 
    WHERE user_id = ? AND domain = ?
  `);
  
  return stmt.run(userId, normalizedDomain);
}

/**
 * Listar todas as sessões Koffice (para o manager)
 */
export function getAllKofficeSessions() {
  const stmt = db.prepare(`
    SELECT ks.*, kc.username, kc.password
    FROM koffice_sessions ks
    JOIN koffice_credentials kc ON ks.user_id = kc.user_id AND ks.domain = kc.domain
    ORDER BY ks.last_heartbeat DESC
  `);
  
  return stmt.all();
}

/**
 * Obter todas as credenciais Koffice (para inicialização do manager)
 */
export function getAllKofficeCredentials() {
  const stmt = db.prepare(`
    SELECT * FROM koffice_credentials
    ORDER BY user_id, domain
  `);
  
  return stmt.all();
}

/**
 * Obter credencial Koffice por domínio
 */
export function getKofficeCredentialByDomain(userId, domain) {
  const normalizedDomain = domain.replace(/\/$/, '');
  
  // Tentar match exato primeiro
  let stmt = db.prepare(`
    SELECT * FROM koffice_credentials 
    WHERE user_id = ? AND domain = ?
  `);
  
  let result = stmt.get(userId, normalizedDomain);
  
  // Se não encontrar, tentar match parcial (com ou sem https)
  if (!result) {
    stmt = db.prepare(`
      SELECT * FROM koffice_credentials 
      WHERE user_id = ? AND (
        domain = ? OR 
        domain = ? OR
        domain LIKE ? OR
        domain LIKE ?
      )
    `);
    
    const withHttps = normalizedDomain.startsWith('https://') ? normalizedDomain : `https://${normalizedDomain}`;
    const withoutHttps = normalizedDomain.replace(/^https?:\/\//, '');
    
    result = stmt.get(
      userId, 
      withHttps, 
      withoutHttps,
      `%${withoutHttps}%`,
      `%${withoutHttps}`
    );
  }
  
  return result;
}

/**
 * Estatísticas das sessões
 */
export function getKofficeSessionStats() {
  const stmt = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
      SUM(login_count) as total_logins
    FROM koffice_sessions
  `);
  
  return stmt.get();
}

// ========================================
// FUNÇÕES CLOUDNATION SESSION KEEPER
// ========================================

export function saveCloudNationSession(userId, domain, sessionData) {
  const stmt = db.prepare(`
    INSERT INTO cloudnation_sessions (user_id, domain, session_data)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, domain) DO UPDATE SET
      session_data = excluded.session_data,
      updated_at = CURRENT_TIMESTAMP
  `);
  return stmt.run(userId, domain, sessionData);
}

export function getCloudNationSession(userId, domain) {
  const stmt = db.prepare(`
    SELECT id, user_id, domain, session_data, created_at, updated_at
    FROM cloudnation_sessions
    WHERE user_id = ? AND domain = ?
  `);
  return stmt.get(userId, domain);
}

export function getAllCloudNationSessions() {
  const stmt = db.prepare(`
    SELECT id, user_id, domain, session_data, created_at, updated_at
    FROM cloudnation_sessions
    ORDER BY updated_at DESC
  `);
  return stmt.all();
}

export function deleteCloudNationSession(userId, domain) {
  const stmt = db.prepare(`
    DELETE FROM cloudnation_sessions
    WHERE user_id = ? AND domain = ?
  `);
  return stmt.run(userId, domain);
}

/**
 * Buscar TODAS as credenciais CloudNation (para inicialização do manager)
 * Similar ao getAllKofficeCredentials do Koffice
 */
export function getAllCloudNationCredentials() {
  const stmt = db.prepare(`
    SELECT id, user_id, username, password, created_at, updated_at
    FROM cloudnation_credentials
    ORDER BY user_id
  `);
  
  return stmt.all();
}

export function deleteCloudNationCredential(userId) {
  const stmt = db.prepare(`DELETE FROM cloudnation_credentials WHERE user_id = ?`);
  return stmt.run(userId);
}

/**
 * Salvar credencial Rush
 * OBS: Rush tem 1 credencial por usuário (domínio fixo: api-new.paineloffice.click)
 */
export function saveRushCredential(userId, username, password) {
  const stmt = db.prepare(`
    INSERT INTO rush_credentials (user_id, username, password)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      password = excluded.password,
      updated_at = CURRENT_TIMESTAMP
  `);
  
  return stmt.run(userId, username, password);
}

/**
 * Buscar credencial Rush de um usuário
 * Retorna: { id, user_id, username, password, created_at, updated_at } ou undefined
 */
export function getRushCredentials(userId) {
  const stmt = db.prepare(`
    SELECT id, user_id, username, password, created_at, updated_at
    FROM rush_credentials
    WHERE user_id = ?
  `);
  
  return stmt.get(userId);
}

/**
 * Atualizar credencial Rush
 */
export function updateRushCredential(userId, username, password) {
  const stmt = db.prepare(`
    UPDATE rush_credentials
    SET username = ?, password = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `);
  
  return stmt.run(username, password, userId);
}

/**
 * Deletar credencial Rush
 */
export function deleteRushCredential(userId) {
  const stmt = db.prepare('DELETE FROM rush_credentials WHERE user_id = ?');
  return stmt.run(userId);
}

/**
 * Verificar se usuário tem credencial Rush cadastrada
 */
export function hasRushCredential(userId) {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM rush_credentials WHERE user_id = ?');
  const result = stmt.get(userId);
  return result.count > 0;
}


export default db;
