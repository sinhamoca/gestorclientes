const https = require('https');
const { proxyPost, proxyRequest } = require('./proxy-request');

// Importar SHA3-512
const { sha3_512 } = require('js-sha3');

// ========== CONFIGURAÇÕES ==========
const API_BASE = 'api.iboproapp.com';

// ========== GERAÇÃO DE TOKENS SHA3-512 ==========

function F(t) {
  if (t.length >= 6) {
    return t.substring(0, 3) + "iBo" + t.substring(3, t.length - 3) + "PrO" + t.substring(t.length - 3, t.length);
  }
  if (t.length >= 3) {
    return t.substring(0, 3) + "iBo" + t.substring(3);
  }
  return t + "PrO";
}

function T(t) {
  const encoded = F(t);
  return F(Buffer.from(encoded).toString('base64'));
}

async function L(e) {
  const n = Date.now().toString();
  const o = T(e + n);
  const normalized = o.normalize();
  const r = sha3_512(normalized);
  return T(r + n);
}

async function generateAllTokens(mac, password) {
  const timestamp = Date.now();
  mac = mac || '';
  password = password || '';
  
  const gcToken = await L(`${mac}${timestamp}${2 * timestamp}`);
  const hash1 = await L(`${mac}___${password}`);
  const hash2 = await L(`${mac}___${password}__${timestamp}`);
  const token1 = await L(`${mac}${timestamp}`);
  const token2 = await L(mac);
  const token3 = T(mac);
  
  return {
    'X-Gc-Token': gcToken,
    'x-hash': hash1,
    'x-hash-2': hash2,
    'x-token': token1,
    'x-token-2': token2,
    'x-token-3': token3
  };
}

// ========== AUTENTICAÇÃO ==========

async function login(macAddress, password) {
  console.log('🔐 Iniciando login no IBOPro...');
  console.log('🔧 Gerando tokens SHA3-512...');
  
  try {
    const tokens = await generateAllTokens(macAddress, password);
    
    const payload = {
      mac: macAddress,
      password: password
    };
    
    const dados = JSON.stringify(payload);
    
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': dados.length.toString(),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Origin': 'https://iboplayer.pro',
      'Referer': 'https://iboplayer.pro/',
      'Authorization': 'Bearer',
      ...tokens
    };
    
    console.log('🌐 Fazendo requisição via PROXY residencial brasileiro...');
    
    const response = await proxyPost(
      `https://${API_BASE}/auth/login`,
      dados,
      headers
    );
    
    console.log('📥 Resposta HTTP recebida:');
    console.log('   Status:', response.statusCode);
    console.log('   Body (primeiros 200 chars):', response.body.substring(0, 200));
    
    if (response.statusCode === 403) {
      console.error('❌ Erro 403: Acesso negado mesmo com proxy!');
      throw new Error('Acesso negado (403). Verifique MAC address e password.');
    }
    
    let resultado;
    try {
      resultado = JSON.parse(response.body);
    } catch (e) {
      console.error('❌ Resposta não é JSON válido');
      console.error('   Resposta:', response.body.substring(0, 500));
      throw new Error('Resposta inválida do servidor');
    }
    
    if (!resultado.status || !resultado.token) {
      throw new Error('Login falhou: ' + (resultado.message || 'Token não recebido'));
    }
    
    const session = {
      macAddress,
      password,
      token: resultado.token,
      loginTime: new Date().toISOString(),
      message: resultado.message
    };
    
    console.log('✅ Login realizado com sucesso via proxy!');
    console.log(`🔑 Token JWT recebido`);
    
    return session;
    
  } catch (erro) {
    console.error('❌ Erro no login IBOPro:', erro.message);
    throw erro;
  }
}

// ========== FUNÇÕES AUXILIARES HTTPS ==========

async function makeRequest(method, path, session, data = null) {
  const tokens = await generateAllTokens(session.macAddress, session.password);
  
  const headers = {
    'Authorization': `Bearer ${session.token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://iboplayer.pro',
    'Referer': 'https://iboplayer.pro/',
    ...tokens
  };
  
  const url = `https://${API_BASE}${path}`;
  
  console.log(`🌐 ${method} ${path} via proxy...`);
  
  // DEBUG: Mostrar payload se houver
  if (data) {
    console.log('📤 Payload enviado:', JSON.stringify(data, null, 2));
  }
  
  try {
    let response;
    
    if (method === 'GET') {
      // GET não deve ter body
      response = await proxyRequest('GET', url, { headers });
    } else if (method === 'POST' || method === 'PUT') {
      response = await proxyRequest(method, url, {
        headers,
        body: data ? JSON.stringify(data) : null
      });
    } else {
      throw new Error('Método HTTP não suportado: ' + method);
    }
    
    console.log(`   Status: ${response.statusCode}`);
    
    // DEBUG: Mostrar resposta completa (não só primeiros 200 chars)
    console.log('📥 Resposta COMPLETA do servidor:');
    console.log(response.body);
    
    if (response.statusCode !== 200) {
      throw new Error(`Erro HTTP ${response.statusCode}: ${response.body.substring(0, 100)}`);
    }
    
    // Parse do JSON
    let result;
    try {
      result = JSON.parse(response.body);
    } catch (e) {
      console.error('❌ Resposta não é JSON válido:', response.body.substring(0, 200));
      throw new Error('Resposta inválida do servidor');
    }
    
    // DEBUG: Mostrar estrutura do JSON
    console.log('📊 Estrutura da resposta JSON:');
    console.log('   - Keys:', Object.keys(result));
    if (result.data) {
      console.log('   - result.data tipo:', typeof result.data);
      console.log('   - result.data é array?', Array.isArray(result.data));
      if (Array.isArray(result.data)) {
        console.log('   - result.data.length:', result.data.length);
      }
    }
    if (result.playlists) {
      console.log('   - result.playlists tipo:', typeof result.playlists);
      console.log('   - result.playlists é array?', Array.isArray(result.playlists));
      if (Array.isArray(result.playlists)) {
        console.log('   - result.playlists.length:', result.playlists.length);
      }
    }
    
    return result;
    
  } catch (error) {
    console.error(`❌ Erro em ${method} ${path}:`, error.message);
    throw error;
  }
}

// ========== OPERAÇÕES DE PLAYLIST ==========

async function listPlaylists(session) {
  console.log('📋 Listando playlists com GET (sem payload)...');
  // API IBOPro usa GET para listar playlists
  return await makeRequest('GET', '/playlistw', session, null);
}

async function addPlaylist(session, name, url, pin = '', protect = false, type = 'URL') {
  const payload = {
    mac_address: session.macAddress,
    playlist_name: name,
    playlist_url: url,
    playlist_type: type,
    type: type,
    is_protected: protect,
    pin: pin,
    playlist_id: null,
    playlist_host: '',
    playlist_username: '',
    playlist_password: ''
  };
  
  return await makeRequest('POST', '/playlistw', session, payload);
}

async function editPlaylist(session, playlistId, name, url, pin = '', protect = false, type = 'URL') {
  const payload = {
    mac_address: session.macAddress,
    playlist_id: playlistId,
    playlist_name: name,
    playlist_url: url,
    playlist_type: type,
    type: type,
    is_protected: protect,
    pin: pin,
    playlist_host: '',
    playlist_username: '',
    playlist_password: ''
  };
  
  return await makeRequest('POST', '/playlistw', session, payload);
}

async function deletePlaylist(session, playlistId, pin = null) {
  if (pin) {
    // Playlist protegida
    return await makeRequest('POST', '/playlistw/protected', session, {
      playlist_id: playlistId,
      pin: pin
    });
  }
  
  // Playlist não protegida - usar DELETE com payload
  const payload = {
    mac_address: session.macAddress,
    playlist_id: playlistId
  };
  
  console.log('🗑️ Deletando playlist:', playlistId);
  
  // Usar makeRequest customizado para DELETE (axios suporta body em DELETE)
  const tokens = await generateAllTokens(session.macAddress, session.password);
  
  const headers = {
    'Authorization': `Bearer ${session.token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Origin': 'https://iboplayer.pro',
    'Referer': 'https://iboplayer.pro/',
    ...tokens
  };
  
  const url = `https://${API_BASE}/playlistw`;
  
  try {
    // DELETE com body via proxy
    const response = await proxyRequest('DELETE', url, {
      headers,
      body: JSON.stringify(payload)
    });
    
    if (response.statusCode !== 200) {
      throw new Error(`Erro HTTP ${response.statusCode}: ${response.body}`);
    }
    
    const result = JSON.parse(response.body);
    console.log('✅ Playlist deletada com sucesso');
    
    return result;
  } catch (error) {
    console.error('❌ Erro ao deletar playlist:', error.message);
    throw error;
  }
}

module.exports = {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist
};