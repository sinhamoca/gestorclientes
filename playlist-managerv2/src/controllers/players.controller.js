const playersService = require('../services/players.service');

class PlayersController {
  // ========== IBOPlayer ==========

  async iboPlayerLogin(req, res) {
    try {
      const { mac_address, device_key, domain } = req.body;

      if (!mac_address || !device_key || !domain) {
        return res.status(400).json({
          success: false,
          error: 'MAC address, device key e domínio são obrigatórios'
        });
      }

      const result = await playersService.iboPlayerLogin(mac_address, device_key, domain);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro no login IBOPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboPlayerListPlaylists(req, res) {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      const result = await playersService.iboPlayerListPlaylists(session);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao listar playlists IBOPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboPlayerAddPlaylist(req, res) {
    try {
      const { session, ...data } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      if (!data.name || !data.url) {
        return res.status(400).json({
          success: false,
          error: 'Nome e URL são obrigatórios'
        });
      }

      const result = await playersService.iboPlayerAddPlaylist(session, data);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao adicionar playlist IBOPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboPlayerEditPlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const { session, ...data } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      if (!data.name || !data.url) {
        return res.status(400).json({
          success: false,
          error: 'Nome e URL são obrigatórios'
        });
      }

      const result = await playersService.iboPlayerEditPlaylist(session, playlistId, data);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao editar playlist IBOPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboPlayerDeletePlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      const result = await playersService.iboPlayerDeletePlaylist(session, playlistId);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao deletar playlist IBOPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  // ========== IBOPro ==========

  async iboProLogin(req, res) {
    try {
      const { mac_address, password } = req.body;

      if (!mac_address || !password) {
        return res.status(400).json({
          success: false,
          error: 'MAC address e password são obrigatórios'
        });
      }

      const result = await playersService.iboProLogin(mac_address, password);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro no login IBOPro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboProListPlaylists(req, res) {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      const result = await playersService.iboProListPlaylists(session);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao listar playlists IBOPro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboProAddPlaylist(req, res) {
    try {
      const { session, ...data } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      if (!data.name || !data.url) {
        return res.status(400).json({
          success: false,
          error: 'Nome e URL são obrigatórios'
        });
      }

      const result = await playersService.iboProAddPlaylist(session, data);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao adicionar playlist IBOPro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboProEditPlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const { session, ...data } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      if (!data.name || !data.url) {
        return res.status(400).json({
          success: false,
          error: 'Nome e URL são obrigatórios'
        });
      }

      const result = await playersService.iboProEditPlaylist(session, playlistId, data);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao editar playlist IBOPro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async iboProDeletePlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const { session, pin } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      const result = await playersService.iboProDeletePlaylist(session, playlistId, pin);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao deletar playlist IBOPro:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  // ========== VUPlayer ==========

  async vuPlayerLogin(req, res) {
    try {
      const { mac_address, device_key } = req.body;

      if (!mac_address || !device_key) {
        return res.status(400).json({
          success: false,
          error: 'MAC address e device key são obrigatórios'
        });
      }

      const result = await playersService.vuPlayerLogin(mac_address, device_key);
      
      if (result.success) {
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Erro no login VUPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async vuPlayerListPlaylists(req, res) {
    try {
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      const result = await playersService.vuPlayerListPlaylists(session);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao listar playlists VUPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async vuPlayerAddPlaylist(req, res) {
    try {
      const { session, ...data } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      if (!data.name || !data.url) {
        return res.status(400).json({
          success: false,
          error: 'Nome e URL são obrigatórios'
        });
      }

      const result = await playersService.vuPlayerAddPlaylist(session, data);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao adicionar playlist VUPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async vuPlayerEditPlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const { session, ...data } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      if (!data.name || !data.url) {
        return res.status(400).json({
          success: false,
          error: 'Nome e URL são obrigatórios'
        });
      }

      const result = await playersService.vuPlayerEditPlaylist(session, playlistId, data);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao editar playlist VUPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }

  async vuPlayerDeletePlaylist(req, res) {
    try {
      const { playlistId } = req.params;
      const { session } = req.body;

      if (!session) {
        return res.status(400).json({
          success: false,
          error: 'Sessão não fornecida'
        });
      }

      const result = await playersService.vuPlayerDeletePlaylist(session, playlistId);
      return res.json(result);
    } catch (error) {
      console.error('Erro ao deletar playlist VUPlayer:', error);
      return res.status(500).json({
        success: false,
        error: 'Erro interno no servidor',
        message: error.message
      });
    }
  }
}

module.exports = new PlayersController();
