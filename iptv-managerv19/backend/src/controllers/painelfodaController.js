/* ========================================
   PAINELFODA CONTROLLER - GESTAO CLIENTES
   Versão FINAL CORRIGIDA com autenticação
   ======================================== */

import axios from 'axios';

const IPTV_MANAGER_URL = process.env.IPTV_MANAGER_URL || 'http://iptv_manager_backend:5001';

/**
 * Capturar packages disponíveis no PainelFoda
 * POST /api/painelfoda/capture-packages
 * 
 * Body: {
 *   domain: "painel.xyz.com",
 *   username: "revendedor1",
 *   password: "senha123"
 * }
 * 
 * Nota: user_id vem de req.user.id (preenchido pelo middleware verifyToken)
 */
export async function capturePackages(req, res) {
  try {
    const { domain, username, password } = req.body;
    const userId = req.user.id;  // ← Vem do middleware verifyToken

    console.log('\n🔍 [PAINELFODA] Recebida requisição de captura de packages');
    console.log(`   User ID: ${userId}`);
    console.log(`   Domínio: ${domain}`);

    // Validações
    if (!domain || !username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Domínio, usuário e senha são obrigatórios'
      });
    }

    // Fazer requisição para o IPTV Manager
    console.log(`📤 [PAINELFODA] Enviando requisição para: ${IPTV_MANAGER_URL}/api/painelfoda/capture-packages`);

    const response = await axios.post(
      `${IPTV_MANAGER_URL}/api/painelfoda/capture-packages`,
      {
        domain,
        username,
        password,
        user_id: userId
      },
      {
        timeout: 60000, // 60 segundos
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ [PAINELFODA] Resposta recebida do IPTV Manager`);
    
    return res.json(response.data);

  } catch (error) {
    console.error('❌ [PAINELFODA] Erro ao capturar packages:', error.message);

    if (error.response) {
      // Erro da API do IPTV Manager
      return res.status(error.response.status).json(error.response.data);
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao comunicar com IPTV Manager',
      message: error.message
    });
  }
}