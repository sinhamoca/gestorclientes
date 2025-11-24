const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');

// ========== UTILITÁRIOS ==========

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanSvg(svgContent) {
  let cleanedSvg = svgContent;
  cleanedSvg = cleanedSvg.replace(/(<svg[^>]*width="[^"]*"[^>]*)(width="[^"]*")/gi, '$1');
  cleanedSvg = cleanedSvg.replace(/(<svg[^>]*height="[^"]*"[^>]*)(height="[^"]*")/gi, '$1');
  return cleanedSvg;
}

async function svgToPng(svgContent) {
  const cleanedSvg = cleanSvg(svgContent);
  const pngBuffer = await sharp(Buffer.from(cleanedSvg))
    .png()
    .toBuffer();
  return pngBuffer;
}

async function solveCaptcha(svgContent, apiKey) {
  const pngBuffer = await svgToPng(svgContent);
  const pngBase64 = pngBuffer.toString('base64');
  
  const formData = new FormData();
  formData.append('key', apiKey);
  formData.append('method', 'base64');
  formData.append('body', pngBase64);
  formData.append('numeric', '2');
  formData.append('min_len', '2');
  formData.append('max_len', '2');
  formData.append('json', '1');
  
  const submitResponse = await axios.post('http://2captcha.com/in.php', formData, {
    headers: formData.getHeaders()
  });
  
  if (submitResponse.data.status !== 1) {
    throw new Error(`Erro ao enviar captcha: ${submitResponse.data.request}`);
  }
  
  const captchaId = submitResponse.data.request;
  
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    await sleep(3000);
    
    const resultResponse = await axios.get('http://2captcha.com/res.php', {
      params: {
        key: apiKey,
        action: 'get',
        id: captchaId,
        json: 1
      }
    });
    
    if (resultResponse.data.status === 1) {
      return resultResponse.data.request;
    }
    
    if (resultResponse.data.request !== 'CAPCHA_NOT_READY') {
      throw new Error(`Erro na resolução: ${resultResponse.data.request}`);
    }
    
    attempts++;
  }
  
  throw new Error('Timeout ao resolver captcha');
}

// ========== AUTENTICAÇÃO ==========

async function getCaptcha(domain) {
  const response = await axios.get(`https://${domain}/frontend/captcha/generate`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': `https://${domain}/frontend/device/login`
    }
  });
  
  return response.data;
}

async function login(domain, macAddress, deviceKey, captchaApiKey) {
  console.log('🔐 Iniciando login no IBOPlayer...');
  
  console.log('📥 Obtendo captcha...');
  const captchaData = await getCaptcha(domain);
  const token = captchaData.token;
  
  if (!captchaData.svg || !token) {
    throw new Error('Captcha ou token não encontrado');
  }
  
  console.log('✅ Captcha obtido!');
  
  console.log('🔍 Resolvendo captcha...');
  const captchaSolution = await solveCaptcha(captchaData.svg, captchaApiKey);
  console.log(`✅ Captcha resolvido: ${captchaSolution}`);
  
  console.log('🔓 Fazendo login...');
  const response = await axios.post(
    `https://${domain}/frontend/device/login`,
    {
      mac_address: macAddress,
      device_key: deviceKey,
      captcha: captchaSolution,
      token: token
    },
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': `https://${domain}`,
        'Referer': `https://${domain}/frontend/device/login`
      }
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Login falhou: ' + JSON.stringify(response.data));
  }
  
  const cookies = response.headers['set-cookie'];
  
  const session = {
    domain,
    macAddress,
    deviceKey,
    deviceId: response.data.device._id,
    cookies: cookies,
    loginTime: new Date().toISOString(),
    device: response.data.device
  };
  
  console.log('✅ Login realizado com sucesso!');
  console.log(`📱 Device ID: ${session.deviceId}`);
  
  return session;
}

// ========== OPERAÇÕES DE PLAYLIST ==========

async function listPlaylists(session) {
  const response = await axios.get(
    `https://${session.domain}/frontend/device/playlists`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      }
    }
  );
  
  if (response.data.status !== 'Sucess') {
    throw new Error('Erro ao listar playlists');
  }
  
  return response.data.playlists;
}

async function addPlaylist(session, name, url, pin = '', protect = false, type = 'general') {
  const payload = {
    current_playlist_url_id: -1,
    password: '',
    pin: pin,
    playlist_name: name,
    playlist_type: type,
    playlist_url: url,
    protect: protect ? 1 : 0,
    username: '',
    xml_url: ''
  };
  
  const response = await axios.post(
    `https://${session.domain}/frontend/device/savePlaylist`,
    payload,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': `https://${session.domain}`,
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      }
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Erro ao adicionar playlist: ' + JSON.stringify(response.data));
  }
  
  return response.data.data;
}

async function editPlaylist(session, playlistId, name, url, pin = '', protect = false, type = 'general') {
  const payload = {
    current_playlist_url_id: playlistId,
    password: '',
    pin: pin,
    playlist_name: name,
    playlist_type: type,
    playlist_url: url,
    protect: protect ? 1 : 0,
    username: '',
    xml_url: ''
  };
  
  const response = await axios.post(
    `https://${session.domain}/frontend/device/savePlaylist`,
    payload,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': `https://${session.domain}`,
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      }
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Erro ao editar playlist: ' + JSON.stringify(response.data));
  }
  
  return response.data.data;
}

async function deletePlaylist(session, playlistId) {
  const response = await axios.delete(
    `https://${session.domain}/frontend/device/deletePlayListUrl/${playlistId}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': `https://${session.domain}/dashboard`,
        'Cookie': session.cookies.join('; ')
      }
    }
  );
  
  if (response.data.status !== 'success') {
    throw new Error('Erro ao deletar playlist: ' + JSON.stringify(response.data));
  }
  
  return response.data;
}

module.exports = {
  login,
  listPlaylists,
  addPlaylist,
  editPlaylist,
  deletePlaylist
};
