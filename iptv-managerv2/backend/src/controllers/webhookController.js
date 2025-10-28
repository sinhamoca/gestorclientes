/* ========================================
   WEBHOOK CONTROLLER - IPTV MANAGER
   Recebe webhooks do sistema principal
   e processa renovação automática CloudNation
   ======================================== */

import CloudNationRenewalService from '../services/cloudnation-renewal.js';
import * as db from '../database.js';

const CAPTCHA_API_KEY = process.env.CAPTCHA_2CAPTCHA_API_KEY;

/**
 * Webhook para renovação automática após pagamento
 * POST /api/webhooks/client-renewed
 * 
 * Payload esperado:
 * {
 *   client_id: 123,
 *   user_id: 2,
 *   client_name: "João Silva",
 *   whatsapp_number: "5585999999999",
 *   cloudnation_id: "789134030",
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
      client_name,
      cloudnation_id, 
      plan_duration_months 
    } = webhookData;

    if (!client_id || !user_id || !cloudnation_id || !plan_duration_months) {
      console.error('❌ [WEBHOOK] Dados incompletos no webhook');
      return res.status(400).json({ 
        error: 'Dados incompletos',
        required: ['client_id', 'user_id', 'cloudnation_id', 'plan_duration_months']
      });
    }

    // ========== VERIFICAR CREDENCIAIS ==========
    console.log(`\n🔍 [WEBHOOK] Buscando credenciais CloudNation do user ${user_id}...`);
    
    const credentials = db.getCredentials(user_id);
    
    if (!credentials) {
      console.error(`❌ [WEBHOOK] Usuário ${user_id} não tem credenciais CloudNation cadastradas`);
      return res.status(404).json({ 
        error: 'Credenciais CloudNation não encontradas',
        message: 'O usuário precisa cadastrar credenciais no IPTV Manager primeiro'
      });
    }

    console.log(`✅ [WEBHOOK] Credenciais encontradas para user ${user_id}`);

    // ========== VERIFICAR API KEY 2CAPTCHA ==========
    if (!CAPTCHA_API_KEY || CAPTCHA_API_KEY === 'SUA_CHAVE_2CAPTCHA_AQUI') {
      console.error('❌ [WEBHOOK] API Key do 2Captcha não configurada');
      return res.status(500).json({ 
        error: 'Sistema de renovação não configurado (2Captcha)' 
      });
    }

    // ========== INICIAR PROCESSO DE RENOVAÇÃO ==========
    console.log('\n🚀 [WEBHOOK] Iniciando renovação automática...');
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
    console.log('\n🔑 [WEBHOOK] Fazendo login no CloudNation...');
    await service.login();
    console.log('✅ [WEBHOOK] Login realizado com sucesso!');

    // ========== RENOVAR TODOS OS USUÁRIOS ==========
    const resultadosGerais = [];
    
    for (let i = 0; i < totalUsuarios; i++) {
      const userId = userIds[i];
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📋 [WEBHOOK] USUÁRIO ${i + 1}/${totalUsuarios}: ${userId}`);
      console.log('='.repeat(60));
      
      let resultado;
      
      if (plan_duration_months === 1) {
        // Renovar apenas 1 mês
        console.log('🔄 [WEBHOOK] Renovando 1 mês...');
        resultado = await service.renovarUsuario(userId);
      } else {
        // Renovar múltiplos meses (repetir renovação X vezes)
        console.log(`🔄 [WEBHOOK] Renovando ${plan_duration_months} meses (${plan_duration_months}x renovações)...`);
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
    console.log('📊 [WEBHOOK] RESUMO DA RENOVAÇÃO');
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
      console.log('✅ [WEBHOOK] RENOVAÇÃO CONCLUÍDA COM SUCESSO!');
      console.log('='.repeat(60) + '\n');
      
      return res.json({
        success: true,
        message: 'Renovação automática concluída com sucesso',
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
      console.error('\n❌ [WEBHOOK] RENOVAÇÃO FALHOU!');
      console.error('Resultado:', resultado);
      console.log('='.repeat(60) + '\n');
      
      return res.status(500).json({
        success: false,
        message: 'Renovação automática falhou',
        error: resultado,
        data: {
          client_id: client_id,
          cloudnation_id: cloudnation_id
        }
      });
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
      captcha_configured: hasCaptchaKey
    },
    timestamp: new Date().toISOString()
  });
}

export default {
  handleClientRenewalWebhook,
  webhookHealthCheck
};