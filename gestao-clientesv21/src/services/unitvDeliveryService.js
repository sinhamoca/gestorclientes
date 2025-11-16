// gestao-clientesv18/src/services/unitvDeliveryService.js
import { query } from '../config/database.js';
import { sendTextMessage, getUserInstance } from '../controllers/evolutionController.js';
import { getAvailableCode, markCodeAsDelivered } from '../controllers/unitvController.js';

/**
 * Entregar código UniTV via WhatsApp
 * Chamado pelo webhookDispatcher após pagamento aprovado
 * 
 * @param {Object} clientData - Dados do cliente que pagou
 * @returns {Object} Resultado da entrega
 */
export async function deliverCodeToClient(clientData) {
  try {
    console.log('\n🎫 ========================================');
    console.log('   [UniTV] INICIANDO ENTREGA DE CÓDIGO');
    console.log('========================================');
    console.log(`   Cliente: ${clientData.name} (ID: ${clientData.id})`);
    console.log(`   Usuário: ${clientData.user_id}`);
    console.log(`   Plano: ${clientData.plan_duration_months} meses`);
    
    // ========== VALIDAÇÃO 1: Verificar WhatsApp conectado ==========
    console.log('\n🔍 [1/4] Verificando conexão WhatsApp...');
    
    const whatsappInstance = await getUserInstance(clientData.user_id);
    
    if (!whatsappInstance) {
      console.log('   ⚠️  WhatsApp não está conectado');
      console.log('   ℹ️  Cliente renovado apenas no sistema\n');
      return {
        success: false,
        skipped: true,
        reason: 'whatsapp_disconnected',
        message: 'WhatsApp não está conectado. Cliente renovado apenas no sistema.'
      };
    }
    
    console.log(`   ✅ WhatsApp conectado: ${whatsappInstance.phone_number}`);
    console.log(`   📱 Instância: ${whatsappInstance.instance_name}`);
    
    // ========== VALIDAÇÃO 2: Verificar número do cliente ==========
    console.log('\n📞 [2/4] Verificando número do cliente...');
    
    if (!clientData.whatsapp_number) {
      console.log('   ⚠️  Cliente sem número de WhatsApp cadastrado');
      console.log('   ℹ️  Cliente renovado apenas no sistema\n');
      return {
        success: false,
        skipped: true,
        reason: 'no_phone_number',
        message: 'Cliente não tem número de WhatsApp cadastrado.'
      };
    }
    
    console.log(`   ✅ Número do cliente: ${clientData.whatsapp_number}`);
    
    // ========== BUSCAR CÓDIGO DISPONÍVEL ==========
    console.log('\n🔍 [3/4] Buscando código disponível...');
    
    const availableCode = await getAvailableCode(clientData.user_id);
    
    if (!availableCode) {
      console.log('   ⚠️  Nenhum código disponível em estoque');
      console.log('   ℹ️  Cliente renovado apenas no sistema');
      console.log('   💡 Adicione códigos no menu "Códigos UniTV"\n');
      return {
        success: false,
        skipped: true,
        reason: 'no_codes_available',
        message: 'Sem códigos disponíveis. Cliente renovado apenas no sistema.'
      };
    }
    
    console.log(`   ✅ Código encontrado: ${availableCode.code}`);
    console.log(`   📋 Código ID: ${availableCode.id}`);
    
    // ========== FORMATAR CÓDIGO PARA EXIBIÇÃO ==========
    // Transforma: 0000000000000000 → 0000-0000-0000-0000
    const formattedCode = availableCode.code.match(/.{1,4}/g).join('-');
    console.log(`   🎨 Código formatado: ${formattedCode}`);
    
    // ========== MONTAR MENSAGEM ==========
    const pluralMeses = clientData.plan_duration_months === 1 ? 'mês' : 'meses';
    
    const message = `
🎉 *Pagamento Confirmado!*

Olá *${clientData.name}*, seu pagamento foi aprovado com sucesso!

🎫 *Seu Código de Ativação UniTV:*
\`${formattedCode}\`

📱 *Como usar:*
1. Acesse o aplicativo UniTV
2. Entre na opção "Ativar Código"
3. Digite o código acima
4. Aproveite seu conteúdo! 🚀

⏰ *Validade:* ${clientData.plan_duration_months} ${pluralMeses}

_Caso tenha dúvidas, entre em contato conosco._
    `.trim();
    
    console.log('\n📝 Mensagem preparada:');
    console.log('─'.repeat(50));
    console.log(message);
    console.log('─'.repeat(50));
    
    // ========== ENVIAR MENSAGEM COM RETRY ==========
    console.log('\n📤 [4/4] Enviando mensagem via WhatsApp...');
    
    const maxRetries = 3;
    const retryDelay = 3000; // 3 segundos
    let attempt = 0;
    let sent = false;
    let lastError = null;
    
    while (attempt < maxRetries && !sent) {
      attempt++;
      
      try {
        console.log(`   🔄 Tentativa ${attempt}/${maxRetries}...`);
        
        await sendTextMessage(
          whatsappInstance.instance_name,
          clientData.whatsapp_number,
          message
        );
        
        sent = true;
        console.log(`   ✅ Mensagem enviada com sucesso!`);
        
      } catch (error) {
        lastError = error.message;
        console.log(`   ❌ Falha: ${error.message}`);
        
        if (attempt < maxRetries) {
          console.log(`   ⏳ Aguardando ${retryDelay / 1000}s antes de tentar novamente...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // ========== PROCESSAR RESULTADO ==========
    if (sent) {
      // ✅ Sucesso: Marcar código como entregue
      console.log('\n💾 Marcando código como entregue no banco...');
      
      await markCodeAsDelivered(availableCode.id, clientData.id);
      
      console.log('   ✅ Código vinculado ao cliente');
      console.log('\n🎉 ========================================');
      console.log('   ENTREGA CONCLUÍDA COM SUCESSO!');
      console.log('========================================\n');
      
      return {
        success: true,
        code: formattedCode,
        codeId: availableCode.id,
        delivered_via: 'whatsapp',
        phone_number: clientData.whatsapp_number,
        attempts: attempt,
        message: `Código ${formattedCode} entregue via WhatsApp`
      };
      
    } else {
      // ❌ Falha: NÃO marcar código como usado
      console.log('\n❌ ========================================');
      console.log(`   FALHA APÓS ${maxRetries} TENTATIVAS`);
      console.log('========================================');
      console.log(`   Último erro: ${lastError}`);
      console.log('   ℹ️  Código NÃO foi marcado como usado');
      console.log('   ℹ️  Cliente renovado apenas no sistema');
      console.log('   💡 Tente reenviar manualmente pelo painel\n');
      
      return {
        success: false,
        skipped: true,
        reason: 'whatsapp_send_failed',
        error: lastError,
        attempts: attempt,
        message: `Não foi possível enviar via WhatsApp após ${maxRetries} tentativas. Cliente renovado apenas no sistema.`
      };
    }
    
  } catch (error) {
    console.error('\n❌ ========================================');
    console.error('   ERRO CRÍTICO NA ENTREGA UNITV');
    console.error('========================================');
    console.error(error);
    console.error('');
    
    return {
      success: false,
      error: error.message,
      message: 'Erro ao processar entrega do código.'
    };
  }
}
