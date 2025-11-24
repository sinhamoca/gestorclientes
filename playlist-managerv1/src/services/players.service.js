const iboPlayerCli = require('../libs/iboplayer-cli');
const iboProCli = require('../libs/ibopro-cli');
const vuPlayerCli = require('../libs/vuplayer-cli');

class PlayersService {
  constructor() {
    this.captchaApiKey = process.env.CAPTCHA_API_KEY;
  }

  // ========== IBOPlayer ==========

  async iboPlayerLogin(macAddress, deviceKey, domain) {
    try {
      const session = await iboPlayerCli.login(domain, macAddress, deviceKey, this.captchaApiKey);
      return { success: true, session };
    } catch (error) {
      console.error('Erro no login IBOPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async iboPlayerListPlaylists(session) {
    try {
      const playlists = await iboPlayerCli.listPlaylists(session);
      return { success: true, playlists };
    } catch (error) {
      console.error('Erro ao listar playlists IBOPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async iboPlayerAddPlaylist(session, data) {
    try {
      const result = await iboPlayerCli.addPlaylist(
        session,
        data.name,
        data.url,
        data.pin || '',
        data.protect || false,
        data.type || 'general'
      );
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao adicionar playlist IBOPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async iboPlayerEditPlaylist(session, playlistId, data) {
    try {
      const result = await iboPlayerCli.editPlaylist(
        session,
        playlistId,
        data.name,
        data.url,
        data.pin || '',
        data.protect || false,
        data.type || 'general'
      );
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao editar playlist IBOPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async iboPlayerDeletePlaylist(session, playlistId) {
    try {
      const result = await iboPlayerCli.deletePlaylist(session, playlistId);
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao deletar playlist IBOPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== IBOPro ==========

  async iboProLogin(macAddress, password) {
    try {
      const session = await iboProCli.login(macAddress, password);
      return { success: true, session };
    } catch (error) {
      console.error('Erro no login IBOPro:', error);
      return { success: false, error: error.message };
    }
  }

  async iboProListPlaylists(session) {
    try {
      const result = await iboProCli.listPlaylists(session);
      
      // A API retorna array direto, não {data: [...]}
      const playlists = Array.isArray(result) ? result : (result.data || []);
      
      console.log(`✅ ${playlists.length} playlist(s) encontrada(s)`);
      
      return { success: true, playlists };
    } catch (error) {
      console.error('Erro ao listar playlists IBOPro:', error);
      return { success: false, error: error.message };
    }
  }

  async iboProAddPlaylist(session, data) {
    try {
      const result = await iboProCli.addPlaylist(
        session,
        data.name,
        data.url,
        data.pin || '',
        data.protect || false,
        data.type || 'URL'
      );
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao adicionar playlist IBOPro:', error);
      return { success: false, error: error.message };
    }
  }

  async iboProEditPlaylist(session, playlistId, data) {
    try {
      const result = await iboProCli.editPlaylist(
        session,
        playlistId,
        data.name,
        data.url,
        data.pin || '',
        data.protect || false,
        data.type || 'URL'
      );
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao editar playlist IBOPro:', error);
      return { success: false, error: error.message };
    }
  }

  async iboProDeletePlaylist(session, playlistId, pin = null) {
    try {
      const result = await iboProCli.deletePlaylist(session, playlistId, pin);
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao deletar playlist IBOPro:', error);
      return { success: false, error: error.message };
    }
  }

  // ========== VUPlayer ==========

  async vuPlayerLogin(macAddress, deviceKey) {
    try {
      const session = await vuPlayerCli.login(macAddress, deviceKey);
      return { success: true, session };
    } catch (error) {
      console.error('Erro no login VUPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async vuPlayerListPlaylists(session) {
    try {
      const playlists = await vuPlayerCli.listPlaylists(session);
      return { success: true, playlists };
    } catch (error) {
      console.error('Erro ao listar playlists VUPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async vuPlayerAddPlaylist(session, data) {
    try {
      const result = await vuPlayerCli.addPlaylist(
        session,
        data.name,
        data.url,
        data.pin || '',
        data.protect || false,
        data.type || 'general'
      );
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao adicionar playlist VUPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async vuPlayerEditPlaylist(session, playlistId, data) {
    try {
      const result = await vuPlayerCli.editPlaylist(
        session,
        playlistId,
        data.name,
        data.url,
        data.pin || '',
        data.protect || false,
        data.type || 'general'
      );
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao editar playlist VUPlayer:', error);
      return { success: false, error: error.message };
    }
  }

  async vuPlayerDeletePlaylist(session, playlistId) {
    try {
      const result = await vuPlayerCli.deletePlaylist(session, playlistId);
      return { success: true, data: result };
    } catch (error) {
      console.error('Erro ao deletar playlist VUPlayer:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new PlayersService();