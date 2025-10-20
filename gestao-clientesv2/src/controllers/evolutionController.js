import { query } from '../config/database.js';
import fetch from 'node-fetch';

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY;

const getHeaders = () => ({
  'Content-Type': 'application/json',
  'apikey': EVOLUTION_API_KEY
});

// Criar ou reconectar instância
export async function createOrConnectInstance(req, res) {
  try {
    const userId = req.user.id;
    const instanceName = `user_${userId}`;

    console.log(`📱 [User ${userId}] Solicitação de conexão WhatsApp`);

    // Verifica se já existe instância no banco
    const existingInstance = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (existingInstance.rows.length > 0) {
      const instance = existingInstance.rows[0];
      console.log(`   ℹ️  Instância existente encontrada: ${instance.instance_name} (Status: ${instance.status})`);
      
      // Se já está conectada, retorna informação
      if (instance.status === 'connected') {
        console.log(`   ✅ WhatsApp já está conectado`);
        return res.json({
          message: 'WhatsApp já conectado',
          connected: true,
          phoneNumber: instance.phone_number,
          needsQR: false
        });
      }
    }

    // Tenta criar/reconectar na Evolution API
    console.log(`🔧 Criando/reconectando instância: ${instanceName}`);
    
    try {
      // Tenta criar nova instância
      const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          instanceName: instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      if (createResponse.ok) {
        const instanceData = await createResponse.json();
        console.log(`   ✅ Instância criada com sucesso`);
        
        // Aguarda 2 segundos para Evolution API processar
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.log(`   ⚠️  Instância já existe, tentando conectar...`);
      }
    } catch (error) {
      console.log(`   ⚠️  Erro ao criar instância (pode já existir):`, error.message);
    }

    // Busca QR Code
    console.log(`🔗 Buscando QR Code...`);
    const connectResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!connectResponse.ok) {
      throw new Error('Erro ao conectar instância');
    }

    const connectData = await connectResponse.json();
    const qrCode = connectData.base64 || connectData.qrcode?.base64 || connectData.qrcode?.code || connectData.code;

    console.log(`   🔲 QR Code obtido: ${qrCode ? 'SIM ✅' : 'NÃO ❌'}`);

    // Salva no banco
    await query(
      `INSERT INTO whatsapp_instances 
       (user_id, instance_name, status, qr_code, qr_code_updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         instance_name = $2,
         status = $3,
         qr_code = $4,
         qr_code_updated_at = NOW(),
         updated_at = NOW()`,
      [userId, instanceName, 'connecting', qrCode]
    );

    console.log(`   💾 Dados salvos no banco`);
    console.log(`   📤 Retornando QR Code para frontend\n`);

    res.json({
      message: 'QR Code gerado com sucesso',
      qrCode: qrCode,
      connected: false,
      needsQR: true,
      instance: instanceName
    });

  } catch (error) {
    console.error('❌ Erro em createOrConnectInstance:', error);
    res.status(500).json({ error: error.message });
  }
}

// Buscar QR Code atualizado
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

    const instance = result.rows[0];

    // Verifica status na Evolution API primeiro
    try {
      const statusResponse = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instance.instance_name}`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const isConnected = statusData.instance?.state === 'open';

        if (isConnected) {
          // Atualiza no banco
          await query(
            `UPDATE whatsapp_instances 
             SET status = 'connected', phone_number = $1, connected_at = NOW(), updated_at = NOW()
             WHERE user_id = $2`,
            [statusData.instance?.owner, userId]
          );

          return res.json({
            connected: true,
            phoneNumber: statusData.instance?.owner
          });
        }
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }

    // Se não está conectado, busca novo QR Code
    try {
      const qrResponse = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instance.instance_name}`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        const qrCode = qrData.base64 || qrData.qrcode?.base64 || qrData.qrcode?.code || qrData.code;

        if (qrCode) {
          await query(
            `UPDATE whatsapp_instances 
             SET qr_code = $1, qr_code_updated_at = NOW()
             WHERE user_id = $2`,
            [qrCode, userId]
          );

          return res.json({
            qrCode: qrCode,
            connected: false
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar QR Code:', error);
    }

    // Retorna QR Code do banco se não conseguiu buscar novo
    res.json({
      qrCode: instance.qr_code,
      connected: false
    });

  } catch (error) {
    console.error('Error getting QR code:', error);
    res.status(500).json({ error: error.message });
  }
}

// Verificar status da conexão
export async function checkConnectionStatus(req, res) {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ connected: false, message: 'Nenhuma instância criada' });
    }

    const instance = result.rows[0];

    // Verifica status na Evolution API
    try {
      const response = await fetch(`${EVOLUTION_API_URL}/instance/connectionState/${instance.instance_name}`, {
        method: 'GET',
        headers: getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        const isConnected = data.instance?.state === 'open';

        // Atualiza status no banco
        await query(
          `UPDATE whatsapp_instances 
           SET status = $1, 
               phone_number = $2,
               connected_at = $3,
               last_ping = NOW(),
               updated_at = NOW()
           WHERE user_id = $4`,
          [
            isConnected ? 'connected' : 'disconnected',
            isConnected ? data.instance?.owner : null,
            isConnected ? (instance.connected_at || new Date()) : null,
            userId
          ]
        );

        return res.json({
          connected: isConnected,
          phoneNumber: data.instance?.owner,
          status: data.instance?.state
        });
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
    }

    res.json({
      connected: instance.status === 'connected',
      phoneNumber: instance.phone_number
    });

  } catch (error) {
    console.error('Error checking status:', error);
    res.status(500).json({ error: error.message });
  }
}

// Desconectar instância
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

    const instance = result.rows[0];

    // Desconecta na Evolution API
    try {
      await fetch(`${EVOLUTION_API_URL}/instance/logout/${instance.instance_name}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
    } catch (error) {
      console.error('Erro ao desconectar da Evolution API:', error);
    }

    // Atualiza status no banco
    await query(
      `UPDATE whatsapp_instances 
       SET status = 'disconnected', qr_code = NULL, phone_number = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ message: 'Desconectado com sucesso' });

  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: error.message });
  }
}

// Enviar mensagem de texto
export async function sendTextMessage(instanceName, phoneNumber, message) {
  try {
    const formattedNumber = phoneNumber.replace(/\D/g, '');
    const numberWithSuffix = formattedNumber.includes('@') ? formattedNumber : `${formattedNumber}@s.whatsapp.net`;

    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        number: numberWithSuffix,
        text: message,
        delay: 1200
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erro ao enviar mensagem');
    }

    return await response.json();

  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
}

// Obter instância do usuário
export async function getUserInstance(userId) {
  const result = await query(
    'SELECT * FROM whatsapp_instances WHERE user_id = $1 AND status = $2',
    [userId, 'connected']
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}
