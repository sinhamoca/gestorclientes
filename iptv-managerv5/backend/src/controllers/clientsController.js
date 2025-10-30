/* ========================================
   CLIENTS CONTROLLER
   Busca clientes do PostgreSQL principal
   ======================================== */

import * as postgres from '../postgres.js';
import * as db from '../database.js'; // Adicione esta importação se não existir

/**
 * Listar clientes do usuário logado
 * GET /api/clients
 */
export async function listClients(req, res) {
  try {
    const userId = req.user.id;

    console.log(`📋 [CLIENTS] Buscando clientes do user ${userId} no PostgreSQL`);

    const clients = await postgres.getClientsByUser(userId);
    const stats = await postgres.getClientStatsByUser(userId);

    console.log(`✅ [CLIENTS] ${clients.length} clientes encontrados`);

    res.json({
      success: true,
      stats: {
        total: parseInt(stats.total) || 0,
        active: parseInt(stats.active) || 0,
        inactive: parseInt(stats.inactive) || 0,
        expired: parseInt(stats.expired) || 0,
        expiring_soon: parseInt(stats.expiring_soon) || 0
      },
      clients: clients
    });

  } catch (error) {
    console.error('❌ [CLIENTS] Erro ao listar clientes:', error);
    res.status(500).json({ error: 'Erro ao listar clientes' });
  }
}

/**
 * Sincronizar cliente com Sigma
 * PUT /api/clients/:id/sync-sigma
 * 
 * Body: {
 *   sigma_id_interno: "pKDNezylLX",
 *   domain: "https://dash.turbox.tv.br"
 * }
 */
export async function syncClientWithSigma(req, res) {
  try {
    const { id } = req.params;
    const { sigma_id_interno, domain } = req.body;
    const userId = req.user.id;

    console.log(`🔄 [CLIENTS] Sincronizando cliente ${id} com Sigma ID ${sigma_id_interno}`);

    if (!sigma_id_interno) {
      return res.status(400).json({ error: 'ID interno do Sigma é obrigatório' });
    }

    if (!domain) {
      return res.status(400).json({ error: 'Domínio do Sigma é obrigatório' });
    }

    // Verificar se o cliente Sigma existe no SQLite
    const sigmaClient = db.getSigmaClientByIdInterno(userId, domain, sigma_id_interno);
    
    if (!sigmaClient) {
      return res.status(404).json({ error: 'Cliente Sigma não encontrado. Capture os clientes primeiro.' });
    }

    // Atualizar o username do cliente no PostgreSQL com o id_interno do Sigma
    await postgres.syncClientWithCloudNation(id, userId, sigma_id_interno);

    console.log(`✅ [CLIENTS] Cliente ${id} sincronizado com Sigma (${sigma_id_interno})`);

    res.json({
      success: true,
      message: 'Cliente sincronizado com Sigma com sucesso',
      sigma_client: {
        id_interno: sigmaClient.id_interno,
        id_externo: sigmaClient.id_externo,
        nome: sigmaClient.nome
      }
    });

  } catch (error) {
    console.error('❌ [CLIENTS] Erro ao sincronizar cliente com Sigma:', error);
    res.status(500).json({ error: 'Erro ao sincronizar cliente com Sigma' });
  }
}


/**
 * Sincronizar cliente com CloudNation
 * PUT /api/clients/:id/sync
 */
export async function syncClient(req, res) {
  try {
    const { id } = req.params;
    const { cloudnation_id } = req.body;
    const userId = req.user.id;

    console.log(`🔄 [CLIENTS] Sincronizando cliente ${id} com CN ID ${cloudnation_id}`);

    if (!cloudnation_id) {
      return res.status(400).json({ error: 'ID do CloudNation é obrigatório' });
    }

    // Atualizar o username do cliente com o ID do CloudNation
    await postgres.syncClientWithCloudNation(id, userId, cloudnation_id);

    console.log(`✅ [CLIENTS] Cliente ${id} sincronizado`);

    res.json({
      success: true,
      message: 'Cliente sincronizado com sucesso'
    });

  } catch (error) {
    console.error('❌ [CLIENTS] Erro ao sincronizar cliente:', error);
    res.status(500).json({ error: 'Erro ao sincronizar cliente' });
  }
}

export default {
  listClients,
  syncClient,           // Sincronização CloudNation (já existe)
  syncClientWithSigma   // Sincronização Sigma (NOVO!)
};

