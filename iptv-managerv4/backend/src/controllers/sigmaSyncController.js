/* ========================================
   SIGMA SYNC CONTROLLER
   Sincroniza pacotes Sigma com gestao-clientes
   ======================================== */

import * as postgres from '../postgres.js';
import * as db from '../database.js';

/**
 * Sincronizar pacotes selecionados com gestao-clientes
 * POST /api/sigma/sync
 * 
 * Body: {
 *   domain: "https://dash.turbox.tv.br",
 *   package_ids: ["XYgD9JWr6V", "ABC123XYZ"]
 * }
 */
export async function syncPackages(req, res) {
  try {
    const userId = req.user.id;
    const { domain, package_ids } = req.body;
    
    if (!domain || !package_ids || !Array.isArray(package_ids)) {
      return res.status(400).json({ error: 'Domínio e IDs dos pacotes são obrigatórios' });
    }
    
    console.log(`🔄 [SYNC] Sincronizando ${package_ids.length} pacotes de ${domain}`);
    
    // Buscar pacotes do SQLite
    const allPackages = db.getSigmaPackages(userId, domain);
    const selectedPackages = allPackages.filter(pkg => package_ids.includes(pkg.id));
    
    if (selectedPackages.length === 0) {
      return res.status(404).json({ error: 'Nenhum pacote encontrado' });
    }
    
    const results = {
      created: 0,
      updated: 0,
      errors: []
    };
    
    // Sincronizar cada pacote
    for (const pkg of selectedPackages) {
      try {
        // Verificar se já existe (pelo código sigma)
        const existing = await postgres.getPlanBySigmaCode(userId, pkg.id);
        
        if (existing) {
          // Atualizar
          await postgres.updatePlan(existing.id, userId, {
            name: pkg.nome,
            duration_months: pkg.duracao,
            num_screens: pkg.conexoes,
            is_sigma_plan: true,
            sigma_plan_code: pkg.id,
            sigma_domain: domain
          });
          results.updated++;
          console.log(`  ✅ Atualizado: ${pkg.nome} (${pkg.id})`);
        } else {
          // Criar
          await postgres.createPlan(userId, {
            name: pkg.nome,
            duration_months: pkg.duracao,
            num_screens: pkg.conexoes,
            is_sigma_plan: true,
            sigma_plan_code: pkg.id,
            sigma_domain: domain
          });
          results.created++;
          console.log(`  ➕ Criado: ${pkg.nome} (${pkg.id})`);
        }
      } catch (error) {
        console.error(`  ❌ Erro ao sincronizar ${pkg.id}:`, error.message);
        results.errors.push({
          package_id: pkg.id,
          package_name: pkg.nome,
          error: error.message
        });
      }
    }
    
    console.log(`✅ [SYNC] Concluído: ${results.created} criados, ${results.updated} atualizados, ${results.errors.length} erros`);
    
    res.json({
      success: true,
      message: 'Sincronização concluída',
      results: results
    });
    
  } catch (error) {
    console.error('❌ [SYNC] Erro ao sincronizar:', error);
    res.status(500).json({ error: 'Erro ao sincronizar pacotes' });
  }
}

export default {
  syncPackages
};