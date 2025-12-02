import { query } from '../config/database.js';
import WhatsAppProviderFactory from '../factories/WhatsAppProviderFactory.js';

// ==========================================
// WHATSAPP CONTROLLER UNIFICADO
// Suporta múltiplos providers via Factory Pattern
// ==========================================

// ==========================================
// CRIAR OU RECONECTAR INSTÂNCIA
// ==========================================
export async function createOrConnectInstance(req, res) {
  try {
    const userId = req.user.id;

    console.log(`📱 [User ${userId}] Solicitação de conexão WhatsApp`);

    // Buscar instância existente no banco
    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    const instanceData = result.rows.length > 0 ? result.rows[0] : null;
    
    // Determinar qual provider usar
    const providerName = instanceData?.provider || 'wppconnect'; // Default: wppconnect
    
    console.log(`   🏭 Provider selecionado: ${providerName}`);

    // Obter provider via Factory
    const provider = WhatsAppProviderFactory.getProvider(providerName);

    // Verificar se provider está disponível
    if (!WhatsAppProviderFactory.isProviderAvailable(providerName)) {
      return res.status(400).json({
        error: `Provider '${providerName}' ainda não está disponível. Use 'wppconnect'.`,
        availableProviders: WhatsAppProviderFactory.getAvailableProviders()
      });
    }

    // Executar ação no provider
    const response = await provider.createOrConnectInstance(userId, instanceData);

    res.json(response);

  } catch (error) {
    console.error('❌ Erro em createOrConnectInstance:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// BUSCAR QR CODE ATUALIZADO
// ==========================================
export async function getQRCode(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma instância encontrada' });
    }

    const instanceData = result.rows[0];
    const provider = WhatsAppProviderFactory.getProvider(instanceData.provider);

    const response = await provider.getQRCode(userId, instanceData);

    res.json(response);

  } catch (error) {
    console.error('❌ Erro em getQRCode:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// VERIFICAR STATUS DA CONEXÃO
// ==========================================
export async function checkConnectionStatus(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ 
        connected: false, 
        message: 'Nenhuma instância criada' 
      });
    }

    const instanceData = result.rows[0];
    const provider = WhatsAppProviderFactory.getProvider(instanceData.provider);

    const response = await provider.checkConnectionStatus(userId, instanceData);

    res.json(response);

  } catch (error) {
    console.error('❌ Erro em checkConnectionStatus:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// DESCONECTAR INSTÂNCIA
// ==========================================
export async function disconnectInstance(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma instância encontrada' });
    }

    const instanceData = result.rows[0];
    const provider = WhatsAppProviderFactory.getProvider(instanceData.provider);

    const response = await provider.disconnectInstance(userId, instanceData);

    res.json(response);

  } catch (error) {
    console.error('❌ Erro em disconnectInstance:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// EXCLUIR INSTÂNCIA COMPLETAMENTE
// ==========================================
export async function deleteInstance(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nenhuma instância encontrada' });
    }

    const instanceData = result.rows[0];
    const provider = WhatsAppProviderFactory.getProvider(instanceData.provider);

    const response = await provider.deleteInstance(userId, instanceData);

    res.json(response);

  } catch (error) {
    console.error('❌ Erro em deleteInstance:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// SALVAR PROVIDER PREFERIDO
// (Nova rota - antes de conectar)
// ==========================================
export async function setPreferredProvider(req, res) {
  try {
    const userId = req.user.id;
    const { provider } = req.body;

    console.log(`🏭 [User ${userId}] Selecionando provider: ${provider}`);

    // Validar provider
    if (!['wppconnect', 'evolution', 'baileys', 'whatsappwebjs'].includes(provider)) {
      return res.status(400).json({ 
        error: 'Provider inválido',
        validProviders: ['wppconnect', 'evolution', 'baileys']
      });
    }

    // Verificar se provider está disponível
    if (!WhatsAppProviderFactory.isProviderAvailable(provider)) {
      return res.status(400).json({
        error: `Provider '${provider}' ainda não está disponível`,
        availableProviders: WhatsAppProviderFactory.getAvailableProviders()
      });
    }

    // Verificar se há instância conectada
    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length > 0) {
      const instance = result.rows[0];
      
      if (instance.status === 'connected') {
        return res.status(400).json({
          error: 'Você deve desconectar o WhatsApp antes de trocar de provider',
          currentProvider: instance.provider,
          currentStatus: 'connected'
        });
      }

      // Se desconectado, permite trocar
      await query(
        `UPDATE whatsapp_instances 
         SET provider = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [provider, userId]
      );

      console.log(`   ✅ Provider atualizado para: ${provider}`);
    } else {
      // Nenhuma instância ainda, cria registro com provider
      await query(
        `INSERT INTO whatsapp_instances (user_id, instance_name, provider, status)
         VALUES ($1, $2, $3, 'disconnected')
         ON CONFLICT (user_id) 
         DO UPDATE SET provider = $3, updated_at = NOW()`,
        [userId, `user_${userId}`, provider]
      );

      console.log(`   ✅ Provider definido como: ${provider}`);
    }

    res.json({
      success: true,
      message: 'Provider selecionado com sucesso',
      provider: provider
    });

  } catch (error) {
    console.error('❌ Erro em setPreferredProvider:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// LISTAR PROVIDERS DISPONÍVEIS
// ==========================================
export async function listProviders(req, res) {
  try {
    const userId = req.user.id;

    // Buscar provider atual do usuário
    const result = await query(
      'SELECT provider, status FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    const currentProvider = result.rows.length > 0 ? result.rows[0].provider : null;
    const currentStatus = result.rows.length > 0 ? result.rows[0].status : null;

    // Lista de providers disponíveis
    const providers = WhatsAppProviderFactory.getAvailableProviders();

    res.json({
      providers,
      currentProvider,
      currentStatus,
      canChangeProvider: currentStatus !== 'connected'
    });

  } catch (error) {
    console.error('❌ Erro em listProviders:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// ENVIAR MENSAGEM DE TEXTO
// (Função auxiliar interna)
// ==========================================
export async function sendTextMessage(instanceName, phoneNumber, message) {
  try {
    // Extrair userId do instanceName (ex: user_2 → 2)
    const userId = parseInt(instanceName.replace('user_', ''));

    // Buscar provider do usuário
    const result = await query(
      'SELECT provider FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Instância não encontrada');
    }

    const providerName = result.rows[0].provider;
    const provider = WhatsAppProviderFactory.getProvider(providerName);

    return await provider.sendTextMessage(instanceName, phoneNumber, message);

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    throw error;
  }
}

// ==========================================
// OBTER INSTÂNCIA DO USUÁRIO
// (Função auxiliar interna)
// ==========================================
export async function getUserInstance(userId) {
  const result = await query(
    'SELECT * FROM whatsapp_instances WHERE user_id = $1 AND status = $2',
    [userId, 'connected']
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}
