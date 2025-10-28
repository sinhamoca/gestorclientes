/* ========================================
   WEBHOOK CONTROLLER - IPTV MANAGER
   Recebe webhooks do sistema principal
   e processa renovação automática CloudNation OU Sigma
   ======================================== */

import CloudNationRenewalService from '../services/cloudnation-renewal.js';
import SigmaRenewalService from '../services/sigma-renewal.js';
import * as db from '../database.js';
import * as postgres from '../postgres.js';

const CAPTCHA_API_KEY = process.env.CAPTCHA_2CAPTCHA_API_KEY;

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
      cloudnation_id,  // Este campo serve para CloudNation E Sigma (username)
      plan_duration_months 
    } = webhookData;

    if (!client_id || !user_id || !plan_id || !cloudnation_id || !plan_duration_months) {
      console.error('❌ [WEBHOOK] Dados incompletos no webhook');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['client_id', 'user_id', 'plan_id', 'cloudnation_id', 'plan_duration_months']
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
    console.log(`   📊 Tipo: ${plan.is_sigma_plan ? 'SIGMA' : 'CLOUDNATION'}`);
    console.log(`   📅 Duração: ${plan.duration_months} mês(es)`);
    console.log(`   🔌 Telas/Conexões: ${plan.num_screens}`);

    // ========== ROTEAR PARA O SERVIÇO CORRETO ==========
    
    if (plan.is_sigma_plan) {
      // ============= RENOVAÇÃO SIGMA =============
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO SIGMA');
      return await handleSigmaRenewal(req, res, webhookData, plan);
    } else {
      // ============= RENOVAÇÃO CLOUDNATION =============
      console.log('\n🎯 [WEBHOOK] Detectado: PLANO CLOUDNATION');
      return await handleCloudNationRenewal(req, res, webhookData, plan);
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
    cloudnation_id,  // Na verdade é o username do cliente no Sigma
    plan_duration_months 
  } = webhookData;

  const sigmaUsername = cloudnation_id;  // Renomear para clareza

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

  // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
  console.log('\n🚀 [WEBHOOK-SIGMA] Iniciando renovação automática Sigma...');
  console.log(`   👤 Cliente: ${client_name}`);
  console.log(`   🆔 Username Sigma: ${sigmaUsername}`);
  console.log(`   🌐 Domínio: ${plan.sigma_domain}`);
  console.log(`   📦 Package ID: ${plan.sigma_plan_code}`);
  console.log(`   🔌 Conexões: ${plan.num_screens}`);
  console.log(`   📅 Duração: ${plan_duration_months} mês(es)`);

  // Criar serviço Sigma
  const service = new SigmaRenewalService(
    plan.sigma_domain,
    credentials.username,  // Admin username
    credentials.password   // Admin password
  );

  try {
    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [WEBHOOK-SIGMA] Fazendo login no painel Sigma...');
    await service.login();
    console.log('✅ [WEBHOOK-SIGMA] Login realizado com sucesso!');

    // ========== RENOVAR CLIENTE ==========
    let resultado;
    
    if (plan_duration_months === 1) {
      // Renovar apenas 1 vez
      console.log('\n🔄 [WEBHOOK-SIGMA] Renovando 1 vez...');
      resultado = await service.renewClient(
        sigmaUsername,
        plan.sigma_plan_code,
        plan.num_screens
      );
    } else {
      // Renovar múltiplas vezes
      console.log(`\n🔄 [WEBHOOK-SIGMA] Renovando ${plan_duration_months}x...`);
      resultado = await service.renewMultipleTimes(
        sigmaUsername,
        plan.sigma_plan_code,
        plan.num_screens,
        plan_duration_months
      );
    }

    // ========== FAZER LOGOUT ==========
    await service.logout();

    // ========== VERIFICAR RESULTADO ==========
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 [WEBHOOK-SIGMA] RESUMO DA RENOVAÇÃO');
    console.log('='.repeat(60));

    const sucesso = plan_duration_months === 1 
      ? resultado.sucesso 
      : resultado.sucessos === plan_duration_months;

    if (sucesso) {
      console.log('✅ [WEBHOOK-SIGMA] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        provider: 'sigma',
        message: 'Renovação automática Sigma concluída com sucesso',
        data: {
          client_id: client_id,
          client_name: client_name,
          sigma_username: sigmaUsername,
          sigma_domain: plan.sigma_domain,
          package_id: plan.sigma_plan_code,
          connections: plan.num_screens,
          plan_duration_months: plan_duration_months,
          resultado: resultado
        }
      });
    } else {
      console.error('\n❌ [WEBHOOK-SIGMA] RENOVAÇÃO FALHOU!');
      console.log('Resultado:', resultado);
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        provider: 'sigma',
        message: 'Renovação automática Sigma falhou',
        error: resultado,
        data: {
          client_id: client_id,
          sigma_username: sigmaUsername,
          sigma_domain: plan.sigma_domain
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
      captcha_configured: hasCaptchaKey
    },
    timestamp: new Date().toISOString()
  });
}

export default {
  handleClientRenewalWebhook,
  webhookHealthCheck
};
