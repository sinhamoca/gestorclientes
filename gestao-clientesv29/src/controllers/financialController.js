/* ========================================
   FINANCIAL CONTROLLER - CORRIGIDO
   src/controllers/financialController.js
   ======================================== */

import { query } from '../config/database.js';

// ========== DASHBOARD FINANCEIRO ==========
export async function getFinancialDashboard(req, res) {
  try {
    const userId = req.user.id;
    const { month, year } = req.query;
    
    // Se não especificado, usa mês/ano atual
    const targetDate = month && year 
      ? new Date(year, month - 1, 1) 
      : new Date();
    
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);

    // 1. RECEITA BRUTA - Baseada na due_date ORIGINAL das transações + clientes que ainda não pagaram
    const revenueExpected = await query(`
      SELECT 
        COUNT(DISTINCT COALESCE(ft.client_id, c.id)) as total_clients,
        COALESCE(SUM(DISTINCT COALESCE(ft.amount_received, c.price_value)), 0) as gross_revenue
      FROM clients c
      LEFT JOIN financial_transactions ft ON (
        ft.client_id = c.id 
        AND DATE_TRUNC('month', ft.due_date) = DATE_TRUNC('month', $2::date)
      )
      WHERE c.user_id = $1
      AND c.is_active = true
      AND (
        c.due_date BETWEEN $2 AND $3
        OR DATE_TRUNC('month', ft.due_date) = DATE_TRUNC('month', $2::date)
      )
    `, [userId, startOfMonth, endOfMonth]);

    // 2. CUSTOS TOTAIS - Considera multiply_by_screens do servidor
    const costsResult = await query(`
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN s.multiply_by_screens = true 
            THEN s.cost_per_screen * COALESCE(p.num_screens, 1)
            ELSE s.cost_per_screen
          END
        ), 0) as total_cost
      FROM clients c
      JOIN servers s ON c.server_id = s.id
      LEFT JOIN plans p ON c.plan_id = p.id
      WHERE c.user_id = $1
      AND c.is_active = true
      AND c.due_date BETWEEN $2 AND $3
    `, [userId, startOfMonth, endOfMonth]);

    const grossRevenue = parseFloat(revenueExpected.rows[0].gross_revenue);
    const totalCost = parseFloat(costsResult.rows[0].total_cost);
    const netProfit = grossRevenue - totalCost;

    // 3. JÁ RECEBIDOS - Soma dos pagamentos FEITOS no mês
    const receivedResult = await query(`
      SELECT 
        COUNT(*) as paid_count,
        COALESCE(SUM(amount_received), 0) as amount_received
      FROM financial_transactions
      WHERE user_id = $1
      AND status = 'paid'
      AND paid_date BETWEEN $2 AND $3
    `, [userId, startOfMonth, endOfMonth]);

    // 4. LUCRO LÍQUIDO ATUAL - Já Recebido MENOS os custos dos clientes que JÁ PAGARAM
    const currentProfitResult = await query(`
      SELECT 
        COALESCE(SUM(
          ft.amount_received - 
          CASE 
            WHEN s.multiply_by_screens = true 
            THEN s.cost_per_screen * COALESCE(p.num_screens, 1)
            ELSE s.cost_per_screen
          END
        ), 0) as current_net_profit
      FROM financial_transactions ft
      JOIN clients c ON ft.client_id = c.id
      JOIN servers s ON c.server_id = s.id
      LEFT JOIN plans p ON c.plan_id = p.id
      WHERE ft.user_id = $1
      AND ft.status = 'paid'
      AND ft.paid_date BETWEEN $2 AND $3
    `, [userId, startOfMonth, endOfMonth]);

    // 5. PENDENTES - Clientes do mês que ainda NÃO pagaram
    const pendingResult = await query(`
      SELECT 
        COUNT(*) as pending_count,
        COALESCE(SUM(c.price_value), 0) as pending_revenue
      FROM clients c
      WHERE c.user_id = $1
      AND c.is_active = true
      AND c.due_date BETWEEN $2 AND $3
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft
        WHERE ft.client_id = c.id 
        AND ft.status = 'paid'
        AND DATE_TRUNC('month', ft.paid_date) = DATE_TRUNC('month', $2::date)
      )
    `, [userId, startOfMonth, endOfMonth]); 

    // 6. VENCIDOS - Clientes que venceram e ainda não pagaram
    const overdueResult = await query(`
      SELECT 
        COUNT(*) as overdue_count,
        COALESCE(SUM(price_value), 0) as overdue_revenue
      FROM clients
      WHERE user_id = $1
      AND is_active = true
      AND due_date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM financial_transactions ft
        WHERE ft.client_id = clients.id 
        AND ft.status = 'paid'
        AND ft.paid_date > clients.due_date
      )
    `, [userId]);

    // 7. EVOLUÇÃO MENSAL (últimos 6 meses) - Baseado em pagamentos
    const evolution = await query(`
      SELECT 
        TO_CHAR(paid_date, 'Mon/YY') as month,
        COALESCE(SUM(amount_received), 0) as revenue,
        COALESCE(SUM(amount_received - server_cost), 0) as profit
      FROM financial_transactions
      WHERE user_id = $1
      AND status = 'paid'
      AND paid_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(paid_date, 'YYYY-MM'), TO_CHAR(paid_date, 'Mon/YY')
      ORDER BY TO_CHAR(paid_date, 'YYYY-MM')
    `, [userId]);

    // 8. TOP PLANOS (mais rentáveis) - Baseado em TODOS os clientes ativos
    const topPlans = await query(`
      SELECT 
        p.name as plan_name,
        COUNT(c.id) as client_count,
        COALESCE(SUM(c.price_value), 0) as total_revenue,
        p.num_screens
      FROM clients c
      JOIN plans p ON c.plan_id = p.id
      WHERE c.user_id = $1
      AND c.is_active = true
      AND c.due_date BETWEEN $2 AND $3
      GROUP BY p.id, p.name, p.num_screens
      ORDER BY total_revenue DESC
      LIMIT 5
    `, [userId, startOfMonth, endOfMonth]);

    // 9. LUCRO LÍQUIDO ANUAL - Soma de TODOS os pagamentos do ano
    const startOfYear = new Date(targetDate.getFullYear(), 0, 1);
    const endOfYear = new Date(targetDate.getFullYear(), 11, 31, 23, 59, 59);
    
    const yearlyProfitResult = await query(`
      SELECT 
        COALESCE(SUM(amount_received), 0) as total_received,
        COALESCE(SUM(server_cost), 0) as total_cost,
        COALESCE(SUM(amount_received - server_cost), 0) as net_profit
      FROM financial_transactions
      WHERE user_id = $1
      AND status = 'paid'
      AND paid_date BETWEEN $2 AND $3
    `, [userId, startOfYear, endOfYear]);

    res.json({
      month: targetDate.getMonth() + 1,
      year: targetDate.getFullYear(),
      summary: {
        gross_revenue: grossRevenue,
        total_cost: totalCost,
        net_profit: netProfit,
        profit_margin: grossRevenue > 0 ? 
          ((netProfit / grossRevenue) * 100).toFixed(2) : 0,
        total_clients: parseInt(revenueExpected.rows[0].total_clients)
      },
      received: {
        count: parseInt(receivedResult.rows[0].paid_count),
        amount: parseFloat(receivedResult.rows[0].amount_received)
      },
      current_profit: {
        amount: parseFloat(currentProfitResult.rows[0].current_net_profit)
      },
      yearly_profit: {
        total_received: parseFloat(yearlyProfitResult.rows[0].total_received),
        total_cost: parseFloat(yearlyProfitResult.rows[0].total_cost),
        net_profit: parseFloat(yearlyProfitResult.rows[0].net_profit)
      },
      pending: {
        count: parseInt(pendingResult.rows[0].pending_count),
        amount: parseFloat(pendingResult.rows[0].pending_revenue)
      },
      overdue: {
        count: parseInt(overdueResult.rows[0].overdue_count),
        amount: parseFloat(overdueResult.rows[0].overdue_revenue)
      },
      evolution: evolution.rows,
      top_plans: topPlans.rows
    });

  } catch (error) {
    console.error('Financial dashboard error:', error);
    res.status(500).json({ error: 'Erro ao buscar dados financeiros' });
  }
}

// ========== REGISTRAR PAGAMENTO ==========
export async function registerPayment(req, res) {
  try {
    const userId = req.user.id;
    const { client_id, payment_method, paid_date, notes } = req.body;

    // Busca dados do cliente COM multiply_by_screens do servidor
    const clientResult = await query(`
      SELECT 
        c.*, 
        s.cost_per_screen, 
        s.multiply_by_screens,
        COALESCE(p.num_screens, 1) as num_screens
      FROM clients c
      JOIN servers s ON c.server_id = s.id
      LEFT JOIN plans p ON c.plan_id = p.id
      WHERE c.id = $1 AND c.user_id = $2
    `, [client_id, userId]);

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const client = clientResult.rows[0];
    const amountReceived = parseFloat(client.price_value);
    
    // Calcula custo baseado no multiply_by_screens
    const serverCost = client.multiply_by_screens 
      ? parseFloat(client.cost_per_screen) * parseInt(client.num_screens)
      : parseFloat(client.cost_per_screen);
    
    const netProfit = amountReceived - serverCost;

    // Registra transação
    const result = await query(`
      INSERT INTO financial_transactions 
      (user_id, client_id, type, amount_received, server_cost, net_profit, 
       due_date, paid_date, status, payment_method, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      userId, client_id, 'renewal', amountReceived, serverCost, netProfit,
      client.due_date, paid_date || new Date(), 'paid', payment_method, notes
    ]);

    res.status(201).json({
      message: 'Pagamento registrado com sucesso',
      transaction: result.rows[0]
    });

  } catch (error) {
    console.error('Register payment error:', error);
    res.status(500).json({ error: 'Erro ao registrar pagamento' });
  }
}

// ========== LISTAR TRANSAÇÕES ==========
export async function listTransactions(req, res) {
  try {
    const userId = req.user.id;
    const { status, startDate, endDate, limit = 50 } = req.query;

    let sql = `
      SELECT 
        ft.*,
        c.name as client_name,
        c.whatsapp_number
      FROM financial_transactions ft
      JOIN clients c ON ft.client_id = c.id
      WHERE ft.user_id = $1
    `;
    const params = [userId];
    let paramCount = 2;

    if (status) {
      sql += ` AND ft.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (startDate && endDate) {
      sql += ` AND ft.paid_date BETWEEN $${paramCount} AND $${paramCount + 1}`;
      params.push(startDate, endDate);
      paramCount += 2;
    }

    sql += ` ORDER BY ft.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await query(sql, params);
    res.json(result.rows);

  } catch (error) {
    console.error('List transactions error:', error);
    res.status(500).json({ error: 'Erro ao listar transações' });
  }
}