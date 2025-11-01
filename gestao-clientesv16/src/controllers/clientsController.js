import { query } from '../config/database.js';
import { dispatchRenewalWebhook } from './webhookDispatcher.js';

export async function listClients(req, res) {
  try {
    const { search, status, page = 1, limit = 20, startDate, endDate, serverId, planId} = req.query;
    
    // Converter para números
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;
    
    let sql = `
      SELECT c.*, 
             p.name as plan_name, 
             p.duration_months,
             p.is_sigma_plan,
             p.is_live21_plan,
             p.is_koffice_plan,
             p.sigma_domain,
             p.sigma_plan_code,
             p.koffice_domain,
             p.num_screens,
             s.name as server_name,
             s.cost_per_screen,
             s.multiply_by_screens
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE c.user_id = $1
    `;
    const params = [req.user.id];
    let paramCount = 2;

    // Filtro de busca
    if (search) {
      sql += ` AND (c.name ILIKE $${paramCount} OR c.whatsapp_number LIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Filtro de status
    if (status === 'active') {
      sql += ` AND c.is_active = true AND c.due_date >= NOW()`;  // ← ATIVO E NÃO VENCIDO
    } else if (status === 'inactive') {
      sql += ` AND c.is_active = false`;
    } else if (status === 'expiring') {
      sql += ` AND c.is_active = true AND c.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`;  // ← ATIVO E VENCENDO
    } else if (status === 'expired') {
      sql += ` AND c.due_date < NOW()`;
    }
    // Filtro de servidor
    if (serverId) {
      sql += ` AND c.server_id = $${paramCount}`;
      params.push(serverId);
      paramCount++;
    }

    // Filtro de plano
    if (planId) {
      sql += ` AND c.plan_id = $${paramCount}`;
      params.push(planId);
      paramCount++;
    }

    // Filtro de período de vencimento
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

    // ========== CONTAR TOTAL (antes de aplicar LIMIT/OFFSET) ==========
    const countSql = sql
      .replace(/SELECT c\.\*,[\s\S]*?FROM/, 'SELECT COUNT(*) FROM')
      .replace(/ORDER BY.*$/, '');

    const countResult = await query(countSql, params);
    const totalClients = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalClients / limitNum);

    // ========== ADICIONAR ORDENAÇÃO + PAGINAÇÃO ==========
    sql += ` ORDER BY c.due_date ASC, c.name ASC`;
    sql += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limitNum, offset);

    const result = await query(sql, params);

    // Adiciona status de vencimento
    const clients = result.rows.map(client => {
      const today = new Date();
      const dueDate = new Date(client.due_date);
      client.days_until_due = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      client.is_expired = dueDate < today;
      return client;
    });

    // ========== RETORNAR COM METADADOS DE PAGINAÇÃO ==========
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
              p.koffice_domain,
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

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Erro ao buscar cliente' });
  }
}

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
      notes
    } = req.body;

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

    const result = await query(
      `INSERT INTO clients (
        user_id, name, whatsapp_number, plan_id, server_id, 
        price_value, due_date, username, password, mac_address, 
        device_key, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        req.user.id, name, whatsapp_number, plan_id, server_id,
        price_value, due_date, username, password, mac_address,
        device_key, notes
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ error: 'Erro ao criar cliente' });
  }
}

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
      is_active
    } = req.body;

    const result = await query(
      `UPDATE clients 
       SET name = $1, whatsapp_number = $2, plan_id = $3, server_id = $4,
           price_value = $5, due_date = $6, username = $7, password = $8,
           mac_address = $9, device_key = $10, notes = $11, is_active = $12,
           updated_at = NOW()
       WHERE id = $13 AND user_id = $14
       RETURNING *`,
      [
        name, whatsapp_number, plan_id, server_id, price_value, due_date,
        username, password, mac_address, device_key, notes, is_active,
        id, req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update client error:', error);
    res.status(500).json({ error: 'Erro ao atualizar cliente' });
  }
}

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

export async function renewClient(req, res) {
  try {
    const { id } = req.params;
    const { 
      register_payment = true, 
      payment_method = 'pix',
      renew_in_iptv = false  // ← NOVO PARÂMETRO!
    } = req.body;
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 [RENOVAÇÃO MANUAL] Iniciando...');
    console.log('='.repeat(60));
    console.log(`   Cliente ID: ${id}`);
    console.log(`   Registrar pagamento: ${register_payment}`);
    console.log(`   Renovar no IPTV: ${renew_in_iptv}`);
    
    // ========== BUSCAR DADOS COMPLETOS DO CLIENTE ==========
  const clientResult = await query(
    `SELECT 
      c.*, 
      p.name as plan_name,
      p.duration_months, 
      p.is_sigma_plan,
      p.is_live21_plan,
      p.is_koffice_plan,
      p.sigma_domain,
      p.sigma_plan_code,
      p.koffice_domain,
      p.num_screens,
      s.cost_per_screen,
      s.multiply_by_screens
    FROM clients c
    JOIN plans p ON c.plan_id = p.id
    JOIN servers s ON c.server_id = s.id
    WHERE c.id = $1 AND c.user_id = $2`,
    [id, req.user.id]
  );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clientResult.rows[0];
    const currentDueDate = new Date(client.due_date);
    const durationMonths = client.duration_months;

    console.log(`   Cliente: ${client.name}`);
    console.log(`   Plano: ${client.plan_name} (${durationMonths} meses)`);
    console.log(`   Is Sigma: ${client.is_sigma_plan || false}`);
    console.log(`   Is Live21: ${client.is_live21_plan || false}`);
    console.log(`   Is Koffice: ${client.is_koffice_plan || false}`);

    // ========== CALCULAR NOVA DATA DE VENCIMENTO ==========
    const today = new Date();
    const baseDate = currentDueDate < today ? today : currentDueDate;
    
    const newDueDate = new Date(baseDate);
    newDueDate.setMonth(newDueDate.getMonth() + durationMonths);

    console.log(`   Data anterior: ${currentDueDate.toLocaleDateString('pt-BR')}`);
    console.log(`   Nova data: ${newDueDate.toLocaleDateString('pt-BR')}`);

    // ========== ATUALIZAR CLIENTE NO BANCO ==========
    const result = await query(
      `UPDATE clients 
       SET due_date = $1, is_active = true, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, name, due_date`,
      [newDueDate, id, req.user.id]
    );

    console.log('✅ Cliente renovado no banco de dados');

    // ========== REGISTRAR TRANSAÇÃO FINANCEIRA (SE SOLICITADO) ==========
    let transaction = null;
    
    if (register_payment) {
      const amountReceived = parseFloat(client.price_value);
      
      // Calcular custo do servidor (com ou sem multiplicação por telas)
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
      if (!client.is_sigma_plan && !client.is_live21_plan && !client.is_koffice_plan) {
        console.warn('⚠️  Plano sem integração ativa, pulando renovação IPTV');
        iptvRenewal = {
          success: false,
          skipped: true,
          reason: 'no_integration'
        };
      } else if (!client.username) {
        console.warn('⚠️  Cliente sem username/ID configurado, pulando renovação IPTV');
        iptvRenewal = {
          success: false,
          skipped: true,
          reason: 'no_username'
        };
      } else {
        // Disparar webhook
        try {
          iptvRenewal = await dispatchRenewalWebhook({
            ...client,
            due_date: newDueDate,
            mercadopago_payment_id: null  // Renovação manual
          });
          
          if (iptvRenewal.success) {
            console.log('✅ Renovação no IPTV Manager concluída com sucesso!');
          } else if (iptvRenewal.skipped) {
            console.log(`ℹ️  Renovação IPTV ignorada: ${iptvRenewal.reason}`);
          } else {
            console.warn('⚠️  Renovação no IPTV Manager falhou');
          }
        } catch (webhookError) {
          console.error('❌ Erro no webhook:', webhookError.message);
          iptvRenewal = {
            success: false,
            error: webhookError.message
          };
        }
      }
    }

    console.log('');
    console.log('🎉 RENOVAÇÃO MANUAL CONCLUÍDA!');
    console.log('='.repeat(60) + '\n');

    // ========== RESPOSTA ==========
    res.json({
      success: true,
      message: 'Cliente renovado com sucesso',
      client: result.rows[0],
      durationMonths: durationMonths,
      transaction: transaction,
      iptv_renewal: iptvRenewal  // ← NOVO!
    });

  } catch (error) {
    console.error('❌ Erro ao renovar cliente:', error);
    res.status(500).json({ error: 'Erro ao renovar cliente' });
  }
}

// ========== BUSCAR FATURAS DO CLIENTE ==========
export async function getClientInvoices(req, res) {
  try {
    const { id } = req.params;
    
    console.log('📜 Buscando faturas do cliente:', id);
    
    // Verificar se o cliente pertence ao usuário
    const clientCheck = await query(
      'SELECT id FROM clients WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    
    // Buscar todas as faturas pagas do cliente
    const result = await query(`
      SELECT 
        id,
        amount_received,
        server_cost,
        net_profit,
        paid_date,
        payment_method,
        payment_gateway,
        gateway_payment_id,
        status
      FROM financial_transactions
      WHERE client_id = $1 
      AND status = 'paid'
      ORDER BY paid_date DESC
      LIMIT 100
    `, [id]);
    
    console.log(`✅ Encontradas ${result.rows.length} faturas para o cliente`);
    
    res.json({
      success: true,
      invoices: result.rows
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar faturas:', error);
    res.status(500).json({ error: 'Erro ao buscar faturas' });
  }
}