#!/usr/bin/env node
// ========================================
// IMPORTADOR DE CLIENTES - GESTÃO CLIENTES
// v2.0 - Com mapeamento de planos por grupo
// ========================================

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';
import pg from 'pg';

const { Pool } = pg;

// ========================================
// CONFIGURAÇÃO
// ========================================
const CONFIG = {
  userId: 37, // Isaac Mendes - altere conforme necessário
  e2eKey: '3733dba1dc385bc92290ad427dc0e51a8fb8509ac94fd8c531b35078d81379d7',
  systemKey: '282b70caf75c319984ad38bb728e16f07244744fba8367e8bdeb97b45f976382',
  // Usa variável de ambiente ou conexão padrão Docker
  dbUrl: process.env.DATABASE_URL || 'postgresql://gestao_user:Gestao_DB_Pass_2025!@postgres-gestao:5432/gestao_clientes'
};

const pool = new Pool({ connectionString: CONFIG.dbUrl });

// ========================================
// CRIPTOGRAFIA (Igual ao sistema)
// ========================================
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function encrypt(text, encryptionKey) {
  if (!text) return null;
  if (!encryptionKey || encryptionKey.length !== 64) {
    throw new Error('Chave de criptografia inválida (deve ter 64 caracteres hex)');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const keyBuffer = Buffer.from(encryptionKey, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted
  ].join(':');
}

// ========================================
// UTILITÁRIOS
// ========================================

// Interface readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Parser do campo "plano" do JSON
function parsePlano(plano) {
  const result = { telas: 1, valor: null, meses: 1 };
  
  if (!plano) return result;
  
  // Extrair telas: "1 tela", "2 telas"
  const telasMatch = plano.match(/(\d+)\s*telas?/i);
  if (telasMatch) result.telas = parseInt(telasMatch[1]);
  
  // Extrair valor: "30 R$", "25,00 R$", "R$ 30"
  const valorMatch = plano.match(/(\d+(?:[.,]\d+)?)\s*R\$|R\$\s*(\d+(?:[.,]\d+)?)/i);
  if (valorMatch) {
    const valorStr = valorMatch[1] || valorMatch[2];
    result.valor = parseFloat(valorStr.replace(',', '.'));
  }
  
  // Extrair meses: "2 meses", "3 meses"
  const mesesMatch = plano.match(/(\d+)\s*mes(?:es)?/i);
  if (mesesMatch) result.meses = parseInt(mesesMatch[1]);
  
  return result;
}

// Converter data DD/MM/YYYY para YYYY-MM-DD
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [dia, mes, ano] = parts;
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

// Validar e normalizar WhatsApp
function validateWhatsApp(input) {
  if (!input || input.trim() === '') return null;
  
  let cleaned = input.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }
  
  if (cleaned.length < 12 || cleaned.length > 13) {
    return null;
  }
  
  return cleaned;
}

// Agrupar clientes por plano original
function groupClientsByPlan(clients) {
  const groups = {};
  
  for (const cliente of clients) {
    const plano = cliente.plano || 'Sem plano definido';
    
    if (!groups[plano]) {
      groups[plano] = {
        planoOriginal: plano,
        planoInfo: parsePlano(plano),
        clientes: []
      };
    }
    
    groups[plano].clientes.push(cliente);
  }
  
  return groups;
}

// Validar se todos os planos têm valor extraível
function validatePlanValues(groups) {
  const errors = [];
  
  for (const [planoName, group] of Object.entries(groups)) {
    if (group.planoInfo.valor === null || group.planoInfo.valor === 0) {
      errors.push({
        plano: planoName,
        clientCount: group.clientes.length,
        exemplo: group.clientes[0]?.nome || 'N/A'
      });
    }
  }
  
  return errors;
}

// ========================================
// FUNÇÕES DO BANCO
// ========================================

async function getServers(userId) {
  const result = await pool.query(
    'SELECT id, name FROM servers WHERE user_id = $1 ORDER BY name',
    [userId]
  );
  return result.rows;
}

async function getPlans(userId) {
  const result = await pool.query(
    'SELECT id, name, duration_months, num_screens FROM plans WHERE user_id = $1 ORDER BY name',
    [userId]
  );
  return result.rows;
}

async function insertClient(data) {
  const result = await pool.query(`
    INSERT INTO clients (
      user_id, name, whatsapp_number, whatsapp_number_encrypted, whatsapp_number_internal,
      plan_id, server_id, price_value, due_date, username, password, is_active, notes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING id
  `, [
    data.userId,
    data.name,
    null, // whatsapp_number - não salva em texto plano
    data.whatsappEncrypted,
    data.whatsappInternal,
    data.planId,
    data.serverId,
    data.priceValue,
    data.dueDate,
    data.username,
    data.password,
    data.isActive,
    data.notes
  ]);
  return result.rows[0].id;
}

// ========================================
// MENU DE SELEÇÃO
// ========================================

async function selectServer(servers) {
  console.log('\n📡 SERVIDORES DISPONÍVEIS:');
  console.log('─'.repeat(40));
  servers.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.name} (ID: ${s.id})`);
  });
  console.log('─'.repeat(40));
  
  const choice = await question('Selecione o servidor (número): ');
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= servers.length) {
    console.log('❌ Opção inválida!');
    return selectServer(servers);
  }
  
  return servers[index];
}

async function selectPlanForGroup(plans, groupName, clientCount, planoInfo) {
  console.log('\n' + '═'.repeat(60));
  console.log(`📦 GRUPO: "${groupName}"`);
  console.log(`   📊 ${clientCount} cliente(s) encontrado(s)`);
  if (planoInfo.valor) {
    console.log(`   💰 Valor extraído: R$ ${planoInfo.valor.toFixed(2)}`);
  }
  if (planoInfo.telas > 1) {
    console.log(`   📺 Telas: ${planoInfo.telas}`);
  }
  console.log('─'.repeat(60));
  console.log('Selecione o plano de DESTINO para esses clientes:');
  console.log('─'.repeat(60));
  
  plans.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.name} (${p.duration_months} mês, ${p.num_screens} tela(s))`);
  });
  console.log('─'.repeat(60));
  
  const choice = await question('Selecione o plano (número): ');
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= plans.length) {
    console.log('❌ Opção inválida!');
    return selectPlanForGroup(plans, groupName, clientCount, planoInfo);
  }
  
  return plans[index];
}

async function selectIdField() {
  console.log('\n🔑 CAMPO PARA "ID INTERNO":');
  console.log('─'.repeat(50));
  console.log('  [1] Usar campo "id_externo" do JSON');
  console.log('  [2] Usar campo "usuario" do JSON');
  console.log('  [3] Não importar ID Interno (deixar vazio)');
  console.log('─'.repeat(50));
  
  const choice = await question('Selecione a opção (1, 2 ou 3): ');
  
  switch (choice.trim()) {
    case '1': return 'id_externo';
    case '2': return 'usuario';
    case '3': return null;
    default:
      console.log('❌ Opção inválida!');
      return selectIdField();
  }
}

function listJsonFiles() {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.json') && !f.includes('package'));
  return files;
}

async function selectJsonFile(files) {
  console.log('\n📂 ARQUIVOS JSON ENCONTRADOS:');
  console.log('─'.repeat(50));
  files.forEach((f, i) => {
    const stats = fs.statSync(f);
    const size = (stats.size / 1024).toFixed(2);
    console.log(`  [${i + 1}] ${f} (${size} KB)`);
  });
  console.log('─'.repeat(50));
  
  const choice = await question('Selecione o arquivo (número): ');
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= files.length) {
    console.log('❌ Opção inválida!');
    return selectJsonFile(files);
  }
  
  return files[index];
}

// ========================================
// IMPORTAÇÃO
// ========================================

async function importClients(clients, serverId, planId, idField, planoOriginal) {
  let importados = 0;
  let erros = 0;
  let whatsappInvalidos = 0;
  
  for (let i = 0; i < clients.length; i++) {
    const cliente = clients[i];
    
    try {
      // Extrair dados
      const nome = cliente.nome?.trim();
      if (!nome) {
        erros++;
        continue;
      }
      
      // WhatsApp
      const whatsappOriginal = cliente.whatsapp;
      const whatsappNormalizado = validateWhatsApp(whatsappOriginal);
      
      let whatsappEncrypted = null;
      let whatsappInternal = null;
      
      if (whatsappNormalizado) {
        // Criptografia dupla
        whatsappEncrypted = encrypt(whatsappNormalizado, CONFIG.e2eKey);
        whatsappInternal = encrypt(whatsappNormalizado, CONFIG.systemKey);
      } else if (whatsappOriginal) {
        whatsappInvalidos++;
      }
      
      // Plano e valor - extrair do plano original do cliente
      const planoInfo = parsePlano(cliente.plano);
      const priceValue = planoInfo.valor || 0;
      
      // Data de vencimento
      const dueDate = parseDate(cliente.vencimento);
      if (!dueDate) {
        erros++;
        continue;
      }
      
      // Status
      const isActive = (cliente.status || '').toLowerCase() === 'ativo';
      
      // ID Interno (username)
      let username = null;
      if (idField === 'id_externo') {
        const idExt = cliente.id_externo;
        if (idExt && idExt !== 'Sem Código' && idExt.trim() !== '') {
          username = idExt.trim();
        }
      } else if (idField === 'usuario') {
        username = cliente.usuario?.trim() || null;
      }
      
      // Senha
      const password = cliente.senha?.trim() || null;
      
      // Notas
      const notes = `Importado | Plano original: ${cliente.plano || 'N/A'} | Servidor original: ${cliente.servidor || 'N/A'}`;
      
      // Inserir no banco
      await insertClient({
        userId: CONFIG.userId,
        name: nome,
        whatsappEncrypted,
        whatsappInternal,
        planId,
        serverId,
        priceValue,
        dueDate,
        username,
        password,
        isActive,
        notes
      });
      
      importados++;
      
    } catch (err) {
      console.log(`❌ Erro ao importar "${cliente.nome}": ${err.message}`);
      erros++;
    }
  }
  
  return { importados, erros, whatsappInvalidos };
}

// ========================================
// MAIN
// ========================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   IMPORTADOR DE CLIENTES - GESTÃO CLIENTES v2.0            ║');
  console.log('║   Com mapeamento de planos por grupo                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Testar conexão
    console.log('🔌 Conectando ao banco de dados...');
    await pool.query('SELECT 1');
    console.log('✅ Conexão estabelecida!\n');
    
    // Listar arquivos JSON
    const jsonFiles = listJsonFiles();
    if (jsonFiles.length === 0) {
      console.log('❌ Nenhum arquivo .json encontrado na pasta atual!');
      console.log('   Coloque os arquivos JSON na mesma pasta deste script.');
      process.exit(1);
    }
    
    // Selecionar arquivo
    const selectedFile = await selectJsonFile(jsonFiles);
    
    // Carregar e analisar o arquivo
    const jsonData = JSON.parse(fs.readFileSync(selectedFile, 'utf8'));
    
    if (!Array.isArray(jsonData)) {
      throw new Error('O arquivo JSON deve conter um array de clientes');
    }
    
    console.log(`\n📊 Arquivo "${selectedFile}" carregado!`);
    console.log(`   Total de clientes: ${jsonData.length}`);
    
    // Agrupar clientes por plano
    const groups = groupClientsByPlan(jsonData);
    const groupKeys = Object.keys(groups);
    
    console.log(`\n📦 GRUPOS DE PLANOS ENCONTRADOS: ${groupKeys.length}`);
    console.log('═'.repeat(60));
    
    groupKeys.forEach((key, i) => {
      const group = groups[key];
      console.log(`  [${i + 1}] "${key}" → ${group.clientes.length} cliente(s)`);
    });
    
    console.log('═'.repeat(60));
    
    // ========== VALIDAÇÃO DE VALORES ==========
    console.log('\n🔍 Validando valores dos planos...');
    
    const valueErrors = validatePlanValues(groups);
    
    if (valueErrors.length > 0) {
      console.log('\n' + '═'.repeat(60));
      console.log('❌ ERRO: PLANOS SEM VALOR DETECTADOS!');
      console.log('═'.repeat(60));
      console.log('\nOs seguintes planos não possuem valor extraível:\n');
      
      valueErrors.forEach((err, i) => {
        console.log(`  [${i + 1}] "${err.plano}"`);
        console.log(`      → ${err.clientCount} cliente(s) afetado(s)`);
        console.log(`      → Exemplo: ${err.exemplo}`);
        console.log('');
      });
      
      console.log('─'.repeat(60));
      console.log('💡 DICA: O sistema espera formatos como:');
      console.log('   • "1 tela 30 R$"');
      console.log('   • "2 telas 50,00 R$"');
      console.log('   • "R$ 25"');
      console.log('─'.repeat(60));
      
      const continueAnyway = await question('\n⚠️  Deseja continuar mesmo assim? (Os clientes ficarão com valor R$ 0,00) (s/n): ');
      
      if (continueAnyway.toLowerCase() !== 's') {
        console.log('\n❌ Importação abortada. Corrija os planos no arquivo JSON e tente novamente.');
        process.exit(1);
      }
      
      console.log('\n⚠️  Continuando com valores zerados para os planos problemáticos...');
    } else {
      console.log('✅ Todos os planos possuem valores válidos!');
    }
    
    // Buscar servidores e planos do sistema
    const servers = await getServers(CONFIG.userId);
    const plans = await getPlans(CONFIG.userId);
    
    if (servers.length === 0) {
      console.log('\n❌ Nenhum servidor cadastrado!');
      console.log('   Cadastre servidores no sistema antes de importar.');
      process.exit(1);
    }
    
    if (plans.length === 0) {
      console.log('\n❌ Nenhum plano cadastrado!');
      console.log('   Cadastre planos no sistema antes de importar.');
      process.exit(1);
    }
    
    // Selecionar servidor (único para todos)
    const selectedServer = await selectServer(servers);
    console.log(`\n✅ Servidor selecionado: ${selectedServer.name}`);
    
    // Selecionar campo de ID Interno
    const idField = await selectIdField();
    if (idField) {
      console.log(`✅ Campo para ID Interno: "${idField}"`);
    } else {
      console.log(`✅ ID Interno: não será importado`);
    }
    
    // Mapear cada grupo para um plano do sistema
    console.log('\n' + '═'.repeat(60));
    console.log('🗺️  MAPEAMENTO DE PLANOS');
    console.log('   Agora vamos definir para qual plano cada grupo vai...');
    console.log('═'.repeat(60));
    
    const planMapping = {}; // { "1 tela 25 R$": { planId: 5, planName: "..." } }
    
    for (const key of groupKeys) {
      const group = groups[key];
      const selectedPlan = await selectPlanForGroup(
        plans, 
        key, 
        group.clientes.length,
        group.planoInfo
      );
      
      planMapping[key] = {
        planId: selectedPlan.id,
        planName: selectedPlan.name
      };
      
      console.log(`✅ "${key}" → ${selectedPlan.name}`);
    }
    
    // Confirmação final
    console.log('\n' + '═'.repeat(60));
    console.log('📋 RESUMO DA IMPORTAÇÃO:');
    console.log('═'.repeat(60));
    console.log(`   Arquivo: ${selectedFile}`);
    console.log(`   Total de clientes: ${jsonData.length}`);
    console.log(`   Servidor destino: ${selectedServer.name}`);
    console.log(`   ID Interno: ${idField || 'não importar'}`);
    console.log(`   Usuário destino: ID ${CONFIG.userId}`);
    console.log('');
    console.log('   📦 Mapeamento de planos:');
    for (const key of groupKeys) {
      const group = groups[key];
      const mapping = planMapping[key];
      console.log(`      "${key}" (${group.clientes.length}) → ${mapping.planName}`);
    }
    console.log('═'.repeat(60));
    
    const confirm = await question('\n⚠️  Confirma a importação? (s/n): ');
    if (confirm.toLowerCase() !== 's') {
      console.log('❌ Importação cancelada pelo usuário.');
      process.exit(0);
    }
    
    // Executar importação por grupo
    console.log('\n🚀 Iniciando importação...\n');
    
    let totalImportados = 0;
    let totalErros = 0;
    let totalWhatsappInvalidos = 0;
    
    for (const key of groupKeys) {
      const group = groups[key];
      const mapping = planMapping[key];
      
      console.log(`📦 Importando grupo "${key}" (${group.clientes.length} clientes)...`);
      
      const resultado = await importClients(
        group.clientes,
        selectedServer.id,
        mapping.planId,
        idField,
        key
      );
      
      totalImportados += resultado.importados;
      totalErros += resultado.erros;
      totalWhatsappInvalidos += resultado.whatsappInvalidos;
      
      console.log(`   ✅ ${resultado.importados} importados | ❌ ${resultado.erros} erros`);
    }
    
    // Resultado final
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RESULTADO FINAL:');
    console.log('═'.repeat(60));
    console.log(`   ✅ Importados com sucesso: ${totalImportados}`);
    console.log(`   ❌ Erros: ${totalErros}`);
    console.log(`   ⚠️  WhatsApp inválidos: ${totalWhatsappInvalidos}`);
    console.log(`   📊 Total processado: ${jsonData.length}`);
    console.log('═'.repeat(60));
    
    if (totalImportados === jsonData.length) {
      console.log('\n🎉 Importação concluída com sucesso!');
    } else {
      console.log('\n⚠️  Importação concluída com alguns problemas.');
    }
    
  } catch (error) {
    console.error('\n💥 ERRO FATAL:', error.message);
    console.error(error.stack);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();