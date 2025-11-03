/* ========================================
   WEBHOOK DISPATCHER - COM VALIDAÇÃO is_live21_plan
   Dispara webhook para IPTV Manager APENAS se o plano tiver renovação automatizada
   ======================================== */

import axios from 'axios';

// URL do IPTV Manager (configurável via ENV)
const IPTV_MANAGER_URL = process.env.IPTV_MANAGER_URL || 'http://iptv_manager_backend:5001';

/**
 * Disparar webhook para IPTV Manager
 * Chamado após renovação bem-sucedida no banco
 * 
 * IMPORTANTE: Agora valida is_live21_plan para saber se deve renovar no CloudNation
 */
async function dispatchRenewalWebhook(clientData) {
  try {
    console.log('\n🔔 [WEBHOOK] Iniciando validação para renovação automática...');
    console.log(`   Cliente: ${clientData.name}`);
    console.log(`   Plano ID: ${clientData.plan_id}`);
    console.log(`   Is Sigma: ${clientData.is_sigma_plan || false}`);
    console.log(`   Is Live21: ${clientData.is_live21_plan || false}`);
    
    // ========== VALIDAÇÃO 1: Verificar se tem integração ==========
    if (!clientData.is_sigma_plan && !clientData.is_live21_plan && !clientData.is_koffice_plan) {
      console.log('ℹ️  [WEBHOOK] Plano SEM integração de renovação automática');
      console.log('   → Não é Sigma, Live21 nem Koffice');
      console.log('   → Renovação APENAS no banco de dados foi concluída');
      return { skipped: true, reason: 'no_integration' };
    }
    
    // ========== VALIDAÇÃO 2: Plano Sigma (renovação via painel Sigma) ==========
    if (clientData.is_sigma_plan) {
      console.log('⚡ [WEBHOOK] Plano SIGMA detectado');
      console.log(`   → Domínio: ${clientData.sigma_domain || 'NÃO CONFIGURADO'}`);
      console.log(`   → Código: ${clientData.sigma_plan_code || 'NÃO CONFIGURADO'}`);
      
      if (!clientData.sigma_domain || !clientData.sigma_plan_code) {
        console.warn('⚠️  [WEBHOOK] Plano Sigma sem domínio/código configurado');
        return { skipped: true, reason: 'sigma_incomplete' };
      }
    }
    
    // ========== VALIDAÇÃO 3: Plano Live21/CloudNation ==========
    if (clientData.is_live21_plan) {
      console.log('🌐 [WEBHOOK] Plano LIVE21/CloudNation detectado');
      console.log(`   → CloudNation ID: ${clientData.username || 'NÃO CONFIGURADO'}`);
      
      // Verificar se cliente tem CloudNation ID
      if (!clientData.username) {
        console.log('⚠️  [WEBHOOK] Cliente não tem CloudNation ID (username vazio)');
        return { skipped: true, reason: 'no_cloudnation_id' };
      }
    }

    // ========== VALIDAÇÃO 4: Plano Koffice (renovação via painel Koffice) ==========
    if (clientData.is_koffice_plan) {
      console.log('🟠 [WEBHOOK] Plano KOFFICE detectado');
      console.log(`   → Domínio: ${clientData.koffice_domain || 'NÃO CONFIGURADO'}`);
      
      if (!clientData.koffice_domain) {
        console.warn('⚠️  [WEBHOOK] Plano Koffice sem domínio configurado');
        return { skipped: true, reason: 'koffice_incomplete' };
      }
      
      // Verificar se cliente tem Koffice Client ID
      if (!clientData.username) {
        console.log('⚠️  [WEBHOOK] Cliente não tem Koffice Client ID (username vazio)');
        return { skipped: true, reason: 'no_koffice_id' };
      }
    }

    // ========== MONTAR PAYLOAD DO WEBHOOK ==========
    const webhookPayload = {
      client_id: clientData.id,
      user_id: clientData.user_id,
      plan_id: clientData.plan_id,
      client_name: clientData.name,
      whatsapp_number: clientData.whatsapp_number,
      
      // IDs de renovação (usado por todos os sistemas)
      cloudnation_id: clientData.username,     // CloudNation ID
      sigma_customer_id: clientData.username,  // Sigma ID
      koffice_client_id: clientData.username,  // ← NOVO: Koffice Client ID
      
      // Informações do plano
      plan_duration_months: clientData.duration_months || 1,
      
      // Flags de integração
      is_sigma_plan: clientData.is_sigma_plan || false,
      is_live21_plan: clientData.is_live21_plan || false,
      is_koffice_plan: clientData.is_koffice_plan || false,  // ← NOVO
      
      // Dados Sigma (se aplicável)
      sigma_domain: clientData.sigma_domain || null,
      sigma_plan_code: clientData.sigma_plan_code || null,
      
      // Dados Koffice (se aplicável) ← NOVO
      koffice_domain: clientData.koffice_domain || null,
      
      // Dados adicionais
      due_date: clientData.due_date,
      payment_id: clientData.mercadopago_payment_id || null,
      amount: clientData.price_value || 0,
      timestamp: new Date().toISOString()
    };

    console.log('📤 [WEBHOOK] Payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('📊 [WEBHOOK] Flags de integração:');
    console.log(`   - Sigma: ${webhookPayload.is_sigma_plan}`);
    console.log(`   - Live21: ${webhookPayload.is_live21_plan}`);
    console.log(`   - Koffice: ${webhookPayload.is_koffice_plan}`);  // ← NOVO

    // ========== FAZER REQUISIÇÃO PARA IPTV MANAGER ==========
    const webhookUrl = `${IPTV_MANAGER_URL}/api/webhooks/client-renewed`;
    
    console.log(`🚀 [WEBHOOK] Disparando para: ${webhookUrl}`);
    
    const response = await axios.post(webhookUrl, webhookPayload, {
      timeout: 120000, // 2 minutos (renovação pode demorar)
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GestaoClientes-Webhook/1.0'
      }
    });

    if (response.data.success) {
      console.log('✅ [WEBHOOK] Renovação automática concluída com sucesso!');
      console.log(`   Resultado:`, response.data);
      return { 
        success: true, 
        data: response.data 
      };
    } else {
      console.error('⚠️  [WEBHOOK] Renovação retornou falha:', response.data);
      return { 
        success: false, 
        error: response.data 
      };
    }

  } catch (error) {
    console.error('❌ [WEBHOOK] Erro ao disparar webhook:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }

    // NÃO quebrar o fluxo de pagamento se o webhook falhar
    // O pagamento já foi processado, webhook é apenas um extra
    return { 
      success: false, 
      error: error.message,
      note: 'Pagamento foi processado mas renovação automática falhou'
    };
  }
}

export { dispatchRenewalWebhook };