// gestao-clientesv18/src/controllers/unitvController.js
import { query } from '../config/database.js';

// ========================================
// ROTAS PÚBLICAS (chamadas pelo frontend)
// ========================================

/**
 * Listar códigos do usuário com filtros e paginação
 * GET /api/unitv/codes
 */
export async function listCodes(req, res) {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 50 } = req.query;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE uc.user_id = $1';
    const params = [userId];
    
    if (status) {
      whereClause += ' AND uc.status = $2';
      params.push(status);
    }
    
    console.log(`\n📋 [UniTV] Listando códigos do usuário ${userId}`);
    console.log(`   Filtro status: ${status || 'todos'}`);
    console.log(`   Página: ${page} | Limite: ${limit}`);
    
    // Buscar códigos
    const codesResult = await query(
      `SELECT 
        uc.*,
        c.name as delivered_to_client_name,
        c.whatsapp_number as delivered_to_client_phone
      FROM unitv_codes uc
      LEFT JOIN clients c ON uc.delivered_to_client_id = c.id
      ${whereClause}
      ORDER BY 
        CASE WHEN uc.status = 'available' THEN 0 ELSE 1 END,
        uc.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    
    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) FROM unitv_codes uc ${whereClause}`,
      params
    );
    
    // Estatísticas gerais
    const statsResult = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'available') as available,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered
      FROM unitv_codes
      WHERE user_id = $1`,
      [userId]
    );
    
    const stats = statsResult.rows[0];
    
    console.log(`   ✅ ${codesResult.rows.length} códigos encontrados`);
    console.log(`   📊 Stats: ${stats.total} total | ${stats.available} disponíveis | ${stats.delivered} entregues\n`);
    
    res.json({
      success: true,
      codes: codesResult.rows,
      total: parseInt(countResult.rows[0].count),
      stats: {
        total: parseInt(stats.total),
        available: parseInt(stats.available),
        delivered: parseInt(stats.delivered)
      },
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
    
  } catch (error) {
    console.error('❌ Erro ao listar códigos UniTV:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Adicionar códigos em lote
 * POST /api/unitv/codes/bulk
 * Body: { codes: ["0000000000000000", "1111111111111111", ...] }
 */
export async function addCodesBulk(req, res) {
  try {
    const userId = req.user.id;
    const { codes } = req.body;
    
    if (!codes || !Array.isArray(codes)) {
      return res.status(400).json({ 
        success: false,
        error: 'Formato inválido. Envie um array de códigos.' 
      });
    }
    
    console.log(`\n➕ [UniTV] Usuário ${userId} adicionando códigos...`);
    console.log(`   Total de linhas recebidas: ${codes.length}`);
    
    // Validar e limpar códigos
    const validCodes = [];
    const errors = [];
    
    for (let i = 0; i < codes.length; i++) {
      const rawCode = codes[i];
      
      // Limpar: remove espaços, hífens e qualquer caractere não-dígito
      const cleanCode = rawCode.trim().replace(/\D/g, '');
      
      if (cleanCode.length === 0) {
        // Linha vazia, ignorar
        continue;
      }
      
      if (cleanCode.length !== 16) {
        errors.push({
          line: i + 1,
          code: rawCode,
          error: `Código deve ter 16 dígitos (recebido: ${cleanCode.length})`
        });
        continue;
      }
      
      validCodes.push(cleanCode);
    }
    
    console.log(`   ✅ ${validCodes.length} códigos válidos`);
    console.log(`   ⚠️  ${errors.length} erros de validação`);
    
    if (validCodes.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Nenhum código válido encontrado',
        errors 
      });
    }
    
    // Inserir códigos (ignorar duplicados)
    const inserted = [];
    const duplicates = [];
    
    for (const code of validCodes) {
      try {
        const result = await query(
          `INSERT INTO unitv_codes (user_id, code, status)
           VALUES ($1, $2, 'available')
           ON CONFLICT (user_id, code) DO NOTHING
           RETURNING *`,
          [userId, code]
        );
        
        if (result.rows.length > 0) {
          inserted.push(code);
        } else {
          duplicates.push(code);
        }
      } catch (err) {
        console.error(`   ❌ Erro ao inserir código ${code}:`, err.message);
        errors.push({
          code: code,
          error: err.message
        });
      }
    }
    
    console.log(`   💾 ${inserted.length} códigos inseridos no banco`);
    console.log(`   🔄 ${duplicates.length} códigos já existiam (ignorados)`);
    console.log('');
    
    res.json({
      success: true,
      inserted: inserted.length,
      duplicates: duplicates.length,
      errors: errors.length,
      errorDetails: errors,
      message: `✅ ${inserted.length} códigos adicionados com sucesso!`
    });
    
  } catch (error) {
    console.error('❌ Erro ao adicionar códigos em lote:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Atualizar status de um código
 * PATCH /api/unitv/codes/:id
 * Body: { status: 'available' | 'delivered' }
 */
export async function updateCodeStatus(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['available', 'delivered'].includes(status)) {
      return res.status(400).json({ 
        success: false,
        error: 'Status inválido. Use: available ou delivered' 
      });
    }
    
    console.log(`\n🔄 [UniTV] Atualizando código ID ${id} para status: ${status}`);
    
    // Se marcar como disponível, limpar vínculo com cliente
    let updateQuery;
    let params;
    
    if (status === 'available') {
      updateQuery = `
        UPDATE unitv_codes 
        SET status = $1, 
            delivered_to_client_id = NULL, 
            delivered_at = NULL, 
            updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *`;
      params = [status, id, userId];
      console.log(`   ℹ️  Removendo vínculo com cliente (marcando como disponível)`);
    } else {
      updateQuery = `
        UPDATE unitv_codes 
        SET status = $1, 
            updated_at = NOW()
        WHERE id = $2 AND user_id = $3
        RETURNING *`;
      params = [status, id, userId];
    }
    
    const result = await query(updateQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Código não encontrado' 
      });
    }
    
    console.log(`   ✅ Status atualizado com sucesso\n`);
    
    res.json({
      success: true,
      code: result.rows[0],
      message: `Código marcado como ${status === 'available' ? 'disponível' : 'entregue'}`
    });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

/**
 * Deletar código
 * DELETE /api/unitv/codes/:id
 */
export async function deleteCode(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    
    console.log(`\n🗑️  [UniTV] Deletando código ID ${id}`);
    
    const result = await query(
      `DELETE FROM unitv_codes 
       WHERE id = $1 AND user_id = $2
       RETURNING code, status`,
      [id, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false,
        error: 'Código não encontrado' 
      });
    }
    
    const deletedCode = result.rows[0];
    console.log(`   ✅ Código ${deletedCode.code} (${deletedCode.status}) deletado\n`);
    
    res.json({
      success: true,
      message: 'Código deletado com sucesso'
    });
    
  } catch (error) {
    console.error('❌ Erro ao deletar código:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
}

// ========================================
// FUNÇÕES INTERNAS (usadas pelo service)
// ========================================

/**
 * Buscar próximo código disponível
 * Usado pelo unitvDeliveryService.js
 */
export async function getAvailableCode(userId) {
  try {
    const result = await query(
      `SELECT * FROM unitv_codes
       WHERE user_id = $1 AND status = 'available'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [userId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Erro ao buscar código disponível:', error);
    throw error;
  }
}

/**
 * Marcar código como entregue
 * Usado pelo unitvDeliveryService.js após envio bem-sucedido
 */
export async function markCodeAsDelivered(codeId, clientId) {
  try {
    const result = await query(
      `UPDATE unitv_codes
       SET status = 'delivered',
           delivered_to_client_id = $1,
           delivered_at = NOW(),
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [clientId, codeId]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('❌ Erro ao marcar código como entregue:', error);
    throw error;
  }
}
