import bcrypt from 'bcrypt';
import { query } from '../config/database.js';

export async function listUsers(req, res) {
  try {
    const { search, role, status } = req.query;
    
    let sql = `
      SELECT id, name, email, phone, role, subscription_start, subscription_end, 
             is_active, max_clients, max_instances, created_at
      FROM users 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (search) {
      sql += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (role) {
      sql += ` AND role = $${paramCount}`;
      params.push(role);
      paramCount++;
    }

    if (status === 'active') {
      sql += ` AND is_active = true`;
    } else if (status === 'inactive') {
      sql += ` AND is_active = false`;
    } else if (status === 'expired') {
      sql += ` AND role = 'user' AND subscription_end < NOW()`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await query(sql, params);

    // Adiciona status de vencimento
    const users = result.rows.map(user => {
      if (user.role === 'user' && user.subscription_end) {
        const today = new Date();
        const endDate = new Date(user.subscription_end);
        user.is_expired = endDate < today;
        user.days_remaining = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
      }
      return user;
    });

    res.json(users);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Erro ao listar usuários' });
  }
}

export async function getUser(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, name, email, phone, role, subscription_start, subscription_end, 
              is_active, max_clients, max_instances, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

export async function createUser(req, res) {
  try {
    const { 
      name, 
      email, 
      password, 
      phone,
      subscription_months,
      max_clients,
      max_instances
    } = req.body;

    // Verifica se email já existe
    const emailCheck = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Calcula datas de assinatura
    const subscriptionStart = new Date();
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + parseInt(subscription_months));

    // Cria usuário
    const result = await query(
      `INSERT INTO users 
       (name, email, password_hash, phone, role, subscription_start, subscription_end, 
        max_clients, max_instances, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, email, phone, subscription_start, subscription_end, is_active`,
      [
        name, 
        email, 
        passwordHash, 
        phone,
        'user',
        subscriptionStart,
        subscriptionEnd,
        max_clients || 100,
        max_instances || 1,
        true
      ]
    );

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      phone,
      subscription_months,
      max_clients,
      max_instances,
      is_active
    } = req.body;

    // Verifica se usuário existe
    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Não permite editar admin
    if (userCheck.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'Não é possível editar administrador' });
    }

    // Verifica se novo email já existe (se mudou)
    if (email) {
      const emailCheck = await query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
    }

    // Monta query de update
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email) {
      updates.push(`email = $${paramCount++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (max_clients) {
      updates.push(`max_clients = $${paramCount++}`);
      values.push(max_clients);
    }
    if (max_instances) {
      updates.push(`max_instances = $${paramCount++}`);
      values.push(max_instances);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    // Renovação de assinatura
    if (subscription_months) {
      const newEndDate = new Date();
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(subscription_months));
      updates.push(`subscription_end = $${paramCount++}`);
      values.push(newEndDate);
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, phone, subscription_start, subscription_end, 
                is_active, max_clients, max_instances
    `;

    const result = await query(sql, values);

    res.json({
      message: 'Usuário atualizado com sucesso',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Verifica se existe
    const userCheck = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Não permite deletar admin
    if (userCheck.rows[0].role === 'admin') {
      return res.status(400).json({ error: 'Não é possível deletar administrador' });
    }

    // Deleta usuário (CASCADE vai deletar dados relacionados)
    await query('DELETE FROM users WHERE id = $1', [id]);

    res.json({ message: 'Usuário deletado com sucesso' });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
}

export async function getDashboardStats(req, res) {
  try {
    // Total de usuários
    const totalResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'user'"
    );

    // Usuários ativos
    const activeResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'user' AND is_active = true"
    );

    // Usuários vencidos
    const expiredResult = await query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'user' AND subscription_end < NOW()"
    );

    // Usuários que vencem nos próximos 7 dias
    const expiringSoonResult = await query(
      `SELECT COUNT(*) as count FROM users 
       WHERE role = 'user' 
       AND subscription_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'`
    );

    // Novos usuários no mês
    const newThisMonthResult = await query(
      `SELECT COUNT(*) as count FROM users 
       WHERE role = 'user' 
       AND created_at >= DATE_TRUNC('month', NOW())`
    );

    res.json({
      total: parseInt(totalResult.rows[0].count),
      active: parseInt(activeResult.rows[0].count),
      expired: parseInt(expiredResult.rows[0].count),
      expiring_soon: parseInt(expiringSoonResult.rows[0].count),
      new_this_month: parseInt(newThisMonthResult.rows[0].count)
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}

// No getDashboardStats, adicionar contagem de clientes por usuário:
export async function getUsersWithClientCount(req, res) {
  try {
    const result = await query(`
      SELECT u.id, u.name, u.email, u.subscription_end, u.is_active,
             COUNT(c.id) as client_count
      FROM users u
      LEFT JOIN clients c ON c.user_id = u.id
      WHERE u.role = 'user'
      GROUP BY u.id
      ORDER BY u.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get users with client count error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}