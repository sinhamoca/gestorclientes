/* ========================================
   SIGMA SYNC CONTROLLER
   Sincroniza pacotes Sigma com gestao-clientes
   MODIFICADO: Agora detecta conflitos e permite decisão do usuário
   ======================================== */

import * as postgres from '../postgres.js';
import * as db from '../database.js';

/**
 * Verificar conflitos antes de sincronizar
 * POST /api/sigma/sync/check
 * 
 * Body: {
 *   domain: "https://dash.turbox.tv.br",
 *   package_ids: ["XYgD9JWr6V", "ABC123XYZ"]
 * }
 * 
 * Retorna: {
 *   conflicts: [...], // Pacotes que já existem
 *   new_packages: [...], // Pacotes novos
 *   existing_plans: [...] // Todos os planos do usuário
 * }
 */
export async function checkSyncConflicts(req, res) {
  try {
    const userId = req.user.id;
    const { domain, package_ids } = req.body;
    
    if (!domain || !package_ids || !Array.isArray(package_ids)) {
      return res.status(400).json({ error: 'Domínio e IDs dos pacotes são obrigatórios' });
    }
    
    console.log(`🔍 [SYNC-CHECK] Verificando conflitos para ${package_ids.length} pacotes...`);
    
    // Buscar pacotes do SQLite
    const allPackages = db.getSigmaPackages(userId, domain);
    const selectedPackages = allPackages.filter(pkg => package_ids.includes(pkg.id));
    
    if (selectedPackages.length === 0) {
      return res.status(404).json({ error: 'Nenhum pacote encontrado' });
    }
    
    // Buscar todos os planos existentes do usuário
    const existingPlans = await postgres.getAllUserPlans(userId);
    
    const conflicts = [];
    const newPackages = [];
    
    for (const pkg of selectedPackages) {
      // Verificar se já existe (pelo código sigma)
      const existingByCode = await postgres.getPlanBySigmaCode(userId, pkg.id);
      
      if (existingByCode) {
        conflicts.push({
          package: {
            id: pkg.id,
            nome: pkg.nome,
            duracao: pkg.duracao,
            conexoes: pkg.conexoes,
            domain: domain
          },
          existing_plan: {
            id: existingByCode.id,
            name: existingByCode.name,
            duration_months: existingByCode.duration_months,
            num_screens: existingByCode.num_screens,
            sigma_plan_code: existingByCode.sigma_plan_code,
            sigma_domain: existingByCode.sigma_domain
          }
        });
      } else {
        newPackages.push({
          id: pkg.id,
          nome: pkg.nome,
          duracao: pkg.duracao,
          conexoes: pkg.conexoes,
          domain: domain
        });
      }
    }
    
    console.log(`✅ [SYNC-CHECK] Verificação concluída: ${conflicts.length} conflitos, ${newPackages.length} novos`);
    
    res.json({
      success: true,
      conflicts: conflicts,
      new_packages: newPackages,
      existing_plans: existingPlans // Todos os planos para o usuário escolher na substituição
    });
    
  } catch (error) {
    console.error('❌ [SYNC-CHECK] Erro ao verificar conflitos:', error);
    res.status(500).json({ error: 'Erro ao verificar conflitos' });
  }
}

/**
 * Sincronizar pacotes selecionados com gestao-clientes
 * POST /api/sigma/sync
 * 
 * Body: {
 *   domain: "https://dash.turbox.tv.br",
 *   package_ids: ["XYgD9JWr6V", "ABC123XYZ"],
 *   resolutions: {
 *     "XYgD9JWr6V": { action: "replace", plan_id: 123 }, // Substituir plano 123
 *     "ABC123XYZ": { action: "create" } // Criar novo
 *   }
 * }
 */
export async function syncPackages(req, res) {
  try {
    const userId = req.user.id;
    const { domain, package_ids, resolutions } = req.body;
    
    if (!domain || !package_ids || !Array.isArray(package_ids)) {
      return res.status(400).json({ error: 'Domínio e IDs dos pacotes são obrigatórios' });
    }
    
    console.log(`🔄 [SYNC] Sincronizando ${package_ids.length} pacotes de ${domain}`);
    if (resolutions) {
      console.log(`📋 [SYNC] Resoluções fornecidas:`, JSON.stringify(resolutions, null, 2));
    }
    
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
        const resolution = resolutions?.[pkg.id];
        
        if (!resolution) {
          // Se não tem resolução definida, criar novo por padrão
          await postgres.createPlan(userId, {
            name: pkg.nome,
            duration_months: pkg.duracao,
            num_screens: pkg.conexoes,
            is_sigma_plan: true,
            sigma_plan_code: pkg.id,
            sigma_domain: domain
          });
          results.created++;
          console.log(`  ➕ Criado (sem resolução): ${pkg.nome} (${pkg.id})`);
          continue;
        }
        
        if (resolution.action === 'create') {
          // Criar novo plano
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
          
        } else if (resolution.action === 'replace' && resolution.plan_id) {
          // Substituir plano existente
          await postgres.updatePlan(resolution.plan_id, userId, {
            name: pkg.nome,
            duration_months: pkg.duracao,
            num_screens: pkg.conexoes,
            is_sigma_plan: true,
            sigma_plan_code: pkg.id,
            sigma_domain: domain
          });
          results.updated++;
          console.log(`  🔄 Substituído: ${pkg.nome} (${pkg.id}) no plano ID ${resolution.plan_id}`);
          
        } else {
          throw new Error('Ação inválida ou ID do plano não fornecido');
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
  syncPackages,
  checkSyncConflicts
};