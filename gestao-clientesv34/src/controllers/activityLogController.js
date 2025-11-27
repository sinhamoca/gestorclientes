// ========================================
// ACTIVITY LOG CONTROLLER
// Endpoints para buscar logs de atividades
// Arquivo: src/controllers/activityLogController.js
// ========================================

import { query } from '../config/database.js';

/**
 * Listar logs de atividades do usuário
 * GET /api/activity-logs
 * 
 * Query params:
 * - type: 'whatsapp' | 'payment' | 'renewal' | '' (todos)
 * - status: 'success' | 'error' | '' (todos)
 * - page: número da página (default: 1)
 * - limit: itens por página (default: 50)
 * - startDate: data inicial (YYYY-MM-DD)
 * - endDate: data final (YYYY-MM-DD)
 */
export async function listActivityLogs(req, res) {
  try {
    const userId = req.user.id;
    const {
      type = '',
      status = '',
      page = 1,
      limit = 50,
      startDate = '',
      endDate = ''
    } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100
    const offset = (pageNum - 1) * limitNum;

    // Construir WHERE clause dinâmica
    let whereClause = 'WHERE user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (type) {
      whereClause += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (startDate) {
      whereClause += ` AND created_at >= $${paramIndex}::date`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND created_at < ($${paramIndex}::date + INTERVAL '1 day')`;
      params.push(endDate);
      paramIndex++;
    }

    // Buscar total para paginação
    const countResult = await query(
      `SELECT COUNT(*) as total FROM activity_logs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Buscar logs
    const logsResult = await query(
      `SELECT 
        id,
        type,
        status,
        title,
        description,
        client_id,
        client_name,
        amount,
        error_details,
        metadata,
        created_at
      FROM activity_logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limitNum, offset]
    );

    // Calcular paginação
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      logs: logsResult.rows,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_items: total,
        items_per_page: limitNum,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar activity logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar logs de atividades'
    });
  }
}

/**
 * Obter estatísticas dos logs
 * GET /api/activity-logs/stats
 */
export async function getActivityStats(req, res) {
  try {
    const userId = req.user.id;

    // Buscar contagens por tipo e status
    const statsResult = await query(`
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM activity_logs
      WHERE user_id = $1
      AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY type, status
      ORDER BY type, status
    `, [userId]);

    // Organizar estatísticas
    const stats = {
      whatsapp: { success: 0, error: 0, total: 0 },
      payment: { success: 0, error: 0, total: 0 },
      renewal: { success: 0, error: 0, total: 0 },
      total: { success: 0, error: 0, total: 0 }
    };

    for (const row of statsResult.rows) {
      const type = row.type;
      const status = row.status;
      const count = parseInt(row.count);

      if (stats[type]) {
        stats[type][status] = count;
        stats[type].total += count;
      }
      
      stats.total[status] = (stats.total[status] || 0) + count;
      stats.total.total += count;
    }

    // Buscar últimos 5 erros
    const recentErrorsResult = await query(`
      SELECT 
        type,
        title,
        error_details,
        created_at
      FROM activity_logs
      WHERE user_id = $1
      AND status = 'error'
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

    res.json({
      success: true,
      stats,
      recent_errors: recentErrorsResult.rows,
      period: '30 dias'
    });

  } catch (error) {
    console.error('❌ Erro ao buscar stats:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar estatísticas'
    });
  }
}

/**
 * Limpar logs antigos do usuário
 * DELETE /api/activity-logs/cleanup
 * 
 * Query params:
 * - days: dias para manter (default: 90)
 */
export async function cleanupOldLogs(req, res) {
  try {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 90;

    const result = await query(`
      DELETE FROM activity_logs
      WHERE user_id = $1
      AND created_at < NOW() - INTERVAL '${days} days'
      RETURNING id
    `, [userId]);

    res.json({
      success: true,
      deleted: result.rows.length,
      message: `${result.rows.length} logs removidos (mais antigos que ${days} dias)`
    });

  } catch (error) {
    console.error('❌ Erro ao limpar logs:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar logs antigos'
    });
  }
}

export default {
  listActivityLogs,
  getActivityStats,
  cleanupOldLogs
};
