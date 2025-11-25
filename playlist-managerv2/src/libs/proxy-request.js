/**
 * Proxy Request Module
 * Usa axios + socks-proxy-agent para fazer requisições via SOCKS5
 * Rotaciona entre múltiplos proxies ProxyEmpire configurados no .env
 */

const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

// Carregar proxies do .env
const PROXIES = process.env.PROXY_LIST 
  ? process.env.PROXY_LIST.split(',').map(p => p.trim())
  : [
      // Fallback caso PROXY_LIST não esteja configurado
      'socks5://r_28f81eb282-country-br-sid-8bk6f6jh:0e79cc45d3@15.235.35.31:5000',
      'socks5://r_28f81eb282-country-br-sid-acja2a57:0e79cc45d3@15.235.35.31:5000'
    ];

console.log(`🌐 Carregados ${PROXIES.length} proxy(s) residencial(is) brasileiro(s)`);

let currentProxyIndex = 0;

/**
 * Pegar próximo proxy (rotação circular)
 */
function getNextProxy() {
  const proxy = PROXIES[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXIES.length;
  return proxy;
}

/**
 * Faz requisição HTTP usando axios + SOCKS5 proxy
 * @param {string} method - Método HTTP (GET, POST, etc)
 * @param {string} url - URL completa
 * @param {object} options - Opções da requisição
 * @returns {Promise<object>} - {statusCode, headers, body}
 */
async function proxyRequest(method, url, options = {}) {
  const { headers = {}, body = null, timeout = 30000 } = options;
  
  const proxyUrl = getNextProxy();
  const httpsAgent = new SocksProxyAgent(proxyUrl);
  
  console.log('🌐 Fazendo requisição via proxy SOCKS5...');
  console.log('   Proxy:', proxyUrl.replace(/:[^:]*@/, ':****@')); // Ocultar senha no log
  
  try {
    // Montar config do axios
    const axiosConfig = {
      method: method.toLowerCase(),
      url: url,
      headers: headers,
      httpsAgent: httpsAgent,
      httpAgent: httpsAgent,
      timeout: timeout,
      validateStatus: () => true, // Não lançar erro em status codes 4xx/5xx
      maxRedirects: 0 // NÃO seguir redirects automaticamente (importante para VU Player login)
    };
    
    // Adicionar 'data' se não for GET e tiver body
    // DELETE pode ter body em algumas APIs
    if (method.toUpperCase() !== 'GET' && body) {
      axiosConfig.data = body;
    }
    
    const response = await axios(axiosConfig);
    
    console.log('✅ Requisição via proxy concluída');
    console.log('   Status:', response.status);
    console.log('   Body (primeiros 200 chars):', JSON.stringify(response.data).substring(0, 200));
    
    return {
      statusCode: response.status,
      headers: response.headers,
      body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    };
  } catch (error) {
    // Axios lança erro em redirects quando maxRedirects: 0
    // Mas queremos capturar isso como sucesso
    if (error.response) {
      console.log('✅ Requisição via proxy concluída (redirect)');
      console.log('   Status:', error.response.status);
      
      return {
        statusCode: error.response.status,
        headers: error.response.headers,
        body: typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)
      };
    }
    
    console.error('❌ Erro na requisição via proxy:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('   Proxy offline ou inacessível');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('   Timeout na conexão com o proxy');
    } else if (error.code === 'ENOTFOUND') {
      console.error('   Erro de DNS - servidor não encontrado');
    }
    
    throw error;
  }
}

/**
 * Helper para fazer requisições POST via proxy
 */
async function proxyPost(url, data, headers = {}) {
  return proxyRequest('POST', url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: data
  });
}

/**
 * Helper para fazer requisições GET via proxy
 */
async function proxyGet(url, headers = {}) {
  return proxyRequest('GET', url, { headers });
}

module.exports = {
  proxyRequest,
  proxyPost,
  proxyGet
};
