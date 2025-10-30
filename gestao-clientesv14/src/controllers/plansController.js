// gestao-clientesv13/src/controllers/plansController.js
import { query } from '../config/database.js';

export async function listPlans(req, res) {
  try {
    const result = await query(
      'SELECT * FROM plans WHERE user_id = $1 ORDER BY name',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List plans error:', error);
    res.status(500).json({ error: 'Erro ao listar planos' });
  }
}

export async function createPlan(req, res) {
  try {
    const { name, duration_months, num_screens, is_sigma_plan, sigma_plan_code, is_live21_plan } = req.body;

    // Validação do num_screens
    if (!num_screens || num_screens < 1) {
      return res.status(400).json({ error: 'Quantidade de telas deve ser no mínimo 1' });
    }

    // Validação do Plano Sigma
    if (is_sigma_plan && (!sigma_plan_code || sigma_plan_code.trim() === '')) {
      return res.status(400).json({ error: 'Código do plano é obrigatório para Planos Sigma' });
    }

    // Verifica se já existe
    const existing = await query(
      'SELECT id FROM plans WHERE user_id = $1 AND name = $2',
      [req.user.id, name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Plano já cadastrado' });
    }

    const result = await query(
      `INSERT INTO plans (user_id, name, duration_months, num_screens, is_sigma_plan, sigma_plan_code, is_live21_plan)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, name, duration_months, num_screens, is_sigma_plan || false, sigma_plan_code || null, is_live21_plan || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Erro ao criar plano' });
  }
}

export async function updatePlan(req, res) {
  try {
    const { id } = req.params;
    const { name, duration_months, num_screens, is_sigma_plan, sigma_plan_code, is_live21_plan } = req.body;

    // Validação do num_screens
    if (!num_screens || num_screens < 1) {
      return res.status(400).json({ error: 'Quantidade de telas deve ser no mínimo 1' });
    }

    // Validação do Plano Sigma
    if (is_sigma_plan && (!sigma_plan_code || sigma_plan_code.trim() === '')) {
      return res.status(400).json({ error: 'Código do plano é obrigatório para Planos Sigma' });
    }

    const result = await query(
      `UPDATE plans 
       SET name = $1, duration_months = $2, num_screens = $3, is_sigma_plan = $4, sigma_plan_code = $5, is_live21_plan = $6
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [name, duration_months, num_screens, is_sigma_plan || false, sigma_plan_code || null, is_live21_plan || false, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Erro ao atualizar plano' });
  }
}

export async function deletePlan(req, res) {
  try {
    const { id } = req.params;

    // Verifica se tem clientes usando
    const clientsCheck = await query(
      'SELECT COUNT(*) FROM clients WHERE plan_id = $1',
      [id]
    );

    if (parseInt(clientsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir. Existem clientes usando este plano.' 
      });
    }

    const result = await query(
      'DELETE FROM plans WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    res.json({ message: 'Plano excluído com sucesso' });
  } catch (error) {
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Erro ao excluir plano' });
  }
}
