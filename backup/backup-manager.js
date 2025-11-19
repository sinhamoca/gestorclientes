#!/usr/bin/env node

/* ========================================
   BACKUP MANAGER - PostgreSQL
   Sistema automático de backup com PM2
   Autor: Isaac
   ======================================== */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '.env') });

// ========== CONFIGURAÇÕES ==========
const CONFIG = {
  // Container do PostgreSQL
  CONTAINER_NAME: process.env.POSTGRES_CONTAINER || 'gestao_db',
  DB_USER: process.env.DB_USER || 'gestao_user',
  DB_NAME: process.env.DB_NAME || 'gestao_clientes',
  
  // Diretórios
  BACKUP_DIR: path.join(__dirname, 'backups'),
  LOG_DIR: path.join(__dirname, 'logs'),
  LOG_FILE: path.join(__dirname, 'logs', 'backup.log'),
  
  // Retenção
  MAX_DAYS: parseInt(process.env.BACKUP_MAX_DAYS || '7'),
  
  // Intervalo (em horas)
  INTERVAL_HOURS: parseInt(process.env.BACKUP_INTERVAL_HOURS || '12')
};

// ========== FUNÇÕES AUXILIARES ==========

/**
 * Escreve log no arquivo e console
 */
async function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  try {
    await fs.appendFile(CONFIG.LOG_FILE, logMessage);
  } catch (error) {
    console.error('❌ Erro ao escrever log:', error.message);
  }
}

/**
 * Cria diretórios necessários
 */
async function ensureDirectories() {
  try {
    await fs.mkdir(CONFIG.BACKUP_DIR, { recursive: true });
    await fs.mkdir(CONFIG.LOG_DIR, { recursive: true });
    await log('✅ Diretórios criados/verificados');
  } catch (error) {
    await log(`❌ Erro ao criar diretórios: ${error.message}`, 'ERROR');
    throw error;
  }
}

/**
 * Verifica se o container está rodando
 */
async function checkContainer() {
  try {
    const { stdout } = await execAsync(`docker ps --filter "name=${CONFIG.CONTAINER_NAME}" --format "{{.Names}}"`);
    
    if (!stdout.trim()) {
      throw new Error(`Container ${CONFIG.CONTAINER_NAME} não está rodando`);
    }
    
    await log(`✅ Container ${CONFIG.CONTAINER_NAME} está ativo`);
    return true;
  } catch (error) {
    await log(`❌ Erro ao verificar container: ${error.message}`, 'ERROR');
    return false;
  }
}

/**
 * Cria backup do PostgreSQL
 */
async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
  const filename = `backup_${timestamp}.sql.gz`;
  const filepath = path.join(CONFIG.BACKUP_DIR, filename);
  
  await log('🔄 Iniciando backup...');
  await log(`   Container: ${CONFIG.CONTAINER_NAME}`);
  await log(`   Database: ${CONFIG.DB_NAME}`);
  await log(`   User: ${CONFIG.DB_USER}`);
  
  try {
    // COMANDO TESTADO E APROVADO: funciona perfeitamente
    const backupCommand = `docker exec ${CONFIG.CONTAINER_NAME} pg_dump -U ${CONFIG.DB_USER} ${CONFIG.DB_NAME} | gzip > ${filepath}`;
    
    await log(`   Executando backup...`);
    
    const { stdout, stderr } = await execAsync(backupCommand);
    
    if (stderr && !stderr.includes('command terminated')) {
      await log(`   ⚠️  Aviso: ${stderr}`, 'WARN');
    }
    
    // Verificar se o arquivo foi criado
    const stats = await fs.stat(filepath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    // Validar tamanho mínimo (backup muito pequeno indica problema)
    if (stats.size < 1024) {
      await log(`❌ Backup muito pequeno (${stats.size} bytes) - provavelmente falhou!`, 'ERROR');
      throw new Error(`Backup inválido - apenas ${stats.size} bytes`);
    }
    
    // Validar conteúdo do backup (deve ter mais de 100 linhas)
    const validateCommand = `gunzip -c ${filepath} | wc -l`;
    const { stdout: linesOutput } = await execAsync(validateCommand);
    const lines = parseInt(linesOutput.trim());
    
    if (lines < 100) {
      await log(`❌ Backup com poucas linhas (${lines}) - pode estar vazio!`, 'ERROR');
      throw new Error(`Backup suspeito - apenas ${lines} linhas`);
    }
    
    if (parseFloat(sizeMB) >= 1) {
      await log(`✅ Backup criado com sucesso: ${filename} (${sizeMB} MB, ${lines} linhas)`);
    } else {
      await log(`✅ Backup criado com sucesso: ${filename} (${sizeKB} KB, ${lines} linhas)`);
    }
    
    return { filename, filepath, size: stats.size };
  } catch (error) {
    await log(`❌ Erro ao criar backup: ${error.message}`, 'ERROR');
    if (error.stderr) {
      await log(`   stderr: ${error.stderr}`, 'ERROR');
    }
    if (error.stdout) {
      await log(`   stdout: ${error.stdout}`, 'ERROR');
    }
    throw error;
  }
}

/**
 * Remove backups antigos (mantém apenas X dias)
 */
async function cleanOldBackups() {
  try {
    await log(`🧹 Limpando backups com mais de ${CONFIG.MAX_DAYS} dias...`);
    
    const files = await fs.readdir(CONFIG.BACKUP_DIR);
    const now = Date.now();
    const maxAge = CONFIG.MAX_DAYS * 24 * 60 * 60 * 1000; // dias em ms
    
    let removed = 0;
    
    for (const file of files) {
      if (!file.startsWith('backup_') || !file.endsWith('.sql.gz')) continue;
      
      const filepath = path.join(CONFIG.BACKUP_DIR, file);
      const stats = await fs.stat(filepath);
      const age = now - stats.mtimeMs;
      
      if (age > maxAge) {
        await fs.unlink(filepath);
        await log(`   🗑️  Removido: ${file} (${Math.floor(age / (24 * 60 * 60 * 1000))} dias)`);
        removed++;
      }
    }
    
    if (removed === 0) {
      await log('   ✅ Nenhum backup antigo para remover');
    } else {
      await log(`✅ ${removed} backup(s) antigo(s) removido(s)`);
    }
  } catch (error) {
    await log(`❌ Erro ao limpar backups antigos: ${error.message}`, 'ERROR');
  }
}

/**
 * Executa o processo completo de backup
 */
async function runBackup() {
  await log('═'.repeat(60));
  await log('🚀 INICIANDO PROCESSO DE BACKUP');
  await log('═'.repeat(60));
  
  try {
    // 1. Verificar container
    const containerOk = await checkContainer();
    if (!containerOk) {
      throw new Error('Container não disponível');
    }
    
    // 2. Criar backup
    const backup = await createBackup();
    
    // 3. Limpar backups antigos
    await cleanOldBackups();
    
    await log('═'.repeat(60));
    await log('✅ BACKUP CONCLUÍDO COM SUCESSO');
    await log('═'.repeat(60));
    
    return backup;
  } catch (error) {
    await log('═'.repeat(60));
    await log('❌ BACKUP FALHOU', 'ERROR');
    await log(`Erro: ${error.message}`, 'ERROR');
    await log('═'.repeat(60));
    throw error;
  }
}

/**
 * Agenda backups periódicos
 */
async function scheduleBackups() {
  const intervalMs = CONFIG.INTERVAL_HOURS * 60 * 60 * 1000;
  
  await log(`⏰ Backups agendados a cada ${CONFIG.INTERVAL_HOURS} horas`);
  await log(`📁 Diretório de backups: ${CONFIG.BACKUP_DIR}`);
  await log(`🗄️  Retenção: ${CONFIG.MAX_DAYS} dias`);
  
  // Executar backup inicial
  await runBackup();
  
  // Agendar próximos backups
  setInterval(async () => {
    await runBackup();
  }, intervalMs);
  
  await log('🟢 Sistema de backup ativo e rodando...');
}

/**
 * Inicialização
 */
async function init() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  📦 BACKUP MANAGER - PostgreSQL');
  console.log('  Sistema automático de backup com PM2');
  console.log('═'.repeat(60));
  console.log('');
  
  try {
    // Criar diretórios
    await ensureDirectories();
    
    // Iniciar sistema de backups
    await scheduleBackups();
    
  } catch (error) {
    console.error('❌ Erro fatal ao inicializar:', error);
    process.exit(1);
  }
}

// ========== TRATAMENTO DE SINAIS ==========

process.on('SIGINT', async () => {
  await log('⚠️  Recebido SIGINT - Finalizando gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await log('⚠️  Recebido SIGTERM - Finalizando gracefully...');
  process.exit(0);
});

process.on('uncaughtException', async (error) => {
  await log(`❌ Exceção não capturada: ${error.message}`, 'ERROR');
  console.error(error);
});

process.on('unhandledRejection', async (reason, promise) => {
  await log(`❌ Promise rejeitada: ${reason}`, 'ERROR');
  console.error('Promise:', promise);
});

// ========== INICIAR ==========
init();