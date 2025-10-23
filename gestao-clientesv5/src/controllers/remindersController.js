import { query } from '../config/database.js';

// Listar lembretes
export async function listReminders(req, res) {
  try {
    const result = await query(
      `SELECT r.*, t.name as template_name
       FROM reminders r
       LEFT JOIN message_templates t ON r.template_id = t.id
       WHERE r.user_id = $1
       ORDER BY r.days_offset ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List reminders error:', error);
    res.status(500).json({ error: 'Erro ao listar lembretes' });
  }
}

// Criar lembrete
export async function createReminder(req, res) {
  try {
    const { name, template_id, days_offset, send_time } = req.body;

    // Verifica se o template existe e pertence ao usuário
    const templateCheck = await query(
      'SELECT id FROM message_templates WHERE id = $1 AND user_id = $2',
      [template_id, req.user.id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Template não encontrado' });
    }

    const result = await query(
      `INSERT INTO reminders (user_id, name, template_id, days_offset, send_time, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, name, template_id, days_offset, send_time || '09:00:00', true]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Erro ao criar lembrete' });
  }
}

// Atualizar lembrete
export async function updateReminder(req, res) {
  try {
    const { id } = req.params;
    const { name, template_id, days_offset, send_time, is_active } = req.body;

    // Verifica se o template existe
    if (template_id) {
      const templateCheck = await query(
        'SELECT id FROM message_templates WHERE id = $1 AND user_id = $2',
        [template_id, req.user.id]
      );

      if (templateCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Template não encontrado' });
      }
    }

    const result = await query(
      `UPDATE reminders 
       SET name = $1, template_id = $2, days_offset = $3, send_time = $4, 
           is_active = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [name, template_id, days_offset, send_time, is_active, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lembrete não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Erro ao atualizar lembrete' });
  }
}

// Deletar lembrete
export async function deleteReminder(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lembrete não encontrado' });
    }

    res.json({ message: 'Lembrete excluído com sucesso' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Erro ao excluir lembrete' });
  }
}

// Buscar clientes que devem receber lembretes hoje
export async function getClientsForReminders(req, res) {
  try {
    const result = await query(
      `SELECT 
        c.id as client_id,
        c.name as client_name,
        c.whatsapp_number,
        c.due_date,
        r.id as reminder_id,
        r.name as reminder_name,
        r.days_offset,
        t.id as template_id,
        t.message as template_message,
        DATE_PART('day', c.due_date - CURRENT_DATE) as days_until_due
       FROM clients c
       CROSS JOIN reminders r
       LEFT JOIN message_templates t ON r.template_id = t.id
       WHERE c.user_id = $1 
       AND c.is_active = true
       AND r.is_active = true
       AND r.user_id = $1
       AND DATE_PART('day', c.due_date - CURRENT_DATE) = r.days_offset
       ORDER BY c.name`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get clients for reminders error:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
}
