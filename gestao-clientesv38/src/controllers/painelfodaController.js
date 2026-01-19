/* ========================================
   PAINELFODA CONTROLLER - GESTAO CLIENTES
   Versão ROBUSTA com fallback e debug
   ======================================== */

import axios from 'axios';

const IPTV_MANAGER_URL = process.env.IPTV_MANAGER_URL || 'http://iptv_manager_backend:5001';

/**
 * Capturar packages disponíveis no PainelFoda
 * POST /api/painelfoda/capture-packages
 */
export async function capturePackages(req, res) {
  try {
    // ========== DEBUG ==========
    console.log('\n🔍 [PAINELFODA-DEBUG] Dados da requisição:');
    console.log('   req.user:', req.user);
    console.log('   req.body:', JSON.stringify(req.body, null, 2));
    console.log('   Authorization:', req.headers.authorization ? 'presente' : 'ausente');

    const { domain, username, password, user_id } = req.body;
    
    // Tentar várias fontes para o user_id (ordem de prioridade)
    const userId = req.user?.id || user_id || 0;
    
    console.log(`   → User ID final: ${userId} (origem: ${req.user?.id ? 'middleware' : user_id ? 'body' : 'default'})`);

    // Validações
    if (!domain || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Domínio, usuário e senha são obrigatórios'
      });
    }

    console.log('\n📤 [PAINELFODA] Enviando para IPTV Manager...');
    console.log(`   URL: ${IPTV_MANAGER_URL}/api/painelfoda/capture-packages`);
    console.log(`   Domain: ${domain}`);
    console.log(`   Username: ${username}`);
    console.log(`   User ID: ${userId}`);

    // Fazer requisição para o IPTV Manager
    const response = await axios.post(
      `${IPTV_MANAGER_URL}/api/painelfoda/capture-packages`,
      {
        domain,
        username,
        password,
        user_id: userId
      },
      {
        timeout: 60000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ [PAINELFODA] Resposta recebida do IPTV Manager');
    console.log('   Success:', response.data.success);
    console.log('   Packages:', response.data.packages?.length || 0);
    
    return res.json(response.data);

  } catch (error) {
    console.error('\n❌ [PAINELFODA] Erro:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        error: 'IPTV Manager não está acessível',
        message: 'Verifique se o container iptv_manager_backend está rodando'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao comunicar com IPTV Manager',
      message: error.message
    });
  }
}