// ========================================
// ENCRYPTION CONTROLLER
// Gerenciamento de chaves de criptografia
// ========================================

import { query } from '../config/database.js';
import { generateEncryptionKey, encrypt, decrypt, testDecryptionKey } from '../utils/encryption.js';
import crypto from 'crypto';

/**
 * Gera uma nova chave de criptografia para o usuário
 * Chamado no primeiro acesso ou quando usuário quer renovar
 */
export async function setupEncryption(req, res) {
  try {
    const userId = req.user.id;

    // Verifica se usuário já tem criptografia configurada
    const userCheck = await query(
      'SELECT encryption_salt, test_encrypted FROM users WHERE id = $1',
      [userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userCheck.rows[0];

    if (user.encryption_salt && user.test_encrypted) {
      return res.status(400).json({ 
        error: 'Usuário já possui criptografia configurada',
        message: 'Use a rota de validação para verificar sua chave existente'
      });
    }

    // Gera nova chave
    const encryptionKey = generateEncryptionKey();
    const salt = crypto.randomBytes(16).toString('hex');

    // Cria dado de teste criptografado
    const testData = `test_${userId}_${Date.now()}`;
    const testEncrypted = encrypt(testData, encryptionKey);

    // Salva no banco
    await query(
      `UPDATE users 
       SET encryption_salt = $1, test_encrypted = $2, updated_at = NOW()
       WHERE id = $3`,
      [salt, testEncrypted, userId]
    );

    console.log(`🔐 Criptografia configurada para usuário ${userId}`);

    res.json({
      success: true,
      encryptionKey,
      message: 'GUARDE ESTA CHAVE EM LOCAL SEGURO! Sem ela, você não poderá acessar seus dados criptografados.',
      warning: 'Esta chave será mostrada apenas uma vez. Nem mesmo o administrador pode recuperá-la.'
    });

  } catch (error) {
    console.error('Setup encryption error:', error);
    res.status(500).json({ error: 'Erro ao configurar criptografia' });
  }
}

/**
 * Valida se a chave fornecida está correta
 * Chamado no login para verificar a chave antes de permitir acesso
 */
export async function validateEncryptionKey(req, res) {
  try {
    const userId = req.user.id;
    const { encryptionKey } = req.body;

    if (!encryptionKey || encryptionKey.length !== 64) {
      return res.status(400).json({ error: 'Chave de criptografia inválida' });
    }

    // Busca dado de teste
    const userResult = await query(
      'SELECT test_encrypted FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const testEncrypted = userResult.rows[0].test_encrypted;

    if (!testEncrypted) {
      return res.status(400).json({ 
        error: 'Criptografia não configurada',
        message: 'Configure a criptografia primeiro'
      });
    }

    // Testa se consegue descriptografar
    const isValid = testDecryptionKey(testEncrypted, encryptionKey);

    if (isValid) {
      console.log(`✅ Chave validada para usuário ${userId}`);
      res.json({ 
        success: true, 
        valid: true,
        message: 'Chave de criptografia válida' 
      });
    } else {
      console.warn(`❌ Chave inválida para usuário ${userId}`);
      res.status(401).json({ 
        success: false,
        valid: false,
        error: 'Chave de criptografia incorreta' 
      });
    }

  } catch (error) {
    console.error('Validate encryption key error:', error);
    res.status(500).json({ error: 'Erro ao validar chave' });
  }
}

/**
 * Verifica se usuário tem criptografia configurada
 */
export async function checkEncryptionStatus(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT encryption_salt, test_encrypted FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    const hasEncryption = !!(user.encryption_salt && user.test_encrypted);

    res.json({
      hasEncryption,
      configured: hasEncryption
    });

  } catch (error) {
    console.error('Check encryption status error:', error);
    res.status(500).json({ error: 'Erro ao verificar status de criptografia' });
  }
}

/**
 * PERIGO: Redefine a criptografia (perde todos os dados criptografados)
 * Só use se o usuário perdeu a chave e aceita perder os dados
 */
export async function resetEncryption(req, res) {
  try {
    const userId = req.user.id;
    const { confirmReset } = req.body;

    if (!confirmReset) {
      return res.status(400).json({ 
        error: 'Confirmação necessária',
        message: 'Você deve confirmar que entende que TODOS os dados criptografados serão perdidos'
      });
    }

    // Limpa campos criptografados de todos os clientes
    await query(
      `UPDATE clients 
       SET whatsapp_number_encrypted = NULL, phone_encrypted = NULL
       WHERE user_id = $1`,
      [userId]
    );

    // Remove configuração de criptografia
    await query(
      `UPDATE users 
       SET encryption_salt = NULL, test_encrypted = NULL, updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    console.log(`⚠️  Criptografia resetada para usuário ${userId} - DADOS PERDIDOS`);

    res.json({
      success: true,
      message: 'Criptografia resetada. Configure uma nova chave para continuar usando o sistema.'
    });

  } catch (error) {
    console.error('Reset encryption error:', error);
    res.status(500).json({ error: 'Erro ao resetar criptografia' });
  }
}
