import { query } from '../config/database.js';

export async function listServers(req, res) {
  try {
    const result = await query(
      'SELECT * FROM servers WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List servers error:', error);
    res.status(500).json({ error: 'Erro ao listar servidores' });
  }
}

export async function createServer(req, res) {
  try {
    const { name, cost_per_screen, multiply_by_screens } = req.body;

    const existing = await query(
      'SELECT id FROM servers WHERE user_id = $1 AND name = $2',
      [req.user.id, name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Servidor já cadastrado' });
    }

    const result = await query(
      `INSERT INTO servers (user_id, name, cost_per_screen, multiply_by_screens)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, name, cost_per_screen, multiply_by_screens !== false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create server error:', error);
    res.status(500).json({ error: 'Erro ao criar servidor' });
  }
}

export async function updateServer(req, res) {
  try {
    const { id } = req.params;
    const { name, cost_per_screen, multiply_by_screens } = req.body;

    const result = await query(
      `UPDATE servers 
       SET name = $1, cost_per_screen = $2, multiply_by_screens = $3
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [name, cost_per_screen, multiply_by_screens !== false, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update server error:', error);
    res.status(500).json({ error: 'Erro ao atualizar servidor' });
  }
}

export async function deleteServer(req, res) {
  try {
    const { id } = req.params;

    const clientsCheck = await query(
      'SELECT COUNT(*) FROM clients WHERE server_id = $1',
      [id]
    );

    if (parseInt(clientsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir. Existem clientes usando este servidor.' 
      });
    }

    const result = await query(
      'DELETE FROM servers WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Servidor não encontrado' });
    }

    res.json({ message: 'Servidor excluído com sucesso' });
  } catch (error) {
    console.error('Delete server error:', error);
    res.status(500).json({ error: 'Erro ao excluir servidor' });
  }
}