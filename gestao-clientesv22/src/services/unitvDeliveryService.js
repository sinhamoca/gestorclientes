// ========================================
// NOVA VERSÃO: unitvDeliveryService.js
// APENAS VINCULA CÓDIGO - SEM WHATSAPP
// Cliente vê código na página de pagamento
// ========================================

/**
 * ARQUIVO: gestao-clientesv21/src/services/unitvDeliveryService.js
 * 
 * SUBSTITUA O ARQUIVO COMPLETO POR ESTE CÓDIGO
 */

import { query } from '../config/database.js';
import { getAvailableCode, markCodeAsDelivered } from '../controllers/unitvController.js';

/**
 * Entregar código UniTV (apenas vincular ao pagamento)
 * Cliente verá o código na página de histórico de pagamentos
 * 
 * @param {Object} clientData - Dados do cliente que pagou
 * @returns {Object} Resultado da entrega
 */
export async function deliverCodeToClient(clientData) {
  try {
    console.log('\n🎫 ========================================');
    console.log('   [UniTV] VINCULANDO CÓDIGO AO PAGAMENTO');
    console.log('========================================');
    console.log(`   Cliente: ${clientData.name} (ID: ${clientData.id})`);
    console.log(`   Usuário: ${clientData.user_id}`);
    
    const planMonths = clientData.duration_months || clientData.plan_duration_months || 1;
    console.log(`   Plano: ${planMonths} ${planMonths === 1 ? 'mês' : 'meses'}`);
    
    // ========== BUSCAR CÓDIGO DISPONÍVEL ==========
    console.log('\n🔍 [1/2] Buscando código disponível...');
    
    const availableCode = await getAvailableCode(clientData.user_id);
    
    if (!availableCode) {
      console.log('   ⚠️  Nenhum código disponível em estoque');
      console.log('   ℹ️  Cliente renovado apenas no sistema');
      console.log('   💡 Adicione códigos no menu "Códigos UniTV"\n');
      return {
        success: false,
        skipped: true,
        reason: 'no_codes_available',
        message: 'Sem códigos disponíveis. Cliente renovado apenas no sistema.',
        unitv_code_id: null
      };
    }
    
    console.log(`   ✅ Código encontrado: ${availableCode.code}`);
    console.log(`   📋 Código ID: ${availableCode.id}`);
    
    // Formatar código para exibição: 0000000000000000 → 0000-0000-0000-0000
    const formattedCode = availableCode.code.match(/.{1,4}/g).join('-');
    console.log(`   🎨 Código formatado: ${formattedCode}`);
    
    // ========== MARCAR CÓDIGO COMO ENTREGUE ==========
    console.log('\n💾 [2/2] Vinculando código ao cliente...');
    
    await markCodeAsDelivered(availableCode.id, clientData.id);
    
    console.log('   ✅ Código vinculado ao cliente no banco');
    console.log('   ℹ️  Cliente verá o código na página de pagamentos');
    
    console.log('\n🎉 ========================================');
    console.log('   CÓDIGO VINCULADO COM SUCESSO!');
    console.log('========================================');
    console.log(`   Código: ${formattedCode}`);
    console.log(`   Cliente verá na página: /pay/${clientData.payment_token || 'TOKEN'}`);
    console.log('========================================\n');
    
    return {
      success: true,
      code: formattedCode,
      codeId: availableCode.id,
      unitv_code_id: availableCode.id,  // ← IMPORTANTE: para salvar na transação
      delivered_via: 'payment_page',
      message: `Código ${formattedCode} disponível na página de pagamento`
    };
    
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('   ERRO CRÍTICO NA ENTREGA UNITV');
    console.error('========================================');
    console.error(error);
    console.error('');
    
    return {
      success: false,
      error: error.message,
      message: 'Erro ao processar entrega do código.',
      unitv_code_id: null
    };
  }
}