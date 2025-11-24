const pool = require('../config/database');

class ClientsController {
  // Listar todos os clientes do usuário logado
  async list(req, res) {
    try {
      const userId = req.userId;

      const result = await pool.query(
        `SELECT 
          id, 
          name, 
          mac_address, 
          device_key,
          whatsapp_number,
          is_active,
          created_at
         FROM clients 
         WHERE user_id = $1 
         AND is_active = true
         ORDER BY name ASC`,
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
          id, 
          name, 
          mac_address, 
          device_key,
          whatsapp_number,
          is_active
         FROM clients 
         WHERE id = $1 AND user_id = $2`,
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
}

module.exports = new ClientsController();
