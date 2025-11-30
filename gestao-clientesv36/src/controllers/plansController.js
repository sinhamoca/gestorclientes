// ========================================
// PLANS CONTROLLER - COM SUPORTE PAINELFODA
// ATUALIZADO: Agora salva todos os campos do PainelFoda
// ========================================

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
    const { 
      name, 
      duration_months, 
      num_screens, 
      is_sigma_plan, 
      sigma_plan_code,
      sigma_domain,
      is_live21_plan,
      is_koffice_plan,
      koffice_domain,
      is_uniplay_plan,
      is_unitv_plan,
      is_club_plan,
      // ← NOVO: PAINELFODA
      is_painelfoda_plan,
      painelfoda_domain,
      painelfoda_username,
      painelfoda_password,
      painelfoda_package_id,
      is_rush_plan,
      rush_type
    } = req.body;

    // ========== VALIDAÇÕES ==========
    
    // Validação do num_screens
    if (!num_screens || num_screens < 1) {
      return res.status(400).json({ error: 'Quantidade de telas deve ser no mínimo 1' });
    }

    // Validação do Plano Sigma
    if (is_sigma_plan && (!sigma_plan_code || sigma_plan_code.trim() === '')) {
      return res.status(400).json({ error: 'Código do plano é obrigatório para Planos Sigma' });
    }

    // Validação do Plano Koffice
    if (is_koffice_plan && (!koffice_domain || koffice_domain.trim() === '')) {
      return res.status(400).json({ error: 'Domínio é obrigatório para Planos Koffice' });
    }

    // Validação do Plano Rush
    if (is_rush_plan) {
      if (!rush_type || !['IPTV', 'P2P'].includes(rush_type.toUpperCase())) {
        return res.status(400).json({ 
          error: 'Tipo do plano Rush é obrigatório (IPTV ou P2P)' 
        });
      }
    }

    // Validação do Plano PainelFoda
    if (is_painelfoda_plan) {
      if (!painelfoda_domain || painelfoda_domain.trim() === '') {
        return res.status(400).json({ error: 'Domínio é obrigatório para Planos PainelFoda' });
      }
      if (!painelfoda_username || painelfoda_username.trim() === '') {
        return res.status(400).json({ error: 'Usuário é obrigatório para Planos PainelFoda' });
      }
      if (!painelfoda_password || painelfoda_password.trim() === '') {
        return res.status(400).json({ error: 'Senha é obrigatória para Planos PainelFoda' });
      }
      if (!painelfoda_package_id || painelfoda_package_id.trim() === '') {
        return res.status(400).json({ error: 'Package ID é obrigatório para Planos PainelFoda' });
      }
    }

    // Validação: Não pode ser mais de um tipo ao mesmo tempo (TODOS SÃO EXCLUSIVOS)
    const typeCount = [
      is_sigma_plan, 
      is_live21_plan, 
      is_koffice_plan, 
      is_uniplay_plan, 
      is_unitv_plan,
      is_club_plan,
      is_painelfoda_plan,
      is_rush_plan
    ].filter(Boolean).length;
    
    if (typeCount > 1) {
      return res.status(400).json({ 
        error: 'Plano não pode ter múltiplos tipos simultaneamente. Escolha apenas um tipo: Sigma, Live21, Koffice, Uniplay, UniTV, Club, PainelFoda ou Rush.'
      });
    }

    // Verifica se já existe
    const existing = await query(
      'SELECT id FROM plans WHERE user_id = $1 AND name = $2',
      [req.user.id, name]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Plano já cadastrado' });
    }

    // ========== CRIAR PLANO ==========
    const result = await query(
      `INSERT INTO plans (
        user_id, 
        name, 
        duration_months, 
        num_screens, 
        is_sigma_plan, 
        sigma_plan_code,
        sigma_domain,
        is_live21_plan,
        is_koffice_plan,
        koffice_domain,
        is_uniplay_plan,
        is_unitv_plan,
        is_club_plan,
        is_painelfoda_plan,
        painelfoda_domain,
        painelfoda_username,
        painelfoda_password,
        painelfoda_package_id,
        is_rush_plan,
        rush_type
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        req.user.id, 
        name, 
        duration_months, 
        num_screens, 
        is_sigma_plan || false, 
        sigma_plan_code || null,
        sigma_domain || null,
        is_live21_plan || false,
        is_koffice_plan || false,
        koffice_domain || null,
        is_uniplay_plan || false,
        is_unitv_plan || false,
        is_club_plan || false,
        is_painelfoda_plan || false,
        painelfoda_domain || null,
        painelfoda_username || null,
        painelfoda_password || null,
        painelfoda_package_id || null,
        is_rush_plan || false,        // ← NOVO $19
        rush_type || null             // ← NOVO $20
      ]
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
    const { 
      name, 
      duration_months, 
      num_screens, 
      is_sigma_plan, 
      sigma_plan_code,
      sigma_domain,
      is_live21_plan,
      is_koffice_plan,
      koffice_domain,
      is_uniplay_plan,
      is_unitv_plan,
      is_club_plan,
      // ← NOVO: PAINELFODA
      is_painelfoda_plan,
      painelfoda_domain,
      painelfoda_username,
      painelfoda_password,
      painelfoda_package_id, 
      is_rush_plan,
      rush_type
    } = req.body;

    // Validação do num_screens
    if (!num_screens || num_screens < 1) {
      return res.status(400).json({ error: 'Quantidade de telas deve ser no mínimo 1' });
    }

    // Validação do Plano Sigma
    if (is_sigma_plan && (!sigma_plan_code || sigma_plan_code.trim() === '')) {
      return res.status(400).json({ error: 'Código do plano é obrigatório para Planos Sigma' });
    }

    // Validação do Plano Koffice
    if (is_koffice_plan && (!koffice_domain || koffice_domain.trim() === '')) {
      return res.status(400).json({ error: 'Domínio é obrigatório para Planos Koffice' });
    }

    // Validação do Plano PainelFoda
    if (is_painelfoda_plan) {
      if (!painelfoda_domain || painelfoda_domain.trim() === '') {
        return res.status(400).json({ error: 'Domínio é obrigatório para Planos PainelFoda' });
      }
      if (!painelfoda_username || painelfoda_username.trim() === '') {
        return res.status(400).json({ error: 'Usuário é obrigatório para Planos PainelFoda' });
      }
      // Senha só é obrigatória se estiver criando ou se foi preenchida na edição
      // (na edição, a senha pode vir vazia se o usuário não quiser alterar)
      if (!painelfoda_package_id || painelfoda_package_id.trim() === '') {
        return res.status(400).json({ error: 'Package ID é obrigatório para Planos PainelFoda' });
      }
    }

    // Validação: Não pode ser mais de um tipo (TODOS SÃO EXCLUSIVOS)
    const typeCount = [
      is_sigma_plan, 
      is_live21_plan, 
      is_koffice_plan, 
      is_uniplay_plan, 
      is_unitv_plan,
      is_club_plan,
      is_painelfoda_plan,
      is_rush_plan,
    ].filter(Boolean).length;
    
    if (typeCount > 1) {
      return res.status(400).json({ 
        error: 'Plano não pode ter múltiplos tipos simultaneamente. Escolha apenas um tipo: Sigma, Live21, Koffice, Uniplay, UniTV, Club ou PainelFoda.'
      });
    }

    // ========== ATUALIZAR PLANO ==========
    // Se a senha vier vazia, manter a senha atual (não sobrescrever)
    let updateQuery;
    let updateParams;

    if (painelfoda_password && painelfoda_password.trim() !== '') {
      // Atualiza incluindo a senha
      updateQuery = `UPDATE plans 
       SET name = $1,
           duration_months = $2,
           num_screens = $3,
           is_sigma_plan = $4,
           sigma_plan_code = $5,
           sigma_domain = $6,
           is_live21_plan = $7,
           is_koffice_plan = $8,
           koffice_domain = $9,
           is_uniplay_plan = $10,
           is_unitv_plan = $11,
           is_club_plan = $12,
           is_painelfoda_plan = $13,
           painelfoda_domain = $14,
           painelfoda_username = $15,
           painelfoda_password = $16,
           painelfoda_package_id = $17,
           is_rush_plan = $18,
           rush_type = $19,
           updated_at = NOW()
       WHERE id = $20 AND user_id = $21
       RETURNING *`;
      
      updateParams = [
        name, 
        duration_months, 
        num_screens,
        is_sigma_plan || false,
        sigma_plan_code || null,
        sigma_domain || null,
        is_live21_plan || false,
        is_koffice_plan || false,
        koffice_domain || null,
        is_uniplay_plan || false,
        is_unitv_plan || false,
        is_club_plan || false,
        is_painelfoda_plan || false,
        painelfoda_domain || null,
        painelfoda_username || null,
        painelfoda_password,
        painelfoda_package_id || null,
        is_rush_plan || false,        // ← NOVO $19
        rush_type || null,             // ← NOVO $20
        id,
        req.user.id
      ];
    } else {
      // Atualiza SEM mudar a senha (mantém a existente)
      updateQuery = `UPDATE plans 
       SET name = $1,
           duration_months = $2,
           num_screens = $3,
           is_sigma_plan = $4,
           sigma_plan_code = $5,
           sigma_domain = $6,
           is_live21_plan = $7,
           is_koffice_plan = $8,
           koffice_domain = $9,
           is_uniplay_plan = $10,
           is_unitv_plan = $11,
           is_club_plan = $12,
           is_painelfoda_plan = $13,
           painelfoda_domain = $14,
           painelfoda_username = $15,
           painelfoda_package_id = $16,
           is_rush_plan = $17,
           rush_type = $18,
           updated_at = NOW()
       WHERE id = $19 AND user_id = $20
       RETURNING *`;
      
      updateParams = [
        name, 
        duration_months, 
        num_screens,
        is_sigma_plan || false,
        sigma_plan_code || null,
        sigma_domain || null,
        is_live21_plan || false,
        is_koffice_plan || false,
        koffice_domain || null,
        is_uniplay_plan || false,
        is_unitv_plan || false,
        is_club_plan || false,
        is_painelfoda_plan || false,
        painelfoda_domain || null,
        painelfoda_username || null,
        painelfoda_package_id || null,
        is_rush_plan || false,        // ← NOVO $19
        rush_type || null,             // ← NOVO $20
        id,
        req.user.id
      ];
    }

    const result = await query(updateQuery, updateParams);

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
    
    const result = await query(
      'DELETE FROM plans WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plano não encontrado' });
    }

    res.json({ message: 'Plano excluído com sucesso' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Não é possível excluir este plano pois existem clientes vinculados a ele' 
      });
    }
    console.error('Delete plan error:', error);
    res.status(500).json({ error: 'Erro ao excluir plano' });
  }
}