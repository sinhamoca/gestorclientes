const pool = require('../config/database');

class ClientsController {
  // Listar todos os clientes do usuário logado (COM SERVIDOR E PLAYER)
  async list(req, res) {
    try {
      const userId = req.userId;

      const result = await pool.query(
        `SELECT 
          c.id, 
          c.name, 
          c.mac_address, 
          c.device_key,
          c.whatsapp_number,
          c.is_active,
          c.created_at,
          c.server_id,
          s.name as server_name,
          c.player_type,
          c.player_domain
         FROM clients c
         LEFT JOIN servers s ON c.server_id = s.id
         WHERE c.user_id = $1 
         AND c.is_active = true
         ORDER BY c.name ASC`,
        [userId]
      );

      return res.json({
        success: true,
        clients: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Erro ao listar clientes:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar clientes',
        message: error.message
      });
    }
  }

  // Buscar cliente específico
  async getById(req, res) {
    try {
      const userId = req.userId;
      const clientId = req.params.id;

      const result = await pool.query(
        `SELECT 
          c.id, 
          c.name, 
          c.mac_address, 
          c.device_key,
          c.whatsapp_number,
          c.is_active,
          c.server_id,
          s.name as server_name,
          c.player_type,
          c.player_domain
         FROM clients c
         LEFT JOIN servers s ON c.server_id = s.id
         WHERE c.id = $1 AND c.user_id = $2`,
        [clientId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cliente não encontrado'
        });
      }

      return res.json({
        success: true,
        client: result.rows[0]
      });
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar cliente',
        message: error.message
      });
    }
  }

  // Listar servidores do usuário
  async listServers(req, res) {
    try {
      const userId = req.userId;

      const result = await pool.query(
        `SELECT id, name 
         FROM servers 
         WHERE user_id = $1 
         ORDER BY name ASC`,
        [userId]
      );

      return res.json({
        success: true,
        servers: result.rows
      });
    } catch (error) {
      console.error('Erro ao listar servidores:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro ao buscar servidores',
        message: error.message
      });
    }
  }
}

module.exports = new ClientsController();
