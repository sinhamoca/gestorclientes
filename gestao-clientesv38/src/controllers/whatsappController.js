import { query } from '../config/database.js';
import WhatsAppProviderFactory from '../factories/WhatsAppProviderFactory.js';
import fetch from 'node-fetch';

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

// ==========================================
// 🔔 OBTER CONFIGURAÇÕES DE NOTIFICAÇÃO
// ==========================================
export async function getNotificationSettings(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        notify_renewal_failures,
        notify_phone_number,
        notify_on_retry_success,
        notify_on_each_retry
      FROM whatsapp_instances 
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        notify_renewal_failures: false,
        notify_phone_number: null,
        notify_on_retry_success: true,
        notify_on_each_retry: false
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('❌ Erro em getNotificationSettings:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// 🔔 SALVAR CONFIGURAÇÕES DE NOTIFICAÇÃO
// ==========================================
export async function saveNotificationSettings(req, res) {
  try {
    const userId = req.user.id;
    const {
      notify_renewal_failures,
      notify_phone_number,
      notify_on_retry_success,
      notify_on_each_retry
    } = req.body;

    console.log(`🔔 [User ${userId}] Salvando configurações de notificação`);
    console.log(`   Habilitado: ${notify_renewal_failures}`);
    console.log(`   Número: ${notify_phone_number}`);

    // Verificar se existe instância
    const existing = await query(
      'SELECT id FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Você precisa conectar o WhatsApp primeiro' 
      });
    }

    // Validar número se notificações estiverem habilitadas
    if (notify_renewal_failures && !notify_phone_number) {
      return res.status(400).json({ 
        error: 'Informe o número para receber notificações' 
      });
    }

    // Atualizar configurações
    await query(`
      UPDATE whatsapp_instances 
      SET 
        notify_renewal_failures = $1,
        notify_phone_number = $2,
        notify_on_retry_success = $3,
        notify_on_each_retry = $4,
        updated_at = NOW()
      WHERE user_id = $5
    `, [
      notify_renewal_failures || false,
      notify_phone_number || null,
      notify_on_retry_success !== false,
      notify_on_each_retry || false,
      userId
    ]);

    console.log('   ✅ Configurações salvas!');

    res.json({
      success: true,
      message: 'Configurações de notificação salvas com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro em saveNotificationSettings:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// 🔄 OBTER FILA DE RETRY
// ==========================================
export async function getRetryQueue(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        id,
        client_id,
        client_name,
        provider,
        attempts,
        max_attempts,
        status,
        last_error,
        next_retry_at,
        created_at
      FROM renewal_retry_queue 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    // Contar por status
    const statsResult = await query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM renewal_retry_queue 
      WHERE user_id = $1
      GROUP BY status
    `, [userId]);

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    statsResult.rows.forEach(row => {
      stats[row.status] = parseInt(row.count);
    });

    res.json({
      items: result.rows,
      stats
    });

  } catch (error) {
    console.error('❌ Erro em getRetryQueue:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// 🔄 RETRY MANUAL DE UM ITEM
// ==========================================
export async function manualRetry(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar se o item pertence ao usuário
    const item = await query(`
      SELECT * FROM renewal_retry_queue 
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    // Resetar para próxima execução imediata
    await query(`
      UPDATE renewal_retry_queue 
      SET 
        status = 'pending', 
        next_retry_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [id]);

    console.log(`🔄 [User ${userId}] Retry manual para item ${id}`);

    res.json({
      success: true,
      message: 'Item agendado para retry imediato'
    });

  } catch (error) {
    console.error('❌ Erro em manualRetry:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// 🗑️ REMOVER ITEM DA FILA
// ==========================================
export async function removeFromRetryQueue(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await query(`
      DELETE FROM renewal_retry_queue 
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item não encontrado' });
    }

    console.log(`🗑️ [User ${userId}] Item ${id} removido da fila de retry`);

    res.json({
      success: true,
      message: 'Item removido da fila'
    });

  } catch (error) {
    console.error('❌ Erro em removeFromRetryQueue:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// 📞 OBTER CONFIGURAÇÕES DE CHAMADAS
// ==========================================
export async function getCallSettings(req, res) {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        auto_reject_calls,
        reject_call_message,
        always_online
      FROM whatsapp_instances 
      WHERE user_id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        auto_reject_calls: false,
        reject_call_message: 'Desculpe, não recebo chamadas por aqui. Me envie uma mensagem! 📱',
        always_online: false
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('❌ Erro em getCallSettings:', error);
    res.status(500).json({ error: error.message });
  }
}

// ==========================================
// 📞 SALVAR CONFIGURAÇÕES DE CHAMADAS
// ==========================================
export async function saveCallSettings(req, res) {
  try {
    const userId = req.user.id;
    const {
      auto_reject_calls,
      reject_call_message,
      always_online
    } = req.body;

    console.log(`📞 [User ${userId}] Salvando configurações de chamadas`);
    console.log(`   Rejeitar chamadas: ${auto_reject_calls}`);
    console.log(`   Sempre online: ${always_online}`);

    // Verificar se existe instância
    const existing = await query(
      'SELECT id, instance_name, status FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(400).json({ 
        error: 'Você precisa conectar o WhatsApp primeiro' 
      });
    }

    // Atualizar configurações no banco
    await query(`
      UPDATE whatsapp_instances 
      SET 
        auto_reject_calls = $1,
        reject_call_message = $2,
        always_online = $3,
        updated_at = NOW()
      WHERE user_id = $4
    `, [
      auto_reject_calls || false,
      reject_call_message || 'Desculpe, não recebo chamadas por aqui. Me envie uma mensagem! 📱',
      always_online || false,
      userId
    ]);

    // 🆕 Se estiver conectado, aplicar configurações no WPP Connect
    const instance = existing.rows[0];
    if (instance.status === 'connected') {
      try {
        const WPP_CONNECT_URL = process.env.WPP_CONNECT_URL || 'http://whatsapp-service:9000';
        const WPP_API_KEY = process.env.WPP_CONNECT_API_KEY;

        // Enviar configurações para o serviço WPP Connect
        await fetch(`${WPP_CONNECT_URL}/api/session/${instance.instance_name}/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': WPP_API_KEY
          },
          body: JSON.stringify({
            rejectCalls: auto_reject_calls || false,
            rejectCallMessage: reject_call_message || '',
            alwaysOnline: always_online || false
          })
        });

        console.log('   ✅ Configurações aplicadas no WPP Connect');
      } catch (wppError) {
        console.warn('   ⚠️ Não foi possível aplicar no WPP Connect:', wppError.message);
        // Não retornar erro - as configs foram salvas no banco
      }
    }

    console.log('   ✅ Configurações salvas!');

    res.json({
      success: true,
      message: 'Configurações de chamadas salvas com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro em saveCallSettings:', error);
    res.status(500).json({ error: error.message });
  }
}