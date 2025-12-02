// ========================================
// ACTIVITY LOG SERVICE
// Serviço centralizado para registrar logs de atividades
// Arquivo: src/services/activityLogService.js
// ========================================

import { query } from '../config/database.js';

/**
 * Tipos de log disponíveis
 */
export const LOG_TYPES = {
  WHATSAPP: 'whatsapp',
  PAYMENT: 'payment',
  RENEWAL: 'renewal'
};

/**
 * Status de log disponíveis
 */
export const LOG_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending'
};

/**
 * Registrar um log de atividade
 * @param {Object} logData - Dados do log
 * @param {number} logData.userId - ID do usuário
 * @param {string} logData.type - Tipo do log (whatsapp, payment, renewal)
 * @param {string} logData.status - Status (success, error, pending)
 * @param {string} logData.title - Título curto
 * @param {string} [logData.description] - Descrição detalhada
 * @param {number} [logData.clientId] - ID do cliente
 * @param {string} [logData.clientName] - Nome do cliente
 * @param {number} [logData.amount] - Valor (para pagamentos)
 * @param {string} [logData.errorDetails] - Detalhes do erro
 * @param {Object} [logData.metadata] - Dados extras em JSON
 */
export async function logActivity(logData) {
  try {
    const {
      userId,
      type,
      status,
      title,
      description = null,
      clientId = null,
      clientName = null,
      amount = null,
      errorDetails = null,
      metadata = null
    } = logData;

    // Validações básicas
    if (!userId || !type || !status || !title) {
      console.error('❌ [ActivityLog] Dados obrigatórios faltando:', { userId, type, status, title });
      return null;
    }

    const result = await query(`
      INSERT INTO activity_logs 
        (user_id, type, status, title, description, client_id, client_name, amount, error_details, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      userId,
      type,
      status,
      title,
      description,
      clientId,
      clientName,
      amount,
      errorDetails,
      metadata ? JSON.stringify(metadata) : null
    ]);

    console.log(`📋 [ActivityLog] ${status === 'success' ? '✅' : '❌'} ${type}: ${title}`);
    
    return result.rows[0]?.id || null;

  } catch (error) {
    // Não quebrar o fluxo principal se o log falhar
    console.error('❌ [ActivityLog] Erro ao registrar log:', error.message);
    return null;
  }
}

// ========================================
// FUNÇÕES HELPER PARA CADA TIPO DE LOG
// ========================================

/**
 * Registrar log de WhatsApp
 */
export async function logWhatsApp({ userId, clientId, clientName, whatsappNumber, success, errorMessage = null }) {
  return logActivity({
    userId,
    type: LOG_TYPES.WHATSAPP,
    status: success ? LOG_STATUS.SUCCESS : LOG_STATUS.ERROR,
    title: success 
      ? `Mensagem enviada para ${clientName}` 
      : `Falha no envio para ${clientName}`,
    description: success 
      ? `Mensagem enviada com sucesso para ${whatsappNumber}`
      : `Erro ao enviar mensagem para ${whatsappNumber}`,
    clientId,
    clientName,
    errorDetails: errorMessage,
    metadata: { whatsapp_number: whatsappNumber }
  });
}

/**
 * Registrar log de Pagamento
 */
export async function logPayment({ userId, clientId, clientName, amount, paymentMethod, success, paymentId = null, errorMessage = null }) {
  return logActivity({
    userId,
    type: LOG_TYPES.PAYMENT,
    status: success ? LOG_STATUS.SUCCESS : LOG_STATUS.ERROR,
    title: success 
      ? `Pagamento recebido de ${clientName}`
      : `Falha no pagamento de ${clientName}`,
    description: success 
      ? `R$ ${amount.toFixed(2)} via ${paymentMethod || 'PIX'}`
      : `Erro ao processar pagamento`,
    clientId,
    clientName,
    amount,
    errorDetails: errorMessage,
    metadata: { 
      payment_method: paymentMethod,
      payment_id: paymentId
    }
  });
}

/**
 * Registrar log de Renovação Automática
 */
export async function logRenewal({ userId, clientId, clientName, provider, success, months = null, errorMessage = null, details = null }) {
  return logActivity({
    userId,
    type: LOG_TYPES.RENEWAL,
    status: success ? LOG_STATUS.SUCCESS : LOG_STATUS.ERROR,
    title: success 
      ? `Renovação automática - ${clientName}`
      : `Falha na renovação - ${clientName}`,
    description: success 
      ? `${provider}${months ? ` - ${months} ${months === 1 ? 'mês' : 'meses'}` : ''}`
      : `Erro ao renovar no ${provider}`,
    clientId,
    clientName,
    errorDetails: errorMessage,
    metadata: { 
      provider,
      months,
      details
    }
  });
}

export default {
  logActivity,
  logWhatsApp,
  logPayment,
  logRenewal,
  LOG_TYPES,
  LOG_STATUS
};
