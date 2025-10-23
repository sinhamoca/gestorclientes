// gestao-clientesv4/src/controllers/paymentController.js
import { query } from '../config/database.js';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import crypto from 'crypto';

// ========== CONFIGURAÇÃO MERCADO PAGO ==========
const mercadopagoClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN || ''
});

const preferenceClient = new Preference(mercadopagoClient);
const paymentClient = new Payment(mercadopagoClient);

// ========== FUNÇÕES AUXILIARES ==========

// Gera token único para sessão
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========== PÁGINA DE PAGAMENTO (Renderiza HTML) ==========
export async function renderPaymentPage(req, res) {
  try {
    const { token } = req.params;
    
    // Busca cliente pelo payment_token
    const clientResult = await query(`
      SELECT 
        c.*,
        p.name as plan_name,
        p.duration_months,
        s.name as server_name,
        u.id as user_id
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.payment_token = $1
    `, [token]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Link Inválido</title>
          <style>
            body { font-family: Arial; text-align: center; padding: 50px; background: #f5f5f5; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Link Inválido</h1>
          <p>Este link de pagamento não é válido ou expirou.</p>
        </body>
        </html>
      `);
    }
    
    const client = clientResult.rows[0];
    
    // Verifica se tem sessão ativa
    const activeSessionResult = await query(`
      SELECT * FROM payment_sessions 
      WHERE client_id = $1 
      AND status = 'pending'
      AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `, [client.id]);
    
    let paymentUrl;
    let sessionId;
    
    if (activeSessionResult.rows.length > 0) {
      // Reutiliza sessão existente
      const session = activeSessionResult.rows[0];
      paymentUrl = session.mercadopago_init_point;
      sessionId = session.id;
      console.log(`♻️ Reutilizando sessão de pagamento para ${client.name}`);
    } else {
      // Cria nova sessão de pagamento
      const session = await createPaymentSession(client);
      paymentUrl = session.mercadopago_init_point;
      sessionId = session.id;
      console.log(`🆕 Nova sessão de pagamento criada para ${client.name}`);
    }
    
    // Renderiza página HTML
    const html = generatePaymentPageHTML(client, paymentUrl, sessionId);
    res.send(html);
    
  } catch (error) {
    console.error('❌ Render payment page error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Erro</title>
      </head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1 style="color: #e74c3c;">❌ Erro</h1>
        <p>Ocorreu um erro ao carregar a página de pagamento.</p>
        <p>Por favor, tente novamente mais tarde.</p>
        <p style="color: #888; font-size: 12px;">Erro: ${error.message}</p>
      </body>
      </html>
    `);
  }
}

// ========== CRIAR SESSÃO DE PAGAMENTO ==========
async function createPaymentSession(client) {
  try {
    const sessionToken = generateSessionToken();
    const expirationHours = parseInt(process.env.PAYMENT_SESSION_EXPIRATION || '24');
    const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);
    
    const domain = process.env.PAYMENT_DOMAIN || 'https://pagamentos.comprarecarga.shop';
    
    console.log('🔍 Dados da preferência:', {
      client: client.name,
      amount: client.price_value,
      domain: domain
    });
    
    // PREFERÊNCIA MÍNIMA - Remove tudo que pode dar problema!
    const preferenceData = {
      items: [
        {
          title: `Renovação - ${client.name}`,
          quantity: 1,
          unit_price: parseFloat(client.price_value),
          currency_id: 'BRL'
        }
      ],
      back_urls: {
        success: `${domain}/payment/success?session=${sessionToken}`,
        failure: `${domain}/payment/failure?session=${sessionToken}`,
        pending: `${domain}/payment/pending?session=${sessionToken}`
      },
      auto_return: 'approved',
      external_reference: sessionToken
    };
    
    console.log('📤 Enviando preferência para Mercado Pago...');
    
    const preference = await preferenceClient.create({
      body: preferenceData
    });
    
    console.log('✅ Preferência criada:', preference.id);
    
    // Salvar sessão no banco
    const sessionResult = await query(`
      INSERT INTO payment_sessions (
        client_id,
        user_id,
        payment_token,
        session_token,
        mercadopago_preference_id,
        mercadopago_init_point,
        amount,
        currency,
        status,
        expires_at,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      client.id,
      client.user_id,
      client.payment_token,
      sessionToken,
      preference.id,
      preference.init_point,
      client.price_value,
      'BRL',
      'pending',
      expiresAt,
      JSON.stringify({
        client_name: client.name,
        plan_name: client.plan_name,
        due_date: client.due_date
      })
    ]);
    
    return sessionResult.rows[0];
    
  } catch (error) {
    console.error('❌ Create payment session error:', {
      message: error.message,
      cause: error.cause,
      status: error.status,
      code: error.code
    });
    throw error;
  }
}

// ========== GERAR HTML DA PÁGINA DE PAGAMENTO ==========
function generatePaymentPageHTML(client, paymentUrl, sessionId) {
  const dueDate = new Date(client.due_date).toLocaleDateString('pt-BR');
  const amount = parseFloat(client.price_value).toFixed(2);
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento - ${client.name}</title>
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
        .container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          max-width: 500px;
          width: 100%;
          padding: 40px;
          text-align: center;
        }
        .logo {
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 {
          color: #333;
          font-size: 24px;
          margin-bottom: 10px;
        }
        .client-name {
          color: #667eea;
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 30px;
        }
        .info-box {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 30px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
        }
        .info-row:last-child { border-bottom: none; }
        .info-label {
          color: #666;
          font-size: 14px;
        }
        .info-value {
          color: #333;
          font-weight: 600;
        }
        .amount {
          font-size: 48px;
          color: #667eea;
          font-weight: bold;
          margin: 20px 0;
        }
        .btn-pay {
          background: #00b894;
          color: white;
          border: none;
          padding: 18px 40px;
          font-size: 18px;
          font-weight: bold;
          border-radius: 50px;
          cursor: pointer;
          transition: all 0.3s;
          text-decoration: none;
          display: inline-block;
          margin-top: 20px;
        }
        .btn-pay:hover {
          background: #00a383;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,184,148,0.3);
        }
        .footer {
          margin-top: 30px;
          color: #999;
          font-size: 12px;
        }
        .secure {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          color: #00b894;
          margin-top: 15px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">💳</div>
        <h1>Pagamento de Renovação</h1>
        <div class="client-name">${client.name}</div>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Plano:</span>
            <span class="info-value">${client.plan_name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Servidor:</span>
            <span class="info-value">${client.server_name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Vencimento:</span>
            <span class="info-value">${dueDate}</span>
          </div>
        </div>
        
        <div class="amount">R$ ${amount}</div>
        
        <a href="${paymentUrl}" class="btn-pay">
          💰 Pagar com Mercado Pago
        </a>
        
        <div class="secure">
          🔒 Pagamento 100% seguro
        </div>
        
        <div class="footer">
          Após o pagamento, sua renovação será processada automaticamente.
        </div>
      </div>
    </body>
    </html>
  `;
}

// ========== PÁGINAS DE RETORNO ==========

export async function paymentSuccess(req, res) {
  const { session } = req.query;
  
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento Aprovado</title>
      <style>
        body {
          font-family: Arial;
          text-align: center;
          padding: 50px;
          background: #d4edda;
        }
        .success {
          color: #155724;
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 { color: #155724; }
      </style>
    </head>
    <body>
      <div class="success">✅</div>
      <h1>Pagamento Aprovado!</h1>
      <p>Sua renovação será processada em instantes.</p>
      <p>Obrigado pela preferência!</p>
    </body>
    </html>
  `);
}

export async function paymentFailure(req, res) {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento Recusado</title>
      <style>
        body {
          font-family: Arial;
          text-align: center;
          padding: 50px;
          background: #f8d7da;
        }
        .failure {
          color: #721c24;
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 { color: #721c24; }
      </style>
    </head>
    <body>
      <div class="failure">❌</div>
      <h1>Pagamento Não Aprovado</h1>
      <p>Não foi possível processar seu pagamento.</p>
      <p>Por favor, tente novamente.</p>
    </body>
    </html>
  `);
}

export async function paymentPending(req, res) {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pagamento Pendente</title>
      <style>
        body {
          font-family: Arial;
          text-align: center;
          padding: 50px;
          background: #fff3cd;
        }
        .pending {
          color: #856404;
          font-size: 48px;
          margin-bottom: 20px;
        }
        h1 { color: #856404; }
      </style>
    </head>
    <body>
      <div class="pending">⏳</div>
      <h1>Pagamento Pendente</h1>
      <p>Seu pagamento está sendo processado.</p>
      <p>Você receberá uma confirmação em breve.</p>
    </body>
    </html>
  `);
}

// ========== WEBHOOK MERCADO PAGO ==========
export async function handleMercadoPagoWebhook(req, res) {
  try {
    console.log('📨 Webhook recebido:', {
      type: req.body.type,
      action: req.body.action,
      data: req.body.data
    });
    
    // Responde rápido para o Mercado Pago
    res.status(200).send('OK');
    
    // Processa async
    if (req.body.type === 'payment' && req.body.data?.id) {
      await processPayment(req.body.data.id);
    }
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).send('Error');
  }
}

// ========== PROCESSAR PAGAMENTO ==========
async function processPayment(paymentId) {
  try {
    console.log('🔍 Processando pagamento:', paymentId);
    
    // Buscar dados do pagamento no Mercado Pago
    const payment = await paymentClient.get({ id: paymentId });
    
    console.log('💳 Status do pagamento:', payment.status);
    
    if (payment.status === 'approved') {
      const externalReference = payment.external_reference;
      
      // Buscar sessão
      const sessionResult = await query(`
        SELECT * FROM payment_sessions
        WHERE session_token = $1
      `, [externalReference]);
      
      if (sessionResult.rows.length === 0) {
        console.error('❌ Sessão não encontrada:', externalReference);
        return;
      }
      
      const session = sessionResult.rows[0];
      
      // Atualizar sessão
      await query(`
        UPDATE payment_sessions
        SET status = 'paid',
            mercadopago_payment_id = $1,
            paid_at = NOW(),
            payment_method = $2
        WHERE id = $3
      `, [paymentId, payment.payment_method_id, session.id]);
      
      // Buscar cliente
      const clientResult = await query(`
        SELECT * FROM clients WHERE id = $1
      `, [session.client_id]);
      
      if (clientResult.rows.length === 0) {
        console.error('❌ Cliente não encontrado');
        return;
      }
      
      const client = clientResult.rows[0];
      
      // Buscar plano
      const planResult = await query(`
        SELECT * FROM plans WHERE id = $1
      `, [client.plan_id]);
      
      const plan = planResult.rows[0];
      
      // Calcular nova data de vencimento
      const currentDueDate = new Date(client.due_date);
      const today = new Date();
      const baseDate = currentDueDate > today ? currentDueDate : today;
      
      const newDueDate = new Date(baseDate);
      newDueDate.setMonth(newDueDate.getMonth() + (plan?.duration_months || 1));
      
      // Renovar cliente
      await query(`
        UPDATE clients
        SET due_date = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [newDueDate, client.id]);
      
      // Registrar transação
      const serverResult = await query(`
        SELECT cost_per_screen FROM servers WHERE id = $1
      `, [client.server_id]);
      
      const serverCost = serverResult.rows[0]?.cost_per_screen || 0;
      const netProfit = parseFloat(client.price_value) - parseFloat(serverCost);
      
      await query(`
        INSERT INTO financial_transactions (
          user_id,
          client_id,
          type,
          amount_received,
          server_cost,
          net_profit,
          due_date,
          paid_date,
          status,
          payment_method,
          payment_gateway,
          gateway_payment_id,
          payment_session_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12)
      `, [
        client.user_id,
        client.id,
        'renewal',
        client.price_value,
        serverCost,
        netProfit,
        newDueDate,
        'paid',
        payment.payment_method_id,
        'mercadopago',
        paymentId,
        session.id
      ]);
      
      console.log('✅ Cliente renovado:', client.name, '→', newDueDate.toISOString().split('T')[0]);
    }
    
  } catch (error) {
    console.error('❌ Process payment error:', error);
  }
}