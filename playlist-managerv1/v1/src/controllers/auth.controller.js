const pool = require('../config/database');

class AuthController {
  // Rota para validar token e retornar dados do usuário
  async me(req, res) {
    try {
      const userId = req.userId;

      const result = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado'
        });
      }

      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      return res.status(500).json({
        error: 'Erro ao buscar dados do usuário',
        message: error.message
      });
    }
  }
}

module.exports = new AuthController();
