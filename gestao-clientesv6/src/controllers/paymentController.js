// ========================================
// PAYMENT CONTROLLER - VERSÃO SIMPLIFICADA
// API Direta Mercado Pago (PIX + Cartão)
// ========================================

import { query } from '../config/database.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import crypto from 'crypto';

// ========== CONFIGURAÇÃO MERCADO PAGO ==========
const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const PUBLIC_KEY = process.env.MERCADOPAGO_PUBLIC_KEY;

if (!ACCESS_TOKEN) {
  console.error('❌ ERRO CRÍTICO: MERCADOPAGO_ACCESS_TOKEN não configurado!');
  console.error('   Verifique seu arquivo .env');
  throw new Error('MERCADOPAGO_ACCESS_TOKEN é obrigatório');
}

if (!PUBLIC_KEY) {
  console.error('❌ ERRO CRÍTICO: MERCADOPAGO_PUBLIC_KEY não configurado!');
  console.error('   Verifique seu arquivo .env');
  throw new Error('MERCADOPAGO_PUBLIC_KEY é obrigatório');
}

console.log('✅ Mercado Pago configurado:');
console.log('   ACCESS_TOKEN:', ACCESS_TOKEN.substring(0, 20) + '...' + ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 10));
console.log('   PUBLIC_KEY:', PUBLIC_KEY.substring(0, 20) + '...');

const mercadopagoClient = new MercadoPagoConfig({
  accessToken: ACCESS_TOKEN
});

const paymentClient = new Payment(mercadopagoClient);

// ========== GERAR TOKEN ==========
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ========== PÁGINA DE PAGAMENTO ==========
export async function renderPaymentPage(req, res) {
  try {
    const { token } = req.params;
    
    console.log('🔍 Buscando cliente pelo token:', token);
    
    // ✅ QUERY CORRIGIDA - u.name as company_name (não u.company_name)
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
      return res.status(404).send(generateErrorPage());
    }
    
    const client = clientResult.rows[0];
    console.log('✅ Cliente encontrado:', client.name);
    
    // Cria sessão de pagamento
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    await query(`
      INSERT INTO payment_sessions (
        client_id, user_id, payment_token, session_token,
        amount, currency, status, expires_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      client.id, client.user_id, client.payment_token, sessionToken,
      client.price_value, 'BRL', 'pending', expiresAt,
      JSON.stringify({ client_name: client.name })
    ]);
    
    console.log('🆕 Nova sessão criada:', sessionToken);
    
    // Renderiza página com opções PIX e Cartão
    const html = generatePaymentPageHTML(client, sessionToken);
    res.send(html);
    
  } catch (error) {
    console.error('❌ Erro:', error);
    res.status(500).send(generateErrorPage());
  }
}

// ========== CRIAR PAGAMENTO PIX ==========
export async function createPixPayment(req, res) {
  try {
    const { session_token } = req.body;
    
    console.log('📱 Criando pagamento PIX para sessão:', session_token);
    
    // ✅ QUERY CORRIGIDA - Sem c.email
    const sessionResult = await query(`
      SELECT ps.*, c.name, c.whatsapp_number
      FROM payment_sessions ps
      JOIN clients c ON ps.client_id = c.id
      WHERE ps.session_token = $1 AND ps.status = 'pending'
    `, [session_token]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    const session = sessionResult.rows[0];
    
    // ✅ Gera email válido (domínio real)
    const fakeEmail = `cliente${session.client_id}@gmail.com`;
    
    console.log('📤 Enviando para Mercado Pago...');
    console.log('   Valor: R$', session.amount);
    console.log('   Cliente:', session.name);
    
    // Cria pagamento PIX via API
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
        notification_url: `${process.env.PAYMENT_DOMAIN}/api/webhooks/mercadopago`
      }
    });
    
    console.log('✅ PIX criado:', payment.id);
    
    // Salva ID do pagamento na sessão
    await query(`
      UPDATE payment_sessions
      SET mercadopago_payment_id = $1
      WHERE session_token = $2
    `, [payment.id.toString(), session_token]);
    
    // Retorna dados do PIX
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

// ========== CRIAR PAGAMENTO CARTÃO ==========
export async function createCardPayment(req, res) {
  try {
    const { session_token, token, installments = 1, payment_method_id } = req.body;
    
    console.log('💳 Criando pagamento com cartão para sessão:', session_token);
    
    // ✅ QUERY CORRIGIDA - Sem c.email
    const sessionResult = await query(`
      SELECT ps.*, c.name
      FROM payment_sessions ps
      JOIN clients c ON ps.client_id = c.id
      WHERE ps.session_token = $1 AND ps.status = 'pending'
    `, [session_token]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sessão não encontrada' });
    }
    
    const session = sessionResult.rows[0];
    
    // ✅ Gera email válido (domínio real)
    const fakeEmail = `cliente${session.client_id}@gmail.com`;
    
    console.log('📤 Processando cartão...');
    console.log('   Valor: R$', session.amount);
    console.log('   Parcelas:', installments);
    
    // Cria pagamento com cartão via API
    const payment = await paymentClient.create({
      body: {
        transaction_amount: parseFloat(session.amount),
        token: token,
        description: `Renovação - ${session.name}`,
        installments: parseInt(installments),
        payment_method_id: payment_method_id,
        payer: {
          email: fakeEmail
        },
        external_reference: session.session_token,
        notification_url: `${process.env.PAYMENT_DOMAIN}/api/webhooks/mercadopago`
      }
    });
    
    console.log('✅ Pagamento cartão criado:', payment.id, 'Status:', payment.status);
    
    // Salva ID do pagamento
    await query(`
      UPDATE payment_sessions
      SET mercadopago_payment_id = $1, payment_method = $2
      WHERE session_token = $3
    `, [payment.id.toString(), payment_method_id, session_token]);
    
    // Retorna resultado
    res.json({
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      approved: payment.status === 'approved'
    });
    
    // Se aprovado, processa imediatamente
    if (payment.status === 'approved') {
      console.log('✅ Pagamento aprovado imediatamente!');
      await processApprovedPayment(payment);
    }
    
  } catch (error) {
    console.error('❌ Erro ao processar cartão:', error);
    res.status(500).json({ 
      error: 'Erro ao processar pagamento',
      details: error.message 
    });
  }
}

// ========== WEBHOOK ==========
export async function handleMercadoPagoWebhook(req, res) {
  try {
    console.log('📥 Webhook recebido:', req.body);
    
    // Responde rápido
    res.status(200).json({ success: true });
    
    const { type, data } = req.body;
    
    if (type === 'payment' && data?.id) {
      console.log('🔑 Verificando ACCESS_TOKEN...');
      console.log('   ACCESS_TOKEN existe?', !!ACCESS_TOKEN);
      console.log('   ACCESS_TOKEN valor:', ACCESS_TOKEN ? ACCESS_TOKEN.substring(0, 20) + '...' : 'VAZIO!');
      
      // Busca detalhes do pagamento
      const payment = await paymentClient.get({ id: data.id });
      
      console.log('💰 Status:', payment.status);
      
      if (payment.status === 'approved') {
        await processApprovedPayment(payment);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro webhook:', error);
  }
}

// ========== PROCESSAR PAGAMENTO APROVADO ==========
async function processApprovedPayment(payment) {
  try {
    const sessionToken = payment.external_reference;
    
    console.log('🔍 Buscando sessão:', sessionToken);
    
    // ✅ QUERY CORRIGIDA - p.num_screens (não c.num_screens)
    const sessionResult = await query(`
      SELECT ps.*, c.*, p.duration_months,
             s.cost_per_screen, s.multiply_by_screens,
             COALESCE(p.num_screens, 1) as num_screens
      FROM payment_sessions ps
      JOIN clients c ON ps.client_id = c.id
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE ps.session_token = $1
    `, [sessionToken]);
    
    if (sessionResult.rows.length === 0) {
      console.warn('⚠️ Sessão não encontrada');
      return;
    }
    
    const session = sessionResult.rows[0];
    
    // Verifica se já processou
    if (session.status === 'paid') {
      console.log('ℹ️ Já processado');
      return;
    }
    
    console.log('✅ Processando:', session.name);
    
    // Calcula valores
    const serverCost = session.multiply_by_screens 
      ? parseFloat(session.cost_per_screen || 0) * parseInt(session.num_screens)
      : parseFloat(session.cost_per_screen || 0);
    
    const amountReceived = parseFloat(payment.transaction_amount);
    const netProfit = amountReceived - serverCost;
    
    console.log('💰 Valores:');
    console.log('   Recebido: R$', amountReceived.toFixed(2));
    console.log('   Custo servidor: R$', serverCost.toFixed(2));
    console.log('   Lucro líquido: R$', netProfit.toFixed(2));
    
    // 1. Atualiza sessão
    await query(`
      UPDATE payment_sessions
      SET status = 'paid', paid_at = NOW(), payment_method = $1,
          mercadopago_payment_id = $2
      WHERE id = $3
    `, [payment.payment_method_id, payment.id, session.id]);
    
    console.log('✅ Sessão atualizada');
    
    // 2. Renova cliente (lógica correta: se vencido, renova a partir de hoje)
    const currentDueDate = new Date(session.due_date);
    const today = new Date();
    const baseDate = currentDueDate < today ? today : currentDueDate;
    
    const newDueDate = new Date(baseDate);
    newDueDate.setMonth(newDueDate.getMonth() + (session.duration_months || 1));
    
    await query(`
      UPDATE clients
      SET due_date = $1, updated_at = NOW()
      WHERE id = $2
    `, [newDueDate, session.client_id]);
    
    console.log('✅ Cliente renovado até:', newDueDate.toLocaleDateString('pt-BR'));
    console.log('   Data anterior:', currentDueDate.toLocaleDateString('pt-BR'));
    console.log('   Meses adicionados:', session.duration_months || 1);
    
    // 3. Registra transação financeira (SEM payment_session_id)
    try {
      await query(`
        INSERT INTO financial_transactions (
          user_id, client_id, type, amount_received, server_cost, net_profit,
          due_date, paid_date, status, payment_method, payment_gateway,
          gateway_payment_id, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11)
      `, [
        session.user_id, session.client_id, 'renewal',
        amountReceived, serverCost, netProfit,
        session.due_date, 'paid', payment.payment_method_id,
        'mercadopago', payment.id,
        `Pagamento automático - ${session.name}`
      ]);
      
      console.log('✅ Transação financeira registrada');
    } catch (error) {
      console.error('⚠️ Erro ao registrar transação (cliente já foi renovado):', error.message);
      
      // Tenta inserir SEM o payment_session_id
      try {
        await query(`
          INSERT INTO financial_transactions (
            user_id, client_id, type, amount_received, server_cost, net_profit,
            due_date, paid_date, status, payment_method, payment_gateway,
            gateway_payment_id, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12)
        `, [
          session.user_id, session.client_id, 'renewal',
          amountReceived, serverCost, netProfit,
          session.due_date, 'paid', payment.payment_method_id,
          'mercadopago', payment.id,
          `Pagamento automático - ${session.name} (sem session_id)`
        ]);
        
        console.log('✅ Transação financeira registrada (sem session_id)');
      } catch (retryError) {
        console.error('❌ Erro crítico ao registrar transação:', retryError);
      }
    }
    
    console.log('');
    console.log('🎉 PROCESSAMENTO CONCLUÍDO COM SUCESSO!');
    console.log('================================================');
    
  } catch (error) {
    console.error('❌ Erro ao processar:', error);
  }
}

// ========== VERIFICAR STATUS DO PAGAMENTO ==========
export async function checkPaymentStatus(req, res) {
  try {
    const { payment_id } = req.params;
    
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

// ========== HTML DA PÁGINA ==========
function generatePaymentPageHTML(client, sessionToken) {
  const amount = parseFloat(client.price_value).toFixed(2);
  const dueDate = new Date(client.due_date).toLocaleDateString('pt-BR');
  const publicKey = PUBLIC_KEY;
  
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
      padding: 15px 30px;
      cursor: pointer;
      border: none;
      background: none;
      font-size: 16px;
      font-weight: 600;
      color: #666;
      border-bottom: 3px solid transparent;
      transition: all 0.3s;
    }
    .tab.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .btn {
      width: 100%;
      padding: 18px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    }
    .btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    #qr-code-container {
      text-align: center;
      padding: 20px;
    }
    #qr-code-container img {
      max-width: 300px;
      margin: 20px 0;
      border: 3px solid #667eea;
      border-radius: 12px;
      padding: 10px;
      background: white;
    }
    .copy-paste {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      word-break: break-all;
      font-family: monospace;
      font-size: 12px;
      margin: 15px 0;
      cursor: pointer;
      border: 2px solid #e0e0e0;
    }
    .copy-paste:hover { background: #e9ecef; }
    .loading {
      text-align: center;
      padding: 40px 20px;
      color: #666;
    }
    .loading:after {
      content: '...';
      animation: dots 1.5s steps(4, end) infinite;
    }
    @keyframes dots {
      0%, 20% { content: '.'; }
      40% { content: '..'; }
      60%, 100% { content: '...'; }
    }
    .success {
      background: #d4edda;
      color: #155724;
      padding: 40px;
      border-radius: 16px;
      text-align: center;
    }
    .success h1 { color: #155724; margin-top: 20px; }
    .error {
      background: #f8d7da;
      color: #721c24;
      padding: 20px;
      border-radius: 12px;
      margin: 15px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>💳 Pagamento</h1>
      
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
        <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Valor</div>
        <div class="amount-value">R$ ${amount}</div>
      </div>
      
      <div class="tabs">
        <button class="tab active" onclick="switchTab('pix')">📱 PIX</button>
        <button class="tab" onclick="switchTab('card')">💳 Cartão</button>
      </div>
      
      <!-- TAB PIX -->
      <div id="pix-tab" class="tab-content active">
        <div id="pix-loading" class="loading">
          Gerando QR Code PIX
        </div>
        <div id="qr-code-container" style="display:none;">
          <img id="qr-code-image" src="" alt="QR Code PIX">
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
        <p style="color: #666; margin-bottom: 20px;">
          Preencha os dados do cartão abaixo
        </p>
        <div id="card-form-container"></div>
        <button id="pay-card-btn" class="btn btn-primary" style="margin-top: 20px; display:none;">
          Pagar com Cartão
        </button>
        <div id="card-error" style="display:none;"></div>
      </div>
    </div>
  </div>

  <script>
    const SESSION_TOKEN = '${sessionToken}';
    const MP_PUBLIC_KEY = '${publicKey}';
    const mp = new MercadoPago(MP_PUBLIC_KEY);
    
    let currentPixCode = '';
    
    // Inicializa PIX automaticamente
    generatePix();
    
    // Alterna tabs
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      if (tab === 'pix') {
        document.querySelector('.tab:nth-child(1)').classList.add('active');
        document.getElementById('pix-tab').classList.add('active');
      } else {
        document.querySelector('.tab:nth-child(2)').classList.add('active');
        document.getElementById('card-tab').classList.add('active');
        initCardForm();
      }
    }
    
    // Gera PIX
    async function generatePix() {
      try {
        const response = await fetch('/api/payment/pix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_token: SESSION_TOKEN })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error || 'Erro ao gerar PIX');
        
        // Mostra QR Code
        document.getElementById('pix-loading').style.display = 'none';
        document.getElementById('qr-code-container').style.display = 'block';
        document.getElementById('qr-code-image').src = 'data:image/png;base64,' + data.qr_code_base64;
        document.getElementById('pix-code').textContent = data.qr_code;
        currentPixCode = data.qr_code;
        
        // Inicia verificação de status
        checkPaymentStatus(data.payment_id);
        
      } catch (error) {
        document.getElementById('pix-loading').style.display = 'none';
        document.getElementById('pix-error').style.display = 'block';
        document.getElementById('pix-error').className = 'error';
        document.getElementById('pix-error').textContent = '❌ ' + error.message;
      }
    }
    
    // Copia código PIX
    function copyPixCode() {
      navigator.clipboard.writeText(currentPixCode);
      alert('✅ Código PIX copiado!');
      document.getElementById('pix-code').style.display = 'block';
    }
    
    // Verifica status do pagamento
    async function checkPaymentStatus(paymentId) {
      let attempts = 0;
      const maxAttempts = 60; // 5 minutos
      
      const interval = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(interval);
          return;
        }
        
        try {
          const response = await fetch('/api/payment/status/' + paymentId);
          const data = await response.json();
          
          if (data.status === 'approved') {
            clearInterval(interval);
            showSuccess();
          }
        } catch (error) {
          // Ignora erros na verificação
        }
      }, 5000); // Verifica a cada 5 segundos
    }
    
    // Mostra sucesso
    function showSuccess() {
      document.querySelector('.container').innerHTML = \`
        <div class="card success">
          <div style="font-size: 64px;">✅</div>
          <h1>Pagamento Aprovado!</h1>
          <p style="margin-top: 10px; font-size: 16px;">Seu pagamento foi processado com sucesso.</p>
          <p style="margin-top: 5px; font-size: 14px;">Você receberá uma confirmação em breve.</p>
        </div>
      \`;
    }
    
    // Inicializa formulário de cartão
    let cardPaymentBrick = null;
    
    async function initCardForm() {
      if (cardPaymentBrick) return;
      
      try {
        const bricksBuilder = mp.bricks();
        
        cardPaymentBrick = await bricksBuilder.create('cardPayment', 'card-form-container', {
          initialization: {
            amount: ${amount}
          },
          callbacks: {
            onReady: () => {
              document.getElementById('pay-card-btn').style.display = 'block';
            },
            onSubmit: async (cardFormData) => {
              return false; // Previne submit automático
            },
            onError: (error) => {
              console.error('Erro no formulário:', error);
            }
          }
        });
        
        // Handler do botão de pagamento
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
            
            if (data.approved) {
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
  </script>
</body>
</html>
  `;
}

// ========== PÁGINA DE ERRO ==========
function generateErrorPage() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erro</title>
  <style>
    body { 
      font-family: Arial; 
      text-align: center; 
      padding: 50px; 
      background: #f5f5f5; 
    }
    .error { 
      color: #e74c3c; 
      font-size: 48px; 
      margin-bottom: 20px; 
    }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="error">❌</div>
  <h1>Link Inválido</h1>
  <p>Este link de pagamento não é válido ou expirou.</p>
</body>
</html>
  `;
}