// src/controllers/subscriptionController.js
import { query } from '../config/database.js';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

const SUBSCRIPTION_PRICE = parseFloat(process.env.SUBSCRIPTION_PRICE || '25.00');
const SUBSCRIPTION_DAYS = parseInt(process.env.SUBSCRIPTION_DAYS || '30');
const MP_ACCESS_TOKEN = process.env.MP_SUBSCRIPTION_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MP_SUBSCRIPTION_PUBLIC_KEY;
const API_URL = process.env.API_URL || 'http://localhost:3001';

// ========== CRIAR PAGAMENTO PIX PARA RENOVAÇÃO ==========
export async function createSubscriptionPayment(req, res) {
  try {
    const userId = req.user.id;

    if (!MP_ACCESS_TOKEN || !MP_PUBLIC_KEY) {
      return res.status(503).json({ 
        error: 'Sistema de pagamentos não configurado. Entre em contato com o administrador.' 
      });
    }

    // Buscar dados do usuário
    const userResult = await query(`
      SELECT id, name, email, subscription_end
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    console.log('💳 Criando pagamento de renovação para:', user.name);
    console.log('   User ID:', userId);
    console.log('   Valor: R$', SUBSCRIPTION_PRICE);
    console.log('   Dias:', SUBSCRIPTION_DAYS);

    // Criar cliente Mercado Pago
    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: MP_ACCESS_TOKEN
    });

    const paymentClient = new Payment(mercadopagoClient);

    // Criar pagamento PIX
    const payment = await paymentClient.create({
      body: {
        transaction_amount: SUBSCRIPTION_PRICE,
        description: `Renovação ${SUBSCRIPTION_DAYS} dias - ${user.name}`,
        payment_method_id: 'pix',
        payer: {
          email: user.email || `user${userId}@sistema.com`,
          first_name: user.name.split(' ')[0] || 'Usuário',
          last_name: user.name.split(' ').slice(1).join(' ') || 'Sistema'
        },
        external_reference: `USER_${userId}`,
        notification_url: `${API_URL}/api/webhooks/subscription-payment`
      }
    });

    console.log('✅ Pagamento PIX criado:', payment.id);
    console.log('   Status:', payment.status);

    // Salvar no histórico
    await query(`
      INSERT INTO user_subscription_payments (
        user_id,
        mercadopago_payment_id,
        amount,
        days_added,
        status,
        payment_method,
        previous_subscription_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId,
      payment.id.toString(),
      SUBSCRIPTION_PRICE,
      SUBSCRIPTION_DAYS,
      'pending',
      'pix',
      user.subscription_end
    ]);

    // Retornar dados do pagamento
    res.json({
      payment_id: payment.id,
      amount: SUBSCRIPTION_PRICE,
      days: SUBSCRIPTION_DAYS,
      qr_code: payment.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: payment.point_of_interaction.transaction_data.qr_code_base64,
      status: payment.status
    });

  } catch (error) {
    console.error('❌ Erro ao criar pagamento:', error);
    res.status(500).json({ 
      error: 'Erro ao criar pagamento. Tente novamente.' 
    });
  }
}

// ========== VERIFICAR STATUS DO PAGAMENTO ==========
export async function checkSubscriptionPaymentStatus(req, res) {
  try {
    const { payment_id } = req.params;

    if (!MP_ACCESS_TOKEN) {
      return res.status(503).json({ error: 'Sistema não configurado' });
    }

    const mercadopagoClient = new MercadoPagoConfig({
      accessToken: MP_ACCESS_TOKEN
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
    res.status(500).json({ error: 'Erro ao verificar status do pagamento' });
  }
}

// ========== WEBHOOK MERCADO PAGO ==========
export async function handleSubscriptionWebhook(req, res) {
  try {
    const { type, data } = req.body;

    console.log('🔔 Webhook recebido (renovação):', type);

    if (type === 'payment') {
      const paymentId = data.id;

      if (!MP_ACCESS_TOKEN) {
        console.log('⚠️ Access token não configurado');
        return res.sendStatus(200);
      }

      // Buscar dados do pagamento no MP
      const mercadopagoClient = new MercadoPagoConfig({
        accessToken: MP_ACCESS_TOKEN
      });

      const paymentClient = new Payment(mercadopagoClient);
      const payment = await paymentClient.get({ id: paymentId });

      console.log('   Payment ID:', paymentId);
      console.log('   Status:', payment.status);
      console.log('   External Ref:', payment.external_reference);
      console.log('   Amount:', payment.transaction_amount);

      // Verificar se é pagamento de renovação (external_reference = USER_123)
      if (!payment.external_reference || !payment.external_reference.startsWith('USER_')) {
        console.log('⚠️ Não é pagamento de renovação, ignorando');
        return res.sendStatus(200);
      }

      // Extrair user_id
      const userId = parseInt(payment.external_reference.replace('USER_', ''));

      if (payment.status === 'approved') {
        console.log('✅ Pagamento aprovado! Processando renovação...');
        
        // Buscar registro de pagamento
        const paymentRecord = await query(`
          SELECT * FROM user_subscription_payments
          WHERE mercadopago_payment_id = $1
        `, [paymentId.toString()]);

        if (paymentRecord.rows.length === 0) {
          console.log('⚠️ Registro de pagamento não encontrado no banco');
          return res.sendStatus(200);
        }

        const record = paymentRecord.rows[0];

        // Se já foi processado, não processar novamente
        if (record.status === 'approved') {
          console.log('⚠️ Pagamento já foi processado anteriormente');
          return res.sendStatus(200);
        }

        // Processar renovação
        await processRenewal(userId, record.days_added, paymentId.toString());
      }
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.sendStatus(500);
  }
}

// ========== PROCESSAR RENOVAÇÃO ==========
async function processRenewal(userId, daysToAdd, paymentId) {
  try {
    console.log(`🔄 Processando renovação para user ${userId}...`);

    // Buscar usuário
    const userResult = await query(`
      SELECT subscription_end FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      throw new Error('Usuário não encontrado');
    }

    const currentEnd = userResult.rows[0].subscription_end 
      ? new Date(userResult.rows[0].subscription_end) 
      : new Date();
    
    const today = new Date();

    // LÓGICA: Se vencido, adiciona a partir de hoje. Se ativo, adiciona na data de vencimento
    const baseDate = currentEnd > today ? currentEnd : today;
    const newEnd = new Date(baseDate);
    newEnd.setDate(newEnd.getDate() + daysToAdd);

    console.log('   Data anterior:', currentEnd.toISOString());
    console.log('   Nova data:', newEnd.toISOString());

    // Atualizar usuário
    await query(`
      UPDATE users
      SET subscription_end = $1, is_active = true, updated_at = NOW()
      WHERE id = $2
    `, [newEnd, userId]);

    // Atualizar registro de pagamento
    await query(`
      UPDATE user_subscription_payments
      SET 
        status = 'approved',
        paid_at = NOW(),
        new_subscription_end = $1
      WHERE mercadopago_payment_id = $2
    `, [newEnd, paymentId]);

    console.log('✅ Renovação concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao processar renovação:', error);
    throw error;
  }
}

// ========== OBTER INFORMAÇÕES DA ASSINATURA ==========
export async function getSubscriptionInfo(req, res) {
  try {
    const userId = req.user.id;

    const userResult = await query(`
      SELECT 
        name, 
        email, 
        subscription_start, 
        subscription_end,
        is_active
      FROM users WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];
    const today = new Date();
    const endDate = user.subscription_end ? new Date(user.subscription_end) : null;
    
    const daysRemaining = endDate 
      ? Math.ceil((endDate - today) / (1000 * 60 * 60 * 24))
      : 0;

    const isExpired = daysRemaining < 0;
    const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 7;

    res.json({
      name: user.name,
      email: user.email,
      subscription_end: user.subscription_end,
      days_remaining: daysRemaining,
      is_expired: isExpired,
      is_expiring_soon: isExpiringSoon,
      is_active: user.is_active,
      renewal_price: SUBSCRIPTION_PRICE,
      renewal_days: SUBSCRIPTION_DAYS
    });

  } catch (error) {
    console.error('❌ Erro ao buscar info da assinatura:', error);
    res.status(500).json({ error: 'Erro ao buscar informações' });
  }
}

// ========== HISTÓRICO DE PAGAMENTOS ==========
export async function getPaymentHistory(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        id,
        mercadopago_payment_id,
        amount,
        days_added,
        status,
        payment_method,
        created_at,
        paid_at,
        previous_subscription_end,
        new_subscription_end
      FROM user_subscription_payments
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [userId]);

    res.json(result.rows);

  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
}
