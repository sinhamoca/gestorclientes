import { query } from '../config/database.js';
import { decryptSystemWhatsApp } from '../utils/systemEncryption.js'; // 🔐 NOVO

// Listar lembretes
export async function listReminders(req, res) {
  try {
    const result = await query(
      `SELECT r.*, t.name as template_name
       FROM reminders r
       LEFT JOIN message_templates t ON r.template_id = t.id
       WHERE r.user_id = $1
       ORDER BY r.days_offset ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('List reminders error:', error);
    res.status(500).json({ error: 'Erro ao listar lembretes' });
  }
}

// Criar lembrete
export async function createReminder(req, res) {
  try {
    const { name, template_id, days_offset, send_time, send_once } = req.body;

    // Verifica se o template existe e pertence ao usuário
    const templateCheck = await query(
      'SELECT id FROM message_templates WHERE id = $1 AND user_id = $2',
      [template_id, req.user.id]
    );

    if (templateCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Template não encontrado' });
    }

    const result = await query(
      `INSERT INTO reminders (user_id, name, template_id, days_offset, send_time, is_active, send_once)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user.id, name, template_id, days_offset, send_time || '09:00:00', true, send_once || false]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create reminder error:', error);
    res.status(500).json({ error: 'Erro ao criar lembrete' });
  }
}

// Atualizar lembrete
export async function updateReminder(req, res) {
  try {
    const { id } = req.params;
    const { name, template_id, days_offset, send_time, is_active, send_once } = req.body;

    // Verifica se o template existe
    if (template_id) {
      const templateCheck = await query(
        'SELECT id FROM message_templates WHERE id = $1 AND user_id = $2',
        [template_id, req.user.id]
      );

      if (templateCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Template não encontrado' });
      }
    }

    const result = await query(
      `UPDATE reminders 
       SET name = $1, template_id = $2, days_offset = $3, send_time = $4, 
           is_active = $5, send_once = $6, updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [name, template_id, days_offset, send_time, is_active, send_once || false, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lembrete não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update reminder error:', error);
    res.status(500).json({ error: 'Erro ao atualizar lembrete' });
  }
}

// Deletar lembrete
export async function deleteReminder(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lembrete não encontrado' });
    }

    res.json({ message: 'Lembrete excluído com sucesso' });
  } catch (error) {
    console.error('Delete reminder error:', error);
    res.status(500).json({ error: 'Erro ao excluir lembrete' });
  }
}

// ========================================
// PREVIEW - Quantos clientes serão afetados
// GET /api/reminders/preview-send-now?reminder_ids=1,2,3
// ========================================
export async function previewSendNow(req, res) {
  try {
    const { reminder_ids } = req.query;
    
    if (!reminder_ids) {
      return res.status(400).json({ error: 'reminder_ids é obrigatório' });
    }

    const ids = reminder_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    
    if (ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum ID válido fornecido' });
    }

    // Verificar se os lembretes pertencem ao usuário
    const remindersResult = await query(
      `SELECT id, name, days_offset, send_once
       FROM reminders 
       WHERE id = ANY($1) AND user_id = $2 AND is_active = true`,
      [ids, req.user.id]
    );

    const reminders = remindersResult.rows;
    
    if (reminders.length === 0) {
      return res.json({ 
        total_clients: 0, 
        by_reminder: {},
        message: 'Nenhum lembrete ativo encontrado' 
      });
    }

    const byReminder = {};
    let totalClients = 0;
    const clientsSet = new Set(); // Para evitar contar o mesmo cliente duas vezes

    for (const reminder of reminders) {
      // Contar clientes que se enquadram neste lembrete HOJE
      let clientQuery = `
        SELECT COUNT(DISTINCT c.id) as count
        FROM clients c
        WHERE c.user_id = $1 
        AND c.is_active = true
        AND (c.whatsapp_valid IS NULL OR c.whatsapp_valid = true)
        AND (c.due_date - (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) = $2
      `;
      
      const params = [req.user.id, reminder.days_offset];

      // Se é send_once, excluir clientes que já receberam
      if (reminder.send_once) {
        clientQuery += `
          AND c.id NOT IN (
            SELECT client_id FROM reminder_sent_log WHERE reminder_id = $3
          )
        `;
        params.push(reminder.id);
      }

      const countResult = await query(clientQuery, params);
      const count = parseInt(countResult.rows[0].count) || 0;
      
      byReminder[reminder.id] = count;
      
      // Buscar IDs dos clientes para contagem total única
      let clientIdsQuery = `
        SELECT DISTINCT c.id
        FROM clients c
        WHERE c.user_id = $1 
        AND c.is_active = true
        AND (c.whatsapp_valid IS NULL OR c.whatsapp_valid = true)
        AND (c.due_date - (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) = $2
      `;
      
      const idsParams = [req.user.id, reminder.days_offset];
      
      if (reminder.send_once) {
        clientIdsQuery += `
          AND c.id NOT IN (
            SELECT client_id FROM reminder_sent_log WHERE reminder_id = $3
          )
        `;
        idsParams.push(reminder.id);
      }

      const idsResult = await query(clientIdsQuery, idsParams);
      idsResult.rows.forEach(row => clientsSet.add(row.id));
    }

    // O total é a soma dos clientes por lembrete (pode haver duplicatas se o mesmo cliente
    // se enquadra em múltiplos lembretes - isso é intencional, pois receberá múltiplas mensagens)
    totalClients = Object.values(byReminder).reduce((sum, count) => sum + count, 0);

    res.json({
      total_clients: totalClients,
      unique_clients: clientsSet.size,
      by_reminder: byReminder,
      reminders_found: reminders.length
    });

  } catch (error) {
    console.error('Preview send now error:', error);
    res.status(500).json({ error: 'Erro ao calcular preview' });
  }
}

// ========================================
// SEND NOW - Executar envio imediato
// POST /api/reminders/send-now
// Body: { reminder_ids: [1, 2, 3] }
// ========================================
export async function sendNow(req, res) {
  try {
    const { reminder_ids } = req.body;
    
    if (!reminder_ids || !Array.isArray(reminder_ids) || reminder_ids.length === 0) {
      return res.status(400).json({ error: 'reminder_ids é obrigatório e deve ser um array' });
    }

    const ids = reminder_ids.map(id => parseInt(id)).filter(id => !isNaN(id));

    console.log('\n' + '='.repeat(60));
    console.log('🚀 ENVIO IMEDIATO DE LEMBRETES');
    console.log('='.repeat(60));
    console.log(`📋 Lembretes solicitados: ${ids.join(', ')}`);
    console.log(`👤 Usuário: ${req.user.id}`);

    // Buscar lembretes ativos do usuário
    const remindersResult = await query(
      `SELECT r.*, t.message as template_message, t.id as template_id
       FROM reminders r
       JOIN message_templates t ON r.template_id = t.id
       WHERE r.id = ANY($1) 
       AND r.user_id = $2 
       AND r.is_active = true
       AND t.is_active = true`,
      [ids, req.user.id]
    );

    const reminders = remindersResult.rows;

    if (reminders.length === 0) {
      console.log('⚠️  Nenhum lembrete ativo encontrado');
      return res.status(400).json({ error: 'Nenhum lembrete ativo encontrado' });
    }

    console.log(`✅ ${reminders.length} lembrete(s) encontrado(s)`);

    // Verificar instância WhatsApp
    const instanceResult = await query(
      `SELECT instance_name, status FROM whatsapp_instances WHERE user_id = $1`,
      [req.user.id]
    );

    if (instanceResult.rows.length === 0 || instanceResult.rows[0].status !== 'connected') {
      console.log('❌ WhatsApp não conectado');
      return res.status(400).json({ 
        error: 'WhatsApp não está conectado. Conecte primeiro antes de enviar.' 
      });
    }

    const instanceName = instanceResult.rows[0].instance_name;
    console.log(`📱 WhatsApp conectado: ${instanceName}`);

    let totalQueued = 0;
    const results = [];

    for (const reminder of reminders) {
      console.log(`\n📌 Processando: "${reminder.name}" (ID: ${reminder.id})`);
      console.log(`   Days offset: ${reminder.days_offset}`);

      // Buscar clientes que se enquadram HOJE
      let clientQuery = `
        SELECT 
          c.id as client_id,
          c.name,
          c.whatsapp_number,
          c.whatsapp_number_internal,
          c.due_date,
          c.price_value,
          c.payment_token,
          p.name as plan_name,
          s.name as server_name
        FROM clients c
        LEFT JOIN plans p ON c.plan_id = p.id
        LEFT JOIN servers s ON c.server_id = s.id
        WHERE c.user_id = $1 
        AND c.is_active = true
        AND (c.whatsapp_valid IS NULL OR c.whatsapp_valid = true)
        AND (c.due_date - (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) = $2
      `;

      const params = [req.user.id, reminder.days_offset];

      // Se é send_once, excluir quem já recebeu
      if (reminder.send_once) {
        clientQuery += `
          AND c.id NOT IN (
            SELECT client_id FROM reminder_sent_log WHERE reminder_id = $3
          )
        `;
        params.push(reminder.id);
      }

      const clientsResult = await query(clientQuery, params);
      const clients = clientsResult.rows;

      console.log(`   📊 ${clients.length} cliente(s) encontrado(s)`);

      if (clients.length === 0) {
        results.push({
          reminder_id: reminder.id,
          reminder_name: reminder.name,
          clients_queued: 0
        });
        continue;
      }

      // Adicionar à fila de mensagens
      for (const client of clients) {
        // Descriptografar WhatsApp
        let whatsappNumber = client.whatsapp_number;
        
        if (client.whatsapp_number_internal && process.env.SYSTEM_ENCRYPTION_KEY) {
          try {
            whatsappNumber = decryptSystemWhatsApp(client.whatsapp_number_internal);
          } catch (err) {
            console.error(`   ⚠️  Erro ao descriptografar WhatsApp do cliente ${client.name}`);
            continue;
          }
        }

        if (!whatsappNumber) {
          console.log(`   ⚠️  Cliente ${client.name} sem WhatsApp`);
          continue;
        }

        // Processar template com variáveis
        let message = reminder.template_message;
        message = message.replace(/\{nome\}/gi, client.name);
        message = message.replace(/\{vencimento\}/gi, formatDate(client.due_date));
        message = message.replace(/\{valor\}/gi, formatCurrency(client.price_value));
        message = message.replace(/\{plano\}/gi, client.plan_name || 'N/A');
        message = message.replace(/\{servidor\}/gi, client.server_name || 'N/A');

        // Link de pagamento
        if (client.payment_token) {
          const paymentLink = `${process.env.FRONTEND_URL || 'https://comprarecarga.shop'}/pay/${client.payment_token}`;
          message = message.replace(/\{link_pagamento\}/gi, paymentLink);
        } else {
          message = message.replace(/\{link_pagamento\}/gi, '[Link não disponível]');
        }

        // Inserir na fila
        await query(
          `INSERT INTO message_queue (user_id, instance_name, client_id, reminder_id, template_id, whatsapp_number, message, status, scheduled_for)
          VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())`,
          [req.user.id, instanceName, client.client_id, reminder.id, reminder.template_id, whatsappNumber, message]
        );

        totalQueued++;
      }

      results.push({
        reminder_id: reminder.id,
        reminder_name: reminder.name,
        clients_queued: clients.length
      });

      console.log(`   ✅ ${clients.length} mensagem(ns) adicionada(s) à fila`);
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🎯 TOTAL: ${totalQueued} mensagem(ns) na fila`);
    console.log('='.repeat(60) + '\n');

    // Registrar no log de atividades
    if (totalQueued > 0) {
      try {
        await query(
          `INSERT INTO activity_logs (user_id, type, status, title, description)
           VALUES ($1, 'whatsapp', 'success', $2, $3)`,
          [
            req.user.id,
            `Envio manual: ${totalQueued} mensagens`,
            `Enviado manualmente via botão "Enviar Agora". Lembretes: ${reminders.map(r => r.name).join(', ')}`
          ]
        );
      } catch (logError) {
        console.error('Erro ao registrar log:', logError);
      }
    }

    res.json({
      success: true,
      message: `${totalQueued} mensagem(s) adicionada(s) à fila de envio`,
      total_queued: totalQueued,
      details: results
    });

  } catch (error) {
    console.error('Send now error:', error);
    res.status(500).json({ error: 'Erro ao processar envio imediato' });
  }
}

// ========================================
// HELPERS
// ========================================
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
  if (!value) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

export async function getClientsForReminders(req, res) {
  try {
    const result = await query(
      `SELECT 
        c.id as client_id,
        c.name as client_name,
        c.whatsapp_number,
        c.whatsapp_number_internal,
        c.due_date,
        r.id as reminder_id,
        r.name as reminder_name,
        r.days_offset,
        t.id as template_id,
        t.message as template_message,
        (c.due_date - CURRENT_DATE) as days_until_due
       FROM clients c
       CROSS JOIN reminders r
       LEFT JOIN message_templates t ON r.template_id = t.id
       WHERE c.user_id = $1 
       AND c.is_active = true
       AND r.is_active = true
       AND r.user_id = $1
       AND (c.due_date - CURRENT_DATE) = r.days_offset
       ORDER BY c.name`,
      [req.user.id]
    );

    // 🔐 Descriptografar WhatsApp com chave do sistema
    const clientsWithDecryptedWhatsApp = result.rows.map(client => {
      try {
        // Se tem WhatsApp criptografado internamente, descriptografa
        if (client.whatsapp_number_internal) {
          client.whatsapp_number = decryptSystemWhatsApp(client.whatsapp_number_internal);
          console.log(`🔓 WhatsApp descriptografado para cliente: ${client.client_name}`);
        }
        // Remove o campo criptografado da resposta
        delete client.whatsapp_number_internal;
      } catch (error) {
        console.error(`❌ Erro ao descriptografar WhatsApp do cliente ${client.client_id}:`, error);
        client.whatsapp_number = null;
      }
      return client;
    });

    res.json(clientsWithDecryptedWhatsApp);
  } catch (error) {
    console.error('Get clients for reminders error:', error);
    res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
}
