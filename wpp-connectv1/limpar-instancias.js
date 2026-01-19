#!/usr/bin/env node

/**
 * ==========================================
 * UTILITÁRIO: GERENCIAR INSTÂNCIAS WHATSAPP
 * ==========================================
 * 
 * Gerencia sessões do WPP Connect dentro do container
 * Resolve erro: "The browser is already running"
 * 
 * Uso:
 *   node limpar-instancias.js list        - Listar todas as instâncias
 *   node limpar-instancias.js delete 2    - Deletar instância do user_2
 *   node limpar-instancias.js delete all  - Deletar TODAS as instâncias
 *   node limpar-instancias.js clean       - Limpar instâncias órfãs
 */

import { execSync } from 'child_process';
import readline from 'readline';

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONTAINER_NAME = 'whatsapp_service';
const SESSIONS_PATH = '/app/sessions';

// ==========================================
// CORES PARA TERMINAL
// ==========================================
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// ==========================================
// EXECUTAR COMANDO NO CONTAINER
// ==========================================
function dockerExec(command) {
  try {
    const result = execSync(
      `docker exec ${CONTAINER_NAME} ${command}`,
      { encoding: 'utf-8' }
    );
    return result.trim();
  } catch (error) {
    if (error.status === 1 && error.stdout) {
      return error.stdout.trim();
    }
    throw error;
  }
}

// ==========================================
// VERIFICAR SE CONTAINER ESTÁ RODANDO
// ==========================================
function checkContainer() {
  try {
    execSync(`docker ps | grep ${CONTAINER_NAME}`, { encoding: 'utf-8' });
    return true;
  } catch (error) {
    return false;
  }
}

// ==========================================
// LISTAR TODAS AS INSTÂNCIAS
// ==========================================
function listInstances() {
  log('\n📋 LISTANDO INSTÂNCIAS WHATSAPP', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    // Listar diretórios em /app/sessions
    const output = dockerExec(`ls -la ${SESSIONS_PATH}`);
    
    if (!output || output.includes('No such file or directory')) {
      log('\n✅ Nenhuma instância encontrada (pasta vazia)', 'green');
      return [];
    }
    
    // Extrair nomes das pastas
    const lines = output.split('\n');
    const instances = [];
    
    for (const line of lines) {
      const match = line.match(/user_(\d+)/);
      if (match) {
        const userId = match[1];
        instances.push({
          userId,
          sessionId: `user_${userId}`,
          path: `${SESSIONS_PATH}/user_${userId}`
        });
      }
    }
    
    if (instances.length === 0) {
      log('\n✅ Nenhuma instância encontrada', 'green');
      return [];
    }
    
    log(`\n📦 Encontradas ${instances.length} instância(s):\n`, 'bold');
    
    instances.forEach((inst, index) => {
      log(`  ${index + 1}. ${inst.sessionId}`, 'yellow');
      log(`     └─ User ID: ${inst.userId}`, 'reset');
      log(`     └─ Path: ${inst.path}`, 'reset');
      
      // Verificar tamanho da pasta
      try {
        const size = dockerExec(`du -sh ${inst.path} 2>/dev/null | cut -f1`);
        log(`     └─ Tamanho: ${size}`, 'reset');
      } catch (e) {
        // Ignorar erro
      }
      
      log('');
    });
    
    return instances;
    
  } catch (error) {
    log(`\n❌ Erro ao listar instâncias: ${error.message}`, 'red');
    return [];
  }
}

// ==========================================
// DELETAR INSTÂNCIA ESPECÍFICA
// ==========================================
function deleteInstance(userId) {
  const sessionId = `user_${userId}`;
  const sessionPath = `${SESSIONS_PATH}/${sessionId}`;
  
  log(`\n🗑️  DELETANDO INSTÂNCIA: ${sessionId}`, 'yellow');
  log('='.repeat(60), 'yellow');
  
  try {
    // Verificar se existe
    const checkResult = dockerExec(`ls -d ${sessionPath} 2>/dev/null || echo "NOT_FOUND"`);
    
    if (checkResult.includes('NOT_FOUND')) {
      log(`\n⚠️  Instância ${sessionId} não existe`, 'yellow');
      return false;
    }
    
    // Deletar
    log(`\n🔄 Removendo ${sessionPath}...`, 'reset');
    dockerExec(`rm -rf ${sessionPath}`);
    
    // Verificar se foi deletado
    const verifyResult = dockerExec(`ls -d ${sessionPath} 2>/dev/null || echo "DELETED"`);
    
    if (verifyResult.includes('DELETED')) {
      log(`\n✅ Instância ${sessionId} deletada com sucesso!`, 'green');
      return true;
    } else {
      log(`\n❌ Erro ao deletar instância ${sessionId}`, 'red');
      return false;
    }
    
  } catch (error) {
    log(`\n❌ Erro ao deletar: ${error.message}`, 'red');
    return false;
  }
}

// ==========================================
// DELETAR TODAS AS INSTÂNCIAS
// ==========================================
async function deleteAllInstances() {
  log('\n⚠️  DELETAR TODAS AS INSTÂNCIAS', 'red');
  log('='.repeat(60), 'red');
  
  const instances = listInstances();
  
  if (instances.length === 0) {
    return;
  }
  
  // Confirmar
  const confirmed = await askConfirmation(
    `\n❓ Tem certeza que deseja deletar TODAS as ${instances.length} instâncias? (s/N): `
  );
  
  if (!confirmed) {
    log('\n❌ Operação cancelada', 'yellow');
    return;
  }
  
  log('\n🔄 Deletando todas as instâncias...', 'reset');
  
  try {
    dockerExec(`rm -rf ${SESSIONS_PATH}/*`);
    
    log('\n✅ Todas as instâncias foram deletadas!', 'green');
    
    // Verificar
    const verify = dockerExec(`ls -A ${SESSIONS_PATH} || echo "EMPTY"`);
    if (verify.includes('EMPTY') || !verify) {
      log('✅ Pasta de sessões está vazia', 'green');
    }
    
  } catch (error) {
    log(`\n❌ Erro ao deletar: ${error.message}`, 'red');
  }
}

// ==========================================
// LIMPAR INSTÂNCIAS ÓRFÃS
// (Instâncias sem registro no banco)
// ==========================================
async function cleanOrphanInstances() {
  log('\n🧹 LIMPANDO INSTÂNCIAS ÓRFÃS', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const instances = listInstances();
  
  if (instances.length === 0) {
    return;
  }
  
  log('\n⚠️  Esta função remove instâncias que não estão no banco de dados', 'yellow');
  log('⚠️  Requer conexão com o banco PostgreSQL', 'yellow');
  
  const confirmed = await askConfirmation('\n❓ Continuar? (s/N): ');
  
  if (!confirmed) {
    log('\n❌ Operação cancelada', 'yellow');
    return;
  }
  
  // TODO: Implementar verificação com banco de dados
  log('\n⚠️  Funcionalidade em desenvolvimento', 'yellow');
  log('Por enquanto, use: node limpar-instancias.js list', 'reset');
}

// ==========================================
// PERGUNTAR CONFIRMAÇÃO
// ==========================================
function askConfirmation(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'y');
    });
  });
}

// ==========================================
// MOSTRAR AJUDA
// ==========================================
function showHelp() {
  log('\n📖 UTILITÁRIO: GERENCIAR INSTÂNCIAS WHATSAPP', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log('\nUSO:', 'bold');
  log('  node limpar-instancias.js <comando> [argumentos]', 'reset');
  
  log('\nCOMANDOS:', 'bold');
  log('  list              - Listar todas as instâncias', 'green');
  log('  delete <userId>   - Deletar instância específica (ex: delete 2)', 'yellow');
  log('  delete all        - Deletar TODAS as instâncias', 'red');
  log('  clean             - Limpar instâncias órfãs (sem registro no BD)', 'cyan');
  log('  help              - Mostrar esta ajuda', 'blue');
  
  log('\nEXEMPLOS:', 'bold');
  log('  node limpar-instancias.js list', 'reset');
  log('  node limpar-instancias.js delete 2', 'reset');
  log('  node limpar-instancias.js delete all', 'reset');
  
  log('\nOBSERVAÇÕES:', 'bold');
  log('  • Resolve erro: "The browser is already running"', 'reset');
  log('  • Equivalente a: docker exec whatsapp_service rm -r /app/sessions/user_X', 'reset');
  log('  • Use com cuidado! Deletar instância = usuário precisa escanear QR novamente', 'reset');
  
  log('');
}

// ==========================================
// MAIN
// ==========================================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Banner
  log('\n' + '='.repeat(60), 'cyan');
  log('🔧 GERENCIADOR DE INSTÂNCIAS WHATSAPP', 'cyan');
  log('='.repeat(60), 'cyan');
  
  // Verificar se container está rodando
  if (!checkContainer()) {
    log(`\n❌ Container '${CONTAINER_NAME}' não está rodando!`, 'red');
    log('Execute: docker-compose up -d whatsapp-service', 'yellow');
    process.exit(1);
  }
  
  log(`✅ Container '${CONTAINER_NAME}' está rodando`, 'green');
  
  // Executar comando
  switch (command) {
    case 'list':
      listInstances();
      break;
      
    case 'delete':
      const target = args[1];
      
      if (!target) {
        log('\n❌ Erro: Especifique o User ID ou "all"', 'red');
        log('Uso: node limpar-instancias.js delete <userId>', 'yellow');
        log('Exemplo: node limpar-instancias.js delete 2', 'yellow');
        break;
      }
      
      if (target === 'all') {
        await deleteAllInstances();
      } else {
        deleteInstance(target);
      }
      break;
      
    case 'clean':
      await cleanOrphanInstances();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    default:
      log('\n❌ Comando inválido!', 'red');
      showHelp();
      break;
  }
  
  log('');
}

// Executar
main().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
