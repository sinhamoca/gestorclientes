// ========================================
// CLIENTS CONTROLLER - COM CRIPTOGRAFIA E2E
// Gerenciamento completo de clientes
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
    const { search, status, page = 1, limit = 20, startDate, endDate, serverId, planId } = req.query;

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

    // Filtro de busca
    if (search) {
      sql += ` AND c.name ILIKE $${paramCount}`;
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
      countSql += ` AND c.name ILIKE $${countParamIndex}`;
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
      client.days_until_due = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      client.is_expired = dueDate < today;
      
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
      password,
      mac_address,
      device_key,
      notes,
      player_type,
      player_domain 
    } = req.body;

    // ========================================
    // VALIDAÇÃO DE WHATSAPP (ADICIONAR AQUI)
    // ========================================
    const whatsappValidation = validateWhatsAppNumber(whatsapp_number);
    if (!whatsappValidation.valid) {
      return res.status(400).json({ 
        error: `Número de WhatsApp inválido: ${whatsappValidation.error}` 
      });
    }
    
    // Usar o número normalizado
    const validatedWhatsapp = whatsappValidation.number;
    console.log(`📱 WhatsApp validado: ${whatsapp_number} -> ${validatedWhatsapp}`);

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

    const result = await query(
      `INSERT INTO clients (
        user_id, name, whatsapp_number, whatsapp_number_encrypted, whatsapp_number_internal,
        plan_id, server_id, price_value, due_date, username, password, 
        mac_address, device_key, notes, player_type, player_domain
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        req.user.id, name, whatsappToSave, whatsappEncrypted, whatsappInternal,
        plan_id, server_id, price_value, due_date,
        username, password, mac_address, device_key, notes, 
        player_type || null, player_domain || null  // ← ADICIONAR
      ]
    );

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
      password,
      mac_address,
      device_key,
      notes,
      player_type,
      player_domain,
      is_active
    } = req.body;

    
    // ========================================
    // VALIDAÇÃO DE WHATSAPP (ADICIONAR AQUI)
    // ========================================
    let validatedWhatsapp = whatsapp_number;
    
    if (whatsapp_number) {
      const whatsappValidation = validateWhatsAppNumber(whatsapp_number);
      if (!whatsappValidation.valid) {
        return res.status(400).json({ 
          error: `Número de WhatsApp inválido: ${whatsappValidation.error}` 
        });
      }
      validatedWhatsapp = whatsappValidation.number;
      console.log(`📱 WhatsApp validado: ${whatsapp_number} -> ${validatedWhatsapp}`);
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

    const result = await query(
      `UPDATE clients 
      SET name = $1, whatsapp_number = $2, whatsapp_number_encrypted = $3, whatsapp_number_internal = $4,
          plan_id = $5, server_id = $6, price_value = $7, due_date = $8, 
          username = $9, password = $10, mac_address = $11, device_key = $12, 
          notes = $13, is_active = $14, player_type = $15, player_domain = $16,
          whatsapp_valid = true, whatsapp_error = NULL, whatsapp_checked_at = NULL,
          updated_at = NOW()
      WHERE id = $17 AND user_id = $18
      RETURNING *`,
      [
        name, whatsappToSave, whatsappEncrypted, whatsappInternal, plan_id, server_id, 
        price_value, due_date, username, password, mac_address, 
        device_key, notes, is_active, 
        player_type || null, player_domain || null,  // ← ADICIONAR
        id, req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

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

    const result = await query(
      'DELETE FROM clients WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ error: 'Erro ao excluir cliente' });
  }
}

/**
 * Estatísticas de clientes
 */
export async function getClientStats(req, res) {
  try {
    // Total de clientes
    const totalResult = await query(
      'SELECT COUNT(*) FROM clients WHERE user_id = $1',
      [req.user.id]
    );

    // Clientes ativos
    const activeResult = await query(
      'SELECT COUNT(*) FROM clients WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    // Vencidos
    const expiredResult = await query(
      'SELECT COUNT(*) FROM clients WHERE user_id = $1 AND due_date < NOW()',
      [req.user.id]
    );

    // Vencem em 7 dias
    const expiringSoonResult = await query(
      `SELECT COUNT(*) FROM clients 
       WHERE user_id = $1 AND due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`,
      [req.user.id]
    );

    res.json({
      total: parseInt(totalResult.rows[0].count),
      active: parseInt(activeResult.rows[0].count),
      expired: parseInt(expiredResult.rows[0].count),
      expiring_soon: parseInt(expiringSoonResult.rows[0].count)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

/**
 * Estatísticas expandidas com receita
 */
export async function getExpandedClientStats(req, res) {
  try {
    const baseStats = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN is_active = true THEN 1 END) as active,
         COUNT(CASE WHEN due_date < NOW() THEN 1 END) as expired,
         COUNT(CASE WHEN due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days' THEN 1 END) as expiring_soon,
         SUM(price_value) as total_revenue
       FROM clients 
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      total: parseInt(baseStats.rows[0].total),
      active: parseInt(baseStats.rows[0].active),
      expired: parseInt(baseStats.rows[0].expired),
      expiring_soon: parseInt(baseStats.rows[0].expiring_soon),
      total_revenue: parseFloat(baseStats.rows[0].total_revenue) || 0
    });
  } catch (error) {
    console.error('Expanded stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas expandidas' });
  }
}

/**
 * Renova um cliente
 */
export async function renewClient(req, res) {
  try {
    const { id } = req.params;
    const { 
      register_payment = true, 
      payment_method = 'pix',
      renew_in_iptv = false
    } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log(`🔄 Renovando cliente ID: ${id}`);
    console.log('='.repeat(60));

    // ========== BUSCAR DADOS COMPLETOS DO CLIENTE ==========
    const clientResult = await query(`
      SELECT 
        c.*,
        p.duration_months,
        p.num_screens,
        p.is_sigma_plan,
        p.is_live21_plan,
        p.is_koffice_plan,
        p.is_uniplay_plan,
        p.is_unitv_plan,
        p.is_club_plan,
        p.is_painelfoda_plan,
        p.sigma_domain,
        p.koffice_domain,
        p.painelfoda_domain,
        p.painelfoda_username,
        p.painelfoda_password,
        p.painelfoda_package_id,
        s.cost_per_screen,
        p.is_rush_plan,
        p.rush_type,
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
    const durationMonths = parseInt(client.duration_months || 1);

    console.log(`📋 Cliente: ${client.name}`);
    console.log(`📅 Duração: ${durationMonths} mês(es)`);
    console.log(`💰 Valor: R$ ${client.price_value}`);

    // ========== CALCULAR NOVA DATA DE VENCIMENTO ==========
    const currentDueDate = new Date(client.due_date);
    const today = new Date();
    const baseDate = currentDueDate > today ? currentDueDate : today;
    
    const newDueDate = new Date(baseDate);
    newDueDate.setMonth(newDueDate.getMonth() + durationMonths);

    console.log(`📆 Vencimento atual: ${currentDueDate.toISOString().split('T')[0]}`);
    console.log(`📆 Novo vencimento: ${newDueDate.toISOString().split('T')[0]}`);

    // ========== ATUALIZAR DATA DE VENCIMENTO NO BANCO ==========
    const updateResult = await query(
      'UPDATE clients SET due_date = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [newDueDate, id]
    );

    // ========== REGISTRAR TRANSAÇÃO FINANCEIRA ==========
    let transaction = null;
    
    if (register_payment) {
      console.log('\n💰 Registrando transação financeira...');
      
      const amountReceived = parseFloat(client.price_value);
      const serverCost = client.multiply_by_screens 
        ? parseFloat(client.cost_per_screen) * parseInt(client.num_screens || 1)
        : parseFloat(client.cost_per_screen);
      
      const netProfit = amountReceived - serverCost;

      const transactionResult = await query(`
        INSERT INTO financial_transactions 
        (user_id, client_id, type, amount_received, server_cost, net_profit, 
         due_date, paid_date, status, payment_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        req.user.id, id, 'renewal', amountReceived, serverCost, netProfit,
        newDueDate, new Date(), 'paid', payment_method
      ]);

      transaction = transactionResult.rows[0];
      console.log('💰 Transação financeira registrada');
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
          !client.is_rush_plan) {  // ← ADICIONAR
        console.warn('⚠️  Plano sem integração ativa, pulando renovação IPTV');
        iptvRenewal = {
          success: false,
          skipped: true,
          reason: 'no_integration'
        };
      } else if (!client.username && !client.is_unitv_plan && !client.is_painelfoda_plan && !client.is_rush_plan) {        console.warn('⚠️  Cliente sem username/ID configurado, pulando renovação IPTV');
        iptvRenewal = {
          success: false,
          skipped: true,
          reason: 'no_username'
        };
      } else {
        // Disparar webhook (você precisa ter essa função importada)
        try {
          // Import no topo do arquivo se não tiver:
          // import { dispatchRenewalWebhook } from './webhookDispatcher.js';
          
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