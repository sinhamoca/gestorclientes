// ========================================
// PAYMENT SETTINGS CONTROLLER
// Gerenciamento de credenciais do Mercado Pago por usuário
// ========================================

import { query } from '../config/database.js';
import crypto from 'crypto';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// ========== CRIPTOGRAFIA ==========
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

// Criptografa dados sensíveis
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Descriptografa dados
function decrypt(text) {
  if (!text) return null;
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.substring(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// ========== BUSCAR CONFIGURAÇÕES DO USUÁRIO ==========
export async function getPaymentSettings(req, res) {
  try {
    const userId = req.user.id;
    
    console.log('🔍 Buscando configurações de pagamento para user:', userId);
    
    const result = await query(`
      SELECT 
        id,
        user_id,
        mercadopago_enabled,
        mercadopago_access_token,
        mercadopago_public_key,
        payment_domain,
        session_expiration_hours,
        send_confirmation_whatsapp,
        created_at,
        updated_at
      FROM payment_settings
      WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      return res.json({
        configured: false,
        mercadopago_enabled: false
      });
    }
    
    const settings = result.rows[0];
    
    // Descriptografa apenas para exibição parcial (mascarado)
    let accessTokenMasked = null;
    let publicKeyMasked = null;
    
    if (settings.mercadopago_access_token) {
      try {
        const decrypted = decrypt(settings.mercadopago_access_token);
        accessTokenMasked = decrypted.substring(0, 20) + '...' + decrypted.substring(decrypted.length - 10);
      } catch (err) {
        console.error('❌ Erro ao descriptografar access token:', err);
      }
    }
    
    if (settings.mercadopago_public_key) {
      try {
        const decrypted = decrypt(settings.mercadopago_public_key);
        publicKeyMasked = decrypted.substring(0, 20) + '...';
      } catch (err) {
        console.error('❌ Erro ao descriptografar public key:', err);
      }
    }
    
    res.json({
      configured: true,
      mercadopago_enabled: settings.mercadopago_enabled,
      access_token_masked: accessTokenMasked,
      public_key_masked: publicKeyMasked,
      payment_domain: settings.payment_domain,
      session_expiration_hours: settings.session_expiration_hours,
      send_confirmation_whatsapp: settings.send_confirmation_whatsapp,
      created_at: settings.created_at,
      updated_at: settings.updated_at
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    res.status(500).json({ error: 'Erro ao buscar configurações de pagamento' });
  }
}

// ========== TESTAR CREDENCIAIS DO MERCADO PAGO ==========
export async function testMercadoPagoCredentials(req, res) {
  try {
    const { access_token, public_key } = req.body;
    
    if (!access_token || !public_key) {
      return res.status(400).json({ error: 'Access Token e Public Key são obrigatórios' });
    }
    
    console.log('🧪 Testando credenciais do Mercado Pago...');
    
    // Tenta criar um cliente MP com as credenciais
    const client = new MercadoPagoConfig({
      accessToken: access_token
    });
    
    const paymentClient = new Payment(client);
    
    // Faz uma busca simples para validar credenciais
    // (não cria nada, só valida acesso à API)
    try {
      // Tenta buscar um pagamento inexistente (retorna 404 se credenciais válidas)
      await paymentClient.get({ id: '999999999999' });
    } catch (error) {
      // Se erro for 404 = credenciais válidas
      // Se erro for 401/403 = credenciais inválidas
      if (error.status === 404) {
        console.log('✅ Credenciais válidas! (404 esperado)');
        return res.json({ 
          valid: true, 
          message: 'Credenciais válidas!' 
        });
      } else if (error.status === 401 || error.status === 403) {
        console.log('❌ Credenciais inválidas:', error.message);
        return res.status(400).json({ 
          valid: false, 
          error: 'Credenciais inválidas. Verifique seu Access Token.' 
        });
      } else {
        // Outro erro, mas credenciais provavelmente válidas
        console.log('✅ Credenciais parecem válidas (erro diferente de auth)');
        return res.json({ 
          valid: true, 
          message: 'Credenciais válidas!' 
        });
      }
    }
    
    // Se chegou aqui, credenciais válidas
    res.json({ 
      valid: true, 
      message: 'Credenciais válidas!' 
    });
    
  } catch (error) {
    console.error('❌ Erro ao testar credenciais:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Erro ao validar credenciais. Tente novamente.' 
    });
  }
}

// ========== SALVAR/ATUALIZAR CONFIGURAÇÕES ==========
export async function savePaymentSettings(req, res) {
  try {
    const userId = req.user.id;
    const { 
      access_token, 
      public_key, 
      payment_domain,
      session_expiration_hours = 24,
      send_confirmation_whatsapp = true
    } = req.body;
    
    if (!access_token || !public_key) {
      return res.status(400).json({ error: 'Access Token e Public Key são obrigatórios' });
    }
    
    console.log('💾 Salvando configurações para user:', userId);
    
    // Define domínio padrão se não fornecido
    const finalPaymentDomain = payment_domain || process.env.PAYMENT_DOMAIN || 'https://pagamentos.comprarecarga.shop';
    
    // Criptografa credenciais
    const encryptedAccessToken = encrypt(access_token);
    const encryptedPublicKey = encrypt(public_key);
    
    // Verifica se já existe configuração
    const existingResult = await query(`
      SELECT id FROM payment_settings WHERE user_id = $1
    `, [userId]);
    
    if (existingResult.rows.length > 0) {
      // UPDATE
      await query(`
        UPDATE payment_settings
        SET 
          mercadopago_enabled = true,
          mercadopago_access_token = $1,
          mercadopago_public_key = $2,
          payment_domain = $3,
          session_expiration_hours = $4,
          send_confirmation_whatsapp = $5,
          updated_at = NOW()
        WHERE user_id = $6
      `, [
        encryptedAccessToken,
        encryptedPublicKey,
        finalPaymentDomain,
        session_expiration_hours,
        send_confirmation_whatsapp,
        userId
      ]);
      
      console.log('✅ Configurações atualizadas!');
    } else {
      // INSERT
      await query(`
        INSERT INTO payment_settings (
          user_id,
          mercadopago_enabled,
          mercadopago_access_token,
          mercadopago_public_key,
          payment_domain,
          session_expiration_hours,
          send_confirmation_whatsapp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        userId,
        true,
        encryptedAccessToken,
        encryptedPublicKey,
        finalPaymentDomain,
        session_expiration_hours,
        send_confirmation_whatsapp
      ]);
      
      console.log('✅ Configurações criadas!');
    }
    
    res.json({ 
      message: 'Configurações salvas com sucesso!',
      mercadopago_enabled: true
    });
    
  } catch (error) {
    console.error('❌ Erro ao salvar configurações:', error);
    res.status(500).json({ error: 'Erro ao salvar configurações' });
  }
}

// ========== ATIVAR/DESATIVAR MERCADO PAGO ==========
export async function toggleMercadoPago(req, res) {
  try {
    const userId = req.user.id;
    const { enabled } = req.body;
    
    await query(`
      UPDATE payment_settings
      SET mercadopago_enabled = $1, updated_at = NOW()
      WHERE user_id = $2
    `, [enabled, userId]);
    
    res.json({ 
      message: enabled ? 'Mercado Pago ativado!' : 'Mercado Pago desativado!',
      mercadopago_enabled: enabled
    });
    
  } catch (error) {
    console.error('❌ Erro ao alterar status:', error);
    res.status(500).json({ error: 'Erro ao alterar status' });
  }
}

// ========== DELETAR CONFIGURAÇÕES ==========
export async function deletePaymentSettings(req, res) {
  try {
    const userId = req.user.id;
    
    await query(`
      DELETE FROM payment_settings WHERE user_id = $1
    `, [userId]);
    
    console.log('🗑️ Configurações deletadas para user:', userId);
    
    res.json({ message: 'Configurações removidas com sucesso!' });
    
  } catch (error) {
    console.error('❌ Erro ao deletar configurações:', error);
    res.status(500).json({ error: 'Erro ao deletar configurações' });
  }
}

// ========== BUSCAR CREDENCIAIS DESCRIPTOGRAFADAS (INTERNO) ==========
// Esta função é usada internamente pelo paymentController
export async function getUserCredentials(userId) {
  try {
    const result = await query(`
      SELECT 
        mercadopago_enabled,
        mercadopago_access_token,
        mercadopago_public_key,
        payment_domain
      FROM payment_settings
      WHERE user_id = $1 AND mercadopago_enabled = true
    `, [userId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const settings = result.rows[0];
    
    return {
      access_token: decrypt(settings.mercadopago_access_token),
      public_key: decrypt(settings.mercadopago_public_key),
      payment_domain: settings.payment_domain
    };
    
  } catch (error) {
    console.error('❌ Erro ao buscar credenciais:', error);
    return null;
  }
}