/* ========================================
   WEBHOOK DISPATCHER - COM SUPORTE UNITV
   Dispara webhook para IPTV Manager OU entrega código UniTV
   ATUALIZADO: Suporte Sigma, Live21, Koffice, Uniplay e UniTV
   ======================================== */

import axios from 'axios';
import { deliverCodeToClient } from '../services/unitvDeliveryService.js';

// URL do IPTV Manager (configurável via ENV)
const IPTV_MANAGER_URL = process.env.IPTV_MANAGER_URL || 'http://iptv_manager_backend:5001';

/**
 * Disparar webhook para IPTV Manager OU entregar código UniTV
 * Chamado após renovação bem-sucedida no banco
 * 
 * SUPORTA: Sigma, Live21/CloudNation, Koffice, Uniplay e UniTV
 */
async function dispatchRenewalWebhook(clientData) {
  try {
    console.log('\n🔔 [WEBHOOK] Iniciando validação para renovação automática...');
    console.log(`   Cliente: ${clientData.name}`);
    console.log(`   Plano ID: ${clientData.plan_id}`);
    console.log(`   Is Sigma: ${clientData.is_sigma_plan || false}`);
    console.log(`   Is Live21: ${clientData.is_live21_plan || false}`);
    console.log(`   Is Koffice: ${clientData.is_koffice_plan || false}`);
    console.log(`   Is Uniplay: ${clientData.is_uniplay_plan || false}`);
    console.log(`   Is UniTV: ${clientData.is_unitv_plan || false}`);  // ← NOVO
    console.log(`   Is Club: ${clientData.is_club_plan || false}`);  // ← ADICIONAR

    
    // ========== VALIDAÇÃO ESPECIAL: PLANO UNITV ==========
    // UniTV é diferente: NÃO vai para IPTV Manager
    // Em vez disso, entrega código diretamente via WhatsApp
    if (clientData.is_unitv_plan) {
      console.log('\n🎫 ========================================');
      console.log('   PLANO UNITV DETECTADO!');
      console.log('========================================');
      console.log('   → Vai entregar CÓDIGO via WhatsApp');
      console.log('   → NÃO vai para IPTV Manager');
      
      try {
        const deliveryResult = await deliverCodeToClient(clientData);
        
        if (deliveryResult.success) {
          console.log('✅ [UNITV] Código entregue com sucesso!');
          return {
            success: true,
            provider: 'unitv',
            delivered: true,
            codes: deliveryResult.codes,
            codeIds: deliveryResult.codeIds,
            unitv_code_ids: deliveryResult.unitv_code_ids, // ← ESTE É O IMPORTANTE!
            message: deliveryResult.message
          };
        } else if (deliveryResult.skipped) {
          console.log('ℹ️  [UNITV] Entrega pulada:', deliveryResult.reason);
          return {
            success: true,
            provider: 'unitv',
            skipped: true,
            reason: deliveryResult.reason,
            codeId: deliveryResult.codeId || null,              // ← ADICIONAR!
            unitv_code_id: deliveryResult.unitv_code_id || null, // ← ADICIONAR!
            message: deliveryResult.message
          };
        } else {
          console.error('❌ [UNITV] Falha na entrega:', deliveryResult.error);
          return {
            success: false,
            provider: 'unitv',
            error: deliveryResult.error,
            codeId: null,              // ← ADICIONAR!
            unitv_code_id: null,       // ← ADICIONAR!
            message: deliveryResult.message
          };
        }
      } catch (error) {
        console.error('❌ [UNITV] Erro ao processar entrega:', error);
        return {
          success: false,
          provider: 'unitv',
          error: error.message,
          codeId: null,              // ← ADICIONAR!
          unitv_code_id: null,       // ← ADICIONAR!
          message: 'Erro ao processar entrega do código UniTV'
        };
      }
    }
    
    // ========== VALIDAÇÃO 1: Verificar se tem integração IPTV ==========
    if (!clientData.is_sigma_plan && 
        !clientData.is_live21_plan && 
        !clientData.is_koffice_plan &&
        !clientData.is_uniplay_plan &&
        !clientData.is_club_plan) {  // ← ADICIONAR
      console.log('ℹ️  [WEBHOOK] Plano SEM integração de renovação automática');
      console.log('   → Não é Sigma, Live21, Koffice, Uniplay, UniTV nem Club');
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
      
      if (!clientData.username) {
        console.log('⚠️  [WEBHOOK] Cliente não tem Koffice Client ID (username vazio)');
        return { skipped: true, reason: 'no_koffice_id' };
      }
    }

    // ========== VALIDAÇÃO 5: Plano Uniplay (renovação via API Uniplay) ==========
    if (clientData.is_uniplay_plan) {
      console.log('🔵 [WEBHOOK] Plano UNIPLAY detectado');
      console.log(`   → Nome do cliente: "${clientData.name}"`);
      console.log(`   → Créditos: ${clientData.duration_months} (1 mês = 1 crédito)`);
      console.log(`   → Busca: Automática (P2P + IPTV)`);
    }

    // ========== VALIDAÇÃO 6: Plano Club (renovação via API Club/Dashboard.bz) ==========
    if (clientData.is_club_plan) {
      console.log('🟡 [WEBHOOK] Plano CLUB detectado');
      console.log(`   → Dashboard: dashboard.bz`);
      console.log(`   → Client ID: ${clientData.username || 'NÃO CONFIGURADO'}`);
      
      if (!clientData.username) {
        console.log('⚠️  [WEBHOOK] Cliente não tem Club Client ID (username vazio)');
        return { skipped: true, reason: 'no_club_id' };
      }
    }

    // ========== MONTAR PAYLOAD DO WEBHOOK ==========
    const webhookPayload = {
      client_id: clientData.id,
      user_id: clientData.user_id,
      plan_id: clientData.plan_id,
      client_name: clientData.name,
      whatsapp_number: clientData.whatsapp_number,
      
      // IDs de renovação
      cloudnation_id: clientData.username,
      sigma_customer_id: clientData.username,
      koffice_client_id: clientData.username,
      club_client_id: clientData.username,  // ← NOVO (Client ID do Club)
      
      // Informações do plano
      plan_duration_months: clientData.duration_months || 1,
      
      // Flags de integração
      is_sigma_plan: clientData.is_sigma_plan || false,
      is_live21_plan: clientData.is_live21_plan || false,
      is_koffice_plan: clientData.is_koffice_plan || false,
      is_uniplay_plan: clientData.is_uniplay_plan || false,
      is_unitv_plan: clientData.is_unitv_plan || false,  // ← NOVO
      is_club_plan: clientData.is_club_plan || false,  // ← NOVO
      
      // Dados Sigma
      sigma_domain: clientData.sigma_domain || null,
      sigma_plan_code: clientData.sigma_plan_code || null,
      
      // Dados Koffice
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
    console.log(`   - Koffice: ${webhookPayload.is_koffice_plan}`);
    console.log(`   - Uniplay: ${webhookPayload.is_uniplay_plan}`);
    console.log(`   - UniTV: ${webhookPayload.is_unitv_plan}`);  // ← NOVO
    console.log(`   - Club: ${webhookPayload.is_club_plan}`);  // ← NOVO


    // ========== FAZER REQUISIÇÃO PARA IPTV MANAGER ==========
    const webhookUrl = `${IPTV_MANAGER_URL}/api/webhooks/client-renewed`;
    
    console.log(`🚀 [WEBHOOK] Disparando para: ${webhookUrl}`);
    
    const response = await axios.post(webhookUrl, webhookPayload, {
      timeout: 120000,
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

    return { 
      success: false, 
      error: error.message,
      note: 'Pagamento foi processado mas renovação automática falhou'
    };
  }
}

export { dispatchRenewalWebhook };