/* ========================================
   WEBHOOK DISPATCHER
   Adicionar ao paymentController.js
   Dispara webhook para IPTV Manager
   ======================================== */

import axios from 'axios';

// URL do IPTV Manager (configurável via ENV)
const IPTV_MANAGER_URL = process.env.IPTV_MANAGER_URL || 'http://iptv_manager_backend:5001';

/**
 * Disparar webhook para IPTV Manager
 * Chamado após renovação bem-sucedida no banco
 */
async function dispatchRenewalWebhook(clientData) {
  try {
    console.log('\n🔔 [WEBHOOK] Disparando webhook para IPTV Manager...');
    console.log(`   Cliente: ${clientData.name}`);
    console.log(`   CloudNation ID: ${clientData.username}`);
    
    // Verificar se cliente tem CloudNation ID
    if (!clientData.username) {
      console.log('⚠️  [WEBHOOK] Cliente não tem CloudNation ID (username vazio), pulando renovação automática');
      return { skipped: true, reason: 'no_cloudnation_id' };
    }

    // Montar payload do webhook
    const webhookPayload = {
      client_id: clientData.id,
      user_id: clientData.user_id,
      plan_id: clientData.plan_id,  // ← ADICIONAR ESTA LINHA!
      client_name: clientData.name,
      whatsapp_number: clientData.whatsapp_number,
      cloudnation_id: clientData.username, // ID do CloudNation (ou username Sigma)
      plan_duration_months: clientData.duration_months || 1,
      due_date: clientData.due_date,
      payment_id: clientData.mercadopago_payment_id || null,
      amount: clientData.price_value || 0,
      timestamp: new Date().toISOString()
    };

    console.log('📤 [WEBHOOK] Payload:', JSON.stringify(webhookPayload, null, 2));

    // Fazer requisição para IPTV Manager
    const webhookUrl = `${IPTV_MANAGER_URL}/api/webhooks/client-renewed`;
    
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

// ========== MODIFICAÇÃO NA FUNÇÃO processApprovedPayment ==========

/**
 * INSTRUÇÕES DE INTEGRAÇÃO:
 * 
 * No arquivo: gestao-clientesv9/src/controllers/paymentController.js
 * 
 * 1. Importar a função no topo do arquivo:
 *    import { dispatchRenewalWebhook } from './webhookDispatcher.js';
 * 
 * 2. Adicionar esta chamada APÓS renovar o cliente no banco,
 *    dentro da função processApprovedPayment():
 * 
 *    // ... código existente que renova o cliente ...
 * 
 *    // 3. Renovar cliente no banco
 *    const newDueDate = new Date(baseDate);
 *    newDueDate.setMonth(newDueDate.getMonth() + durationMonths);
 * 
 *    await query(
 *      'UPDATE clients SET due_date = $1, updated_at = NOW() WHERE id = $2',
 *      [newDueDate, clientData.id]
 *    );
 * 
 *    // ✨ NOVO: Disparar webhook para renovação automática CloudNation
 *    const webhookResult = await dispatchRenewalWebhook({
 *      ...clientData,
 *      mercadopago_payment_id: payment.id,
 *      due_date: newDueDate
 *    });
 * 
 *    if (webhookResult.success) {
 *      console.log('✅ Renovação automática CloudNation concluída');
 *    } else {
 *      console.log('⚠️  Renovação automática CloudNation falhou (mas pagamento foi processado)');
 *    }
 * 
 *    // ... resto do código ...
 */

export { dispatchRenewalWebhook };
