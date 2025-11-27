import WhatsAppProvider from './WhatsAppProvider.js';
import { query } from '../config/database.js';
import fetch from 'node-fetch';

// ==========================================
// WHATSAPP-WEB.JS PROVIDER
// Integração com serviço whatsapp-web.js
// ==========================================

class WhatsAppWebJsProvider extends WhatsAppProvider {
  constructor() {
    super('whatsappwebjs');
    this.apiUrl = process.env.WWEB_API_URL || 'http://wweb_service:9100';
    this.apiKey = process.env.WWEB_API_KEY;
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-API-Key': this.apiKey
    };
  }

  async createOrConnectInstance(userId, instanceData) {
    try {
      const sessionId = `user_${userId}`;
      console.log(`📱 [WhatsApp-Web.js] Criando sessão: ${sessionId}`);

      // Se já está conectada, verificar status
      if (instanceData && instanceData.status === 'connected') {
        try {
          const statusResponse = await fetch(`${this.apiUrl}/api/session/status/${sessionId}`, {
            method: 'GET',
            headers: this.getHeaders()
          });

          if (statusResponse.ok) {
            const statusData = await statusResponse.json();
            
            if (statusData.success && statusData.connected) {
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
      
      if (!createData.success) {
        throw new Error(createData.error || 'Falha ao criar sessão');
      }

      const qrCode = createData.qr || null;
      const needsQR = createData.needsQR !== false;
      const connected = createData.connected || false;

      console.log(`   🔲 QR Code: ${qrCode ? 'SIM' : 'NÃO'}`);
      console.log(`   📱 Status: ${connected ? 'Conectado' : 'Aguardando QR'}`);

      // Atualizar banco
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
        [
          userId, 
          sessionId, 
          connected ? 'connected' : (needsQR ? 'connecting' : 'disconnected'),
          'whatsappwebjs', 
          qrCode
        ]
      );

      return {
        success: true,
        message: connected ? 'Conectado' : (needsQR ? 'QR Code gerado' : 'Aguardando conexão'),
        qrCode,
        connected,
        needsQR,
        sessionId
      };

    } catch (error) {
      console.error(`❌ [WhatsApp-Web.js] Erro:`, error);
      throw error;
    }
  }

  async getQRCode(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      // Verificar status primeiro
      const statusResponse = await fetch(`${this.apiUrl}/api/session/status/${sessionId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (statusData.success && statusData.connected) {
          // Já conectado
          await query(
            `UPDATE whatsapp_instances 
             SET status = 'connected', 
                 phone_number = $1, 
                 connected_at = NOW(), 
                 qr_code = NULL,
                 updated_at = NOW()
             WHERE user_id = $2`,
            [statusData.phoneNumber || null, userId]
          );

          return {
            connected: true,
            phoneNumber: statusData.phoneNumber
          };
        }
      }

      // Não conectado, tentar obter QR
      const qrResponse = await fetch(`${this.apiUrl}/api/session/qr/${sessionId}`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (qrResponse.ok) {
        const qrData = await qrResponse.json();
        
        if (qrData.success && qrData.qr) {
          return {
            qrCode: qrData.qr,
            connected: false
          };
        }
      }

      // Retornar QR do banco como fallback
      return {
        qrCode: instanceData.qr_code,
        connected: false
      };

    } catch (error) {
      console.error(`❌ [WhatsApp-Web.js] Erro ao buscar QR:`, error);
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
        const isConnected = statusData.success && statusData.connected;

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

        // 🆕 RETORNAR TODAS AS INFORMAÇÕES
        return {
          connected: isConnected,
          phoneNumber: statusData.phoneNumber,
          platform: statusData.platform,      // ← ADICIONAR
          pushname: statusData.pushname,      // ← ADICIONAR
          status: statusData.status
        };
      }

      return {
        connected: false
      };

    } catch (error) {
      console.error(`❌ [WhatsApp-Web.js] Erro ao verificar status:`, error);
      throw error;
    }
  }

  async disconnectInstance(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      const disconnectResponse = await fetch(`${this.apiUrl}/api/session/disconnect/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (disconnectResponse.ok) {
        console.log(`   ✅ Desconectado do WhatsApp-Web.js`);
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
      console.error(`❌ [WhatsApp-Web.js] Erro ao desconectar:`, error);
      throw error;
    }
  }

  async deleteInstance(userId, instanceData) {
    try {
      const sessionId = instanceData.instance_name;

      // Desconectar primeiro
      await fetch(`${this.apiUrl}/api/session/disconnect/${sessionId}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      }).catch(() => {});

      console.log(`   ✅ Instância deletada do WhatsApp-Web.js`);

      await query(
        'DELETE FROM whatsapp_instances WHERE user_id = $1',
        [userId]
      );

      return {
        success: true,
        message: 'Instância excluída com sucesso'
      };

    } catch (error) {
      console.error(`❌ [WhatsApp-Web.js] Erro ao deletar:`, error);
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
          to: phoneNumber,
          message
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao enviar mensagem');
      }

      const result = await response.json();
      console.log(`   ✅ Mensagem enviada via WhatsApp-Web.js`);

      return result;

    } catch (error) {
      console.error(`❌ [WhatsApp-Web.js] Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  async getUserInstance(userId) {
    const result = await query(
      'SELECT * FROM whatsapp_instances WHERE user_id = $1 AND status = $2 AND provider = $3',
      [userId, 'connected', 'whatsappwebjs']
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }
}

export default WhatsAppWebJsProvider;