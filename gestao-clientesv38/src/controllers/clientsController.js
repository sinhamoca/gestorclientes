// ========================================
// CLIENTS CONTROLLER - COM CRIPTOGRAFIA E2E
// Gerenciamento completo de clientes
// + SUPORTE A PAYMENT_TYPE (link/pix)
// ========================================

import { query } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';



/**
 * Valida e normaliza número de WhatsApp brasileiro
 * @param {string} input - Número digitado pelo usuário
 * @returns {{ valid: boolean, number: string, error: string }}
 */
function validateWhatsAppNumber(input) {
  if (!input || input.trim() === '') {
    return { valid: false, number: '', error: 'WhatsApp é obrigatório' };
  }

  // Remove tudo que não é número
  let cleaned = input.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Se não começar com 55, adiciona
  if (!cleaned.startsWith('55')) {
    cleaned = '55' + cleaned;
  }

  // Validar tamanho: 55 (2) + DDD (2) + Número (8 ou 9) = 12 ou 13 dígitos
  if (cleaned.length < 12) {
    return { 
      valid: false, 
      number: cleaned, 
      error: `Número incompleto (${cleaned.length} dígitos). Mínimo: 12 dígitos` 
    };
  }

  if (cleaned.length > 13) {
    return { 
      valid: false, 
      number: cleaned, 
      error: `Número muito longo (${cleaned.length} dígitos). Máximo: 13 dígitos` 
    };
  }

  // Validar DDD (11-99)
  const ddd = parseInt(cleaned.substring(2, 4));
  if (ddd < 11 || ddd > 99) {
    return { 
      valid: false, 
      number: cleaned, 
      error: `DDD inválido: ${ddd}` 
    };
  }

  // Se tem 13 dígitos, o 5º deve ser 9 (celular)
  if (cleaned.length === 13) {
    const fifthDigit = cleaned.charAt(4);
    if (fifthDigit !== '9') {
      return { 
        valid: false, 
        number: cleaned, 
        error: 'Celular de 13 dígitos deve ter 9 como 5º dígito' 
      };
    }
  }

  return { valid: true, number: cleaned, error: '' };
}

/**
 * Helper para descriptografar cliente
 */
function decryptClientData(client, encryptionKey) {
  if (!client || !encryptionKey) return client;
  
  try {
    // Descriptografa WhatsApp se existir versão criptografada
    if (client.whatsapp_number_encrypted) {
      client.whatsapp_number = decrypt(client.whatsapp_number_encrypted, encryptionKey);
    }
    
    // Descriptografa telefone se existir versão criptografada
    if (client.phone_encrypted) {
      client.phone = decrypt(client.phone_encrypted, encryptionKey);
    }
  } catch (error) {
    console.error('Erro ao descriptografar dados do cliente:', error);
    // Mantém os dados criptografados se falhar
  }
  
  return client;
}

/**
 * Lista todos os clientes do usuário com filtros e paginação
 */
export async function listClients(req, res) {
  try {
    const { search, status, page = 1, limit = 20, startDate, endDate, serverId, planId, payment_type } = req.query;

    let sql = `
      SELECT c.*, 
            p.name as plan_name,
            p.is_sigma_plan,
            p.is_live21_plan,
            p.is_koffice_plan,
            p.sigma_domain,
            p.sigma_plan_code,
            p.is_uniplay_plan,
            p.is_unitv_plan,
            p.is_club_plan,
            p.is_painelfoda_plan,
            p.koffice_domain,
            p.is_rush_plan,
            p.rush_type,
            s.name as server_name
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE c.user_id = $1
    `;

    const params = [req.user.id];
    let paramCount = 2;

    // Filtro de busca (nome - ignorando acentos)
    if (search) {
      sql += ` AND unaccent(c.name) ILIKE unaccent($${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Filtro de status
    if (status === 'active') {
      sql += ` AND c.is_active = true`;
    } else if (status === 'inactive') {
      sql += ` AND c.is_active = false`;
    } else if (status === 'expired') {
      sql += ` AND c.due_date < NOW()`;
    } else if (status === 'expiring_soon') {
      sql += ` AND c.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`;
    }

    // Filtro de data
    if (startDate) {
      sql += ` AND c.due_date >= $${paramCount}`;
      params.push(startDate);
      paramCount++;
    }
    if (endDate) {
      sql += ` AND c.due_date <= $${paramCount}`;
      params.push(endDate);
      paramCount++;
    }

    // Filtro de servidor
    if (serverId) {
      sql += ` AND c.server_id = $${paramCount}`;
      params.push(parseInt(serverId));
      paramCount++;
    }

    // Filtro de plano
    if (planId) {
      sql += ` AND c.plan_id = $${paramCount}`;
      params.push(parseInt(planId));
      paramCount++;
    }

    // 🆕 Filtro de tipo de pagamento
    if (payment_type) {
      sql += ` AND c.payment_type = $${paramCount}`;
      params.push(payment_type);
      paramCount++;
    }

    // Contar total para paginação
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Cria query de contagem a partir do SQL base
    let countSql = `
      SELECT COUNT(*)
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE c.user_id = $1
    `;

    // Adiciona os mesmos filtros da query principal
    let countParamIndex = 2;
    if (search) {
      countSql += ` AND unaccent(c.name) ILIKE unaccent($${countParamIndex})`;
      countParamIndex++;
    }
    if (status === 'active') {
      countSql += ` AND c.is_active = true`;
    } else if (status === 'inactive') {
      countSql += ` AND c.is_active = false`;
    } else if (status === 'expired') {
      countSql += ` AND c.due_date < NOW()`;
    } else if (status === 'expiring_soon') {
      countSql += ` AND c.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`;
    }
    if (startDate) {
      countSql += ` AND c.due_date >= $${countParamIndex}`;
      countParamIndex++;
    }
    if (endDate) {
      countSql += ` AND c.due_date <= $${countParamIndex}`;
      countParamIndex++;
    }
    if (serverId) {
      countSql += ` AND c.server_id = $${countParamIndex}`;
      countParamIndex++;
    }
    if (planId) {
      countSql += ` AND c.plan_id = $${countParamIndex}`;
      countParamIndex++;
    }
    // 🆕 Filtro de tipo de pagamento no count
    if (payment_type) {
      countSql += ` AND c.payment_type = $${countParamIndex}`;
      countParamIndex++;
    }

    const countResult = await query(countSql, params);
    const totalClients = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalClients / limitNum);

    // Ordenação + Paginação
    sql += ` ORDER BY c.due_date ASC, c.name ASC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limitNum, offset);

    const result = await query(sql, params);

    // 🔐 Descriptografa dados se tiver chave
    let clients = result.rows.map(client => {
      const today = new Date();
      const dueDate = new Date(client.due_date);
      
      // 🔥 CORREÇÃO: Comparar apenas datas (ignorando horário)
      const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      // Calcular diferença em dias
      const diffTime = dueDateOnly - todayDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      client.days_until_due = diffDays;
      client.expires_today = diffDays === 0;           // 🆕 Vence hoje
      client.is_expired = diffDays < 0;                // 🔥 Só é vencido se for ANTES de hoje
      
      // Descriptografa se tiver chave
      if (req.encryptionKey) {
        return decryptClientData(client, req.encryptionKey);
      }
      
      return client;
    });

    res.json({
      clients: clients,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalClients,
        totalPages: totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

/**
 * Busca um cliente específico
 */
export async function getClient(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*, 
              p.name as plan_name,
              p.is_sigma_plan,
              p.is_live21_plan,
              p.is_koffice_plan,
              p.sigma_domain,
              p.sigma_plan_code,
              p.is_uniplay_plan,
              p.is_unitv_plan,
              p.is_club_plan,
              p.is_painelfoda_plan,
              p.koffice_domain,
              p.is_rush_plan,
              p.rush_type,
              s.name as server_name
       FROM clients c
       LEFT JOIN plans p ON c.plan_id = p.id
       LEFT JOIN servers s ON c.server_id = s.id
       WHERE c.id = $1 AND c.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // 🔐 Descriptografa dados se tiver chave
    let client = result.rows[0];
    if (req.encryptionKey) {
      client = decryptClientData(client, req.encryptionKey);
    }

    res.json(client);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
}

/**
 * Cria um novo cliente
 */
export async function createClient(req, res) {
  try {
    const {
      name,
      whatsapp_number,
      plan_id,
      server_id,
      price_value,
      due_date,
      username,
      suffix,  
      password,
      mac_address,
      device_key,
      notes,
      player_type,
      player_domain,
      payment_type = 'link',  // 🆕 ADICIONAR - padrão: link
      skip_number_validation = false  // 🌍 Número sem tratamento
    } = req.body;

    // ========================================
    // VALIDAÇÃO DE WHATSAPP
    // ========================================
    let validatedWhatsapp = whatsapp_number;
    
    if (skip_number_validation) {
      // 🌍 Modo internacional/sem tratamento - aceita qualquer formato
      validatedWhatsapp = whatsapp_number?.replace(/\D/g, '') || '';
      
      if (!validatedWhatsapp) {
        return res.status(400).json({ 
          error: 'Número de WhatsApp é obrigatório' 
        });
      }
      
      console.log(`🌍 WhatsApp SEM tratamento: ${whatsapp_number} -> ${validatedWhatsapp}`);
    } else {
      // Validação padrão brasileira
      const whatsappValidation = validateWhatsAppNumber(whatsapp_number);
      if (!whatsappValidation.valid) {
        return res.status(400).json({ 
          error: `Número de WhatsApp inválido: ${whatsappValidation.error}` 
        });
      }
      validatedWhatsapp = whatsappValidation.number;
      console.log(`📱 WhatsApp validado: ${whatsapp_number} -> ${validatedWhatsapp}`);
    }

    // Verifica limite de clientes
    const countResult = await query(
      'SELECT COUNT(*) FROM clients WHERE user_id = $1',
      [req.user.id]
    );

    const userResult = await query(
      'SELECT max_clients FROM users WHERE id = $1',
      [req.user.id]
    );

    const currentCount = parseInt(countResult.rows[0].count);
    const maxClients = userResult.rows[0].max_clients;

    if (currentCount >= maxClients) {
      return res.status(400).json({ 
        error: `Limite de clientes atingido (${maxClients})` 
      });
    }

    // 🔐 CRIPTOGRAFIA DUPLA
    let whatsappToSave = validatedWhatsapp;
    let whatsappEncrypted = null;
    let whatsappInternal = null;

    if (validatedWhatsapp) {
      try {
        // CAMADA 1: Criptografia E2E (chave do usuário)
        if (req.encryptionKey) {
          whatsappEncrypted = encrypt(validatedWhatsapp, req.encryptionKey);

          whatsappToSave = null; // Não salva em texto plano
          console.log(`🔐 [E2E] WhatsApp criptografado com chave do usuário: ${name}`);
        }
        
        // CAMADA 2: Criptografia interna (chave do sistema)
        if (process.env.SYSTEM_ENCRYPTION_KEY) {
          whatsappInternal = encrypt(validatedWhatsapp, process.env.SYSTEM_ENCRYPTION_KEY);

          console.log(`🔒 [SYSTEM] WhatsApp criptografado com chave do sistema: ${name}`);
        } else {
          console.warn('⚠️  SYSTEM_ENCRYPTION_KEY não configurada! Lembretes automáticos não funcionarão.');
        }
      } catch (error) {
        console.error('Erro ao criptografar WhatsApp:', error);
        return res.status(400).json({ 
          error: 'Erro ao criptografar dados. Verifique as chaves de criptografia.' 
        });
      }
    }

    // 🆕 Gerar payment_token apenas se payment_type for 'link'
    const crypto = await import('crypto');
    const paymentToken = payment_type === 'link' 
      ? crypto.randomBytes(16).toString('hex')
      : null;

    const result = await query(
      `INSERT INTO clients (
        user_id, name, whatsapp_number, whatsapp_number_encrypted, whatsapp_number_internal,
        plan_id, server_id, price_value, due_date, username, suffix, password, 
        mac_address, device_key, notes, player_type, player_domain,
        payment_type, payment_token, skip_number_validation
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        req.user.id, name, whatsappToSave, whatsappEncrypted, whatsappInternal,
        plan_id, server_id, price_value, due_date,
        username, suffix || null, password, mac_address, device_key, notes, 
        player_type || null, player_domain || null,
        payment_type, paymentToken, skip_number_validation
      ]
    );

    console.log(`✅ Cliente criado: ${name} (payment_type: ${payment_type})`);

    // 🔐 Descriptografa para retornar ao frontend
    let client = result.rows[0];
    if (req.encryptionKey) {
      client = decryptClientData(client, req.encryptionKey);
    }

    res.status(201).json(client);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
}

/**
 * Atualiza um cliente existente
 */
export async function updateClient(req, res) {
  try {
    const { id } = req.params;
    const {
      name,
      whatsapp_number,
      plan_id,
      server_id,
      price_value,
      due_date,
      username,
      suffix,
      password,
      mac_address,
      device_key,
      notes,
      player_type,
      player_domain,
      is_active,
      payment_type,  // 🆕 ADICIONAR
      skip_number_validation  // 🌍 Número sem tratamento
    } = req.body;

    
    // ========================================
    // VALIDAÇÃO DE WHATSAPP
    // ========================================
    let validatedWhatsapp = whatsapp_number;
    
    if (whatsapp_number) {
      if (skip_number_validation) {
        // 🌍 Modo internacional/sem tratamento - aceita qualquer formato
        validatedWhatsapp = whatsapp_number?.replace(/\D/g, '') || '';
        
        if (!validatedWhatsapp) {
          return res.status(400).json({ 
            error: 'Número de WhatsApp é obrigatório' 
          });
        }
        
        console.log(`🌍 WhatsApp SEM tratamento: ${whatsapp_number} -> ${validatedWhatsapp}`);
      } else {
        // Validação padrão brasileira
        const whatsappValidation = validateWhatsAppNumber(whatsapp_number);
        if (!whatsappValidation.valid) {
          return res.status(400).json({ 
            error: `Número de WhatsApp inválido: ${whatsappValidation.error}` 
          });
        }
        validatedWhatsapp = whatsappValidation.number;
        console.log(`📱 WhatsApp validado: ${whatsapp_number} -> ${validatedWhatsapp}`);
      }
    }

    // 🔐 CRIPTOGRAFIA DUPLA
    let whatsappToSave = validatedWhatsapp;
    let whatsappEncrypted = null;
    let whatsappInternal = null;

    if (validatedWhatsapp) {
      try {
        // CAMADA 1: Criptografia E2E (chave do usuário)
        if (req.encryptionKey) {
          whatsappEncrypted = encrypt(validatedWhatsapp, req.encryptionKey);

          whatsappToSave = null;
          console.log(`🔐 [E2E] WhatsApp atualizado com chave do usuário para cliente ID: ${id}`);
        }
        
        // CAMADA 2: Criptografia interna (chave do sistema)
        if (process.env.SYSTEM_ENCRYPTION_KEY) {
          whatsappInternal = encrypt(validatedWhatsapp, process.env.SYSTEM_ENCRYPTION_KEY);

          console.log(`🔒 [SYSTEM] WhatsApp atualizado com chave do sistema para cliente ID: ${id}`);
        }
      } catch (error) {
        console.error('Erro ao criptografar WhatsApp:', error);
        return res.status(400).json({ 
          error: 'Erro ao criptografar dados. Verifique as chaves de criptografia.' 
        });
      }
    }

    // 🆕 Se mudou para 'link' e não tinha payment_token, gerar um
    let paymentToken = undefined;
    if (payment_type === 'link') {
      const clientResult = await query(
        'SELECT payment_token FROM clients WHERE id = $1',
        [id]
      );
      if (!clientResult.rows[0]?.payment_token) {
        const crypto = await import('crypto');
        paymentToken = crypto.randomBytes(16).toString('hex');
        console.log(`🔗 Gerando payment_token para cliente ${id} (mudou para tipo 'link')`);
      }
    }

    const result = await query(
      `UPDATE clients 
      SET name = $1, whatsapp_number = $2, whatsapp_number_encrypted = $3, whatsapp_number_internal = $4,
          plan_id = $5, server_id = $6, price_value = $7, due_date = $8, 
          username = $9, suffix = $10, password = $11, mac_address = $12, device_key = $13, 
          notes = $14, is_active = $15, player_type = $16, player_domain = $17,
          payment_type = COALESCE($18, payment_type),
          payment_token = COALESCE($19, payment_token),
          skip_number_validation = COALESCE($20, skip_number_validation),
          whatsapp_valid = true, whatsapp_error = NULL, whatsapp_checked_at = NULL,
          updated_at = NOW()
      WHERE id = $21 AND user_id = $22
      RETURNING *`,
      [
        name, whatsappToSave, whatsappEncrypted, whatsappInternal, plan_id, server_id, 
        price_value, due_date, username, suffix || null, password, mac_address, 
        device_key, notes, is_active, 
        player_type || null, player_domain || null,
        payment_type, paymentToken, skip_number_validation,
        id, req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    console.log(`✅ Cliente atualizado: ${name} (payment_type: ${payment_type || 'não alterado'})`);

    // 🔐 Descriptografa para retornar ao frontend
    let client = result.rows[0];
    if (req.encryptionKey) {
      client = decryptClientData(client, req.encryptionKey);
    }

    res.json(client);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}

/**
 * Deleta um cliente
 */
export async function deleteClient(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`🗑️  Iniciando deleção do cliente ${id} (user: ${userId})`);

    // 1. Verificar se cliente existe e pertence ao usuário
    const clientCheck = await query(
      'SELECT id, name FROM clients WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const clientName = clientCheck.rows[0].name;

    // 2. Deletar registros relacionados em ordem
    
    // 2.1 Deletar da fila de mensagens
    await query('DELETE FROM message_queue WHERE client_id = $1', [id]);
    console.log(`   ✅ Fila de mensagens limpa`);

    // 2.2 Deletar transações financeiras
    await query('DELETE FROM financial_transactions WHERE client_id = $1', [id]);
    console.log(`   ✅ Transações financeiras removidas`);

    // 2.3 Deletar sessões de pagamento
    await query('DELETE FROM payment_sessions WHERE client_id = $1', [id]);
    console.log(`   ✅ Sessões de pagamento removidas`);

    // 3. Finalmente deletar o cliente
    const result = await query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Erro ao deletar cliente' });
    }

    console.log(`   ✅ Cliente "${clientName}" deletado com sucesso!`);

    res.json({ 
      message: 'Cliente excluído com sucesso',
      deleted: {
        id: parseInt(id),
        name: clientName
      }
    });

  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
}

/**
 * Retorna estatísticas dos clientes
 */
export async function getClientStats(req, res) {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive,
        COUNT(CASE WHEN due_date < NOW() THEN 1 END) as expired,
        COUNT(CASE WHEN due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' THEN 1 END) as expiring_soon
      FROM clients
      WHERE user_id = $1
    `, [req.user.id]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

/**
 * Retorna estatísticas expandidas dos clientes
 * Inclui: total, active, expired, expired_30/60/90_days, total_received_year/month
 */
export async function getExpandedClientStats(req, res) {
  try {
    // Estatísticas de clientes
    const baseStats = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN is_active = true THEN 1 END) as active,
         COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as expired,
         COUNT(CASE WHEN due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as expiring_soon,
         COUNT(CASE WHEN due_date < CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as expired_30_days,
         COUNT(CASE WHEN due_date < CURRENT_DATE - INTERVAL '60 days' THEN 1 END) as expired_60_days,
         COUNT(CASE WHEN due_date < CURRENT_DATE - INTERVAL '90 days' THEN 1 END) as expired_90_days,
         SUM(price_value) as total_revenue
       FROM clients 
       WHERE user_id = $1`,
      [req.user.id]
    );

    // Lucro líquido no ano atual (da tabela financial_transactions)
    const yearStats = await query(
      `SELECT COALESCE(SUM(net_profit), 0) as total_received_year
       FROM financial_transactions 
       WHERE user_id = $1 
       AND status = 'paid'
       AND EXTRACT(YEAR FROM paid_date) = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [req.user.id]
    );

    // Lucro líquido no mês atual
    const monthStats = await query(
      `SELECT COALESCE(SUM(net_profit), 0) as total_received_month
       FROM financial_transactions 
       WHERE user_id = $1 
       AND status = 'paid'
       AND EXTRACT(YEAR FROM paid_date) = EXTRACT(YEAR FROM CURRENT_DATE)
       AND EXTRACT(MONTH FROM paid_date) = EXTRACT(MONTH FROM CURRENT_DATE)`,
      [req.user.id]
    );

    res.json({
      total: parseInt(baseStats.rows[0].total) || 0,
      active: parseInt(baseStats.rows[0].active) || 0,
      expired: parseInt(baseStats.rows[0].expired) || 0,
      expiring_soon: parseInt(baseStats.rows[0].expiring_soon) || 0,
      expired_30_days: parseInt(baseStats.rows[0].expired_30_days) || 0,
      expired_60_days: parseInt(baseStats.rows[0].expired_60_days) || 0,
      expired_90_days: parseInt(baseStats.rows[0].expired_90_days) || 0,
      total_revenue: parseFloat(baseStats.rows[0].total_revenue) || 0,
      total_received_year: parseFloat(yearStats.rows[0].total_received_year) || 0,
      total_received_month: parseFloat(monthStats.rows[0].total_received_month) || 0
    });
  } catch (error) {
    console.error('Expanded stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas expandidas' });
  }
}

// ========================================
// RENOVAR CLIENTE
// POST /api/clients/:id/renew
// ========================================
export async function renewClient(req, res) {
  try {
    const { id } = req.params;
    const { 
      duration_months = 1, 
      payment_method = 'pix', 
      register_payment = true,
      renew_in_iptv = false
    } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('🔄 RENOVAÇÃO MANUAL DE CLIENTE');
    console.log('='.repeat(60));
    console.log(`   Cliente ID: ${id}`);
    console.log(`   Duração: ${duration_months} mês(es)`);
    console.log(`   Método: ${payment_method}`);
    console.log(`   Registrar Pagamento: ${register_payment}`);
    console.log(`   Renovar IPTV: ${renew_in_iptv}`);

    // Buscar cliente com dados do plano e servidor
    const clientResult = await query(`
      SELECT c.*, 
             p.name as plan_name,
             p.duration_months as plan_duration,
             p.num_screens,
             p.is_sigma_plan,
             p.is_live21_plan,
             p.is_koffice_plan,
             p.is_uniplay_plan,
             p.is_unitv_plan,
             p.is_club_plan,
             p.is_painelfoda_plan,
             p.is_rush_plan,
             p.sigma_domain,
             p.sigma_plan_code,
             p.koffice_domain,
             p.rush_type,
             s.name as server_name,
             s.cost_per_screen,
             s.multiply_by_screens
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [id, req.user.id]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clientResult.rows[0];
    console.log(`   Nome: ${client.name}`);
    console.log(`   Plano: ${client.plan_name}`);

    // ========== CALCULAR NOVO VENCIMENTO ==========
    const durationMonths = parseInt(duration_months) || parseInt(client.plan_duration) || 1;
    
    // Se o cliente está vencido, começa a contar de HOJE
    // Se não está vencido, adiciona à data atual de vencimento
    const currentDueDate = new Date(client.due_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentDueDate.setHours(0, 0, 0, 0);

    let baseDate;
    if (currentDueDate < today) {
      // Cliente vencido - começa de hoje
      baseDate = today;
      console.log('   ⚠️  Cliente vencido - renovação começa de HOJE');
    } else {
      // Cliente em dia - adiciona à data atual
      baseDate = currentDueDate;
      console.log('   ✅ Cliente em dia - renovação estende a data atual');
    }

    const newDueDate = new Date(baseDate);
    newDueDate.setMonth(newDueDate.getMonth() + durationMonths);

    console.log(`   Data atual: ${client.due_date}`);
    console.log(`   Nova data: ${newDueDate.toISOString().split('T')[0]}`);

    // ========== ATUALIZAR CLIENTE E REGISTRAR PAGAMENTO ==========
    let updateResult = null;
    let transaction = null;
    
    if (register_payment) {
      console.log('\n💰 Registrando pagamento e atualizando vencimento...');
      
      // ✅ CORREÇÃO: UPDATE só acontece se register_payment = true
      updateResult = await query(
        'UPDATE clients SET due_date = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newDueDate, id]
      );
      
      const amountReceived = parseFloat(client.price_value);
      const serverCost = client.multiply_by_screens 
        ? parseFloat(client.cost_per_screen) * parseInt(client.num_screens || 1)
        : parseFloat(client.cost_per_screen);
      
      const netProfit = amountReceived - serverCost;

      const transactionResult = await query(`
        INSERT INTO financial_transactions 
        (user_id, client_id, client_name, type, amount_received, server_cost, net_profit, 
        due_date, paid_date, status, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        req.user.id, id, client.name, 'renewal', amountReceived, serverCost, netProfit,
        newDueDate, new Date(), 'paid', payment_method
      ]);

      transaction = transactionResult.rows[0];
      console.log('💰 Transação financeira registrada');
    } else {
      console.log('\n⏭️  Registro de pagamento não solicitado - due_date NÃO será alterado');
      // Apenas busca dados atuais do cliente sem alterar
      updateResult = await query(
        'SELECT * FROM clients WHERE id = $1',
        [id]
      );
    }

    // ========== RENOVAR NO IPTV MANAGER (SE SOLICITADO) ==========
    let iptvRenewal = null;

    if (renew_in_iptv) {
      console.log('\n🌐 Disparando renovação no IPTV Manager...');
      
      // Verificar se tem integração ativa
      if (!client.is_sigma_plan && 
          !client.is_live21_plan && 
          !client.is_koffice_plan && 
          !client.is_uniplay_plan && 
          !client.is_unitv_plan &&
          !client.is_club_plan &&
          !client.is_painelfoda_plan &&
          !client.is_rush_plan) {
        console.warn('⚠️  Plano sem integração ativa, pulando renovação IPTV');
        iptvRenewal = {
          success: false,
          skipped: true,
          reason: 'no_integration'
        };
      } else if (!client.username && !client.is_unitv_plan && !client.is_uniplay_plan && !client.is_painelfoda_plan && !client.is_rush_plan) {
        console.warn('⚠️  Cliente sem username/ID configurado, pulando renovação IPTV');
        iptvRenewal = {
          success: false,
          skipped: true,
          reason: 'no_username'
        };
      } else {
        // Disparar webhook
        try {
          const { dispatchRenewalWebhook } = await import('./webhookDispatcher.js');
          
          iptvRenewal = await dispatchRenewalWebhook({
            ...client,
            due_date: newDueDate,
            mercadopago_payment_id: null
          });
          
          if (iptvRenewal.success) {
            console.log('✅ Renovação no IPTV Manager concluída com sucesso!');
          } else {
            console.warn('⚠️  Renovação no IPTV Manager falhou:', iptvRenewal.error);
          }
        } catch (error) {
          console.error('❌ Erro ao disparar webhook IPTV:', error.message);
          iptvRenewal = {
            success: false,
            error: error.message
          };
        }
      }
    }

    console.log('='.repeat(60) + '\n');

    // ========== RESPOSTA ==========
    res.json({
      success: true,
      message: 'Cliente renovado com sucesso',
      client: updateResult.rows[0],
      durationMonths: durationMonths,
      transaction: transaction,
      iptv_renewal: iptvRenewal
    });

  } catch (error) {
    console.error('❌ Erro ao renovar cliente:', error);
    res.status(500).json({ error: 'Erro ao renovar cliente' });
  }
}

// ========================================
// ENVIAR FATURA VIA WHATSAPP
// POST /api/clients/:id/send-invoice
// ========================================
export async function sendInvoiceToClient(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log('\n📧 ========================================');
    console.log(`   ENVIAR FATURA PARA CLIENTE ${id}`);
    console.log('========================================');

    // ========== 1. BUSCAR CLIENTE ==========
    const clientResult = await query(`
      SELECT 
        c.id,
        c.name,
        c.whatsapp_number,
        c.whatsapp_number_internal,
        c.payment_token,
        c.payment_type,
        c.is_active
      FROM clients c
      WHERE c.id = $1 AND c.user_id = $2
    `, [id, userId]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clientResult.rows[0];

    // ========== 2. DESCRIPTOGRAFAR WHATSAPP ==========
    let whatsappNumber = client.whatsapp_number;
    
    if (client.whatsapp_number_internal && process.env.SYSTEM_ENCRYPTION_KEY) {
      try {
        whatsappNumber = decrypt(client.whatsapp_number_internal, process.env.SYSTEM_ENCRYPTION_KEY);
      } catch (err) {
        console.error('Erro ao descriptografar WhatsApp:', err);
      }
    }

    if (!whatsappNumber) {
      return res.status(400).json({ 
        error: 'Cliente sem WhatsApp',
        message: 'Este cliente não possui número de WhatsApp cadastrado'
      });
    }

    // ========== 3. VERIFICAR PAYMENT TOKEN (apenas para tipo 'link') ==========
    if (client.payment_type !== 'pix' && !client.payment_token) {
      return res.status(400).json({ 
        error: 'Sem link de pagamento',
        message: 'Este cliente não possui link de pagamento gerado'
      });
    }

    // ========== 4. VERIFICAR WHATSAPP CONECTADO ==========
    const instanceResult = await query(`
      SELECT instance_name, status, provider
      FROM whatsapp_instances 
      WHERE user_id = $1 AND status = 'connected'
    `, [userId]);

    if (instanceResult.rows.length === 0) {
      return res.status(400).json({ 
        error: 'WhatsApp não conectado',
        message: 'Conecte seu WhatsApp antes de enviar faturas'
      });
    }

    const instanceName = instanceResult.rows[0].instance_name;

    // ========== 5. MONTAR MENSAGEM ==========
    const paymentDomain = process.env.PAYMENT_DOMAIN || 'https://pagamentos.comprarecarga.shop';
    const paymentLink = `${paymentDomain}/pay/${client.payment_token}`;
    
    const message = `📋 Segue a Fatura:\n🔗 Link: ${paymentLink}`;

    console.log(`   👤 Cliente: ${client.name}`);
    console.log(`   📱 WhatsApp: ${whatsappNumber}`);
    console.log(`   🔗 Link: ${paymentLink}`);

    // ========== 6. ENVIAR MENSAGEM ==========
    const { sendTextMessage } = await import('./whatsappController.js');
    const { logWhatsApp } = await import('../services/activityLogService.js');

    try {
      await sendTextMessage(instanceName, whatsappNumber, message);

      // Registrar no log
      await logWhatsApp({
        userId,
        clientId: parseInt(id),
        clientName: client.name,
        whatsappNumber: whatsappNumber,
        success: true
      });

      console.log(`   ✅ Fatura enviada com sucesso!`);

      res.json({
        success: true,
        message: `Fatura enviada para ${client.name}`,
        whatsapp: whatsappNumber
      });

    } catch (error) {
      console.error(`   ❌ Erro ao enviar:`, error.message);

      await logWhatsApp({
        userId,
        clientId: parseInt(id),
        clientName: client.name,
        whatsappNumber: whatsappNumber,
        success: false,
        errorMessage: error.message
      });

      res.status(500).json({
        error: 'Erro ao enviar',
        message: error.message
      });
    }

  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Erro ao enviar fatura' });
  }
}

/**
 * Busca faturas de um cliente
 */
export async function getClientInvoices(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT ft.*
       FROM financial_transactions ft
       WHERE ft.client_id = $1 AND ft.user_id = $2
       ORDER BY ft.created_at DESC`,
      [id, req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Erro ao buscar faturas' });
  }
}