/* ========================================
   WEBHOOK CONTROLLER - IPTV MANAGER
   Recebe webhooks do sistema principal
   e processa renovação automática CloudNation OU Sigma
   
   ✨ COM VALIDAÇÃO is_live21_plan
   ======================================== */

import CloudNationRenewalService from '../services/cloudnation-renewal.js';
import SigmaRenewalService from '../services/sigma-renewal.js';
import * as db from '../database.js';
import * as postgres from '../postgres.js';
import KofficeRenewalService from '../services/koffice-renewal.js';
import ClubRenewalService from '../services/club-renewal.js';
import PainelFodaRenewalService from '../services/painelfoda-renewal.js';
import RushRenewalService from '../services/rush-renewal.js';

const CAPTCHA_API_KEY = process.env.CAPTCHA_2CAPTCHA_API_KEY;
const CLUB_ANTICAPTCHA_KEY = process.env.CLUB_ANTICAPTCHA_KEY;
import UniplayRenewalService from '../services/uniplay-renewal.js';

/**
 * Webhook para renovação automática após pagamento
 * POST /api/webhooks/client-renewed
 * 
 * Payload esperado:
 * {
 *   client_id: 123,
 *   user_id: 2,
 *   plan_id: 5,
 *   client_name: "João Silva",
 *   whatsapp_number: "5585999999999",
 *   cloudnation_id: "789134030",  // ou username do sigma
 *   plan_duration_months: 3,
 *   is_sigma_plan: false,         // ← NOVO!
 *   is_live21_plan: true,          // ← NOVO!
 *   due_date: "2025-11-29",
 *   payment_id: "123456789",
 *   amount: 50.00
 * }
 */
export async function handleClientRenewalWebhook(req, res) {
  try {
    const webhookData = req.body;
    
    console.log('\n' + '='.repeat(60));
    console.log('🔔 [WEBHOOK] RENOVAÇÃO AUTOMÁTICA RECEBIDA');
    console.log('='.repeat(60));
    console.log('📦 Dados recebidos:', JSON.stringify(webhookData, null, 2));
    
    // ========== VALIDAÇÃO ==========
    const { 
      client_id,
      user_id, 
      plan_id,
      client_name,
      cloudnation_id,
      plan_duration_months,
      is_sigma_plan,
      is_live21_plan,
      is_koffice_plan,
      is_uniplay_plan,
      is_club_plan,
      is_rush_plan,        // ← ADICIONADO
      is_painelfoda_plan   // ← ADICIONADO
    } = webhookData;

    // Validações básicas (campos obrigatórios para TODOS)
    if (!client_id || !user_id || !plan_id || !plan_duration_months) {
      console.error('❌ [WEBHOOK] Dados incompletos no webhook');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['client_id', 'user_id', 'plan_id', 'plan_duration_months']
      });
    }

    // ========== DEFINIR QUAIS INTEGRAÇÕES USAM BUSCA POR NOME ==========
    // Uniplay, Rush e PainelFoda: usam "name" + "username" como sufixo (opcional)
    // Os demais (Sigma, CloudNation, Koffice, Club): usam "username" como ID direto
    const usesNameBasedSearch = is_uniplay_plan || is_rush_plan || is_painelfoda_plan;

    // Validação específica: cloudnation_id obrigatório EXCETO para integrações baseadas em nome
    // (CloudNation, Sigma, Koffice e Club usam cloudnation_id como ID direto)
    // (Uniplay, Rush e PainelFoda usam client_name + sufixos opcionais)
    if (!usesNameBasedSearch && !cloudnation_id) {
      console.error('❌ [WEBHOOK] cloudnation_id obrigatório para este tipo de plano');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['cloudnation_id'],
        message: 'CloudNation ID / Sigma Username / Koffice Client ID / Club Client ID é obrigatório'
      });
    }

    // Validação específica: client_name obrigatório para integrações baseadas em nome
    if (usesNameBasedSearch && !client_name) {
      console.error('❌ [WEBHOOK] client_name obrigatório para planos baseados em nome');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['client_name'],
        message: 'Nome do cliente é obrigatório para planos Uniplay/Rush/PainelFoda'
      });
    }

    // ========== BUSCAR INFORMAÇÕES DO PLANO ==========
    console.log(`\n🔍 [WEBHOOK] Buscando informações do plano ${plan_id}...`);
    
    const plan = await postgres.getPlanById(plan_id, user_id);
    
    if (!plan) {
      console.error(`❌ [WEBHOOK] Plano ${plan_id} não encontrado`);
      return res.status(404).json({ 
        error: 'Plano não encontrado',
        message: 'O plano do cliente não foi encontrado no sistema'
      });
    }

    console.log(`✅ [WEBHOOK] Plano encontrado: ${plan.name}`);
    console.log(`   📊 Is Sigma: ${plan.is_sigma_plan || false}`);
    console.log(`   📊 Is Live21: ${plan.is_live21_plan || false}`);
    console.log(`   📊 Is Koffice: ${plan.is_koffice_plan || false}`);
    console.log(`   📊 Is Uniplay: ${plan.is_uniplay_plan || false}`);
    console.log(`   📊 Is Club: ${plan.is_club_plan || false}`);
    console.log(`   📊 Is PainelFoda: ${plan.is_painelfoda_plan || false}`);
    console.log(`   📅 Duração: ${plan.duration_months} mês(es)`);
    console.log(`   🔌 Telas/Conexões: ${plan.num_screens}`);

    // ========== ✨ VALIDAÇÃO: Verificar se tem integração ==========
    if (!plan.is_sigma_plan && !plan.is_live21_plan && !plan.is_koffice_plan && !plan.is_uniplay_plan && !plan.is_club_plan && !plan.is_painelfoda_plan && !plan.is_rush_plan) {
      console.log('\n⚠️ [WEBHOOK] PLANO SEM INTEGRAÇÃO DE RENOVAÇÃO');
      console.log('   is_sigma_plan: false');
      console.log('   is_live21_plan: false');
      console.log('   is_koffice_plan: false');
      console.log('   is_uniplay_plan: false');
      console.log('   is_club_plan: false');
      console.log('   → Renovação automática NÃO será executada');
      console.log('   → Cliente foi renovado APENAS no banco de dados');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        skipped: true,
        reason: 'no_integration',
        message: 'Plano sem integração de renovação automática',
        data: {
          client_id: client_id,
          client_name: client_name,
          plan_id: plan_id
        }
      });
    }

    // ========== ROTEAR PARA O SERVIÇO CORRETO ==========
    
    if (plan.is_sigma_plan) {
      // ============= RENOVAÇÃO SIGMA =============
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO SIGMA');
      return await handleSigmaRenewal(req, res, webhookData, plan);
    }
    
    if (plan.is_live21_plan) {
      // ============= RENOVAÇÃO CLOUDNATION/LIVE21 =============
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO LIVE21/CLOUDNATION');
      return await handleCloudNationRenewal(req, res, webhookData, plan);
    }
    
    if (plan.is_koffice_plan) {
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO KOFFICE');
      return await handleKofficeRenewal(req, res, webhookData, plan);
    }

    // ← ADICIONAR AQUI:
    if (plan.is_uniplay_plan) {
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO UNIPLAY');
      return await handleUniplayRenewal(req, res, webhookData, plan);
    }

    if (plan.is_club_plan) {
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO CLUB');
      return await handleClubRenewal(req, res, webhookData, plan);
    }

    if (plan.is_rush_plan) {
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO RUSH');
      return await handleRushRenewal(req, res, webhookData, plan);
    }

    if (plan.is_painelfoda_plan) {
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO PAINELFODA');
      return await handlePainelFodaRenewal(req, res, webhookData, plan);
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK] ERRO CRÍTICO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    return res.status(500).json({ 
      success: false,
      error: 'Erro ao processar renovação automática',
      message: error.message 
    });
  }
}

/**
 * Handler específico para renovação CloudNation
 */
async function handleCloudNationRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    cloudnation_id, 
    plan_duration_months 
  } = webhookData;

  // ========== VERIFICAR CREDENCIAIS CLOUDNATION ==========
  console.log(`\n🔍 [WEBHOOK-CN] Buscando credenciais CloudNation do user ${user_id}...`);
  
  const credentials = db.getCredentials(user_id);
  
  if (!credentials) {
    console.error(`❌ [WEBHOOK-CN] Usuário ${user_id} não tem credenciais CloudNation cadastradas`);
    return res.status(404).json({ 
      error: 'Credenciais CloudNation não encontradas',
      message: 'O usuário precisa cadastrar credenciais no IPTV Manager primeiro'
    });
  }

  console.log(`✅ [WEBHOOK-CN] Credenciais encontradas para user ${user_id}`);

  // ========== VERIFICAR API KEY 2CAPTCHA ==========
  if (!CAPTCHA_API_KEY || CAPTCHA_API_KEY === 'SUA_CHAVE_2CAPTCHA_AQUI') {
    console.error('❌ [WEBHOOK-CN] API Key do 2Captcha não configurada');
    return res.status(500).json({ 
      error: 'Sistema de renovação não configurado (2Captcha)' 
    });
  }

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-CN] Iniciando renovação automática CloudNation...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🆔 CloudNation ID(s): ${cloudnation_id}`);
  console.log(`   📅 Plano: ${plan_duration_months} mês(es)`);

  // ========== PROCESSAR MÚLTIPLOS IDS (separados por vírgula) ==========
  const userIds = cloudnation_id
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  const totalUsuarios = userIds.length;
  
  if (totalUsuarios > 1) {
    console.log(`   📊 Detectados ${totalUsuarios} usuários para renovar`);
    userIds.forEach((id, index) => {
      console.log(`      [${index + 1}] ID: ${id}`);
    });
  }

  // Decodificar senha
  const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');
  
  // Criar serviço CloudNation
  const service = new CloudNationRenewalService(
    CAPTCHA_API_KEY,
    credentials.username,
    decodedPassword
  );

  // ========== FAZER LOGIN ==========
  console.log('\n🔑 [WEBHOOK-CN] Fazendo login no CloudNation...');
  await service.login();
  console.log('✅ [WEBHOOK-CN] Login realizado com sucesso!');

  // ========== RENOVAR TODOS OS USUÁRIOS ==========
  const resultadosGerais = [];
  
  for (let i = 0; i < totalUsuarios; i++) {
    const userId = userIds[i];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 [WEBHOOK-CN] USUÁRIO ${i + 1}/${totalUsuarios}: ${userId}`);
    console.log('='.repeat(60));
    
    let resultado;
    
    if (plan_duration_months === 1) {
      // Renovar apenas 1 mês
      console.log('🔄 [WEBHOOK-CN] Renovando 1 mês...');
      resultado = await service.renovarUsuario(userId);
    } else {
      // Renovar múltiplos meses (repetir renovação X vezes)
      console.log(`🔄 [WEBHOOK-CN] Renovando ${plan_duration_months} meses (${plan_duration_months}x renovações)...`);
      resultado = await service.renovarMultiplosMeses(userId, plan_duration_months);
    }
    
    resultadosGerais.push({
      userId: userId,
      resultado: resultado
    });
    
    // Aguardar entre usuários (se tiver mais)
    if (i < totalUsuarios - 1) {
      console.log('\n⏳ Aguardando 3s antes do próximo usuário...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // ========== VERIFICAR RESULTADO GERAL ==========
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 [WEBHOOK-CN] RESUMO DA RENOVAÇÃO');
  console.log('='.repeat(60));
  
  let totalSucessos = 0;
  let totalFalhas = 0;
  
  resultadosGerais.forEach((item, index) => {
    const sucesso = plan_duration_months === 1 
      ? item.resultado.sucesso 
      : item.resultado.sucessos === plan_duration_months;
    
    if (sucesso) {
      totalSucessos++;
      console.log(`✅ Usuário ${index + 1} (${item.userId}): SUCESSO`);
    } else {
      totalFalhas++;
      console.log(`❌ Usuário ${index + 1} (${item.userId}): FALHOU`);
    }
  });
  
  console.log('');
  console.log(`📈 Total: ${totalUsuarios} usuário(s)`);
  console.log(`✅ Sucessos: ${totalSucessos}`);
  console.log(`❌ Falhas: ${totalFalhas}`);
  console.log('='.repeat(60) + '\n');
  
  const sucessoGeral = totalSucessos === totalUsuarios;

  if (sucessoGeral) {
    console.log('✅ [WEBHOOK-CN] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60) + '\n');
    
    return res.json({
      success: true,
      provider: 'cloudnation',
      message: 'Renovação automática CloudNation concluída com sucesso',
      data: {
        client_id: client_id,
        client_name: client_name,
        cloudnation_ids: userIds,
        plan_duration_months: plan_duration_months,
        total_usuarios: totalUsuarios,
        sucessos: totalSucessos,
        falhas: totalFalhas,
        resultados: resultadosGerais
      }
    });
  } else {
    console.error('\n❌ [WEBHOOK-CN] RENOVAÇÃO FALHOU!');
    console.log('='.repeat(60) + '\n');
    
    return res.status(500).json({
      success: false,
      provider: 'cloudnation',
      message: 'Renovação automática CloudNation falhou',
      data: {
        client_id: client_id,
        cloudnation_ids: userIds,
        total_usuarios: totalUsuarios,
        sucessos: totalSucessos,
        falhas: totalFalhas,
        resultados: resultadosGerais
      }
    });
  }
}

/**
 * Handler específico para renovação Sigma
 */
async function handleSigmaRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    cloudnation_id,  // Na verdade é o username(s) do cliente no Sigma
    plan_duration_months  // ⚠️ ESTE CAMPO SERÁ IGNORADO!
  } = webhookData;

  // ========== VERIFICAR DOMÍNIO SIGMA ==========
  if (!plan.sigma_domain) {
    console.error(`❌ [WEBHOOK-SIGMA] Plano ${plan.id} não tem domínio Sigma configurado`);
    return res.status(400).json({ 
      error: 'Domínio Sigma não configurado',
      message: 'O plano Sigma precisa ter um domínio configurado'
    });
  }

  console.log(`\n🔍 [WEBHOOK-SIGMA] Domínio Sigma: ${plan.sigma_domain}`);

  // ========== VERIFICAR CREDENCIAIS SIGMA ==========
  console.log(`\n🔍 [WEBHOOK-SIGMA] Buscando credenciais Sigma para ${plan.sigma_domain}...`);
  
  const credentials = db.getSigmaCredentialByDomain(user_id, plan.sigma_domain);
  
  if (!credentials) {
    console.error(`❌ [WEBHOOK-SIGMA] Usuário ${user_id} não tem credenciais Sigma para ${plan.sigma_domain}`);
    return res.status(404).json({ 
      error: 'Credenciais Sigma não encontradas',
      message: `O usuário precisa cadastrar credenciais Sigma para o domínio ${plan.sigma_domain}`
    });
  }

  console.log(`✅ [WEBHOOK-SIGMA] Credenciais encontradas para ${plan.sigma_domain}`);

  // ========== VERIFICAR PACKAGE_ID ==========
  if (!plan.sigma_plan_code) {
    console.error(`❌ [WEBHOOK-SIGMA] Plano ${plan.id} não tem código de pacote Sigma (sigma_plan_code)`);
    return res.status(400).json({ 
      error: 'Código de pacote Sigma não configurado',
      message: 'O plano Sigma precisa ter um código de pacote (sigma_plan_code) configurado'
    });
  }

  // ========== 🆕 PROCESSAR MÚLTIPLOS USERNAMES (separados por vírgula) ==========
  console.log('\n🔍 [WEBHOOK-SIGMA] Processando username(s)...');
  console.log(`   📝 Campo recebido: "${cloudnation_id}"`);
  
  const sigmaUsernames = cloudnation_id
    .split(',')
    .map(username => username.trim())
    .filter(username => username.length > 0);
  
  const totalUsuarios = sigmaUsernames.length;
  
  console.log(`   👥 Total de usuários detectados: ${totalUsuarios}`);
  
  if (totalUsuarios > 1) {
    console.log(`   📊 Múltiplos usuários para renovar:`);
    sigmaUsernames.forEach((username, index) => {
      console.log(`      [${index + 1}] Username: ${username}`);
    });
  } else {
    console.log(`   👤 Usuário único: ${sigmaUsernames[0]}`);
  }

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-SIGMA] Iniciando renovação automática Sigma...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🌐 Domínio: ${plan.sigma_domain}`);
  console.log(`   📦 Package ID: ${plan.sigma_plan_code}`);
  console.log(`   🔌 Conexões: ${plan.num_screens}`);
  console.log(`   ⚠️  plan_duration_months (${plan_duration_months}) será IGNORADO`);
  console.log(`   ℹ️  Motivo: Package ID já contém a duração automaticamente`);

  // Criar serviço Sigma COM PROXY
  const service = new SigmaRenewalService(
    plan.sigma_domain,
    credentials.username,
    credentials.password,
    true  // ← ADICIONAR ESTE PARÂMETRO (useProxy = true)
  );

  try {
    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [WEBHOOK-SIGMA] Fazendo login no painel Sigma...');
    await service.login();
    console.log('✅ [WEBHOOK-SIGMA] Login realizado com sucesso!');

    // ========== 🆕 RENOVAR TODOS OS USUÁRIOS (1 vez cada) ==========
    const resultadosGerais = [];
    
    for (let i = 0; i < totalUsuarios; i++) {
      const username = sigmaUsernames[i];
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 [WEBHOOK-SIGMA] USUÁRIO ${i + 1}/${totalUsuarios}: ${username}`);
      console.log('='.repeat(60));
      
      try {
        // 🆕 PRIMEIRO: Buscar cliente pelo username para obter o ID interno
        console.log('🔍 [WEBHOOK-SIGMA] Buscando cliente pelo username...');
        const customer = await service.findCustomerByUsername(username);
        
        if (!customer || !customer.id) {
          console.error(`❌ [WEBHOOK-SIGMA] Cliente não encontrado: ${username}`);
          resultadosGerais.push({
            username: username,
            resultado: { sucesso: false, error: 'Cliente não encontrado no Sigma' }
          });
          continue;
        }
        
        console.log(`✅ [WEBHOOK-SIGMA] Cliente encontrado! ID interno: ${customer.id}`);
        
        // ⚠️ SEMPRE RENOVAR APENAS 1 VEZ
        // O Package ID já contém a duração (1 mês, 3 meses, etc)
        console.log('🔄 [WEBHOOK-SIGMA] Renovando 1 vez (package ID contém duração)...');
        
        const resultado = await service.renewClient(
          customer.id,  // ✅ Usar o ID interno, não o username!
          plan.sigma_plan_code,
          plan.num_screens
        );
        
        resultadosGerais.push({
          username: username,
          sigma_id: customer.id,
          resultado: { sucesso: resultado.success, ...resultado }
        });
        
      } catch (error) {
        console.error(`❌ [WEBHOOK-SIGMA] Erro ao processar ${username}: ${error.message}`);
        resultadosGerais.push({
          username: username,
          resultado: { sucesso: false, error: error.message }
        });
      }
      
      // Aguardar entre usuários (se tiver mais)
      if (i < totalUsuarios - 1) {
        console.log('\n⏳ Aguardando 3s antes do próximo usuário...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // ========== FAZER LOGOUT ==========
    //await service.logout();

    // ========== VERIFICAR RESULTADO GERAL ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 [WEBHOOK-SIGMA] RESUMO DA RENOVAÇÃO');
    console.log('='.repeat(60));
    
    let totalSucessos = 0;
    let totalFalhas = 0;
    
    resultadosGerais.forEach((item, index) => {
      if (item.resultado.sucesso) {
        totalSucessos++;
        console.log(`✅ Usuário ${index + 1} (${item.username}): SUCESSO`);
      } else {
        totalFalhas++;
        console.log(`❌ Usuário ${index + 1} (${item.username}): FALHOU`);
      }
    });
    
    console.log('');
    console.log(`📈 Total: ${totalUsuarios} usuário(s)`);
    console.log(`✅ Sucessos: ${totalSucessos}`);
    console.log(`❌ Falhas: ${totalFalhas}`);
    console.log('='.repeat(60) + '\n');
    
    const sucessoGeral = totalSucessos === totalUsuarios;

    if (sucessoGeral) {
      console.log('✅ [WEBHOOK-SIGMA] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'sigma',
        message: 'Renovação automática Sigma concluída com sucesso',
        data: {
          client_id: client_id,
          client_name: client_name,
          sigma_usernames: sigmaUsernames,
          sigma_domain: plan.sigma_domain,
          package_id: plan.sigma_plan_code,
          connections: plan.num_screens,
          total_usuarios: totalUsuarios,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultadosGerais,
          nota: 'plan_duration_months foi ignorado - Package ID já contém a duração'
        }
      });
    } else {
      console.error('\n❌ [WEBHOOK-SIGMA] RENOVAÇÃO FALHOU!');
      console.log('Resultados:', JSON.stringify(resultadosGerais, null, 2));
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'sigma',
        message: 'Renovação automática Sigma falhou',
        data: {
          client_id: client_id,
          sigma_usernames: sigmaUsernames,
          sigma_domain: plan.sigma_domain,
          total_usuarios: totalUsuarios,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultadosGerais
        }
      });
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK-SIGMA] ERRO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    // Tentar fazer logout mesmo com erro
    // try {
    //   await service.logout();
    // } catch (logoutError) {
    //   console.error('⚠️ Erro no logout:', logoutError.message);
    // }
    
    return res.status(500).json({ 
      success: false,
      provider: 'sigma',
      error: 'Erro ao processar renovação Sigma',
      message: error.message 
    });
  }
}

/**
 * Handler específico para renovação Koffice
 * 
 * DIFERENÇA DOS OUTROS SISTEMAS:
 * - CloudNation: Precisa renovar N vezes (1 mês por requisição)
 * - Sigma: Precisa renovar N vezes (1 período por requisição)
 * - Koffice: Renova N meses em 1 requisição ✅
 */
async function handleKofficeRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    cloudnation_id,  // Pode ter múltiplos IDs separados por vírgula
    plan_duration_months 
  } = webhookData;

  // ========== VERIFICAR DOMÍNIO KOFFICE ==========
  if (!plan.koffice_domain) {
    console.error(`❌ [WEBHOOK-KOFFICE] Plano ${plan.id} não tem domínio Koffice configurado`);
    return res.status(400).json({ 
      error: 'Domínio Koffice não configurado',
      message: 'O plano Koffice precisa ter um domínio configurado'
    });
  }

  console.log(`\n🔍 [WEBHOOK-KOFFICE] Domínio Koffice: ${plan.koffice_domain}`);

  // ========== VERIFICAR CREDENCIAIS KOFFICE ==========
  console.log(`\n🔍 [WEBHOOK-KOFFICE] Buscando credenciais Koffice para ${plan.koffice_domain}...`);
  
  const credentials = db.getKofficeCredentialByDomain(user_id, plan.koffice_domain);
  
  if (!credentials) {
    console.error(`❌ [WEBHOOK-KOFFICE] Usuário ${user_id} não tem credenciais Koffice para ${plan.koffice_domain}`);
    return res.status(404).json({ 
      error: 'Credenciais Koffice não encontradas',
      message: `O usuário precisa cadastrar credenciais Koffice para o domínio ${plan.koffice_domain}`
    });
  }

  console.log(`✅ [WEBHOOK-KOFFICE] Credenciais encontradas para ${plan.koffice_domain}`);

  // ========== 🆕 PROCESSAR MÚLTIPLOS CLIENT IDS (separados por vírgula) ==========
  console.log('\n🔍 [WEBHOOK-KOFFICE] Processando Client ID(s)...');
  console.log(`   📝 Campo recebido: "${cloudnation_id}"`);
  
  const kofficeClientIds = cloudnation_id
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  const totalClientes = kofficeClientIds.length;
  
  console.log(`   👥 Total de clientes detectados: ${totalClientes}`);
  
  if (totalClientes > 1) {
    console.log(`   📊 Múltiplos clientes para renovar:`);
    kofficeClientIds.forEach((id, index) => {
      console.log(`      [${index + 1}] Client ID: ${id}`);
    });
  } else {
    console.log(`   👤 Cliente único: ${kofficeClientIds[0]}`);
  }

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-KOFFICE] Iniciando renovação automática Koffice...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🆔 Koffice Client IDs: ${kofficeClientIds.join(', ')}`);
  console.log(`   🌐 Domínio: ${plan.koffice_domain}`);
  console.log(`   📅 Meses: ${plan_duration_months}`);
  console.log(`   ✨ Vantagem: Renovação de ${plan_duration_months} mês(es) em 1 requisição por cliente!`);

  // Criar serviço Koffice
  const service = new KofficeRenewalService(
    plan.koffice_domain,
    credentials.username,
    credentials.password
  );

  try {
    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [WEBHOOK-KOFFICE] Fazendo login no painel Koffice...');
    await service.login();
    console.log('✅ [WEBHOOK-KOFFICE] Login realizado com sucesso!');

    // ========== RENOVAR TODOS OS CLIENTES ==========
    const resultadosGerais = [];
    
    for (let i = 0; i < totalClientes; i++) {
      const kofficeClientId = kofficeClientIds[i];
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 [WEBHOOK-KOFFICE] CLIENTE ${i + 1}/${totalClientes}: ${kofficeClientId}`);
      console.log('='.repeat(60));
      console.log(`🔄 Renovando ${plan_duration_months} mês(es) em 1 requisição...`);
      
      try {
        const resultado = await service.renovarCliente(
          kofficeClientId,
          plan_duration_months
        );
        
        resultadosGerais.push({
          kofficeClientId: kofficeClientId,
          sucesso: resultado.sucesso,
          resultado: resultado
        });
        
        if (resultado.sucesso) {
          console.log(`✅ Cliente ${kofficeClientId} renovado com sucesso!`);
          if (resultado.data && resultado.data.message) {
            console.log(`   Mensagem: ${resultado.data.message}`);
          }
        } else {
          console.error(`❌ Cliente ${kofficeClientId} falhou:`, resultado.error || 'Erro desconhecido');
        }
      } catch (error) {
        console.error(`❌ Erro ao renovar cliente ${kofficeClientId}:`, error.message);
        resultadosGerais.push({
          kofficeClientId: kofficeClientId,
          sucesso: false,
          resultado: { sucesso: false, error: error.message }
        });
      }
      
      // Aguardar entre clientes (se tiver mais)
      if (i < totalClientes - 1) {
        console.log('\n⏳ Aguardando 2s antes do próximo cliente...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // ========== FAZER LOGOUT ==========
    console.log('\n🔓 [WEBHOOK-KOFFICE] Fazendo logout...');
    await service.logout();
    console.log('✅ [WEBHOOK-KOFFICE] Logout realizado');

    // ========== VERIFICAR RESULTADO GERAL ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 [WEBHOOK-KOFFICE] RESUMO DA RENOVAÇÃO');
    console.log('='.repeat(60));
    
    let totalSucessos = 0;
    let totalFalhas = 0;
    
    resultadosGerais.forEach((item, index) => {
      if (item.sucesso) {
        totalSucessos++;
        console.log(`✅ Cliente ${index + 1} (${item.kofficeClientId}): SUCESSO`);
      } else {
        totalFalhas++;
        console.log(`❌ Cliente ${index + 1} (${item.kofficeClientId}): FALHOU`);
      }
    });
    
    console.log('');
    console.log(`📈 Total: ${totalClientes} cliente(s)`);
    console.log(`✅ Sucessos: ${totalSucessos}`);
    console.log(`❌ Falhas: ${totalFalhas}`);
    console.log(`⏱️  Meses renovados por cliente: ${plan_duration_months}`);
    console.log('='.repeat(60) + '\n');
    
    const sucessoGeral = totalSucessos === totalClientes;
    
    if (sucessoGeral) {
      console.log('✅ [WEBHOOK-KOFFICE] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'koffice',
        message: 'Renovação automática Koffice concluída com sucesso',
        data: {
          client_id: client_id,
          client_name: client_name,
          koffice_client_ids: kofficeClientIds,
          koffice_domain: plan.koffice_domain,
          plan_duration_months: plan_duration_months,
          total_clientes: totalClientes,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultadosGerais
        }
      });
    } else {
      console.error('\n❌ [WEBHOOK-KOFFICE] RENOVAÇÃO FALHOU!');
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'koffice',
        message: 'Renovação automática Koffice falhou',
        data: {
          client_id: client_id,
          koffice_client_ids: kofficeClientIds,
          koffice_domain: plan.koffice_domain,
          total_clientes: totalClientes,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultadosGerais
        }
      });
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK-KOFFICE] ERRO CRÍTICO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    // Tentar fazer logout mesmo com erro
    try {
      await service.logout();
    } catch (logoutError) {
      console.error('⚠️ Erro no logout:', logoutError.message);
    }
    
    return res.status(500).json({ 
      success: false,
      provider: 'koffice',
      error: 'Erro ao processar renovação Koffice',
      message: error.message,
      data: {
        client_id: client_id,
        koffice_client_ids: cloudnation_id.split(',').map(id => id.trim())
      }
    });
  }
}

/**
 * Health check do sistema de webhooks
 * GET /api/webhooks/health
 */
export async function webhookHealthCheck(req, res) {
  const hasCaptchaKey = CAPTCHA_API_KEY && CAPTCHA_API_KEY !== 'SUA_CHAVE_2CAPTCHA_AQUI';
  
  res.json({
    status: 'ok',
    service: 'IPTV Manager Webhook System',
    features: {
      cloudnation_renewal: true,
      sigma_renewal: true,
      koffice_renewal: true,
      uniplay_renewal: true,  // ← ADICIONAR
      live21_validation: true,  // ← NOVO!
      captcha_configured: hasCaptchaKey
    },
    timestamp: new Date().toISOString()
  });
}


/**
 * Handler específico para renovação Club
 */
async function handleClubRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    cloudnation_id,  // Pode ter múltiplos IDs separados por vírgula
    plan_duration_months 
  } = webhookData;

  // ========== VERIFICAR CREDENCIAIS CLUB ==========
  console.log(`\n🔍 [WEBHOOK-CLUB] Buscando credenciais Club do user ${user_id}...`);
  
  const credentials = db.getClubCredentials(user_id);
  
  if (!credentials) {
    console.error(`❌ [WEBHOOK-CLUB] Usuário ${user_id} não tem credenciais Club cadastradas`);
    return res.status(404).json({ 
      error: 'Credenciais Club não encontradas',
      message: 'O usuário precisa cadastrar credenciais no IPTV Manager primeiro'
    });
  }

  console.log(`✅ [WEBHOOK-CLUB] Credenciais encontradas para user ${user_id}`);

  // ========== VERIFICAR API KEY ANTI-CAPTCHA ==========
  if (!CLUB_ANTICAPTCHA_KEY || CLUB_ANTICAPTCHA_KEY === 'SUA_CHAVE_ANTICAPTCHA_AQUI') {
    console.error('❌ [WEBHOOK-CLUB] API Key do Anti-Captcha não configurada');
    return res.status(500).json({ 
      error: 'Sistema de renovação Club não configurado (Anti-Captcha)' 
    });
  }

  // ========== 🆕 PROCESSAR MÚLTIPLOS IDS (separados por vírgula) ==========
  console.log('\n🔍 [WEBHOOK-CLUB] Processando username(s)...');
  console.log(`   📝 Campo recebido: "${cloudnation_id}"`);
  
  const clubClientIds = cloudnation_id
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  const totalClientes = clubClientIds.length;
  
  console.log(`   👥 Total de clientes detectados: ${totalClientes}`);
  
  if (totalClientes > 1) {
    console.log(`   📊 Múltiplos clientes para renovar:`);
    clubClientIds.forEach((id, index) => {
      console.log(`      [${index + 1}] Club ID: ${id}`);
    });
  } else {
    console.log(`   👤 Cliente único: ${clubClientIds[0]}`);
  }

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-CLUB] Iniciando renovação automática Club...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🆔 Club Client IDs: ${clubClientIds.join(', ')}`);
  console.log(`   📅 Duração: ${plan_duration_months} mês(es)`);

  // Decodificar senha
  const decodedPassword = Buffer.from(credentials.password, 'base64').toString('utf-8');
  
  // Criar serviço Club
  const service = new ClubRenewalService(
    CLUB_ANTICAPTCHA_KEY,
    credentials.username,
    decodedPassword
  );

  try {
    // ========== FAZER LOGIN ==========
    await service.login();
    
    // ========== RENOVAR TODOS OS CLIENTES ==========
    const resultadosGerais = [];
    
    for (let i = 0; i < totalClientes; i++) {
      const clubClientId = clubClientIds[i];
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 [WEBHOOK-CLUB] CLIENTE ${i + 1}/${totalClientes}: ${clubClientId}`);
      console.log('='.repeat(60));
      
      try {
        const resultado = await service.renovarCliente(clubClientId, plan_duration_months);
        
        resultadosGerais.push({
          clubClientId: clubClientId,
          sucesso: resultado.sucesso,
          resultado: resultado
        });
        
        if (resultado.sucesso) {
          console.log(`✅ Cliente ${clubClientId} renovado com sucesso!`);
          console.log(`   Novo vencimento: ${new Date(resultado.novoVencimento * 1000).toLocaleString('pt-BR')}`);
        } else {
          console.error(`❌ Cliente ${clubClientId} falhou:`, resultado.erro);
        }
      } catch (error) {
        console.error(`❌ Erro ao renovar cliente ${clubClientId}:`, error.message);
        resultadosGerais.push({
          clubClientId: clubClientId,
          sucesso: false,
          resultado: { sucesso: false, erro: error.message }
        });
      }
      
      // Aguardar entre clientes (se tiver mais)
      if (i < totalClientes - 1) {
        console.log('\n⏳ Aguardando 3s antes do próximo cliente...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    // ========== VERIFICAR RESULTADO GERAL ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 [WEBHOOK-CLUB] RESUMO DA RENOVAÇÃO');
    console.log('='.repeat(60));
    
    let totalSucessos = 0;
    let totalFalhas = 0;
    
    resultadosGerais.forEach((item, index) => {
      if (item.sucesso) {
        totalSucessos++;
        console.log(`✅ Cliente ${index + 1} (${item.clubClientId}): SUCESSO`);
      } else {
        totalFalhas++;
        console.log(`❌ Cliente ${index + 1} (${item.clubClientId}): FALHOU`);
      }
    });
    
    console.log('');
    console.log(`📈 Total: ${totalClientes} cliente(s)`);
    console.log(`✅ Sucessos: ${totalSucessos}`);
    console.log(`❌ Falhas: ${totalFalhas}`);
    console.log('='.repeat(60) + '\n');
    
    const sucessoGeral = totalSucessos === totalClientes;
    
    if (sucessoGeral) {
      console.log('✅ [WEBHOOK-CLUB] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'club',
        message: 'Renovação automática Club concluída com sucesso',
        data: {
          client_id: client_id,
          client_name: client_name,
          club_client_ids: clubClientIds,
          plan_duration_months: plan_duration_months,
          total_clientes: totalClientes,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultadosGerais
        }
      });
    } else {
      console.error('\n❌ [WEBHOOK-CLUB] RENOVAÇÃO FALHOU!');
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'club',
        message: 'Renovação automática Club falhou',
        data: {
          client_id: client_id,
          club_client_ids: clubClientIds,
          total_clientes: totalClientes,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultadosGerais
        }
      });
    }
    
  } catch (error) {
    console.error('\n💥 [WEBHOOK-CLUB] ERRO CRÍTICO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    return res.status(500).json({ 
      success: false,
      provider: 'club',
      error: 'Erro ao processar renovação automática Club',
      message: error.message,
      data: {
        client_id: client_id,
        club_client_ids: cloudnation_id.split(',').map(id => id.trim())
      }
    });
  }
}

/**
 * Handler específico para renovação PainelFoda
 * 
 * DIFERENÇAS DOS OUTROS SISTEMAS:
 * - CloudNation: Renova 1 mês por vez (loop de meses)
 * - Sigma: Package já define a duração
 * - Koffice: Renova N meses em 1 requisição
 * - PainelFoda: Package já define a duração ✅
 * 
 * ABORDAGEM HÍBRIDA:
 * - Se username vazio: Renova 1 cliente com max_connections
 * - Se username preenchido: Loop de telas (igual Uniplay)
 */
async function handlePainelFodaRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    username,              // 🆕 ID interno (PRIORIDADE)
    suffix,                // 🆕 Sufixos separados
    cloudnation_id,        // Mantido para compatibilidade
    plan_duration_months
  } = webhookData;

  // ========== VALIDAÇÃO: Credenciais do plano ==========
  if (!plan.painelfoda_domain || !plan.painelfoda_username || !plan.painelfoda_password) {
    console.error(`❌ [WEBHOOK-PAINELFODA] Plano ${plan.id} não tem credenciais configuradas`);
    return res.status(400).json({ 
      error: 'Credenciais PainelFoda não configuradas',
      message: 'O plano precisa ter domínio, usuário e senha configurados'
    });
  }

  if (!plan.painelfoda_package_id) {
    console.error(`❌ [WEBHOOK-PAINELFODA] Plano ${plan.id} não tem package_id configurado`);
    return res.status(400).json({ 
      error: 'Package ID não configurado',
      message: 'O plano precisa ter um package_id configurado'
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 [WEBHOOK-PAINELFODA] Detectado: PLANO PAINELFODA');
  console.log('='.repeat(60));
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🌐 Domínio: ${plan.painelfoda_domain}`);
  console.log(`   📦 Package ID: ${plan.painelfoda_package_id}`);
  console.log(`   🔌 Conexões: ${plan.num_screens}`);
  console.log(`   ⚠️  plan_duration_months (${plan_duration_months}) será IGNORADO`);
  console.log(`   ℹ️  Motivo: Package ID já contém a duração automaticamente`);

  // ========== PROCESSAR MÚLTIPLAS TELAS ==========
  // ========== PROCESSAR RENOVAÇÃO ==========
  let telasParaRenovar = [];

  // 🆕 PRIORIDADE 1: Se username (ID interno) preenchido, usa direto
  if (username && username.trim().length > 0) {
    const idsDiretos = username
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    console.log('\n📋 [WEBHOOK-PAINELFODA] Cenário: ID INTERNO (PRIORIDADE)');
    console.log(`   → Modo: Renovação DIRETA por ID`);
    console.log(`   → IDs: ${idsDiretos.join(', ')}`);
    console.log(`   → Total: ${idsDiretos.length} cliente(s)`);
    console.log(`   → Conexões: ${plan.num_screens}`);
    
    telasParaRenovar = idsDiretos.map(id => ({
      id: id,
      nome: null,
      connections: plan.num_screens,
      usarIdDireto: true
    }));

  // 🆕 PRIORIDADE 2: Se suffix preenchido, usa nome + sufixo
  } else if (suffix && suffix.trim().length > 0) {
    const sufixos = suffix
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log('\n📋 [WEBHOOK-PAINELFODA] Cenário: NOME + SUFIXOS');
    console.log(`   → Nome base: "${client_name}"`);
    console.log(`   → Sufixos: ${sufixos.join(', ')}`);
    console.log(`   → Total: ${sufixos.length} tela(s)`);
    
    telasParaRenovar = sufixos.map((sufixo, index) => {
      const nomeCompleto = `${client_name} ${sufixo}`;
      console.log(`   [${index + 1}] "${nomeCompleto}" (${plan.num_screens} conexões)`);
      return { nome: nomeCompleto, connections: plan.num_screens, usarIdDireto: false };
    });

  // 🆕 FALLBACK: cloudnation_id (compatibilidade)
  } else if (cloudnation_id && cloudnation_id.trim().length > 0) {
    const telas = cloudnation_id
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);
    
    console.log('\n📋 [WEBHOOK-PAINELFODA] Cenário: COMPATIBILIDADE (cloudnation_id)');
    console.log(`   → Total de telas: ${telas.length}`);
    
    telasParaRenovar = telas.map((tela, index) => {
      const nomeCompleto = `${client_name} ${tela}`;
      console.log(`   [${index + 1}] "${nomeCompleto}" (${plan.num_screens} conexões)`);
      return { nome: nomeCompleto, connections: plan.num_screens, usarIdDireto: false };
    });

  } else {
    // Cenário final: Nome único
    console.log('\n📋 [WEBHOOK-PAINELFODA] Cenário: NOME ÚNICO');
    console.log(`   → Buscar: "${client_name}"`);
    console.log(`   → Conexões: ${plan.num_screens}`);
    telasParaRenovar = [{ nome: client_name, connections: plan.num_screens, usarIdDireto: false }];
  }

  // ========== INICIAR RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-PAINELFODA] Iniciando renovação automática...\n');

  // Decodificar senha
  const decodedPassword = Buffer.from(plan.painelfoda_password, 'base64').toString('utf-8');

  // Criar serviço PainelFoda
  const service = new PainelFodaRenewalService(
    plan.painelfoda_domain,
    plan.painelfoda_username,
    decodedPassword
  );

  try {
    // ========== FAZER LOGIN (1 vez só) ==========
    console.log('🔑 [WEBHOOK-PAINELFODA] Fazendo login...');
    await service.login();
    console.log('✅ [WEBHOOK-PAINELFODA] Login realizado com sucesso!\n');

    // ========== CAPTURAR MEMBER ID ==========
    console.log('🔍 [WEBHOOK-PAINELFODA] Capturando member_id...');
    const memberId = await service.getMemberId();
    
    if (!memberId) {
      console.error('❌ [WEBHOOK-PAINELFODA] Não foi possível capturar o member_id');
      return res.status(500).json({
        success: false,
        provider: 'painelfoda',
        error: 'Não foi possível capturar o member_id'
      });
    }
    
    console.log(`✅ [WEBHOOK-PAINELFODA] Member ID: ${memberId}\n`);

    // ========== LISTAR TODOS OS CLIENTES ==========
    console.log('📥 [WEBHOOK-PAINELFODA] Carregando todos os clientes...');
    console.log('   ⚠️  Isso pode levar alguns segundos...\n');
    
    await service.listClients(memberId);
    
    console.log('✅ [WEBHOOK-PAINELFODA] Clientes carregados!\n');

    // ========== RENOVAR CADA TELA ==========
    const resultados = [];
    let totalSucessos = 0;
    let totalFalhas = 0;

    for (let i = 0; i < telasParaRenovar.length; i++) {
      const { nome, connections, usarIdDireto, id } = telasParaRenovar[i];
      
      console.log('─'.repeat(60));
      console.log(`🔄 [WEBHOOK-PAINELFODA] Renovando ${i + 1}/${telasParaRenovar.length}`);
      console.log(`   ${usarIdDireto ? `ID Direto: ${id}` : `Cliente: "${nome}"`}`);
      console.log('─'.repeat(60));

      let cliente;
      let clienteId;

      // 🆕 Se usar ID direto, não precisa buscar
      if (usarIdDireto) {
        console.log(`✅ [WEBHOOK-PAINELFODA] Usando ID direto: ${id}`);
        clienteId = id;
        cliente = { id: id, username: `ID-${id}` };
      } else {
        // ========== BUSCAR CLIENTE POR NOME ==========
        cliente = service.findClientByName(nome);
        
        if (!cliente) {
          console.error(`\n❌ [WEBHOOK-PAINELFODA] Cliente "${nome}" NÃO encontrado!`);
          console.log('─'.repeat(60) + '\n');
          
          return res.status(404).json({
            success: false,
            provider: 'painelfoda',
            error: `Cliente "${nome}" não encontrado no PainelFoda`,
            message: `Verifique se o nome está cadastrado corretamente no painel`
          });
        }
        
        clienteId = cliente.id;
        console.log(`✅ [WEBHOOK-PAINELFODA] Cliente encontrado!`);
        console.log(`   ID: ${cliente.id}`);
        console.log(`   Username: ${cliente.username}`);
      }

      // ========== RENOVAR ==========
      const resultado = await service.renewClient(
        clienteId,
        plan.painelfoda_package_id,
        connections
      );

      if (resultado.success) {
        totalSucessos++;
        console.log(`✅ [WEBHOOK-PAINELFODA] Renovação ${i + 1} concluída com sucesso!`);
      } else {
        totalFalhas++;
        console.error(`❌ [WEBHOOK-PAINELFODA] Renovação ${i + 1} falhou: ${resultado.message || resultado.error}`);
      }

      console.log('─'.repeat(60) + '\n');

      resultados.push({
        tela: nome,
        client_id: cliente.id,
        username: cliente.username,
        ...resultado
      });

      // Delay entre renovações
      if (i < telasParaRenovar.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // ========== RESULTADO FINAL ==========
    console.log('='.repeat(60));
    
    if (totalFalhas === 0) {
      console.log('✅ [WEBHOOK-PAINELFODA] TODAS AS RENOVAÇÕES CONCLUÍDAS COM SUCESSO!');
      console.log('='.repeat(60));
      console.log(`📊 Total de telas: ${telasParaRenovar.length}`);
      console.log(`✅ Sucessos: ${totalSucessos}`);
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'painelfoda',
        message: 'Renovação automática PainelFoda concluída com sucesso',
        data: {
          client_id: client_id,
          client_name: client_name,
          painelfoda_domain: plan.painelfoda_domain,
          package_id: plan.painelfoda_package_id,
          total_telas: telasParaRenovar.length,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultados
        }
      });
    } else {
      console.log('⚠️  [WEBHOOK-PAINELFODA] RENOVAÇÃO CONCLUÍDA COM ERROS');
      console.log('='.repeat(60));
      console.log(`📊 Total de telas: ${telasParaRenovar.length}`);
      console.log(`✅ Sucessos: ${totalSucessos}`);
      console.log(`❌ Falhas: ${totalFalhas}`);
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'painelfoda',
        message: 'Renovação automática PainelFoda falhou',
        data: {
          client_id: client_id,
          painelfoda_domain: plan.painelfoda_domain,
          total_telas: telasParaRenovar.length,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados: resultados
        }
      });
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK-PAINELFODA] ERRO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    return res.status(500).json({ 
      success: false,
      provider: 'painelfoda',
      error: 'Erro ao processar renovação PainelFoda',
      message: error.message 
    });
  }
}

/**
 * Handler específico para renovação Rush
 * 
 * CARACTERÍSTICAS DO RUSH:
 * - Sem captcha
 * - Sem proxy
 * - API REST pura
 * - Busca por nome (campo notes)
 * - Suporta IPTV e P2P
 * - Multi-mês em 1 request
 * 
 * LÓGICA DE NOME COMPOSTO:
 * - name: "João Silva"
 * - cloudnation_id (username): "tela 1, tela 2"
 * - Resultado: busca "João Silva tela 1", "João Silva tela 2"
 */
async function handleRushRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    username,              // 🆕 ID interno (PRIORIDADE)
    suffix,                // 🆕 Sufixos separados
    cloudnation_id,        // Mantido para compatibilidade
    plan_duration_months
  } = webhookData;

  console.log('\n' + '='.repeat(60));
  console.log('🚀 [WEBHOOK-RUSH] INICIANDO RENOVAÇÃO');
  console.log('='.repeat(60));
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🆔 Client ID: ${client_id}`);
  console.log(`   📅 Meses: ${plan_duration_months}`);
  console.log(`   📺 Tipo: ${plan.rush_type || 'IPTV'}`);
  console.log(`   🖥️  Telas: ${plan.num_screens}`);
  console.log(`   📝 Sufixos: ${cloudnation_id || '(nenhum)'}`);

  // ========== VERIFICAR TIPO DO PLANO ==========
  const rushType = (plan.rush_type || 'IPTV').toUpperCase();
  
  if (!['IPTV', 'P2P'].includes(rushType)) {
    console.error(`❌ [WEBHOOK-RUSH] Tipo de plano inválido: ${rushType}`);
    return res.status(400).json({ 
      error: 'Tipo de plano Rush inválido',
      message: 'O tipo deve ser IPTV ou P2P'
    });
  }

  // ========== BUSCAR CREDENCIAIS RUSH ==========
  console.log(`\n🔍 [WEBHOOK-RUSH] Buscando credenciais Rush do user ${user_id}...`);
  
  const credentials = db.getRushCredentials(user_id);
  
  if (!credentials) {
    console.error(`❌ [WEBHOOK-RUSH] Usuário ${user_id} não tem credenciais Rush cadastradas`);
    return res.status(404).json({ 
      error: 'Credenciais Rush não encontradas',
      message: 'O usuário precisa cadastrar credenciais Rush no IPTV Manager primeiro'
    });
  }

  console.log(`✅ [WEBHOOK-RUSH] Credenciais encontradas para user ${user_id}`);

  // ========== CRIAR SERVIÇO RUSH ==========
  const service = new RushRenewalService(
    credentials.username,
    credentials.password
  );

  try {
    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [WEBHOOK-RUSH] Fazendo login no Rush...');
    await service.login();
    console.log('✅ [WEBHOOK-RUSH] Login realizado com sucesso!');

    // ========== CARREGAR CLIENTES ==========
    console.log('\n📥 [WEBHOOK-RUSH] Carregando lista de clientes...');
    await service.atualizarListaClientes();

    // ========== PROCESSAR RENOVAÇÃO ==========
    let resultado;

    // 🆕 PRIORIDADE 1: Se username (ID interno) preenchido, usa direto
    if (username && username.trim().length > 0) {
      const ids = username.split(',').map(id => id.trim()).filter(id => id.length > 0);
      
      console.log('\n🔄 [WEBHOOK-RUSH] Modo: RENOVAÇÃO POR ID DIRETO');
      console.log(`   IDs: ${ids.join(', ')}`);
      console.log(`   Total: ${ids.length}`);
      
      // Renovar cada ID diretamente
      const resultados = [];
      let sucessos = 0;
      let falhas = 0;

      for (let i = 0; i < ids.length; i++) {
        const clientId = ids[i];
        console.log(`\n   [${i + 1}/${ids.length}] Renovando ID: ${clientId}`);
        
        const res = await service.renovarClientePorId(
          clientId,
          plan_duration_months,
          rushType,
          plan.num_screens || 1
        );
        
        resultados.push({ id: clientId, ...res });
        
        if (res.success) {
          sucessos++;
          console.log(`   ✅ ID ${clientId} renovado com sucesso!`);
        } else {
          falhas++;
          console.log(`   ❌ ID ${clientId} falhou: ${res.error}`);
        }

        // Delay entre renovações
        if (i < ids.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      resultado = {
        success: falhas === 0,
        total: ids.length,
        sucessos,
        falhas,
        resultados
      };

    // 🆕 PRIORIDADE 2: Se suffix preenchido, usa nome + sufixo
    } else if (suffix && suffix.trim().length > 0) {
      console.log('\n🔄 [WEBHOOK-RUSH] Modo: RENOVAÇÃO POR NOME + SUFIXOS');
      
      resultado = await service.renovarMultiplosClientes(
        client_name,
        suffix,
        plan_duration_months,
        rushType,
        plan.num_screens || 1
      );

    // 🆕 FALLBACK: cloudnation_id (compatibilidade)
    } else if (cloudnation_id && cloudnation_id.trim().length > 0) {
      console.log('\n🔄 [WEBHOOK-RUSH] Modo: RENOVAÇÃO MÚLTIPLA (compatibilidade)');
      
      resultado = await service.renovarMultiplosClientes(
        client_name,
        cloudnation_id,
        plan_duration_months,
        rushType,
        plan.num_screens || 1
      );

    } else {
      // ===== RENOVAÇÃO ÚNICA =====
      console.log('\n🔄 [WEBHOOK-RUSH] Modo: RENOVAÇÃO ÚNICA');
      
      resultado = await service.renovarClientePorNome(
        client_name,
        plan_duration_months,
        rushType,
        plan.num_screens || 1
      );

      // Normalizar resultado para formato consistente
      resultado = {
        success: resultado.success,
        total: 1,
        sucessos: resultado.success ? 1 : 0,
        falhas: resultado.success ? 0 : 1,
        resultados: [{
          nome: client_name,
          ...resultado
        }]
      };
    }

    // ========== RETORNAR RESULTADO ==========
    console.log('\n' + '='.repeat(60));
    console.log('📊 [WEBHOOK-RUSH] RESULTADO FINAL');
    console.log('='.repeat(60));
    console.log(`   Total: ${resultado.total}`);
    console.log(`   Sucessos: ${resultado.sucessos}`);
    console.log(`   Falhas: ${resultado.falhas}`);

    if (resultado.success) {
      console.log('\n✅ [WEBHOOK-RUSH] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'rush',
        message: 'Renovação automática Rush concluída com sucesso',
        data: {
          client_id,
          client_name,
          rush_type: rushType,
          plan_duration_months,
          num_screens: plan.num_screens,
          ...resultado
        }
      });

    } else {
      console.error('\n❌ [WEBHOOK-RUSH] RENOVAÇÃO FALHOU!');
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'rush',
        message: 'Renovação automática Rush falhou',
        data: {
          client_id,
          client_name,
          rush_type: rushType,
          ...resultado
        }
      });
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK-RUSH] ERRO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    return res.status(500).json({ 
      success: false,
      provider: 'rush',
      error: 'Erro ao processar renovação Rush',
      message: error.message 
    });
  }
}

/**
 * Handler específico para renovação Uniplay
 */
async function handleUniplayRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,
    username,              // 🆕 ID interno (PRIORIDADE)
    suffix,                // 🆕 Sufixos separados
    cloudnation_id,        // Mantido para compatibilidade
    plan_duration_months
  } = webhookData;

  // ========== PROCESSAR RENOVAÇÃO ==========
  let searchNames = [];
  let usarIdDireto = false;
  let idsDiretos = [];

  // 🆕 PRIORIDADE 1: Se username (ID interno) preenchido, usa direto
  if (username && username.trim().length > 0) {
    usarIdDireto = true;
    idsDiretos = username
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 [WEBHOOK-UNIPLAY] MODO: ID INTERNO (PRIORIDADE)');
    console.log('='.repeat(60));
    console.log(`   🎯 Renovação DIRETA por ID`);
    console.log(`   📝 IDs: ${idsDiretos.join(', ')}`);
    console.log(`   📊 Total: ${idsDiretos.length} cliente(s)`);
    console.log('='.repeat(60));

  // 🆕 PRIORIDADE 2: Se suffix preenchido, usa nome + sufixo
  } else if (suffix && suffix.trim().length > 0) {
    const sufixos = suffix
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    searchNames = sufixos.map(sufixo => `${client_name} ${sufixo}`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 [WEBHOOK-UNIPLAY] MODO: NOME + SUFIXOS');
    console.log('='.repeat(60));
    console.log(`   👤 Nome base: ${client_name}`);
    console.log(`   📝 Sufixos: ${sufixos.join(', ')}`);
    console.log(`   🎯 Total de telas: ${searchNames.length}`);
    console.log(`   📋 Nomes completos para busca:`);
    searchNames.forEach((name, index) => {
      console.log(`      [${index + 1}] ${name}`);
    });
    console.log('='.repeat(60));

  // 🆕 FALLBACK: cloudnation_id (compatibilidade)
  } else if (cloudnation_id && cloudnation_id.trim().length > 0) {
    const sufixos = cloudnation_id
      .split(',')
      .map(sufixo => sufixo.trim())
      .filter(sufixo => sufixo.length > 0);
    
    searchNames = sufixos.map(sufixo => `${client_name} ${sufixo}`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 [WEBHOOK-UNIPLAY] MODO: COMPATIBILIDADE (cloudnation_id)');
    console.log('='.repeat(60));
    console.log(`   👤 Nome base: ${client_name}`);
    console.log(`   📝 Sufixos: ${sufixos.join(', ')}`);
    console.log(`   🎯 Total de telas: ${searchNames.length}`);
    console.log('='.repeat(60));

  } else {
    // Nome único
    searchNames = [client_name];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 [WEBHOOK-UNIPLAY] MODO: NOME ÚNICO');
    console.log('='.repeat(60));
    console.log(`   👤 Nome: ${client_name}`);
    console.log(`   💡 Dica: Preencha "ID Interno" para renovação direta`);
    console.log('='.repeat(60));
  }

  // ========== VERIFICAR CREDENCIAIS UNIPLAY ==========
  console.log(`\n🔍 [WEBHOOK-UNIPLAY] Buscando credenciais do user ${user_id}...`);
  
  const credentials = db.getUniplayCredentials(user_id);
  
  if (!credentials) {
    console.error(`❌ [WEBHOOK-UNIPLAY] Usuário ${user_id} não tem credenciais Uniplay`);
    return res.status(404).json({ 
      error: 'Credenciais Uniplay não encontradas',
      message: 'O usuário precisa cadastrar credenciais Uniplay no IPTV Manager'
    });
  }

  console.log(`✅ [WEBHOOK-UNIPLAY] Credenciais encontradas`);

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-UNIPLAY] Iniciando renovação automática Uniplay...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   📊 Telas para renovar: ${searchNames.length}`);
  console.log(`   🌐 Domínio: gesapioffice.com (fixo)`);
  console.log(`   💳 Créditos por tela: ${plan_duration_months} (1 mês = 1 crédito)`);
  console.log(`   📡 Busca: Automática (P2P + IPTV)`);
  console.log(`   🔐 Proxy: Ativado (proxychains)`);

  // Criar serviço Uniplay COM PROXY
  const service = new UniplayRenewalService(
    credentials.username,
    credentials.password,
    true  // useProxy = true (OBRIGATÓRIO)
  );

  try {
    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [WEBHOOK-UNIPLAY] Fazendo login no Uniplay...');
    await service.login();
    console.log('✅ [WEBHOOK-UNIPLAY] Login realizado com sucesso!');

    // 🆕 SE USAR ID DIRETO, RENOVAR DIRETAMENTE SEM BUSCAR
    if (usarIdDireto) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🔄 [WEBHOOK-UNIPLAY] RENOVAÇÃO DIRETA POR ID`);
      console.log('='.repeat(60));

      const resultados = [];
      let totalSucessos = 0;
      let totalFalhas = 0;

      for (let i = 0; i < idsDiretos.length; i++) {
        const clientId = idsDiretos[i];
        
        console.log(`\n📌 [${i + 1}/${idsDiretos.length}] Renovando ID: ${clientId}`);
        console.log('-'.repeat(60));

        try {
          console.log(`   🔄 Renovando ${plan_duration_months} crédito(s)...`);
          
          // Tentar P2P primeiro
          let resultado = await service.renewClient(clientId, 'p2p', plan_duration_months);
          
          if (!resultado.sucesso) {
            console.log(`   ⚠️ Falha em P2P, tentando IPTV...`);
            resultado = await service.renewClient(clientId, 'iptv', plan_duration_months);
          }

          if (resultado.sucesso) {
            console.log(`   ✅ Renovação CONCLUÍDA!`);
            totalSucessos++;
            resultados.push({
              id: clientId,
              status: 'success',
              credits: plan_duration_months
            });
          } else {
            console.error(`   ❌ Renovação FALHOU!`);
            totalFalhas++;
            resultados.push({
              id: clientId,
              status: 'failed',
              error: resultado.error
            });
          }
        } catch (error) {
          console.error(`   💥 ERRO: ${error.message}`);
          totalFalhas++;
          resultados.push({
            id: clientId,
            status: 'error',
            error: error.message
          });
        }

        // Delay entre renovações
        if (i < idsDiretos.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await service.logout();

      // Retornar resultado
      const sucesso = totalFalhas === 0;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 [WEBHOOK-UNIPLAY] RESULTADO: ${sucesso ? '✅ SUCESSO' : '❌ FALHAS'}`);
      console.log(`   Total: ${idsDiretos.length} | Sucessos: ${totalSucessos} | Falhas: ${totalFalhas}`);
      console.log('='.repeat(60));

      return res.status(sucesso ? 200 : 500).json({
        success: sucesso,
        provider: 'uniplay',
        message: sucesso ? 'Renovação por ID concluída com sucesso' : 'Algumas renovações falharam',
        data: {
          client_id,
          client_name,
          mode: 'direct_id',
          total: idsDiretos.length,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          resultados
        }
      });
    }

    // ========== BUSCAR E RENOVAR CADA TELA ==========
    const resultados = [];
    let totalSucessos = 0;
    let totalFalhas = 0;
    let telasNaoEncontradas = [];

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 [WEBHOOK-UNIPLAY] PROCESSANDO ${searchNames.length} TELA(S)`);
    console.log('='.repeat(60));

    for (let i = 0; i < searchNames.length; i++) {
      const searchName = searchNames[i];
      const telaNumero = i + 1;
      
      console.log(`\n📌 [${telaNumero}/${searchNames.length}] Processando: "${searchName}"`);
      console.log('-'.repeat(60));

      try {
        // Buscar cliente
        console.log(`   🔍 Buscando cliente...`);
        const foundClient = await service.findClientByName(searchName);

        if (!foundClient) {
          console.error(`   ❌ Cliente NÃO encontrado: "${searchName}"`);
          telasNaoEncontradas.push(searchName);
          totalFalhas++;
          
          resultados.push({
            tela: telaNumero,
            searchName: searchName,
            status: 'not_found',
            error: 'Cliente não encontrado no Uniplay'
          });
          
          continue; // Próxima tela
        }

        console.log(`   ✅ Cliente encontrado!`);
        console.log(`      ID: ${foundClient.id}`);
        console.log(`      Tipo: ${foundClient.serviceType.toUpperCase()}`);

        // Renovar cliente
        console.log(`   🔄 Renovando ${plan_duration_months} crédito(s)...`);
        
        const resultado = await service.renewClient(
          foundClient.id,
          foundClient.serviceType,
          plan_duration_months
        );

        if (resultado.sucesso) {
          console.log(`   ✅ Renovação CONCLUÍDA!`);
          totalSucessos++;
          
          resultados.push({
            tela: telaNumero,
            searchName: searchName,
            status: 'success',
            uniplay_id: foundClient.id,
            service_type: foundClient.serviceType,
            credits: plan_duration_months,
            resultado: resultado
          });
        } else {
          console.error(`   ❌ Renovação FALHOU!`);
          console.error(`      Erro: ${resultado.error}`);
          totalFalhas++;
          
          resultados.push({
            tela: telaNumero,
            searchName: searchName,
            status: 'renewal_failed',
            uniplay_id: foundClient.id,
            service_type: foundClient.serviceType,
            error: resultado.error
          });
        }

      } catch (error) {
        console.error(`   💥 ERRO ao processar tela: ${error.message}`);
        totalFalhas++;
        
        resultados.push({
          tela: telaNumero,
          searchName: searchName,
          status: 'error',
          error: error.message
        });
      }
    }

    // ========== FAZER LOGOUT ==========
    await service.logout();

    // ========== RESUMO FINAL ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 [WEBHOOK-UNIPLAY] RESUMO FINAL DA RENOVAÇÃO');
    console.log('='.repeat(60));
    console.log(`   👤 Cliente: ${client_name}`);
    console.log(`   📊 Total de telas: ${searchNames.length}`);
    console.log(`   ✅ Sucessos: ${totalSucessos}`);
    console.log(`   ❌ Falhas: ${totalFalhas}`);
    
    if (telasNaoEncontradas.length > 0) {
      console.log(`\n   ⚠️  Telas não encontradas:`);
      telasNaoEncontradas.forEach(nome => {
        console.log(`      - ${nome}`);
      });
    }
    
    console.log('='.repeat(60));

    // ========== VERIFICAR SE HOUVE SUCESSO TOTAL, PARCIAL OU FALHA ==========
    
    if (totalSucessos === searchNames.length) {
      // 100% DE SUCESSO
      console.log('\n✅ [WEBHOOK-UNIPLAY] TODAS AS TELAS RENOVADAS COM SUCESSO!\n');
      
      return res.json({
        success: true,
        provider: 'uniplay',
        message: `Renovação automática Uniplay concluída: ${totalSucessos} tela(s) renovada(s)`,
        data: {
          client_id: client_id,
          client_name: client_name,
          total_telas: searchNames.length,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          modo: cloudnation_id ? 'multiplos_sufixos' : 'nome_unico',
          sufixos: cloudnation_id || null,
          resultados: resultados
        }
      });
      
    } else if (totalSucessos > 0 && totalFalhas > 0) {
      // SUCESSO PARCIAL
      console.log('\n⚠️  [WEBHOOK-UNIPLAY] RENOVAÇÃO PARCIAL (algumas telas falharam)\n');
      
      return res.status(207).json({ // 207 = Multi-Status
        success: true,
        partial: true,
        provider: 'uniplay',
        message: `Renovação parcial: ${totalSucessos} tela(s) renovada(s), ${totalFalhas} falha(s)`,
        data: {
          client_id: client_id,
          client_name: client_name,
          total_telas: searchNames.length,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          modo: cloudnation_id ? 'multiplos_sufixos' : 'nome_unico',
          sufixos: cloudnation_id || null,
          telas_nao_encontradas: telasNaoEncontradas,
          resultados: resultados
        }
      });
      
    } else {
      // FALHA TOTAL
      console.error('\n❌ [WEBHOOK-UNIPLAY] RENOVAÇÃO FALHOU PARA TODAS AS TELAS!\n');
      
      return res.status(500).json({
        success: false,
        provider: 'uniplay',
        message: `Renovação falhou: nenhuma tela foi renovada (${totalFalhas} falha(s))`,
        data: {
          client_id: client_id,
          client_name: client_name,
          total_telas: searchNames.length,
          sucessos: totalSucessos,
          falhas: totalFalhas,
          modo: cloudnation_id ? 'multiplos_sufixos' : 'nome_unico',
          sufixos: cloudnation_id || null,
          telas_nao_encontradas: telasNaoEncontradas,
          resultados: resultados
        }
      });
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK-UNIPLAY] ERRO CRÍTICO:', error);
    console.error('Stack:', error.stack);
    console.log('='.repeat(60) + '\n');
    
    // Tentar fazer logout mesmo com erro
    try {
      await service.logout();
    } catch (logoutError) {
      console.error('⚠️ Erro no logout:', logoutError.message);
    }
    
    return res.status(500).json({ 
      success: false,
      provider: 'uniplay',
      error: 'Erro crítico ao processar renovação Uniplay',
      message: error.message,
      data: {
        client_id: client_id,
        client_name: client_name,
        modo: cloudnation_id ? 'multiplos_sufixos' : 'nome_unico'
      }
    });
  }
}

export default {
  handleClientRenewalWebhook,
  webhookHealthCheck
};