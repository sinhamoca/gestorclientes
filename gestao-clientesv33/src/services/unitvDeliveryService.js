// ========================================
// UNITV DELIVERY SERVICE - MÚLTIPLOS CÓDIGOS
// Entrega X códigos baseado em duration_months
// Data: 17/11/2024
// ========================================

import { query } from '../config/database.js';

/**
 * Entregar códigos UniTV (múltiplos baseado na duração do plano)
 * Cliente verá os códigos na página de histórico de pagamentos
 * 
 * @param {Object} clientData - Dados do cliente que pagou
 * @returns {Object} Resultado da entrega
 */
export async function deliverCodeToClient(clientData) {
  try {
    console.log('\n🎫 ========================================');
    console.log('   [UniTV] VINCULANDO CÓDIGOS AO PAGAMENTO');
    console.log('========================================');
    console.log(`   Cliente: ${clientData.name} (ID: ${clientData.id})`);
    console.log(`   Usuário: ${clientData.user_id}`);
    
    const planMonths = clientData.duration_months || clientData.plan_duration_months || 1;
    const codesNeeded = planMonths; // 1 código por mês
    
    console.log(`   Plano: ${planMonths} ${planMonths === 1 ? 'mês' : 'meses'}`);
    console.log(`   Códigos necessários: ${codesNeeded}`);
    
    // ========== BUSCAR CÓDIGOS DISPONÍVEIS ==========
    console.log('\n🔍 [1/3] Buscando códigos disponíveis...');
    
    const availableCodesResult = await query(`
      SELECT * FROM unitv_codes
      WHERE user_id = $1 AND status = 'available'
      ORDER BY created_at ASC
      LIMIT $2
      FOR UPDATE SKIP LOCKED
    `, [clientData.user_id, codesNeeded]);
    
    const availableCodes = availableCodesResult.rows;
    
    if (availableCodes.length === 0) {
      console.log('   ⚠️  Nenhum código disponível em estoque');
      console.log('   ℹ️  Cliente renovado apenas no sistema');
      console.log('   💡 Adicione códigos no menu "Códigos UniTV"\n');
      return {
        success: false,
        skipped: true,
        reason: 'no_codes_available',
        message: 'Sem códigos disponíveis. Cliente renovado apenas no sistema.',
        unitv_code_ids: []
      };
    }
    
    if (availableCodes.length < codesNeeded) {
      console.log(`   ⚠️  Códigos insuficientes!`);
      console.log(`   📊 Necessário: ${codesNeeded} | Disponível: ${availableCodes.length}`);
      console.log('   ℹ️  Cliente renovado apenas no sistema');
      console.log('   💡 Adicione mais códigos no menu "Códigos UniTV"\n');
      return {
        success: false,
        skipped: true,
        reason: 'insufficient_codes',
        message: `Necessário ${codesNeeded} códigos, mas apenas ${availableCodes.length} disponíveis.`,
        unitv_code_ids: []
      };
    }
    
    console.log(`   ✅ ${availableCodes.length} códigos encontrados`);
    
    // ========== FORMATAR CÓDIGOS ==========
    console.log('\n🎨 [2/3] Formatando códigos...');
    
    const formattedCodes = availableCodes.map((code, index) => {
      const formatted = code.code.match(/.{1,4}/g).join('-');
      console.log(`   ${index + 1}. ${formatted} (ID: ${code.id})`);
      return {
        id: code.id,
        code: code.code,
        formatted: formatted
      };
    });
    
    // ========== MARCAR CÓDIGOS COMO ENTREGUES ==========
    console.log('\n💾 [3/3] Vinculando códigos ao cliente...');
    
    for (const codeInfo of formattedCodes) {
      await query(`
        UPDATE unitv_codes
        SET status = 'delivered',
            delivered_to_client_id = $1,
            delivered_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `, [clientData.id, codeInfo.id]);
      console.log(`   ✅ Código ${codeInfo.formatted} vinculado`);
    }
    
    console.log('\n🎉 ========================================');
    console.log('   CÓDIGOS VINCULADOS COM SUCESSO!');
    console.log('========================================');
    console.log(`   Quantidade: ${formattedCodes.length} códigos`);
    console.log(`   Cliente verá na página: /pay/${clientData.payment_token || 'TOKEN'}`);
    console.log('========================================\n');
    
    return {
      success: true,
      codes: formattedCodes.map(c => c.formatted),
      codeIds: formattedCodes.map(c => c.id),
      unitv_code_ids: formattedCodes.map(c => c.id), // Array de IDs
      quantity: formattedCodes.length,
      delivered_via: 'payment_page',
      message: `${formattedCodes.length} código(s) disponíveis na página de pagamento`
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
      message: 'Erro ao processar entrega dos códigos.',
      unitv_code_ids: []
    };
  }
}