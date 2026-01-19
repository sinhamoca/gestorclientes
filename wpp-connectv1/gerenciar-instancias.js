#!/usr/bin/env node

/**
 * ==========================================
 * GERENCIADOR INTERATIVO DE INSTÂNCIAS
 * ==========================================
 * Interface visual com menu navegável
 * 
 * Uso: node gerenciar-instancias.js
 */

import { execSync } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONTAINER_NAME = 'whatsapp_service';
const SESSIONS_PATH = '/app/sessions';

// ==========================================
// BANNER
// ==========================================
function showBanner() {
  console.clear();
  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('║        ') + chalk.white.bold('📱 GERENCIADOR DE INSTÂNCIAS WHATSAPP') + chalk.cyan.bold('        ║'));
  console.log(chalk.cyan.bold('║                                                            ║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════╝\n'));
}

// ==========================================
// EXECUTAR COMANDO NO DOCKER
// ==========================================
function dockerExec(command, silent = false) {
  try {
    const result = execSync(
      `docker exec ${CONTAINER_NAME} ${command}`,
      { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' }
    );
    return result.trim();
  } catch (error) {
    if (error.stdout) {
      return error.stdout.trim();
    }
    throw error;
  }
}

// ==========================================
// VERIFICAR CONTAINER
// ==========================================
function checkContainer() {
  try {
    execSync(`docker ps | grep ${CONTAINER_NAME}`, { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

// ==========================================
// LISTAR INSTÂNCIAS
// ==========================================
function listInstances() {
  try {
    const output = dockerExec(`ls -la ${SESSIONS_PATH}`, true);
    
    if (!output || output.includes('No such file or directory')) {
      return [];
    }
    
    const lines = output.split('\n');
    const instances = [];
    
    for (const line of lines) {
      const match = line.match(/user_(\d+)/);
      if (match) {
        const userId = match[1];
        
        // Obter tamanho
        let size = 'N/A';
        try {
          size = dockerExec(`du -sh ${SESSIONS_PATH}/user_${userId} 2>/dev/null | cut -f1`, true);
        } catch (e) {
          // Ignorar
        }
        
        instances.push({
          userId,
          sessionId: `user_${userId}`,
          path: `${SESSIONS_PATH}/user_${userId}`,
          size: size || 'N/A'
        });
      }
    }
    
    return instances;
  } catch (error) {
    return [];
  }
}

// ==========================================
// DELETAR INSTÂNCIA
// ==========================================
async function deleteInstance(sessionId) {
  const spinner = ora(`Deletando ${sessionId}...`).start();
  
  try {
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay visual
    dockerExec(`rm -rf ${SESSIONS_PATH}/${sessionId}`, true);
    
    // Verificar se foi deletado
    const verify = dockerExec(`ls -d ${SESSIONS_PATH}/${sessionId} 2>/dev/null || echo "DELETED"`, true);
    
    if (verify.includes('DELETED')) {
      spinner.succeed(chalk.green(`Instância ${sessionId} deletada com sucesso!`));
      return true;
    } else {
      spinner.fail(chalk.red(`Erro ao deletar ${sessionId}`));
      return false;
    }
  } catch (error) {
    spinner.fail(chalk.red(`Erro: ${error.message}`));
    return false;
  }
}

// ==========================================
// DELETAR TODAS
// ==========================================
async function deleteAllInstances() {
  const spinner = ora('Deletando todas as instâncias...').start();
  
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    dockerExec(`rm -rf ${SESSIONS_PATH}/*`, true);
    spinner.succeed(chalk.green('Todas as instâncias foram deletadas!'));
    return true;
  } catch (error) {
    spinner.fail(chalk.red(`Erro: ${error.message}`));
    return false;
  }
}

// ==========================================
// TELA: LISTAR E SELECIONAR
// ==========================================
async function screenListAndSelect() {
  const instances = listInstances();
  
  if (instances.length === 0) {
    console.log(chalk.yellow('\n✨ Nenhuma instância encontrada!\n'));
    await inquirer.prompt([{
      type: 'input',
      name: 'continue',
      message: 'Pressione ENTER para voltar...'
    }]);
    return;
  }
  
  console.log(chalk.cyan.bold('\n📦 INSTÂNCIAS ENCONTRADAS:\n'));
  
  instances.forEach((inst, index) => {
    console.log(chalk.white(`  ${index + 1}. `) + chalk.yellow.bold(inst.sessionId));
    console.log(chalk.gray(`     └─ User ID: ${inst.userId}`));
    console.log(chalk.gray(`     └─ Tamanho: ${inst.size}`));
    console.log(chalk.gray(`     └─ Path: ${inst.path}\n`));
  });
  
  const choices = [
    ...instances.map(inst => ({
      name: `🗑️  Deletar ${inst.sessionId}`,
      value: `delete_${inst.userId}`
    })),
    new inquirer.Separator(),
    {
      name: chalk.red.bold('🗑️  Deletar TODAS as instâncias'),
      value: 'delete_all'
    },
    new inquirer.Separator(),
    {
      name: '🔙 Voltar ao menu principal',
      value: 'back'
    }
  ];
  
  const answer = await inquirer.prompt([{
    type: 'list',
    name: 'action',
    message: 'O que deseja fazer?',
    choices,
    pageSize: 15
  }]);
  
  if (answer.action === 'back') {
    return;
  }
  
  if (answer.action === 'delete_all') {
    const confirm = await inquirer.prompt([{
      type: 'confirm',
      name: 'sure',
      message: chalk.red.bold(`⚠️  Deletar TODAS as ${instances.length} instâncias?`),
      default: false
    }]);
    
    if (confirm.sure) {
      await deleteAllInstances();
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    return;
  }
  
  // Deletar instância específica
  const userId = answer.action.replace('delete_', '');
  const sessionId = `user_${userId}`;
  
  const confirm = await inquirer.prompt([{
    type: 'confirm',
    name: 'sure',
    message: chalk.yellow(`Deletar ${sessionId}?`),
    default: false
  }]);
  
  if (confirm.sure) {
    await deleteInstance(sessionId);
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

// ==========================================
// TELA: APENAS LISTAR
// ==========================================
async function screenOnlyList() {
  const instances = listInstances();
  
  console.log(chalk.cyan.bold('\n📋 LISTAGEM DE INSTÂNCIAS\n'));
  
  if (instances.length === 0) {
    console.log(chalk.green('✅ Nenhuma instância encontrada (pasta vazia)\n'));
  } else {
    console.log(chalk.white(`📦 Total: ${chalk.bold(instances.length)} instância(s)\n`));
    
    instances.forEach((inst, index) => {
      console.log(chalk.white(`  ${index + 1}. `) + chalk.yellow.bold(inst.sessionId));
      console.log(chalk.gray(`     └─ User ID: ${inst.userId}`));
      console.log(chalk.gray(`     └─ Tamanho: ${inst.size}`));
      console.log(chalk.gray(`     └─ Path: ${inst.path}\n`));
    });
  }
  
  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Pressione ENTER para voltar...'
  }]);
}

// ==========================================
// TELA: INFO DO SISTEMA
// ==========================================
async function screenSystemInfo() {
  console.log(chalk.cyan.bold('\n📊 INFORMAÇÕES DO SISTEMA\n'));
  
  const spinner = ora('Coletando informações...').start();
  
  try {
    // Container status
    const containerRunning = checkContainer();
    
    // Espaço em disco
    let diskUsage = 'N/A';
    try {
      diskUsage = dockerExec(`du -sh ${SESSIONS_PATH} 2>/dev/null | cut -f1`, true);
    } catch (e) {
      diskUsage = 'N/A';
    }
    
    // Número de instâncias
    const instances = listInstances();
    
    spinner.stop();
    
    console.log(chalk.white('Container:      ') + (containerRunning ? chalk.green('✅ Rodando') : chalk.red('❌ Parado')));
    console.log(chalk.white('Nome:           ') + chalk.yellow(CONTAINER_NAME));
    console.log(chalk.white('Path sessões:   ') + chalk.gray(SESSIONS_PATH));
    console.log(chalk.white('Espaço usado:   ') + chalk.cyan(diskUsage));
    console.log(chalk.white('Instâncias:     ') + chalk.cyan(instances.length));
    
    if (instances.length > 0) {
      console.log(chalk.white('\nDetalhes:\n'));
      instances.forEach(inst => {
        console.log(chalk.gray(`  • ${inst.sessionId}: ${inst.size}`));
      });
    }
    
  } catch (error) {
    spinner.fail(chalk.red(`Erro: ${error.message}`));
  }
  
  console.log('');
  
  await inquirer.prompt([{
    type: 'input',
    name: 'continue',
    message: 'Pressione ENTER para voltar...'
  }]);
}

// ==========================================
// MENU PRINCIPAL
// ==========================================
async function mainMenu() {
  while (true) {
    showBanner();
    
    // Verificar container
    const containerRunning = checkContainer();
    
    if (!containerRunning) {
      console.log(chalk.red.bold('❌ ERRO: Container não está rodando!\n'));
      console.log(chalk.yellow('Execute: docker-compose up -d whatsapp-service\n'));
      process.exit(1);
    }
    
    console.log(chalk.green('✅ Container ativo\n'));
    
    const instances = listInstances();
    console.log(chalk.white(`📦 Instâncias ativas: ${chalk.bold(instances.length)}\n`));
    
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'option',
      message: 'Escolha uma opção:',
      choices: [
        {
          name: '📋 Apenas listar instâncias',
          value: 'list'
        },
        {
          name: '🗑️  Gerenciar instâncias (listar + deletar)',
          value: 'manage'
        },
        new inquirer.Separator(),
        {
          name: '📊 Informações do sistema',
          value: 'info'
        },
        new inquirer.Separator(),
        {
          name: '🚪 Sair',
          value: 'exit'
        }
      ]
    }]);
    
    switch (answer.option) {
      case 'list':
        await screenOnlyList();
        break;
        
      case 'manage':
        await screenListAndSelect();
        break;
        
      case 'info':
        await screenSystemInfo();
        break;
        
      case 'exit':
        console.log(chalk.cyan.bold('\n👋 Até logo!\n'));
        process.exit(0);
        break;
    }
  }
}

// ==========================================
// VERIFICAR DEPENDÊNCIAS
// ==========================================
async function checkDependencies() {
  try {
    await import('inquirer');
    await import('chalk');
    await import('ora');
    return true;
  } catch (error) {
    console.log(chalk.red.bold('\n❌ ERRO: Dependências não instaladas!\n'));
    console.log(chalk.yellow('Execute os seguintes comandos:\n'));
    console.log(chalk.white('  npm install inquirer@^9.0.0 chalk@^5.0.0 ora@^7.0.0'));
    console.log(chalk.gray('  ou'));
    console.log(chalk.white('  npm install\n'));
    console.log(chalk.gray('(Se package.json não existir, use a primeira opção)\n'));
    return false;
  }
}

// ==========================================
// INIT
// ==========================================
async function init() {
  // Verificar dependências primeiro
  const depsOk = await checkDependencies();
  if (!depsOk) {
    process.exit(1);
  }
  
  // Iniciar menu
  await mainMenu();
}

// Executar
init().catch(error => {
  console.log(chalk.red.bold(`\n❌ Erro fatal: ${error.message}\n`));
  process.exit(1);
});
