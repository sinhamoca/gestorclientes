import { query } from '../config/database.js';

export async function listClients(req, res) {
  try {
    const { search, status } = req.query;
    
    let sql = `
      SELECT c.*, 
             p.name as plan_name, 
             p.duration_months,
             s.name as server_name,
             s.cost_per_screen
      FROM clients c
      LEFT JOIN plans p ON c.plan_id = p.id
      LEFT JOIN servers s ON c.server_id = s.id
      WHERE c.user_id = $1
    `;
    const params = [req.user.id];
    let paramCount = 2;

    if (search) {
      sql += ` AND (c.name ILIKE $${paramCount} OR c.whatsapp_number LIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (status === 'active') {
      sql += ` AND c.is_active = true`;
    } else if (status === 'inactive') {
      sql += ` AND c.is_active = false`;
    } else if (status === 'expiring') {
      sql += ` AND c.due_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'`;
    } else if (status === 'expired') {
      sql += ` AND c.due_date < NOW()`;
    }

    sql += ` ORDER BY c.name`;

    const result = await query(sql, params);

    // Adiciona status de vencimento
    const clients = result.rows.map(client => {
      const today = new Date();
      const dueDate = new Date(client.due_date);
      client.days_until_due = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      client.is_expired = dueDate < today;
      return client;
    });

    res.json(clients);
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
    const { register_payment = true, payment_method = 'pix' } = req.body; // ← Mudou para TRUE
    
    // Busca cliente com informações do plano e servidor
    const clientResult = await query(
      `SELECT c.*, p.duration_months, s.cost_per_screen 
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

    // Calcula nova data de vencimento
    const today = new Date();
    const baseDate = currentDueDate < today ? today : currentDueDate;
    
    const newDueDate = new Date(baseDate);
    newDueDate.setMonth(newDueDate.getMonth() + durationMonths);

    // Atualiza no banco
    const result = await query(
      `UPDATE clients 
       SET due_date = $1, is_active = true, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, name, due_date`,
      [newDueDate, id, req.user.id]
    );

    // Se solicitado, registra transação financeira
    let transaction = null;
    if (register_payment) {
      const amountReceived = parseFloat(client.price_value);
      const serverCost = parseFloat(client.cost_per_screen);
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
    }

    console.log(`🔄 Cliente renovado: ${client.name} - Nova data: ${newDueDate.toLocaleDateString('pt-BR')}`);

    res.json({
      message: 'Cliente renovado com sucesso',
      client: result.rows[0],
      durationMonths: durationMonths,
      transaction: transaction
    });

  } catch (error) {
    console.error('Renew client error:', error);
    res.status(500).json({ error: 'Erro ao renovar cliente' });
  }
}