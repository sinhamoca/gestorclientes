import WhatsAppProvider from './WhatsAppProvider.js';
import { query } from '../config/database.js';
import fetch from 'node-fetch';

// ==========================================
// WPP CONNECT PROVIDER
// Implementação funcional para WPP Connect
// ==========================================

class WppConnectProvider extends WhatsAppProvider {
  constructor() {
    super('wppconnect');
    this.apiUrl = process.env.WPP_CONNECT_URL || 'http://whatsapp-service:9000';
    this.apiKey = process.env.WPP_CONNECT_API_KEY;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey
    };
  }

  async createOrConnectInstance(userId, instanceData) {
    try {
      const sessionId = `user_${userId}`;
      console.log(`📱 [WPP Connect] Criando sessão: ${sessionId}`);

      // Se já está conectada, verifica status
      if (instanceData && instanceData.status === 'connected') {
        try {
          const statusResponse = await fetch(`${this.apiUrl}/api/session/status/${sessionId}`, {
            method: 'GET',
            headers: this.getHeaders()
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.connected) {
              console.log(`   ✅ Sessão já conectada`);
              return {
                success: true,
                message: 'WhatsApp já conectado',
                connected: true,
                phoneNumber: statusData.phoneNumber,
                needsQR: false
              };
            }
          }
        } catch (error) {
          console.log(`   ⚠️  Erro ao verificar status:`, error.message);
        }
      }

      // Criar nova sessão
      const createResponse = await fetch(`${this.apiUrl}/api/session/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sessionId })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Erro ao criar sessão');
      }

      const createData = await createResponse.json();
      const qrCode = createData.qrCode || createData.base64 || null;
      const needsQR = createData.needsQR !== false;

      console.log(`   🔲 QR Code: ${qrCode ? 'SIM' : 'NÃO'}`);

      // Atualizar banco com provider
      await query(
        `INSERT INTO whatsapp_instances 
         (user_id, instance_name, status, provider, qr_code, qr_code_updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           instance_name = $2,
           status = $3,
           provider = $4,
           qr_code = $5,
           qr_code_updated_at = NOW(),
           updated_at = NOW()`,
        [userId, sessionId, needsQR ? 'connecting' : 'connected', 'wppconnect', qrCode]
      );

      return {
        success: true,
        message: needsQR ? 'QR Code gerado' : 'Conectado',
        qrCode,
        connected: !needsQR,
        needsQR,
        sessionId
      };

    } catch (error) {
      console.error(`❌ [WPP Connect] Erro:`, error);
      throw error;
    }
  }

  async getQRCode(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      // Verificar status
      const statusResponse = await fetch(`${this.apiUrl}/api/session/status/${sessionId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (statusData.connected) {
          await query(
            `UPDATE whatsapp_instances 
             SET status = 'connected', 
                 phone_number = $1, 
                 connected_at = NOW(), 
                 qr_code = NULL,
                 updated_at = NOW()
             WHERE user_id = $2`,
            [statusData.phoneNumber, userId]
          );

          return {
            connected: true,
            phoneNumber: statusData.phoneNumber
          };
        }
      }

      return {
        qrCode: instanceData.qr_code,
        connected: false
      };

    } catch (error) {
      console.error(`❌ [WPP Connect] Erro ao buscar QR:`, error);
      throw error;
    }
  }

  async checkConnectionStatus(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      const statusResponse = await fetch(`${this.apiUrl}/api/session/status/${sessionId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const isConnected = statusData.connected === true;

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
            statusData.phoneNumber || null,
            isConnected ? (instanceData.connected_at || new Date()) : null,
            userId
          ]
        );

        // 🆕 RETORNAR MAIS INFORMAÇÕES
        return {
          connected: isConnected,
          phoneNumber: statusData.phoneNumber,
          platform: statusData.platform,      // ← ADICIONAR
          pushname: statusData.pushname        // ← ADICIONAR
        };
      }

      return {
        connected: false
      };

    } catch (error) {
      console.error(`❌ [WPP Connect] Erro ao verificar status:`, error);
      throw error;
    }
  }

  async disconnectInstance(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      const disconnectResponse = await fetch(`${this.apiUrl}/api/session/disconnect`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ sessionId })
      });

      if (disconnectResponse.ok) {
        console.log(`   ✅ Desconectado do WPP Connect`);
      }

      await query(
        `UPDATE whatsapp_instances 
         SET status = 'disconnected', 
             qr_code = NULL, 
             phone_number = NULL, 
             updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      return {
        success: true,
        message: 'Desconectado com sucesso'
      };

    } catch (error) {
      console.error(`❌ [WPP Connect] Erro ao desconectar:`, error);
      throw error;
    }
  }

  async deleteInstance(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      const deleteResponse = await fetch(`${this.apiUrl}/api/session/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (deleteResponse.ok) {
        console.log(`   ✅ Instância deletada do WPP Connect`);
      }

      await query(
        'DELETE FROM whatsapp_instances WHERE user_id = $1',
        [userId]
      );

      return {
        success: true,
        message: 'Instância excluída com sucesso'
      };

    } catch (error) {
      console.error(`❌ [WPP Connect] Erro ao deletar:`, error);
      throw error;
    }
  }

  async sendTextMessage(sessionId, phoneNumber, message) {
    try {
      const response = await fetch(`${this.apiUrl}/api/message/send`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          sessionId,
          phoneNumber,
          message
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }

      const result = await response.json();
      console.log(`   ✅ Mensagem enviada via WPP Connect`);

      return result;

    } catch (error) {
      console.error(`❌ [WPP Connect] Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  async getUserInstance(userId) {
    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1 AND status = $2 AND provider = $3',
      [userId, 'connected', 'wppconnect']
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }
}

export default WppConnectProvider;