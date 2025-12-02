#!/usr/bin/env node
// ========================================
// MIGRADOR DE PLANOS - GESTÃO CLIENTES
// Migra clientes de um plano para outro
// filtrando por servidor
// ========================================

import readline from 'readline';
import pg from 'pg';

const { Pool } = pg;

// ========================================
// CONFIGURAÇÃO
// ========================================
const CONFIG = {
  userId: 37, // Isaac Mendes - altere conforme necessário
  dbUrl: process.env.DATABASE_URL || 'postgresql://gestao_user:Gestao_DB_Pass_2025!@postgres-gestao:5432/gestao_clientes'
};

const pool = new Pool({ connectionString: CONFIG.dbUrl });

// ========================================
// UTILITÁRIOS
// ========================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
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

async function getClientsByServerGroupedByPlan(userId, serverId) {
  const result = await pool.query(`
    SELECT 
      p.id as plan_id,
      p.name as plan_name,
      p.duration_months,
      p.num_screens,
      COUNT(c.id) as client_count,
      ARRAY_AGG(c.id) as client_ids,
      ARRAY_AGG(c.name) as client_names
    FROM clients c
    LEFT JOIN plans p ON c.plan_id = p.id
    WHERE c.user_id = $1 AND c.server_id = $2
    GROUP BY p.id, p.name, p.duration_months, p.num_screens
    ORDER BY p.name NULLS LAST
  `, [userId, serverId]);
  
  return result.rows;
}

async function migrateClients(clientIds, newPlanId) {
  const result = await pool.query(`
    UPDATE clients 
    SET plan_id = $1, updated_at = NOW()
    WHERE id = ANY($2)
    RETURNING id, name
  `, [newPlanId, clientIds]);
  
  return result.rows;
}

// ========================================
// MENU DE SELEÇÃO
// ========================================

async function selectServer(servers) {
  console.log('\n📡 SERVIDORES DISPONÍVEIS:');
  console.log('─'.repeat(50));
  servers.forEach((s, i) => {
    console.log(`  [${i + 1}] ${s.name} (ID: ${s.id})`);
  });
  console.log('─'.repeat(50));
  
  const choice = await question('Selecione o servidor (número): ');
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= servers.length) {
    console.log('❌ Opção inválida!');
    return selectServer(servers);
  }
  
  return servers[index];
}

async function selectPlanGroup(groups) {
  console.log('\n📦 PLANOS COM CLIENTES NESTE SERVIDOR:');
  console.log('─'.repeat(60));
  
  groups.forEach((g, i) => {
    const planName = g.plan_name || '⚠️  SEM PLANO DEFINIDO';
    const info = g.plan_id ? `(${g.duration_months} mês, ${g.num_screens} tela(s))` : '';
    console.log(`  [${i + 1}] ${planName} ${info}`);
    console.log(`       → ${g.client_count} cliente(s)`);
  });
  
  console.log('─'.repeat(60));
  
  const choice = await question('Selecione o plano de ORIGEM (número): ');
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= groups.length) {
    console.log('❌ Opção inválida!');
    return selectPlanGroup(groups);
  }
  
  return groups[index];
}

async function selectDestinationPlan(plans, excludePlanId) {
  console.log('\n🎯 PLANOS DE DESTINO DISPONÍVEIS:');
  console.log('─'.repeat(60));
  
  const availablePlans = plans.filter(p => p.id !== excludePlanId);
  
  availablePlans.forEach((p, i) => {
    console.log(`  [${i + 1}] ${p.name} (${p.duration_months} mês, ${p.num_screens} tela(s))`);
  });
  
  console.log('─'.repeat(60));
  
  const choice = await question('Selecione o plano de DESTINO (número): ');
  const index = parseInt(choice) - 1;
  
  if (index < 0 || index >= availablePlans.length) {
    console.log('❌ Opção inválida!');
    return selectDestinationPlan(plans, excludePlanId);
  }
  
  return availablePlans[index];
}

// ========================================
// MAIN
// ========================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║      MIGRADOR DE PLANOS - GESTÃO CLIENTES v1.0             ║');
  console.log('║      Migra clientes entre planos por servidor              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    // Testar conexão
    console.log('🔌 Conectando ao banco de dados...');
    await pool.query('SELECT 1');
    console.log('✅ Conexão estabelecida!');
    
    // Buscar servidores
    const servers = await getServers(CONFIG.userId);
    
    if (servers.length === 0) {
      console.log('\n❌ Nenhum servidor cadastrado!');
      process.exit(1);
    }
    
    // Loop principal - permite múltiplas migrações
    let continuar = true;
    
    while (continuar) {
      // Selecionar servidor
      const selectedServer = await selectServer(servers);
      console.log(`\n✅ Servidor selecionado: ${selectedServer.name}`);
      
      // Buscar clientes agrupados por plano
      const groups = await getClientsByServerGroupedByPlan(CONFIG.userId, selectedServer.id);
      
      if (groups.length === 0) {
        console.log('\n⚠️  Nenhum cliente encontrado neste servidor!');
        const retry = await question('\nDeseja selecionar outro servidor? (s/n): ');
        if (retry.toLowerCase() !== 's') {
          continuar = false;
        }
        continue;
      }
      
      // Mostrar resumo
      const totalClients = groups.reduce((sum, g) => sum + parseInt(g.client_count), 0);
      console.log(`\n📊 Total de clientes no servidor: ${totalClients}`);
      
      // Selecionar grupo de origem
      const sourceGroup = await selectPlanGroup(groups);
      const sourcePlanName = sourceGroup.plan_name || 'SEM PLANO';
      console.log(`\n✅ Plano de origem: ${sourcePlanName} (${sourceGroup.client_count} clientes)`);
      
      // Buscar planos e selecionar destino
      const plans = await getPlans(CONFIG.userId);
      const destPlan = await selectDestinationPlan(plans, sourceGroup.plan_id);
      console.log(`✅ Plano de destino: ${destPlan.name}`);
      
      // Mostrar prévia dos clientes
      console.log('\n📋 CLIENTES QUE SERÃO MIGRADOS:');
      console.log('─'.repeat(60));
      
      const clientNames = sourceGroup.client_names.slice(0, 10);
      clientNames.forEach((name, i) => {
        console.log(`  ${i + 1}. ${name}`);
      });
      
      if (sourceGroup.client_names.length > 10) {
        console.log(`  ... e mais ${sourceGroup.client_names.length - 10} cliente(s)`);
      }
      
      console.log('─'.repeat(60));
      
      // Confirmação
      console.log('\n' + '═'.repeat(60));
      console.log('📋 RESUMO DA MIGRAÇÃO:');
      console.log('═'.repeat(60));
      console.log(`   Servidor: ${selectedServer.name}`);
      console.log(`   Plano ORIGEM: ${sourcePlanName}`);
      console.log(`   Plano DESTINO: ${destPlan.name}`);
      console.log(`   Clientes afetados: ${sourceGroup.client_count}`);
      console.log('═'.repeat(60));
      
      const confirm = await question('\n⚠️  Confirma a migração? (s/n): ');
      
      if (confirm.toLowerCase() === 's') {
        // Executar migração
        console.log('\n🚀 Executando migração...');
        
        const migrated = await migrateClients(sourceGroup.client_ids, destPlan.id);
        
        console.log(`\n✅ ${migrated.length} cliente(s) migrado(s) com sucesso!`);
        console.log(`   ${sourcePlanName} → ${destPlan.name}`);
      } else {
        console.log('\n❌ Migração cancelada.');
      }
      
      // Perguntar se quer continuar
      const continuarResp = await question('\n🔄 Deseja fazer outra migração? (s/n): ');
      continuar = continuarResp.toLowerCase() === 's';
    }
    
    console.log('\n👋 Até mais!');
    
  } catch (error) {
    console.error('\n💥 ERRO FATAL:', error.message);
    console.error(error.stack);
  } finally {
    rl.close();
    await pool.end();
  }
}

main();
