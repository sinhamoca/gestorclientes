const https = require('https');
const { URLSearchParams } = require('url');
const zlib = require('zlib');
const { proxyRequest } = require('./proxy-request');

// ========== CONFIGURAÇÕES ==========
const DOMAIN = 'vuproplayer.org';

// ========== AUTENTICAÇÃO ==========

async function login(macAddress, deviceKey) {
  console.log('🔐 Iniciando login no VU Player Pro...');
  console.log('🌐 Fazendo requisição via PROXY residencial brasileiro...');
  
  const params = new URLSearchParams({
    mac_address: macAddress,
    device_key: deviceKey,
    submit: ''
  });

  const postData = params.toString();
  
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Referer': `https://${DOMAIN}/login`,
    'Origin': `https://${DOMAIN}`
  };

  try {
    const response = await proxyRequest('POST', `https://${DOMAIN}/login`, {
      headers,
      body: postData
    });
    
    console.log('📥 Resposta HTTP recebida:');
    console.log('   Status:', response.statusCode);
    
    // VU Player retorna redirect 302 com cookie em caso de sucesso
    if (response.statusCode === 302 && response.headers['set-cookie']) {
      const cookies = response.headers['set-cookie'];
      const cookie = Array.isArray(cookies) ? cookies[0].split(';')[0] : cookies.split(';')[0];
      
      const session = {
        macAddress,
        deviceKey,
        cookie,
        loginTime: new Date().toISOString()
      };
      
      console.log('✅ Login realizado com sucesso via proxy!');
      console.log(`🔑 MAC: ${macAddress}`);
      
      return session;
    } else {
      console.error('❌ Login falhou - Status:', response.statusCode);
      throw new Error('Login falhou - credenciais inválidas ou servidor indisponível');
    }
  } catch (error) {
    console.error('❌ Erro no login VUPlayer:', error.message);
    throw error;
  }
}

// ========== FUNÇÕES AUXILIARES HTTPS ==========

async function makeRequest(method, path, cookie, data = null) {
  console.log(`🌐 ${method} ${path} via proxy...`);
  
  const headers = {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36',
    'Accept': method === 'GET' ? 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' : 'application/json, text/plain, */*',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Referer': `https://${DOMAIN}/mylist`
  };

  if (data) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Origin'] = `https://${DOMAIN}`;
  }

  const url = `https://${DOMAIN}${path}`;

  try {
    const response = await proxyRequest(method, url, {
      headers,
      body: data ? data.toString() : null
    });

    console.log(`   Status: ${response.statusCode}`);

    if (response.statusCode === 200) {
      return response.body;
    } else {
      throw new Error(`Erro HTTP ${response.statusCode}`);
    }
  } catch (error) {
    console.error(`❌ Erro em ${method} ${path}:`, error.message);
    throw error;
  }
}

// ========== PARSER DE HTML ==========

function parsePlaylistsHTML(html) {
  const playlists = [];
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  
  if (!tbodyMatch) {
    return playlists;
  }
  
  const tbody = tbodyMatch[1];
  const rowRegex = /<tr>\s*<td class="text-center">([^<]+)<\/td>\s*<td class="text-center">([^<]+)<\/td>\s*<td class="text-center">[\s\S]*?data-current_id="([^"]+)"[\s\S]*?data-protected="([^"]+)"[\s\S]*?data-playlist_type="([^"]*)"/g;
  
  let match;
  
  while ((match = rowRegex.exec(tbody)) !== null) {
    playlists.push({
      name: match[1].trim(),
      url: match[2].trim(),
      id: match[3].trim(),
      is_protected: match[4] === '1',
      type: match[5].trim() || 'general'
    });
  }
  
  return playlists;
}

// ========== OPERAÇÕES DE PLAYLIST ==========

async function listPlaylists(session) {
  const html = await makeRequest('GET', '/mylist', session.cookie);
  return parsePlaylistsHTML(html);
}

async function addPlaylist(session, name, url, pin = '', protect = false, type = 'general') {
  const params = new URLSearchParams({
    current_playlist_url_id: '-1',
    playlist_name: name,
    playlist_url: url,
    protect: protect ? '1' : '0',
    pin: protect ? pin : '',
    playlist_type: type,
    user_name: '',
    password: ''
  });

  const response = await makeRequest('POST', '/savePlaylist', session.cookie, params);
  
  try {
    const result = JSON.parse(response);
    if (result.status === 'success') {
      return result.data;
    } else {
      throw new Error(result.msg || 'Erro ao adicionar playlist');
    }
  } catch (error) {
    throw new Error('Erro ao processar resposta: ' + error.message);
  }
}

async function editPlaylist(session, playlistId, name, url, pin = '', protect = false, type = 'general') {
  const params = new URLSearchParams({
    current_playlist_url_id: playlistId,
    playlist_name: name,
    playlist_url: url,
    protect: protect ? '1' : '0',
    pin: protect ? pin : '',
    playlist_type: type,
    user_name: '',
    password: ''
  });

  const response = await makeRequest('POST', '/savePlaylist', session.cookie, params);
  
  try {
    const result = JSON.parse(response);
    if (result.status === 'success') {
      return result.data;
    } else {
      throw new Error(result.msg || 'Erro ao editar playlist');
    }
  } catch (error) {
    throw new Error('Erro ao processar resposta: ' + error.message);
  }
}

async function deletePlaylist(session, playlistId) {
  const params = new URLSearchParams({
    playlist_url_id: playlistId
  });

  const response = await makeRequest('DELETE', '/deletePlayListUrl', session.cookie, params);
  
  try {
    const result = JSON.parse(response);
    if (result.status === 'success') {
      return result;
    } else {
      throw new Error('Erro ao deletar playlist');
    }
  } catch (error) {
    throw new Error('Erro ao processar resposta: ' + error.message);
  }
}

module.exports = {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist
};