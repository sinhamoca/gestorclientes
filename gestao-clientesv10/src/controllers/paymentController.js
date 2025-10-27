// ========================================
// PAYMENT CONTROLLER - VERSÃO COMPLETA
// ✅ Cartão com taxa de 10%
// ✅ PIX sem taxa
// ✅ Aba de Faturas (Histórico)
// ✅ Botão para Gerar PIX
// ✅ Multi-tenant
// ✅ Proteção webhook duplicado
// Data: 24/10/2025
// ========================================

import { query } from '../config/database.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';
import { getUserCredentials } from './paymentSettingsController.js';
import { dispatchRenewalWebhook } from './webhookDispatcher.js';

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
    
    // Busca histórico de transações pagas
    const historyResult = await query(`
      SELECT 
        ft.id,
        ft.amount_received,
        ft.paid_date,
        ft.payment_method,
        ft.payment_gateway,
        ft.status,
        ft.gateway_payment_id
      FROM financial_transactions ft
      WHERE ft.client_id = $1 
      AND ft.status = 'paid'
      ORDER BY ft.paid_date DESC
      LIMIT 50
    `, [client.id]);
    
    console.log(`✅ Encontradas ${historyResult.rows.length} transações`);
    
    res.json({
      success: true,
      transactions: historyResult.rows
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
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
    const html = generatePaymentPageHTML(client, sessionToken, credentials.public_key, pixAmount, cardAmount);
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
      error: 'Erro ao gerar PIX',
      details: error.message 
    });
  }
}

// ========== CRIAR PAGAMENTO CARTÃO (COM TAXA 10%) ==========
export async function createCardPayment(req, res) {
  try {
    const { session_token, token, installments = 1, payment_method_id } = req.body;
    
    console.log('💳 Criando pagamento com cartão para sessão:', session_token);
    
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
    
    // Buscar credenciais
    const credentials = await getUserCredentials(session.user_id);
    
    if (!credentials) {
      return res.status(403).json({ 
        error: 'Sistema de pagamentos não configurado' 
      });
    }
    
    // Criar cliente Mercado Pago
    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: credentials.access_token
    });
    
    const paymentClient = new Payment(mercadopagoClient);
    const fakeEmail = `cliente${session.client_id}@gmail.com`;
    
    // ⚠️ APLICA TAXA DE 10% NO CARTÃO
    const basePrice = parseFloat(session.price_value);
    const cardAmount = basePrice * (1 + CARD_FEE_PERCENTAGE / 100);
    
    console.log('📤 Criando pagamento cartão:');
    console.log('   Valor base: R$', basePrice.toFixed(2));
    console.log('   Taxa cartão: +' + CARD_FEE_PERCENTAGE + '%');
    console.log('   Valor final: R$', cardAmount.toFixed(2));
    console.log('   Parcelas:', installments);
    
    // Criar pagamento com cartão
    const payment = await paymentClient.create({
      body: {
        transaction_amount: cardAmount, // ← Valor COM taxa de 10%
        token: token,
        description: `Renovação - ${session.name} (Cartão)`,
        installments: parseInt(installments),
        payment_method_id: payment_method_id,
        payer: {
          email: fakeEmail,
          first_name: session.name.split(' ')[0] || 'Cliente',
          last_name: session.name.split(' ').slice(1).join(' ') || 'Sistema'
        },
        external_reference: session.session_token,
        notification_url: `${credentials.payment_domain || process.env.PAYMENT_DOMAIN}/api/webhooks/mercadopago`
      }
    });
    
    console.log('✅ Pagamento cartão criado:', payment.id, '- Status:', payment.status);
    
    // Atualizar sessão com valor do cartão
    await query(`
      UPDATE payment_sessions
      SET mercadopago_payment_id = $1, payment_method = $2, amount = $3
      WHERE session_token = $4
    `, [payment.id.toString(), payment_method_id, cardAmount, session_token]);
    
    res.json({
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      approved: payment.status === 'approved'
    });
    
    // Se aprovado imediatamente, processar
    if (payment.status === 'approved') {
      console.log('✅ Pagamento aprovado imediatamente!');
      const sessionData = { ...session, amount: cardAmount };
      await processApprovedPayment(payment, sessionData);
    }
    
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

// ========== PROCESSAR PAGAMENTO APROVADO ==========
async function processApprovedPayment(payment, session) {
  try {
    console.log('✅ Processando pagamento aprovado:', payment.id);
    console.log('   Cliente:', session.name);
    
    // ⚠️ PROTEÇÃO CONTRA WEBHOOK DUPLICADO
    if (session.status === 'paid') {
      console.log('ℹ️  Pagamento já foi processado anteriormente (ignorando webhook duplicado)');
      return;
    }
    
    // Buscar informações completas do cliente
    const clientDataResult = await query(`
      SELECT 
        c.*,
        p.duration_months,
        p.num_screens,
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
    
    // 2. Calcular nova data de vencimento (usando duration_months do plano)
    const currentDueDate = new Date(clientData.due_date);
    const today = new Date();
    
    // Se vencido, renova a partir de hoje. Senão, a partir da data atual
    const baseDate = currentDueDate < today ? today : currentDueDate;
    
    const newDueDate = new Date(baseDate);
    const monthsToAdd = clientData.duration_months || 1; // ← Vem do plano!
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
    
    console.log('✅ Cliente renovado');

    // ✨ NOVO: Disparar webhook para renovação automática CloudNation
    try {
      console.log('\n🔔 Disparando webhook para renovação automática...');
      const webhookResult = await dispatchRenewalWebhook({
        ...clientData,
        mercadopago_payment_id: payment.id,
        due_date: newDueDate
      });

      if (webhookResult.success) {
        console.log('✅ Renovação automática CloudNation concluída com sucesso!');
      } else if (webhookResult.skipped) {
        console.log('ℹ️  Renovação automática CloudNation ignorada:', webhookResult.reason);
      } else {
        console.log('⚠️  Renovação automática CloudNation falhou (mas pagamento foi processado)');
        console.log('   Erro:', webhookResult.error);
      }
    } catch (webhookError) {
      // Não quebrar o fluxo se webhook falhar
      console.error('⚠️  Erro no webhook (pagamento já foi processado):', webhookError.message);
    }
    
    // 4. Registrar transação financeira
    await query(`
      INSERT INTO financial_transactions (
        user_id, client_id, type, amount_received, server_cost, net_profit,
        due_date, paid_date, status, payment_method, payment_gateway,
        gateway_payment_id, payment_session_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12)
    `, [
      session.user_id,              // $1
      session.client_id,            // $2
      'renewal',                    // $3
      amountReceived,               // $4
      serverCost,                   // $5
      netProfit,                    // $6
      clientData.due_date,          // $7 ← Data correta!
      'paid',                       // $8
      payment.payment_type_id,      // $9
      'mercadopago',                // $10
      payment.id.toString(),        // $11
      session.id                    // $12
    ]);
    
    console.log('✅ Transação financeira registrada');
    console.log('');
    console.log('🎉 PAGAMENTO PROCESSADO COM SUCESSO!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro ao processar pagamento aprovado:', error);
    throw error;
  }
}

// ========== VERIFICAR STATUS DO PAGAMENTO ==========
export async function checkPaymentStatus(req, res) {
  try {
    const { payment_id } = req.params;
    
    // Buscar sessão para pegar user_id
    const sessionResult = await query(`
      SELECT ps.*, c.user_id
      FROM payment_sessions ps
      JOIN clients c ON ps.client_id = c.id
      WHERE ps.mercadopago_payment_id = $1
    `, [payment_id]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pagamento não encontrado' });
    }
    
    const session = sessionResult.rows[0];
    const credentials = await getUserCredentials(session.user_id);
    
    if (!credentials) {
      return res.status(403).json({ error: 'Credenciais não encontradas' });
    }
    
    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: credentials.access_token
    });
    
    const paymentClient = new Payment(mercadopagoClient);
    const payment = await paymentClient.get({ id: payment_id });
    
    res.json({
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar status' });
  }
}

// ========== GERAR PÁGINA HTML ==========
function generatePaymentPageHTML(client, sessionToken, publicKey, pixAmount, cardAmount) {
  const pixAmountFormatted = pixAmount.toFixed(2);
  const cardAmountFormatted = cardAmount.toFixed(2);
  const dueDate = new Date(client.due_date).toLocaleDateString('pt-BR');
  const paymentToken = client.payment_token;
  
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento - ${client.company_name || 'Portal de Pagamentos'}</title>
  <script src="https://sdk.mercadopago.com/js/v2"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 600px; margin: 0 auto; }
    .card {
      background: white;
      border-radius: 16px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      margin-bottom: 20px;
    }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    .info { margin-bottom: 20px; }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label { color: #666; font-size: 14px; }
    .info-value { color: #333; font-weight: 600; font-size: 14px; }
    .amount {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin: 20px 0;
    }
    .amount-value {
      font-size: 36px;
      font-weight: 700;
      color: #667eea;
    }
    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 2px solid #f0f0f0;
    }
    .tab {
      padding: 15px 20px;
      cursor: pointer;
      border: none;
      background: none;
      font-size: 16px;
      font-weight: 600;
      color: #666;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
      flex: 1;
    }
    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .btn {
      width: 100%;
      padding: 15px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: #667eea;
      color: white;
    }
    .btn-primary:hover {
      background: #5568d3;
    }
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .loader {
      border: 3px solid #f3f3f3;
      border-top: 3px solid #667eea;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .success {
      background: #efe;
      color: #3c3;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .copy-paste {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      word-break: break-all;
      margin: 10px 0;
    }
    .welcome-message {
      text-align: center;
      padding: 30px 20px;
      color: #666;
    }
    .welcome-message-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
    .history-item {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 10px;
      border-left: 4px solid #667eea;
    }
    .history-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .history-amount {
      font-size: 20px;
      font-weight: 700;
      color: #667eea;
    }
    .history-date {
      color: #666;
      font-size: 14px;
    }
    .history-method {
      display: inline-block;
      background: #e3f2fd;
      color: #1976d2;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 5px;
    }
    .no-history {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }
    .fee-notice {
      background: #fff3cd;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 15px;
      text-align: center;
      border: 1px solid #ffeaa7;
    }
    .fee-notice small {
      color: #856404;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>${client.company_name || 'Portal de Pagamentos'}</h1>
      <div class="info">
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
      </div>
      <div class="amount">
        <div style="font-size: 14px; color: #666; margin-bottom: 5px;">Valor a Pagar</div>
        <div class="amount-value" id="display-amount">R$ ${pixAmountFormatted}</div>
        <div style="font-size: 12px; color: #999; margin-top: 5px;" id="amount-note">
          PIX: R$ ${pixAmountFormatted}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="tabs">
        <button class="tab active" onclick="switchTab('pix')">📱 PIX</button>
        <button class="tab" onclick="switchTab('card')">💳 Cartão</button>
        <button class="tab" onclick="switchTab('history')">📜 Faturas</button>
      </div>

      <!-- TAB PIX -->
      <div id="pix-tab" class="tab-content active">
        <div class="welcome-message">
          <div class="welcome-message-icon">📱</div>
          <p><strong>Pagamento via PIX</strong></p>
          <p style="margin-top: 10px; font-size: 14px;">
            Clique no botão abaixo para gerar o QR Code<br>
            e efetuar o pagamento instantaneamente.
          </p>
        </div>
        
        <button id="generate-pix-btn" class="btn btn-primary" onclick="generatePix()">
          🔑 Gerar PIX
        </button>
        
        <div id="pix-loading" style="display:none;">
          <div class="loader"></div>
          <p style="text-align: center; color: #666;">Gerando QR Code PIX...</p>
        </div>
        
        <div id="qr-code-container" style="display:none; text-align: center;">
          <img id="qr-code-image" src="" alt="QR Code PIX" style="max-width: 300px; margin: 20px auto;">
          <p style="margin: 20px 0;">Escaneie o QR Code com o app do seu banco</p>
          <button class="btn btn-primary" onclick="copyPixCode()">
            📋 Copiar Código PIX
          </button>
          <div id="pix-code" class="copy-paste" style="display:none;"></div>
        </div>
        
        <div id="pix-error" style="display:none;"></div>
      </div>

      <!-- TAB CARTÃO -->
      <div id="card-tab" class="tab-content">
        <div class="fee-notice">
          <small>⚠️ <strong>Taxa de 10%</strong> aplicada em pagamentos com cartão</small>
        </div>
        
        <p style="color: #666; margin-bottom: 15px; text-align: center;">
          💳 <strong>Preencha os dados do cartão</strong>
        </p>
        
        <div id="card-form-container"></div>
        <button id="pay-card-btn" class="btn btn-primary" style="margin-top: 20px; display:none;">
          💳 Pagar com Cartão
        </button>
        <div id="card-error" style="display:none;"></div>
      </div>

      <!-- TAB HISTÓRICO -->
      <div id="history-tab" class="tab-content">
        <div id="history-loading">
          <div class="loader"></div>
          <p style="text-align: center; color: #666;">Carregando histórico...</p>
        </div>
        <div id="history-content" style="display:none;"></div>
      </div>
    </div>
  </div>

  <script>
    const SESSION_TOKEN = '${sessionToken}';
    const PAYMENT_TOKEN = '${paymentToken}';
    const MP_PUBLIC_KEY = '${publicKey}';
    const PIX_AMOUNT = ${pixAmount};
    const CARD_AMOUNT = ${cardAmount};
    const mp = new MercadoPago(MP_PUBLIC_KEY);
    
    let currentPixCode = '';
    let pixGenerated = false;
    let cardPaymentBrick = null;
    
    // ========== ALTERNAR ABAS ==========
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const displayAmount = document.getElementById('display-amount');
      const amountNote = document.getElementById('amount-note');
      
      if (tab === 'pix') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('pix-tab').classList.add('active');
        displayAmount.textContent = 'R$ ' + PIX_AMOUNT.toFixed(2);
        amountNote.innerHTML = 'PIX: R$ ' + PIX_AMOUNT.toFixed(2);
      } else if (tab === 'card') {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('card-tab').classList.add('active');
        displayAmount.textContent = 'R$ ' + CARD_AMOUNT.toFixed(2);
        amountNote.innerHTML = 'Cartão (+10%): R$ ' + CARD_AMOUNT.toFixed(2) + 
                               ' <span style="color: #999;">(PIX: R$ ' + PIX_AMOUNT.toFixed(2) + ')</span>';
        initCardForm();
      } else if (tab === 'history') {
        document.querySelector('.tab:nth-child(3)').classList.add('active');
        document.getElementById('history-tab').classList.add('active');
        displayAmount.textContent = 'R$ ' + PIX_AMOUNT.toFixed(2);
        amountNote.innerHTML = 'PIX: R$ ' + PIX_AMOUNT.toFixed(2);
        loadHistory();
      }
    }
    
    // ========== GERAR PIX ==========
    async function generatePix() {
      if (pixGenerated) {
        alert('⚠️ QR Code já foi gerado!');
        return;
      }
      
      try {
        document.getElementById('generate-pix-btn').style.display = 'none';
        document.getElementById('pix-loading').style.display = 'block';
        
        const response = await fetch('/api/payment/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: SESSION_TOKEN })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Erro ao gerar PIX');
        
        document.getElementById('pix-loading').style.display = 'none';
        document.getElementById('qr-code-container').style.display = 'block';
        document.getElementById('qr-code-image').src = 'data:image/png;base64,' + data.qr_code_base64;
        document.getElementById('pix-code').textContent = data.qr_code;
        currentPixCode = data.qr_code;
        pixGenerated = true;
        
        checkPaymentStatus(data.payment_id);
        
      } catch (error) {
        document.getElementById('generate-pix-btn').style.display = 'block';
        document.getElementById('pix-loading').style.display = 'none';
        document.getElementById('pix-error').style.display = 'block';
        document.getElementById('pix-error').className = 'error';
        document.getElementById('pix-error').textContent = '❌ ' + error.message;
      }
    }
    
    // ========== COPIAR CÓDIGO PIX ==========
    function copyPixCode() {
      navigator.clipboard.writeText(currentPixCode);
      document.getElementById('pix-code').style.display = 'block';
      alert('✅ Código PIX copiado!');
    }
    
    // ========== VERIFICAR STATUS DO PAGAMENTO ==========
    function checkPaymentStatus(paymentId) {
      const interval = setInterval(async () => {
        try {
          const response = await fetch('/api/payment/status/' + paymentId);
          const data = await response.json();
          
          if (data.status === 'approved') {
            clearInterval(interval);
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
          <h1 style="text-align: center;">Pagamento Aprovado!</h1>
          <p style="margin-top: 10px; font-size: 16px; text-align: center; color: #666;">
            Seu pagamento foi processado com sucesso.
          </p>
          <p style="margin-top: 5px; font-size: 14px; text-align: center; color: #999;">
            Você receberá uma confirmação em breve.
          </p>
        </div>
      \`;
    }
    
    // ========== CARREGAR HISTÓRICO ==========
    async function loadHistory() {
      try {
        document.getElementById('history-loading').style.display = 'block';
        document.getElementById('history-content').style.display = 'none';
        
        const response = await fetch('/api/payment/history/' + PAYMENT_TOKEN);
        const data = await response.json();
        
        document.getElementById('history-loading').style.display = 'none';
        document.getElementById('history-content').style.display = 'block';
        
        if (data.transactions && data.transactions.length > 0) {
          let html = '<h3 style="margin-bottom: 20px; color: #333;">📜 Histórico de Pagamentos</h3>';
          
          data.transactions.forEach(tx => {
            const date = new Date(tx.paid_date).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            
            const method = tx.payment_method === 'pix' ? '📱 PIX' : 
                          tx.payment_method === 'credit_card' ? '💳 Cartão' : 
                          '💰 ' + (tx.payment_method || 'Outros');
            
            html += \`
              <div class="history-item">
                <div class="history-item-header">
                  <div class="history-amount">R$ \${parseFloat(tx.amount_received).toFixed(2)}</div>
                  <div class="history-date">\${date}</div>
                </div>
                <div class="history-method">\${method}</div>
                <div style="font-size: 12px; color: #999; margin-top: 8px;">
                  ID: \${tx.gateway_payment_id || tx.id}
                </div>
              </div>
            \`;
          });
          
          document.getElementById('history-content').innerHTML = html;
        } else {
          document.getElementById('history-content').innerHTML = \`
            <div class="no-history">
              <div style="font-size: 64px; margin-bottom: 20px;">📭</div>
              <h3 style="color: #666; margin-bottom: 10px;">Nenhum pagamento encontrado</h3>
              <p style="font-size: 14px;">Seu histórico de pagamentos aparecerá aqui.</p>
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #333;
      margin-bottom: 15px;
      font-size: 24px;
    }
    p {
      color: #666;
      line-height: 1.6;
      margin-bottom: 10px;
    }
    .company {
      color: #667eea;
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