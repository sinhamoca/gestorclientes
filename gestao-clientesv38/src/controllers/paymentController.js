// ========================================
// PAYMENT CONTROLLER - VERSÃO ATUALIZADA
// ✅ Cartão com taxa de 10%
// ✅ PIX sem taxa
// ✅ Aba de Faturas (Histórico)
// ✅ Botão para Gerar PIX
// ✅ Multi-tenant
// ✅ Proteção webhook duplicado
// ✅ SISTEMA UNITV - Código na página
// Data: 17/11/2024
// ========================================

import { query } from '../config/database.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { getUserCredentials } from './paymentSettingsController.js';
import { dispatchRenewalWebhook } from './webhookDispatcher.js';
import { logPayment } from '../services/activityLogService.js';

// ========== CONFIGURAÇÕES ==========
const CARD_FEE_PERCENTAGE = 10; // Taxa de 10% para pagamento com cartão

// ========== GERAR TOKEN ==========
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========== BUSCAR HISTÓRICO DE PAGAMENTOS DO CLIENTE ==========
export async function getClientPaymentHistory(req, res) {
  try {
    const { token } = req.params;
    
    console.log('📜 Buscando histórico de pagamentos para token:', token);
    
    // Busca cliente pelo token
    const clientResult = await query(`
      SELECT id, user_id FROM clients WHERE payment_token = $1
    `, [token]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    const client = clientResult.rows[0];
    
    // Busca histórico de transações pagas (COM código UniTV se existir)
    // Busca histórico de transações pagas (COM MÚLTIPLOS códigos UniTV)
    const historyResult = await query(`
      SELECT 
        ft.id,
        ft.amount_received,
        ft.paid_date,
        ft.payment_method,
        ft.payment_gateway,
        ft.status,
        ft.gateway_payment_id,
        ARRAY_AGG(uc.code) FILTER (WHERE uc.code IS NOT NULL) as unitv_codes
      FROM financial_transactions ft
      LEFT JOIN transaction_unitv_codes tuc ON ft.id = tuc.transaction_id
      LEFT JOIN unitv_codes uc ON tuc.unitv_code_id = uc.id
      WHERE ft.client_id = $1 
      AND ft.status = 'paid'
      GROUP BY ft.id, ft.amount_received, ft.paid_date, ft.payment_method, ft.payment_gateway, ft.status, ft.gateway_payment_id
      ORDER BY ft.paid_date DESC
      LIMIT 50
    `, [client.id]);
    
    console.log(`✅ Encontradas ${historyResult.rows.length} transações`);
    
    // Formatar códigos UniTV (agora é um array)
    const transactions = historyResult.rows.map(tx => {
      if (tx.unitv_codes && tx.unitv_codes.length > 0) {
        // Formatar cada código: 1111111111111111 → 1111-1111-1111-1111
        tx.unitv_codes_formatted = tx.unitv_codes.map(code => 
          code.match(/.{1,4}/g).join('-')
        );
      } else {
        tx.unitv_codes_formatted = [];
      }
      return tx;
    });    
    res.json({
      success: true,
      transactions
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}

// ========== BUSCAR CÓDIGO UNITV DE UMA TRANSAÇÃO ==========
export async function getUnitvCodeFromTransaction(req, res) {
  try {
    const { transaction_id } = req.params;
    
    // Buscar transação com código
    const result = await query(`
      SELECT 
        ft.id as transaction_id,
        ft.client_id,
        ft.amount_received,
        ft.paid_date,
        ft.unitv_code_id,
        uc.code as unitv_code,
        uc.delivered_at,
        c.name as client_name,
        c.due_date as client_due_date,
        p.name as plan_name,
        p.duration_months
      FROM financial_transactions ft
      LEFT JOIN unitv_codes uc ON ft.unitv_code_id = uc.id
      LEFT JOIN clients c ON ft.client_id = c.id
      LEFT JOIN plans p ON c.plan_id = p.id
      WHERE ft.id = $1
    `, [transaction_id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Transação não encontrada' 
      });
    }
    
    const transaction = result.rows[0];
    
    // Formatar código: 1111111111111111 → 1111-1111-1111-1111
    if (transaction.unitv_code) {
      transaction.unitv_code_formatted = transaction.unitv_code.match(/.{1,4}/g).join('-');
    }
    
    res.json({
      success: true,
      has_unitv_code: !!transaction.unitv_code_id,
      transaction
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar código UniTV:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

// ========== PÁGINA DE PAGAMENTO ==========
export async function renderPaymentPage(req, res) {
  try {
    const { token } = req.params;
    
    console.log('🔍 Buscando cliente pelo token:', token);
    
    const clientResult = await query(`
      SELECT 
        c.*,
        p.name as plan_name,
        p.num_screens,
        s.name as server_name,
        u.id as user_id,
        u.name as company_name
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.payment_token = $1
    `, [token]);
    
    if (clientResult.rows.length === 0) {
      console.warn('⚠️ Cliente não encontrado para token:', token);
      return res.status(404).send(generateErrorPage('Cliente não encontrado'));
    }
    
    const client = clientResult.rows[0];
    console.log('✅ Cliente encontrado:', client.name);
    console.log('   User ID:', client.user_id);

// Buscar código(s) UniTV mais recente(s) do cliente
    let latestUnitvCodes = [];
    const unitvResult = await query(`
      SELECT 
        uc.code,
        uc.delivered_at
      FROM unitv_codes uc
      JOIN transaction_unitv_codes tuc ON uc.id = tuc.unitv_code_id
      JOIN financial_transactions ft ON tuc.transaction_id = ft.id
      WHERE ft.client_id = $1
      AND uc.status = 'delivered'
      ORDER BY ft.paid_date DESC, uc.delivered_at DESC
      LIMIT 3
    `, [client.id]);

    if (unitvResult.rows.length > 0) {
      latestUnitvCodes = unitvResult.rows.map(row => 
        row.code.match(/.{1,4}/g).join('-')
      );
      console.log('🎫 Códigos UniTV encontrados:', latestUnitvCodes);
    }
    
    // Verificar se usuário configurou Mercado Pago
    const credentials = await getUserCredentials(client.user_id);
    
    if (!credentials) {
      console.error('❌ Usuário não configurou Mercado Pago!');
      return res.status(403).send(generateErrorPage(
        'Sistema de Pagamentos Não Configurado',
        `O responsável por ${client.company_name || 'esta conta'} ainda não configurou o sistema de pagamentos.<br><br>Entre em contato para mais informações.`,
        client.company_name
      ));
    }
    
    console.log('✅ Credenciais encontradas para user:', client.user_id);
    
    // Cria sessão de pagamento
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Calcula valores: PIX (normal) e Cartão (+10%)
    const pixAmount = parseFloat(client.price_value);
    const cardAmount = pixAmount * (1 + CARD_FEE_PERCENTAGE / 100);
    
    console.log('💰 Valores calculados:');
    console.log('   PIX (sem taxa): R$', pixAmount.toFixed(2));
    console.log('   Cartão (+10%): R$', cardAmount.toFixed(2));
    
    await query(`
      INSERT INTO payment_sessions (
        client_id, user_id, payment_token, session_token,
        amount, currency, status, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      client.id, client.user_id, client.payment_token, sessionToken,
      pixAmount, // Valor base (PIX)
      'BRL', 'pending', expiresAt,
      JSON.stringify({ 
        client_name: client.name,
        pix_amount: pixAmount,
        card_amount: cardAmount
      })
    ]);
    
    console.log('🆕 Nova sessão criada:', sessionToken);
    
    // Renderiza página HTML
    const html = generatePaymentPageHTML(client, sessionToken, credentials.public_key, pixAmount, cardAmount, latestUnitvCodes);
    res.send(html);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).send(generateErrorPage('Erro Interno', error.message));
  }
}

// ========== CRIAR PAGAMENTO PIX ==========
export async function createPixPayment(req, res) {
  try {
    const { session_token } = req.body;
    
    console.log('📱 Criando pagamento PIX para sessão:', session_token);
    
    const sessionResult = await query(`
      SELECT ps.*, c.name, c.whatsapp_number, c.user_id
      FROM payment_sessions ps
      JOIN clients c ON ps.client_id = c.id
      WHERE ps.session_token = $1 AND ps.status = 'pending'
    `, [session_token]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    const session = sessionResult.rows[0];
    
    // Buscar credenciais do usuário
    const credentials = await getUserCredentials(session.user_id);
    
    if (!credentials) {
      return res.status(403).json({ 
        error: 'Sistema de pagamentos não configurado. Entre em contato com o responsável.' 
      });
    }
    
    console.log('✅ Usando credenciais do user:', session.user_id);
    
    // Criar cliente Mercado Pago
    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: credentials.access_token
    });
    
    const paymentClient = new Payment(mercadopagoClient);
    const fakeEmail = `cliente${session.client_id}@gmail.com`;
    
    console.log('📤 Criando PIX - Valor: R$', session.amount);
    
    // Criar pagamento PIX
    const payment = await paymentClient.create({
      body: {
        transaction_amount: parseFloat(session.amount),
        description: `Renovação - ${session.name}`,
        payment_method_id: 'pix',
        payer: {
          email: fakeEmail,
          first_name: session.name.split(' ')[0] || 'Cliente',
          last_name: session.name.split(' ').slice(1).join(' ') || 'Sistema'
        },
        external_reference: session.session_token,
        notification_url: `${credentials.payment_domain || process.env.PAYMENT_DOMAIN}/api/webhooks/mercadopago`
      }
    });
    
    console.log('✅ PIX criado:', payment.id);
    
    // Salvar ID do pagamento
    await query(`
      UPDATE payment_sessions
      SET mercadopago_payment_id = $1
      WHERE session_token = $2
    `, [payment.id.toString(), session_token]);
    
    // Retornar dados do PIX
    res.json({
      payment_id: payment.id,
      qr_code: payment.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: payment.point_of_interaction.transaction_data.qr_code_base64,
      ticket_url: payment.point_of_interaction.transaction_data.ticket_url,
      expires_at: payment.date_of_expiration
    });
    
  } catch (error) {
    console.error('❌ Erro ao criar PIX:', error);
    res.status(500).json({ 
      error: 'Erro ao criar pagamento',
      details: error.message 
    });
  }
}

// ========== CRIAR PAGAMENTO CARTÃO ==========
export async function createCardPayment(req, res) {
  try {
    const { session_token, token, payment_method_id, installments } = req.body;
    
    console.log('💳 Processando cartão para sessão:', session_token);
    
    const sessionResult = await query(`
      SELECT ps.*, c.name, c.whatsapp_number, c.user_id, c.price_value
      FROM payment_sessions ps
      JOIN clients c ON ps.client_id = c.id
      WHERE ps.session_token = $1 AND ps.status = 'pending'
    `, [session_token]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    const session = sessionResult.rows[0];
    
    // Buscar credenciais do usuário
    const credentials = await getUserCredentials(session.user_id);
    
    if (!credentials) {
      return res.status(403).json({ 
        error: 'Sistema de pagamentos não configurado. Entre em contato com o responsável.' 
      });
    }
    
    console.log('✅ Usando credenciais do user:', session.user_id);
    
    // Calcular valor com taxa de 10%
    const baseAmount = parseFloat(session.price_value);
    const cardAmount = baseAmount * (1 + CARD_FEE_PERCENTAGE / 100);
    
    console.log('💰 Valores:');
    console.log('   Base (PIX): R$', baseAmount.toFixed(2));
    console.log('   Cartão (+10%): R$', cardAmount.toFixed(2));
    
    // Criar cliente Mercado Pago
    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: credentials.access_token
    });
    
    const paymentClient = new Payment(mercadopagoClient);
    const fakeEmail = `cliente${session.client_id}@gmail.com`;
    
    // Criar pagamento
    const payment = await paymentClient.create({
      body: {
        transaction_amount: cardAmount,
        token: token,
        description: `Renovação - ${session.name}`,
        installments: parseInt(installments),
        payment_method_id: payment_method_id,
        payer: {
          email: fakeEmail
        },
        external_reference: session.session_token,
        notification_url: `${credentials.payment_domain || process.env.PAYMENT_DOMAIN}/api/webhooks/mercadopago`
      }
    });
    
    console.log('📊 Status do pagamento:', payment.status);
    
    // Salvar ID do pagamento
    await query(`
      UPDATE payment_sessions
      SET mercadopago_payment_id = $1
      WHERE session_token = $2
    `, [payment.id.toString(), session_token]);
    
    if (payment.status === 'approved') {
      console.log('✅ Pagamento aprovado! Processando...');
      const sessionData = { ...session, amount: cardAmount };
      await processApprovedPayment(payment, sessionData);
    }
    
    res.json({
      approved: payment.status === 'approved',
      status: payment.status,
      status_detail: payment.status_detail,
      payment_id: payment.id
    });
    
  } catch (error) {
    console.error('❌ Erro ao processar cartão:', error);
    res.status(500).json({ 
      error: 'Erro ao processar pagamento',
      details: error.message 
    });
  }
}

// ========== WEBHOOK DO MERCADO PAGO ==========
export async function handleMercadoPagoWebhook(req, res) {
  try {
    console.log('📥 Webhook recebido do Mercado Pago');
    
    const { type, data } = req.body;
    
    if (type === 'payment') {
      const paymentId = data.id;
      console.log('💰 Payment ID:', paymentId);
      
      // Buscar sessão pelo payment_id
      const sessionResult = await query(`
        SELECT ps.*, c.user_id, c.due_date, c.name
        FROM payment_sessions ps
        JOIN clients c ON ps.client_id = c.id
        WHERE ps.mercadopago_payment_id = $1
      `, [paymentId.toString()]);
      
      if (sessionResult.rows.length === 0) {
        console.warn('⚠️ Sessão não encontrada para payment:', paymentId);
        return res.status(200).json({ received: true });
      }
      
      const session = sessionResult.rows[0];
      
      // Buscar credenciais para consultar o pagamento
      const credentials = await getUserCredentials(session.user_id);
      
      if (!credentials) {
        console.error('❌ Credenciais não encontradas para processar webhook');
        return res.status(200).json({ received: true });
      }
      
      // Consultar status do pagamento
      const mercadopagoClient = new MercadoPagoConfig({
        accessToken: credentials.access_token
      });
      
      const paymentClient = new Payment(mercadopagoClient);
      const payment = await paymentClient.get({ id: paymentId });
      
      console.log('📊 Status do pagamento:', payment.status);
      
      if (payment.status === 'approved') {
        await processApprovedPayment(payment, session);
      }
    }
    
    res.status(200).json({ received: true });
    
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    res.status(200).json({ received: true });
  }
}

// ========== PROCESSAR PAGAMENTO APROVADO (COM UNITV CODE ID) ==========
async function processApprovedPayment(payment, session) {
  try {
    console.log('✅ Processando pagamento aprovado:', payment.id);
    console.log('   Cliente:', session.name);
    
    // ⚠️ PROTEÇÃO CONTRA WEBHOOK DUPLICADO
    if (session.status === 'paid') {
      console.log('ℹ️  Pagamento já foi processado anteriormente (ignorando webhook duplicado)');
      return;
    }
    
    const paidDateTime = new Date(); // Hora ATUAL do pagamento

    // ========== BUSCAR INFORMAÇÕES COMPLETAS (COM is_unitv_plan) ==========
    const clientDataResult = await query(`
      SELECT 
        c.id,
        c.user_id,
        c.name,
        c.whatsapp_number,
        c.username,
        p.num_screens,
        c.due_date,
        c.plan_id,
        p.duration_months,
        p.is_sigma_plan,
        p.is_live21_plan,
        p.is_koffice_plan,
        p.sigma_domain,
        p.is_uniplay_plan,
        p.is_unitv_plan,
        p.is_club_plan,
        p.is_painelfoda_plan,
        p.is_rush_plan,
        p.rush_type,
        p.sigma_plan_code,
        p.koffice_domain,
        p.painelfoda_domain,
        p.painelfoda_username,
        p.painelfoda_password,
        p.painelfoda_package_id,
        s.cost_per_screen,
        s.multiply_by_screens
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE c.id = $1
    `, [session.client_id]);
    
    if (clientDataResult.rows.length === 0) {
      console.error('❌ Cliente não encontrado:', session.client_id);
      return;
    }
    
    const clientData = clientDataResult.rows[0];
    
    // Log para debug
    console.log('📋 Dados do plano:');
    console.log(`   Is Sigma: ${clientData.is_sigma_plan || false}`);
    console.log(`   Is Live21: ${clientData.is_live21_plan || false}`);
    console.log(`   Is Koffice: ${clientData.is_koffice_plan || false}`);
    console.log(`   Is Uniplay: ${clientData.is_uniplay_plan || false}`);
    console.log(`   Is UniTV: ${clientData.is_unitv_plan || false}`);
    console.log(`   Is Club: ${clientData.is_club_plan || false}`);  // ← ADICIONAR
    console.log(`   Is PainelFoda: ${clientData.is_painelfoda_plan || false}`);
    console.log(`   Rush Type: ${clientData.rush_type || 'N/A'}`);               // ← ADD

    // Calcular valores
    const serverCost = clientData.multiply_by_screens 
      ? parseFloat(clientData.cost_per_screen || 0) * parseInt(clientData.num_screens || 1)
      : parseFloat(clientData.cost_per_screen || 0);
    
    const amountReceived = parseFloat(payment.transaction_amount);
    const netProfit = amountReceived - serverCost;
    
    console.log('💰 Cálculos:');
    console.log('   Recebido: R$', amountReceived.toFixed(2));
    console.log('   Custo servidor: R$', serverCost.toFixed(2));
    console.log('   Lucro líquido: R$', netProfit.toFixed(2));
    
    // 1. Atualizar status da sessão
    await query(`
      UPDATE payment_sessions
      SET status = 'paid', paid_at = NOW(), payment_method = $1
      WHERE id = $2
    `, [payment.payment_type_id, session.id]);
    
    console.log('✅ Sessão atualizada');
    
    // 2. Calcular nova data de vencimento
    const currentDueDate = new Date(clientData.due_date);
    const today = new Date();
    const baseDate = currentDueDate < today ? today : currentDueDate;
    
    const newDueDate = new Date(baseDate);
    const monthsToAdd = clientData.duration_months || 1;
    newDueDate.setMonth(newDueDate.getMonth() + monthsToAdd);
    
    console.log('📅 Renovação:');
    console.log('   Data anterior:', currentDueDate.toLocaleDateString('pt-BR'));
    console.log('   Meses do plano:', monthsToAdd);
    console.log('   Nova data:', newDueDate.toLocaleDateString('pt-BR'));
    
    // 3. Atualizar cliente (renovar)
    await query(`
      UPDATE clients
      SET due_date = $1, updated_at = NOW()
      WHERE id = $2
    `, [newDueDate, session.client_id]);
    
    console.log('✅ Cliente renovado no banco de dados');

    // 4. WEBHOOK PARA RENOVAÇÃO AUTOMÁTICA (retorna unitv_code_id se houver)
    let webhookResult = { success: false };
    
    try {
      console.log('\n🔔 Disparando webhook para renovação automática...');
      
      webhookResult = await dispatchRenewalWebhook({
        ...clientData,
        mercadopago_payment_id: payment.id,
        due_date: newDueDate
      });

      if (webhookResult.success) {
        console.log('✅ Renovação automática externa concluída com sucesso!');
      } else if (webhookResult.skipped) {
        console.log(`ℹ️  Renovação automática externa ignorada: ${webhookResult.reason}`);
        
        // Mensagens amigáveis para cada motivo
        switch(webhookResult.reason) {
          case 'no_integration':
            console.log('   → Plano sem integração de renovação (apenas renovação interna)');
            break;
          case 'no_cloudnation_id':
            console.log('   → Cliente sem ID do CloudNation configurado');
            break;
          case 'sigma_incomplete':
            console.log('   → Plano Sigma sem domínio/código configurado');
            break;
          case 'no_codes_available':
            console.log('   → Sem códigos UniTV disponíveis em estoque');
            break;
          case 'whatsapp_send_failed':
            console.log('   → Código vinculado mas falha no envio WhatsApp');
            break;
        }
      } else {
        console.log('⚠️  Renovação automática externa falhou (mas pagamento foi processado)');
        console.log('   Erro:', webhookResult.error);
      }
    } catch (webhookError) {
      // Não quebrar o fluxo se webhook falhar
      console.error('⚠️  Erro no webhook (pagamento já foi processado):', webhookError.message);
    }
    
    // ========== EXTRAIR unitv_code_id DO WEBHOOK ==========
    // ========== EXTRAIR unitv_code_ids DO WEBHOOK (MÚLTIPLOS) ==========
    console.log('🔍 [DEBUG] webhookResult completo:', JSON.stringify(webhookResult, null, 2));
    
    const unitvCodeIds = Array.isArray(webhookResult.unitv_code_ids) 
      ? webhookResult.unitv_code_ids 
      : (webhookResult.unitv_code_id || webhookResult.codeId ? [webhookResult.unitv_code_id || webhookResult.codeId] : []);
    
    console.log(`💾 Salvando transação financeira...`);
    console.log(`   🔍 [DEBUG] Códigos UniTV: ${unitvCodeIds.length > 0 ? unitvCodeIds.join(', ') : 'nenhum'}`);
    
    // 5. Registrar transação financeira (SEM unitv_code_id direto)
    const transactionResult = await query(`
      INSERT INTO financial_transactions (
        user_id, client_id, client_name, type, amount_received, server_cost, net_profit,
        due_date, paid_date, status, payment_method, payment_gateway,
        gateway_payment_id, payment_session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9, $10, $11, $12, $13)
      RETURNING id
    `, [
      session.user_id,
      session.client_id,
      clientData.name,
      'renewal',
      amountReceived,
      serverCost,
      netProfit,
      clientData.due_date,
      'paid',
      payment.payment_type_id,
      'mercadopago',
      payment.id.toString(),
      session.id
    ]);

    const transactionId = transactionResult.rows[0].id;
    console.log('✅ Transação financeira registrada (ID:', transactionId + ')');

    // ✅ NOVO: Registrar no activity_logs
    await logPayment({
      userId: clientData.user_id,
      clientId: session.client_id,
      clientName: clientData.name,
      amount: parseFloat(payment.transaction_amount),
      paymentMethod: payment.payment_type_id || 'pix',
      success: true,
      paymentId: payment.id?.toString()
    });

    console.log('📋 Log de pagamento registrado');

    // 6. Vincular códigos UniTV à transação (se houver)
    if (unitvCodeIds.length > 0) {
      console.log(`🎫 Vinculando ${unitvCodeIds.length} código(s) UniTV à transação...`);
      
      for (const codeId of unitvCodeIds) {
        await query(`
          INSERT INTO transaction_unitv_codes (transaction_id, unitv_code_id)
          VALUES ($1, $2)
        `, [transactionId, codeId]);
      }
      
      console.log(`✅ ${unitvCodeIds.length} código(s) vinculado(s) à transação`);
    } else {
      console.log(`   ⚠️  Nenhum código UniTV vinculado a esta transação`);
    }
    console.log('');
    console.log('🎉 PAGAMENTO PROCESSADO COM SUCESSO!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro ao processar pagamento aprovado:', error);

    // ✅ NOVO: Registrar ERRO no activity_logs (se tiver dados suficientes)
    if (session && session.client_id) {
      try {
        await logPayment({
          userId: session.user_id,
          clientId: session.client_id,
          clientName: session.name || 'Cliente',
          amount: parseFloat(payment?.transaction_amount || 0),
          paymentMethod: payment?.payment_type_id || 'desconhecido',
          success: false,
          errorMessage: error.message
        });
      } catch (logError) {
        console.error('❌ Erro ao registrar log de falha:', logError);
      }
    }
    throw error;
  }
}

// ========== VERIFICAR STATUS DO PAGAMENTO ==========
export async function checkPaymentStatus(req, res) {
  try {
    const { payment_id } = req.params;
    
    // Buscar sessão para pegar user_id
    const sessionResult = await query(`
      SELECT ps.user_id
      FROM payment_sessions ps
      WHERE ps.mercadopago_payment_id = $1
    `, [payment_id]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    
    const userId = sessionResult.rows[0].user_id;
    
    // Buscar credenciais
    const credentials = await getUserCredentials(userId);
    
    if (!credentials) {
      return res.status(403).json({ 
        error: 'Sistema de pagamentos não configurado' 
      });
    }
    
    // Consultar status no Mercado Pago
    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: credentials.access_token
    });
    
    const paymentClient = new Payment(mercadopagoClient);
    const payment = await paymentClient.get({ id: payment_id });
    
    res.json({
      status: payment.status,
      status_detail: payment.status_detail,
      approved: payment.status === 'approved'
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    res.status(500).json({ error: error.message });
  }
}

// ========== GERAR PÁGINA HTML ==========
function generatePaymentPageHTML(client, sessionToken, publicKey, pixAmount, cardAmount, latestUnitvCodes = []) {  const dueDate = new Date(client.due_date).toLocaleDateString('pt-BR');
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento - ${client.name}</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      padding: 20px;
      position: relative;
    }
    
    /* ========== BACKGROUND COM IMAGEM ========== */
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #1a1a2e; /* Fallback se imagem não carregar */
      background-image: url('/images/payment-bg.png');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      z-index: -2;
    }
    
    /* Overlay escuro para melhorar legibilidade */
    body::after {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.3);
      z-index: -1;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      position: relative;
      z-index: 1;
    }
    
    .header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    
    /* ========== DARK GLASS MORPHISM ========== */
    .card {
      background: rgba(15, 15, 35, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .card-header {
      border-bottom: 1px solid rgba(255,255,255,0.1);
      padding-bottom: 20px;
      margin-bottom: 20px;
    }
    
    .card-header h2 {
      color: #fff;
      font-size: 22px;
      margin-bottom: 5px;
    }
    
    .card-header p {
      color: rgba(255,255,255,0.6);
      font-size: 14px;
    }
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid rgba(255,255,255,0.08);
    }
    
    .info-label {
      color: rgba(255,255,255,0.6);
      font-size: 14px;
    }
    
    .info-value {
      color: #fff;
      font-weight: 600;
      font-size: 14px;
    }
    
    .amount {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%);
      border-radius: 16px;
      padding: 25px;
      text-align: center;
      margin: 20px 0;
      border: 1px solid rgba(255,255,255,0.2);
    }
    
    .amount-label {
      color: rgba(255,255,255,0.9);
      font-size: 14px;
      margin-bottom: 5px;
    }
    
    .amount-value {
      color: white;
      font-size: 36px;
      font-weight: bold;
      text-shadow: 0 2px 10px rgba(0,0,0,0.3);
    }
    
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .tab {
      flex: 1;
      padding: 15px;
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      transition: all 0.3s;
      color: rgba(255,255,255,0.7);
    }
    
    .tab:hover {
      background: rgba(255,255,255,0.15);
      color: #fff;
    }
    
    .tab.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-color: transparent;
    }
    
    .tab-content {
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .button {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    
    .button:hover {
      transform: translateY(-2px);
    }
    
    .button:disabled {
      background: rgba(255,255,255,0.2);
      cursor: not-allowed;
      transform: none;
      color: rgba(255,255,255,0.5);
    }
    
    .qr-code-container {
      text-align: center;
      padding: 20px;
      max-width: 400px;      /* Limita o container */
      margin: 0 auto;        /* Centraliza */
    }
    
    .qr-code-container img {
      max-width: 280px !important;  /* Igual ao antigo: 300px */
      width: 100% !important;
      height: auto !important;
      display: block;
      margin: 0 auto;
      border-radius: 12px;
      background: white;
      padding: 10px;
    }
    
    .copy-button {
      margin-top: 10px;
      padding: 12px 24px;
      background: #00a650;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }
    
    .copy-button:hover {
      background: #008c3f;
    }
    
    .success, .error {
      padding: 15px;
      border-radius: 8px;
      margin-top: 15px;
      text-align: center;
    }
    
    .success {
      background: rgba(16, 185, 129, 0.2);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    
    .error {
      background: rgba(239, 68, 68, 0.2);
      color: #fca5a5;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    
    .history-item {
      background: rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 15px;
      border-left: 4px solid #667eea;
    }
    
    .history-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .history-amount {
      font-size: 24px;
      font-weight: bold;
      color: #a78bfa;
    }
    
    .history-date {
      font-size: 14px;
      color: rgba(255,255,255,0.6);
    }
    
    .history-method {
      font-size: 16px;
      color: #fff;
      margin-bottom: 5px;
    }
    
    .no-history {
      text-align: center;
      padding: 60px 20px;
      color: rgba(255,255,255,0.6);
    }
    
    /* ========== NOVO: ESTILOS CÓDIGO UNITV ========== */
    .unitv-code-box {
      background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
      border-radius: 16px;
      padding: 20px;
      margin-top: 15px;
      color: white;
    }
    
    .unitv-code-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 15px;
      text-align: center;
    }
    
    .unitv-code-display {
      background: rgba(255,255,255,0.2);
      border: 2px dashed rgba(255,255,255,0.5);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 15px 0;
    }
    
    .unitv-code-value {
      font-size: 28px;
      font-weight: bold;
      font-family: 'Courier New', monospace;
      letter-spacing: 2px;
      margin-bottom: 10px;
    }
    
    .unitv-copy-button {
      background: white;
      color: #ff6b6b;
      border: none;
      padding: 12px 30px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      margin-top: 10px;
      width: 100%;
    }
    
    .unitv-copy-button:hover {
      background: #f0f0f0;
    }
    
    .unitv-instructions {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 15px;
      margin-top: 15px;
      font-size: 14px;
    }
    
    .unitv-instructions ol {
      margin-left: 20px;
      margin-top: 10px;
    }
    
    .unitv-instructions li {
      margin-bottom: 8px;
    }
    
    @media (max-width: 600px) {
      .qr-code-container img { 
        max-width: 220px;    /* Em mobile, menor ainda */
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💳 ${client.company_name || 'Portal de Pagamentos'}</h1>
    </div>
    
    <div class="card">
      <div class="card-header">
        <h2>🎬 ${client.server_name || 'Serviço'}</h2>
        <p>Renovação de Plano</p>
      </div>
      
      <div class="info-row">
        <span class="info-label">👤 Cliente</span>
        <span class="info-value">${client.name}</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">📋 Plano</span>
        <span class="info-value">${client.plan_name || 'Padrão'}</span>
      </div>
      
      <div class="info-row">
        <span class="info-label">📅 Vencimento</span>
        <span class="info-value">${dueDate}</span>
      </div>

      ${latestUnitvCodes && latestUnitvCodes.length > 0 ? `
      <div class="info-row">
        <span class="info-label">🎫 Código${latestUnitvCodes.length > 1 ? 's' : ''} UniTV</span>
        <span class="info-value" style="font-family: monospace; font-weight: 700; font-size: 12px;">
          ${latestUnitvCodes.join('<br>')}
        </span>
      </div>
      ` : ''}
      
    </div>
    
    <div class="tabs">
      <button class="tab active" onclick="switchTab('pix')">📱 PIX</button>
      <button class="tab" onclick="switchTab('card')">💳 Cartão</button>
      <button class="tab" onclick="switchTab('history')">📜 Faturas</button>
    </div>
    
    <!-- ABA PIX -->
    <div id="tab-pix" class="tab-content active">
      <div class="card">
        <div class="amount">
          <div class="amount-label">Valor</div>
          <div class="amount-value">R$ ${pixAmount.toFixed(2)}</div>
        </div>
        
        <button id="generate-pix-btn" class="button" onclick="generatePix()">
          📱 Gerar PIX
        </button>
        
        <div id="qr-code-container" style="display: none;"></div>
        <div id="pix-error" class="error" style="display: none;"></div>
      </div>
    </div>
    
    <!-- ABA CARTÃO -->
    <div id="tab-card" class="tab-content">
      <div class="card">
        <div class="amount">
          <div class="amount-label">Valor (com taxa de 10%)</div>
          <div class="amount-value">R$ ${cardAmount.toFixed(2)}</div>
        </div>
        
        <div id="card-form-container"></div>
        <button id="pay-card-btn" class="button" style="display: none; margin-top: 20px;">
          💳 Pagar com Cartão
        </button>
        <div id="card-error" class="error" style="display: none;"></div>
      </div>
    </div>
    
    <!-- ABA HISTÓRICO -->
    <div id="tab-history" class="tab-content">
      <div class="card">
        <div id="history-loading" style="text-align: center; padding: 40px;">
          <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
          <p style="color: rgba(255,255,255,0.6);">Carregando histórico...</p>
        </div>
        <div id="history-content" style="display: none;"></div>
      </div>
    </div>
  </div>
  
  <script>
    const SESSION_TOKEN = '${sessionToken}';
    const PAYMENT_TOKEN = '${client.payment_token}';
    const PUBLIC_KEY = '${publicKey}';
    const PIX_AMOUNT = ${pixAmount};
    const CARD_AMOUNT = ${cardAmount};
    
    const mp = new MercadoPago(PUBLIC_KEY);
    let cardPaymentBrick = null;
    let statusCheckInterval = null;
    
    // ========== TROCAR ABAS ==========
    function switchTab(tabName) {
      // Atualizar botões
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      event.target.classList.add('active');
      
      // Atualizar conteúdo
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById('tab-' + tabName).classList.add('active');
      
      // Inicializar conteúdo específico
      if (tabName === 'card' && !cardPaymentBrick) {
        initCardForm();
      } else if (tabName === 'history') {
        loadHistory();
      }
    }
    
    // ========== GERAR PIX ==========
    async function generatePix() {
      try {
        document.getElementById('generate-pix-btn').disabled = true;
        document.getElementById('generate-pix-btn').textContent = 'Gerando PIX...';
        document.getElementById('pix-error').style.display = 'none';
        
        const response = await fetch('/api/payment/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: SESSION_TOKEN })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Erro ao gerar PIX');
        
        // Mostrar QR Code
        const container = document.getElementById('qr-code-container');
        container.innerHTML = \`
          <h3 style="color: #fff; margin-bottom: 15px;">📱 Escaneie o QR Code</h3>
          <img src="data:image/png;base64,\${data.qr_code_base64}" alt="QR Code PIX" style="max-width: 280px; margin: 20px auto; display: block; border-radius: 12px; background: white; padding: 10px;" />
          <p style="color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 10px;">
            Ou copie o código PIX:
          </p>
          <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; word-break: break-all; font-family: monospace; font-size: 12px; color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.1);">
            \${data.qr_code}
          </div>
          <button class="copy-button" onclick="copyPixCode('\${data.qr_code}')">
            📋 Copiar Código PIX
          </button>
          <p style="color: rgba(255,255,255,0.5); font-size: 12px; margin-top: 15px;">
            ⏱️ Aguardando pagamento... (atualiza automaticamente)
          </p>
        \`;
        container.style.display = 'block';
        
        document.getElementById('generate-pix-btn').style.display = 'none';
        
        // Iniciar verificação automática
        checkPaymentStatus(data.payment_id);
        
      } catch (error) {
        document.getElementById('pix-error').style.display = 'block';
        document.getElementById('pix-error').className = 'error';
        document.getElementById('pix-error').textContent = '❌ ' + error.message;
        
        document.getElementById('generate-pix-btn').disabled = false;
        document.getElementById('generate-pix-btn').textContent = '📱 Gerar PIX';
      }
    }
    
    // ========== COPIAR CÓDIGO PIX ==========
    function copyPixCode(code) {
      navigator.clipboard.writeText(code).then(() => {
        event.target.textContent = '✅ Copiado!';
        setTimeout(() => {
          event.target.textContent = '📋 Copiar Código PIX';
        }, 2000);
      });
    }
    
    // ========== VERIFICAR STATUS DO PAGAMENTO ==========
    function checkPaymentStatus(paymentId) {
      if (statusCheckInterval) clearInterval(statusCheckInterval);
      
      statusCheckInterval = setInterval(async () => {
        try {
          const response = await fetch('/api/payment/status/' + paymentId);
          const data = await response.json();
          
          if (data.status === 'approved') {
            clearInterval(statusCheckInterval);
            document.getElementById('qr-code-container').style.display = 'none';
            document.getElementById('pix-error').style.display = 'block';
            document.getElementById('pix-error').className = 'success';
            document.getElementById('pix-error').innerHTML = '✅ <strong>Pagamento Aprovado!</strong><br>Seu acesso será renovado em instantes.';
            
            setTimeout(() => {
              switchTab('history');
            }, 3000);
          }
        } catch (error) {
          console.error('Erro ao verificar status:', error);
        }
      }, 3000);
    }
    
    // ========== INICIALIZAR FORMULÁRIO DE CARTÃO ==========
    async function initCardForm() {
      if (cardPaymentBrick) return;
      
      try {
        const bricksBuilder = mp.bricks();
        
        cardPaymentBrick = await bricksBuilder.create('cardPayment', 'card-form-container', {
          initialization: {
            amount: CARD_AMOUNT
          },
          callbacks: {
            onReady: () => {
              document.getElementById('pay-card-btn').style.display = 'block';
            },
            onSubmit: async (cardFormData) => {
              return false;
            },
            onError: (error) => {
              console.error('Erro no formulário:', error);
            }
          }
        });
        
        document.getElementById('pay-card-btn').onclick = async () => {
          try {
            document.getElementById('pay-card-btn').disabled = true;
            document.getElementById('pay-card-btn').textContent = 'Processando...';
            
            const formData = await cardPaymentBrick.getFormData();
            
            const response = await fetch('/api/payment/card', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_token: SESSION_TOKEN,
                token: formData.token,
                payment_method_id: formData.payment_method_id,
                installments: formData.installments
              })
            });
            
            const data = await response.json();
            
            if (!response.ok) throw new Error(data.error || 'Erro ao processar');
            
            if (data.approved || data.status === 'approved') {
              showSuccess();
            } else {
              throw new Error('Pagamento não aprovado: ' + data.status_detail);
            }
            
          } catch (error) {
            document.getElementById('card-error').style.display = 'block';
            document.getElementById('card-error').className = 'error';
            document.getElementById('card-error').textContent = '❌ ' + error.message;
            
            document.getElementById('pay-card-btn').disabled = false;
            document.getElementById('pay-card-btn').textContent = 'Pagar com Cartão';
          }
        };
        
      } catch (error) {
        console.error('Erro ao inicializar formulário:', error);
        document.getElementById('card-error').style.display = 'block';
        document.getElementById('card-error').className = 'error';
        document.getElementById('card-error').textContent = 'Erro ao carregar formulário de cartão';
      }
    }
    
    // ========== MOSTRAR SUCESSO ==========
    function showSuccess() {
      document.querySelector('.container').innerHTML = \`
        <div class="card">
          <div style="font-size: 64px; text-align: center;">✅</div>
          <h1 style="text-align: center; color: #fff;">Pagamento Aprovado!</h1>
          <p style="margin-top: 10px; font-size: 16px; text-align: center; color: rgba(255,255,255,0.7);">
            Seu pagamento foi processado com sucesso.
          </p>
          <p style="margin-top: 5px; font-size: 14px; text-align: center; color: rgba(255,255,255,0.5);">
            Você receberá uma confirmação em breve.
          </p>
        </div>
      \`;
    }
    
    // ========== COPIAR CÓDIGO UNITV ==========
    function copyUnitvCode(code) {
      navigator.clipboard.writeText(code).then(() => {
        event.target.textContent = '✅ Copiado!';
        event.target.style.background = '#4caf50';
        setTimeout(() => {
          event.target.textContent = '📋 Copiar Código';
          event.target.style.background = 'white';
        }, 2000);
      });
    }
    
    // ========== CARREGAR HISTÓRICO (COM CÓDIGOS UNITV) ==========
    async function loadHistory() {
      try {
        document.getElementById('history-loading').style.display = 'block';
        document.getElementById('history-content').style.display = 'none';
        
        const response = await fetch('/api/payment/history/' + PAYMENT_TOKEN);
        const data = await response.json();
        
        document.getElementById('history-loading').style.display = 'none';
        document.getElementById('history-content').style.display = 'block';
        
        if (data.transactions && data.transactions.length > 0) {
          let html = '<h3 style="margin-bottom: 20px; color: #fff;">📜 Histórico de Pagamentos</h3>';
          
          data.transactions.forEach(tx => {
            // Cria a data uma única vez
            const date = new Date(tx.paid_date);
            
            const dateStr = date.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric'
            });
            
            // Extrai hora da MESMA instância
            const timeStr = date.toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit'
            });
            
            const fullDate = dateStr + ' às ' + timeStr;
            
            const method = tx.payment_method === 'pix' ? '📱 PIX' : 
                          tx.payment_method === 'credit_card' ? '💳 Cartão' : 
                          '💰 ' + (tx.payment_method || 'Outros');
            
            html += \`
              <div class="history-item">
                <div class="history-item-header">
                  <div class="history-amount">R$ \${parseFloat(tx.amount_received).toFixed(2)}</div>
                  <div class="history-date">\${fullDate}</div>
                </div>
                <div class="history-method">\${method}</div>
                <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 8px;">
                  ID: \${tx.gateway_payment_id || tx.id}
                </div>
            \`;
            
            // ========== NOVO: EXIBIR CÓDIGO UNITV SE EXISTIR ==========
            if (tx.unitv_codes_formatted && tx.unitv_codes_formatted.length > 0) {
              html += '<div style="font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 8px;"><strong>🎫 Código';
              html += (tx.unitv_codes_formatted.length > 1 ? 's' : '') + ' UniTV:</strong><div style="margin-top: 5px;">';
              for (let i = 0; i < tx.unitv_codes_formatted.length; i++) {
                html += '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;"><span style="font-family: monospace; font-weight: 600; color: #fff;">';
                if (tx.unitv_codes_formatted.length > 1) html += (i + 1) + '. ';
                html += tx.unitv_codes_formatted[i] + '</span><button onclick="copyUnitvCode(\\'' + tx.unitv_codes[i] + '\\')" style="background: #ff6b6b; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;">📋 Copiar</button></div>';
              }
              html += '</div></div>';
            }
            html += \`</div>\`;
          });
          
          document.getElementById('history-content').innerHTML = html;
        } else {
          document.getElementById('history-content').innerHTML = \`
            <div class="no-history">
              <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
              <h3 style="color: rgba(255,255,255,0.7); margin-bottom: 10px;">Nenhum pagamento encontrado</h3>
              <p style="font-size: 14px; color: rgba(255,255,255,0.5);">Seu histórico de pagamentos aparecerá aqui.</p>
            </div>
          \`;
        }
        
      } catch (error) {
        document.getElementById('history-loading').style.display = 'none';
        document.getElementById('history-content').style.display = 'block';
        document.getElementById('history-content').innerHTML = \`
          <div class="error">
            ❌ Erro ao carregar histórico. Tente novamente.
          </div>
        \`;
      }
    }
  </script>
</body>
</html>
  `;
}

// ========== PÁGINA DE ERRO ==========
function generateErrorPage(title = 'Erro', message = 'Ocorreu um erro ao processar sua solicitação', companyName = null) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
    }
    body::before {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: #1a1a2e; /* Fallback se imagem não carregar */
      background-image: url('/images/payment-bg.png');
      background-size: cover;
      background-position: center;
      z-index: -2;
    }
    body::after {
      content: '';
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.4);
      z-index: -1;
    }
    .card {
      background: rgba(15, 15, 35, 0.85);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.1);
      position: relative;
      z-index: 1;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #fff;
      margin-bottom: 15px;
      font-size: 24px;
    }
    p {
      color: rgba(255,255,255,0.7);
      line-height: 1.6;
      margin-bottom: 10px;
    }
    .company {
      color: #a78bfa;
      font-weight: 600;
      font-size: 18px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${companyName ? `<div class="company">${companyName}</div>` : ''}
  </div>
</body>
</html>
  `;
}