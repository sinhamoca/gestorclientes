/* ========================================
   PAINELFODA CONTROLLER - IPTV MANAGER
   Versão CORRETA para captura de packages
   ======================================== */

import PainelFodaRenewalService from '../services/painelfoda-renewal.js';

/**
 * Capturar packages disponíveis no PainelFoda
 * POST /api/painelfoda/capture-packages
 * 
 * Body: {
 *   domain: "painel.xyz.com",
 *   username: "revendedor1",
 *   password: "senha123",
 *   user_id: 36  // ← Vem do gestao-clientes
 * }
 * 
 * Nota: Esta rota NÃO tem autenticação pois recebe requisições internas
 * do Gestao Clientes (que já fez a autenticação)
 */
export async function capturePackages(req, res) {
  try {
    // Pegar dados do body (enviados pelo gestao-clientes)
    const { domain, username, password, user_id } = req.body;

    console.log('\n' + '='.repeat(60));
    console.log('📦 [PAINELFODA] CAPTURA DE PACKAGES');
    console.log('='.repeat(60));
    console.log(`   User ID: ${user_id}`);
    console.log(`   Domínio: ${domain}`);
    console.log(`   Username: ${username}`);

    // Validações
    if (!domain || !username || !password) {
      console.error('❌ [PAINELFODA] Dados obrigatórios faltando');
      return res.status(400).json({
        success: false,
        error: 'Domínio, usuário e senha são obrigatórios'
      });
    }

    // Criar serviço PainelFoda
    const service = new PainelFodaRenewalService(domain, username, password);

    // ========== FAZER LOGIN ==========
    console.log('\n🔑 [PAINELFODA] Fazendo login...');
    await service.login();
    console.log('✅ [PAINELFODA] Login realizado com sucesso!');

    // ========== CAPTURAR MEMBER ID ==========
    console.log('\n🔍 [PAINELFODA] Capturando member_id...');
    const memberId = await service.getMemberId();
    
    if (!memberId) {
      console.error('❌ [PAINELFODA] Não foi possível capturar o member_id');
      return res.status(500).json({
        success: false,
        error: 'Não foi possível capturar o member_id'
      });
    }
    console.log(`✅ [PAINELFODA] Member ID: ${memberId}`);

    // ========== LISTAR CLIENTES (para descobrir packages) ==========
    console.log('\n📥 [PAINELFODA] Carregando clientes para descobrir packages...');
    console.log('   ⚠️  Isso pode levar alguns segundos...');
    
    await service.listClients(memberId);
    console.log('✅ [PAINELFODA] Clientes carregados!');

    // ========== EXTRAIR PACKAGES ÚNICOS ==========
    console.log('\n📦 [PAINELFODA] Extraindo packages únicos...');
    const packages = await service.findPackages();
    
    console.log(`✅ [PAINELFODA] ${packages.length} packages encontrados:`);
    packages.forEach(pkg => {
      console.log(`   [${pkg.id}] ${pkg.nome}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ [PAINELFODA] CAPTURA CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(60) + '\n');

    return res.json({
      success: true,
      packages: packages,
      member_id: memberId,
      total_clients: service.clients?.length || 0
    });

  } catch (error) {
    console.error('\n❌ [PAINELFODA] Erro ao capturar packages:', error.message);
    
    // Tratar erros específicos
    if (error.message.includes('Login falhou') || error.message.includes('401')) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais inválidas',
        message: 'Verifique usuário e senha do painel'
      });
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      return res.status(503).json({
        success: false,
        error: 'Painel não acessível',
        message: `Não foi possível conectar ao domínio ${req.body.domain}`
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro ao capturar packages',
      message: error.message
    });
  }
}