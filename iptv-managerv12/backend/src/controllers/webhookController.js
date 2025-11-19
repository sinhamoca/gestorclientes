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


const CAPTCHA_API_KEY = process.env.CAPTCHA_2CAPTCHA_API_KEY;
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
      is_uniplay_plan
    } = webhookData;

    // Validações básicas (campos obrigatórios para TODOS)
    if (!client_id || !user_id || !plan_id || !plan_duration_months) {
      console.error('❌ [WEBHOOK] Dados incompletos no webhook');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['client_id', 'user_id', 'plan_id', 'plan_duration_months']
      });
    }

    // Validação específica: cloudnation_id obrigatório EXCETO para Uniplay
    // (CloudNation, Sigma e Koffice usam cloudnation_id)
    // (Uniplay usa client_name)
    if (!is_uniplay_plan && !cloudnation_id) {
      console.error('❌ [WEBHOOK] cloudnation_id obrigatório para este tipo de plano');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['cloudnation_id'],
        message: 'CloudNation ID / Sigma Username / Koffice Client ID é obrigatório'
      });
    }

    // Validação específica: client_name obrigatório para Uniplay
    if (is_uniplay_plan && !client_name) {
      console.error('❌ [WEBHOOK] client_name obrigatório para planos Uniplay');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['client_name'],
        message: 'Nome do cliente é obrigatório para planos Uniplay'
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
    console.log(`   📅 Duração: ${plan.duration_months} mês(es)`);
    console.log(`   🔌 Telas/Conexões: ${plan.num_screens}`);

    // ========== ✨ VALIDAÇÃO: Verificar se tem integração ==========
    if (!plan.is_sigma_plan && !plan.is_live21_plan && !plan.is_koffice_plan && !plan.is_uniplay_plan) {
      console.log('\n⚠️ [WEBHOOK] PLANO SEM INTEGRAÇÃO DE RENOVAÇÃO');
      console.log('   is_sigma_plan: false');
      console.log('   is_live21_plan: false');
      console.log('   is_koffice_plan: false');
      console.log('   is_uniplay_plan: false');
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
      
      // ⚠️ SEMPRE RENOVAR APENAS 1 VEZ
      // O Package ID já contém a duração (1 mês, 3 meses, etc)
      console.log('🔄 [WEBHOOK-SIGMA] Renovando 1 vez (package ID contém duração)...');
      
      const resultado = await service.renewClient(
        username,
        plan.sigma_plan_code,
        plan.num_screens
      );
      
      resultadosGerais.push({
        username: username,
        resultado: resultado
      });
      
      // Aguardar entre usuários (se tiver mais)
      if (i < totalUsuarios - 1) {
        console.log('\n⏳ Aguardando 3s antes do próximo usuário...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // ========== FAZER LOGOUT ==========
    await service.logout();

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
    try {
      await service.logout();
    } catch (logoutError) {
      console.error('⚠️ Erro no logout:', logoutError.message);
    }
    
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
    cloudnation_id,  // Na verdade é o Koffice Client ID
    plan_duration_months 
  } = webhookData;

  const kofficeClientId = cloudnation_id; // Renomear para clareza

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

  // ========== VERIFICAR CLIENT ID ==========
  if (!kofficeClientId) {
    console.error(`❌ [WEBHOOK-KOFFICE] Cliente ${client_id} não tem Koffice Client ID`);
    return res.status(400).json({ 
      error: 'Koffice Client ID não encontrado',
      message: 'O cliente precisa estar sincronizado com Koffice (campo username vazio)'
    });
  }

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-KOFFICE] Iniciando renovação automática Koffice...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🆔 Koffice Client ID: ${kofficeClientId}`);
  console.log(`   🌐 Domínio: ${plan.koffice_domain}`);
  console.log(`   📅 Meses: ${plan_duration_months}`);
  console.log(`   ✨ Vantagem: Renovação em 1 requisição (sem loop)!`);

  // Criar serviço Koffice
  const service = new KofficeRenewalService(
    plan.koffice_domain,
    credentials.username,  // Admin username
    credentials.password   // Admin password
  );

  try {
    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [WEBHOOK-KOFFICE] Fazendo login no painel Koffice...');
    await service.login();
    console.log('✅ [WEBHOOK-KOFFICE] Login realizado com sucesso!');

    // ========== RENOVAR CLIENTE ==========
    // IMPORTANTE: Diferente dos outros sistemas, o Koffice
    // renova N meses em UMA ÚNICA requisição!
    console.log(`\n🔄 [WEBHOOK-KOFFICE] Renovando ${plan_duration_months} mês(es) em 1 requisição...`);
    
    const resultado = await service.renovarCliente(
      kofficeClientId,
      plan_duration_months
    );

    // ========== FAZER LOGOUT ==========
    await service.logout();

    // ========== VERIFICAR RESULTADO ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 [WEBHOOK-KOFFICE] RESUMO DA RENOVAÇÃO');
    console.log('='.repeat(60));

    if (resultado.sucesso) {
      console.log('✅ [WEBHOOK-KOFFICE] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'koffice',
        message: 'Renovação automática Koffice concluída com sucesso',
        data: {
          client_id: client_id,
          client_name: client_name,
          koffice_client_id: kofficeClientId,
          koffice_domain: plan.koffice_domain,
          plan_duration_months: plan_duration_months,
          resultado: resultado
        }
      });
    } else {
      console.error('\n❌ [WEBHOOK-KOFFICE] RENOVAÇÃO FALHOU!');
      console.log('Resultado:', resultado);
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'koffice',
        message: 'Renovação automática Koffice falhou',
        error: resultado.error,
        data: {
          client_id: client_id,
          koffice_client_id: kofficeClientId,
          koffice_domain: plan.koffice_domain
        }
      });
    }

  } catch (error) {
    console.error('\n💥 [WEBHOOK-KOFFICE] ERRO:', error);
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
      message: error.message 
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
 * Handler específico para renovação Uniplay
 * 
 * DIFERENÇAS:
 * - CloudNation: Identifica por ID numérico
 * - Sigma: Identifica por username(s)
 * - Koffice: Identifica por Client ID
 * - Uniplay: Identifica por NOME do cliente ← ÚNICO
 * 
 * CARACTERÍSTICAS UNIPLAY:
 * - Busca automática em P2P e IPTV
 * - Identificação por nome completo (case-insensitive)
 * - Renovação direta com N créditos (1 mês = 1 crédito)
 * - Domínio fixo: gesapioffice.com
 * - PROXY OBRIGATÓRIO (proxychains)
 */
/**
 * Handler específico para renovação Uniplay
 * 
 * DIFERENÇAS:
 * - CloudNation: Identifica por ID numérico
 * - Sigma: Identifica por username(s)
 * - Koffice: Identifica por Client ID
 * - Uniplay: Identifica por NOME + SUFIXOS (campo username)
 * 
 * CARACTERÍSTICAS UNIPLAY:
 * - Busca automática em P2P e IPTV
 * - Suporte a MÚLTIPLOS SUFIXOS (separados por vírgula)
 * - Renovação de MÚLTIPLAS TELAS com 1 pagamento
 * - Domínio fixo: gesapioffice.com
 * - PROXY OBRIGATÓRIO (proxychains)
 * 
 * EXEMPLO DE USO:
 * Cliente: "Leticia Perdigão"
 * Username: "tela 1, tela 2, tela 3, tela 4"
 * 
 * Sistema busca e renova:
 * - "Leticia Perdigão tela 1"
 * - "Leticia Perdigão tela 2"
 * - "Leticia Perdigão tela 3"
 * - "Leticia Perdigão tela 4"
 */
async function handleUniplayRenewal(req, res, webhookData, plan) {
  const { 
    client_id,
    user_id, 
    client_name,          // ← Nome base do cliente
    cloudnation_id,       // ← Sufixos separados por vírgula (ex: "tela 1, tela 2")
    plan_duration_months  // ← Créditos (1 mês = 1 crédito)
  } = webhookData;

  // ========== PROCESSAR SUFIXOS ==========
  let searchNames = [];
  
  if (cloudnation_id && cloudnation_id.trim().length > 0) {
    // Tem sufixos → Separar por vírgula e criar lista de nomes completos
    const sufixos = cloudnation_id
      .split(',')
      .map(sufixo => sufixo.trim())
      .filter(sufixo => sufixo.length > 0);
    
    // Para cada sufixo, concatenar com o nome do cliente
    searchNames = sufixos.map(sufixo => `${client_name} ${sufixo}`);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 [WEBHOOK-UNIPLAY] MODO: MÚLTIPLOS SUFIXOS');
    console.log('='.repeat(60));
    console.log(`   👤 Nome base: ${client_name}`);
    console.log(`   📝 Sufixos: ${sufixos.join(', ')}`);
    console.log(`   🎯 Total de telas: ${searchNames.length}`);
    console.log(`   📋 Nomes completos para busca:`);
    searchNames.forEach((name, index) => {
      console.log(`      [${index + 1}] ${name}`);
    });
    console.log('='.repeat(60));
  } else {
    // Sem sufixos → Buscar apenas pelo nome (comportamento antigo)
    searchNames = [client_name];
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('🔍 [WEBHOOK-UNIPLAY] MODO: NOME ÚNICO (sem sufixos)');
    console.log('='.repeat(60));
    console.log(`   👤 Nome: ${client_name}`);
    console.log(`   💡 Dica: Use sufixos para renovar múltiplas telas`);
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