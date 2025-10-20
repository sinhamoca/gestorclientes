// gestao-clientesv2/src/reminderCron.js
import { query } from './config/database.js';
import cron from 'node-cron';
import { sendTextMessage, getUserInstance } from './controllers/evolutionController.js';

// ========== CONFIGURAÇÕES ==========
const RETRY_ATTEMPTS = 3;

// ========== FUNÇÕES AUXILIARES ==========

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function replaceVariables(message, client) {
  const today = new Date();
  const dueDate = new Date(client.due_date);
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const dueDateFormatted = dueDate.toLocaleDateString('pt-BR');
  const valueFormatted = `R$ ${parseFloat(client.price_value).toFixed(2)}`;

  return message
    .replace(/\{\{nome\}\}/g, client.name)
    .replace(/\{\{vencimento\}\}/g, dueDateFormatted)
    .replace(/\{\{valor\}\}/g, valueFormatted)
    .replace(/\{\{servidor\}\}/g, client.server_name || 'N/A')
    .replace(/\{\{plano\}\}/g, client.plan_name || 'N/A')
    .replace(/\{\{dias\}\}/g, Math.abs(diffDays).toString())
    .replace(/\{\{whatsapp\}\}/g, client.whatsapp_number);
}

async function wasMessageSentToday(userId, clientId, reminderId) {
  const result = await query(
    `SELECT id FROM message_logs 
     WHERE user_id = $1 AND client_id = $2 AND reminder_id = $3 
     AND DATE(sent_at) = CURRENT_DATE`,
    [userId, clientId, reminderId]
  );
  return result.rows.length > 0;
}

async function logMessage(userId, clientId, reminderId, templateId, message, whatsapp, status = 'sent', error = null) {
  await query(
    `INSERT INTO message_logs 
     (user_id, client_id, reminder_id, template_id, message_sent, whatsapp_number, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, clientId, reminderId, templateId, message, whatsapp, status, error]
  );
}

// ========== 1. POPULAR A FILA (Executa a cada minuto) ==========

export async function populateQueue() {
  try {
    const currentTime = new Date().toTimeString().substring(0, 5);
    
    // Busca todos os lembretes ativos que devem rodar agora
    const remindersResult = await query(
      `SELECT r.*, u.id as user_id, t.message as template_message, t.id as template_id
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       JOIN message_templates t ON r.template_id = t.id
       WHERE r.is_active = true 
       AND t.is_active = true
       AND u.is_active = true
       AND r.send_time::time::text LIKE $1`,
      [currentTime + '%']
    );

    const reminders = remindersResult.rows;
    
    if (reminders.length === 0) return;

    console.log(`[${new Date().toISOString()}] 📋 Populando fila - ${reminders.length} lembretes ativos`);

    let totalQueued = 0;

    for (const reminder of reminders) {
      // Busca instância WhatsApp do usuário
      const userInstance = await getUserInstance(reminder.user_id);
      if (!userInstance) {
        console.log(`   ⚠️  User ${reminder.user_id} - WhatsApp desconectado`);
        continue;
      }

      // Busca clientes que devem receber
      const clientsResult = await query(
        `SELECT 
          c.id as client_id,
          c.name,
          c.whatsapp_number,
          c.due_date,
          c.price_value,
          p.name as plan_name,
          s.name as server_name
         FROM clients c
         LEFT JOIN plans p ON c.plan_id = p.id
         LEFT JOIN servers s ON c.server_id = s.id
         WHERE c.user_id = $1 
         AND c.is_active = true
         AND (c.due_date - CURRENT_DATE) = $2`,
        [reminder.user_id, reminder.days_offset]
      );

      const clients = clientsResult.rows;

      // Adiciona à fila
      for (const client of clients) {
        // Verifica se já enviou hoje
        const alreadySent = await wasMessageSentToday(
          reminder.user_id,
          client.client_id,
          reminder.id
        );

        if (alreadySent) continue;

        // Verifica se já está na fila
        const inQueue = await query(
          `SELECT id FROM message_queue 
           WHERE user_id = $1 AND client_id = $2 AND reminder_id = $3 
           AND status IN ('pending', 'processing')`,
          [reminder.user_id, client.client_id, reminder.id]
        );

        if (inQueue.rows.length > 0) continue;

        // Monta mensagem
        const message = replaceVariables(reminder.template_message, client);

        // Adiciona à fila
        await query(
          `INSERT INTO message_queue 
           (user_id, instance_name, client_id, reminder_id, template_id, 
            whatsapp_number, message, scheduled_for, priority)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)`,
          [
            reminder.user_id,
            userInstance.instance_name,
            client.client_id,
            reminder.id,
            reminder.template_id,
            client.whatsapp_number,
            message,
            0
          ]
        );

        totalQueued++;
      }
    }

    if (totalQueued > 0) {
      console.log(`   ✅ ${totalQueued} mensagens adicionadas à fila\n`);
    }

  } catch (error) {
    console.error('❌ Erro ao popular fila:', error);
  }
}

// ========== 2. PROCESSAR FILA ROUND-ROBIN (Executa a cada 1 minuto) ==========

export async function processQueueRoundRobin() {
  try {
    // Busca usuários com mensagens pendentes e seus rate limits
    const usersResult = await query(
      `SELECT DISTINCT 
        u.id,
        u.messages_per_minute,
        COUNT(mq.id) as pending_count
       FROM users u
       JOIN message_queue mq ON u.id = mq.user_id
       WHERE mq.status = 'pending'
       AND mq.scheduled_for <= NOW()
       AND mq.attempts < $1
       GROUP BY u.id, u.messages_per_minute
       ORDER BY u.id`,
      [RETRY_ATTEMPTS]
    );

    const users = usersResult.rows;

    if (users.length === 0) return;

    console.log(`[${new Date().toISOString()}] 🔄 Processando fila Round-Robin`);
    console.log(`   👥 ${users.length} usuário(s) com mensagens pendentes\n`);

    let totalSent = 0;
    let totalFailed = 0;

    // Processa cada usuário de forma round-robin
    for (const user of users) {
      const limit = user.messages_per_minute || 5;
      
      console.log(`   📤 [User ${user.id}] Limite: ${limit} msgs/min | Pendentes: ${user.pending_count}`);

      // Busca as próximas N mensagens do usuário
      const messagesResult = await query(
        `SELECT * FROM message_queue 
         WHERE user_id = $1 
         AND status = 'pending'
         AND scheduled_for <= NOW()
         AND attempts < $2
         ORDER BY scheduled_for ASC
         LIMIT $3`,
        [user.id, RETRY_ATTEMPTS, limit]
      );

      const messages = messagesResult.rows;
      
      if (messages.length === 0) continue;

      console.log(`      Enviando ${messages.length} mensagens...`);

      for (const msg of messages) {
        try {
          // Marca como processando
          await query(
            `UPDATE message_queue 
             SET status = 'processing', last_attempt = NOW(), attempts = attempts + 1
             WHERE id = $1`,
            [msg.id]
          );

          // Envia mensagem
          await sendTextMessage(
            msg.instance_name,
            msg.whatsapp_number,
            msg.message
          );

          // Marca como enviada
          await query(
            `UPDATE message_queue 
             SET status = 'sent', sent_at = NOW()
             WHERE id = $1`,
            [msg.id]
          );

          // Registra no log
          await logMessage(
            msg.user_id,
            msg.client_id,
            msg.reminder_id,
            msg.template_id,
            msg.message,
            msg.whatsapp_number,
            'sent',
            null
          );

          console.log(`      ✅ ${msg.whatsapp_number}`);
          totalSent++;

          // Delay entre mensagens do MESMO usuário (60s / messages_per_minute)
          const delayMs = Math.floor(60000 / limit);
          await sleep(delayMs);

        } catch (error) {
          console.error(`      ❌ ${msg.whatsapp_number}: ${error.message}`);

          // Se excedeu tentativas, marca como falha
          if (msg.attempts + 1 >= RETRY_ATTEMPTS) {
            await query(
              `UPDATE message_queue 
               SET status = 'failed', error_message = $1
               WHERE id = $2`,
              [error.message, msg.id]
            );

            await logMessage(
              msg.user_id,
              msg.client_id,
              msg.reminder_id,
              msg.template_id,
              msg.message,
              msg.whatsapp_number,
              'failed',
              error.message
            );

            totalFailed++;
          } else {
            // Volta para pending para tentar novamente em 5 minutos
            await query(
              `UPDATE message_queue 
               SET status = 'pending', scheduled_for = NOW() + INTERVAL '5 minutes'
               WHERE id = $1`,
              [msg.id]
            );
          }
        }
      }

      console.log('');
    }

    if (totalSent > 0 || totalFailed > 0) {
      console.log(`   📊 RESUMO: ✅ ${totalSent} enviadas | ❌ ${totalFailed} falhas\n`);
    }

  } catch (error) {
    console.error('❌ Erro ao processar fila:', error);
  }
}

// ========== 3. INICIAR SISTEMA DE CRON ==========

export function startReminderCron() {
  console.log('🚀 Sistema de lembretes com fila Round-Robin iniciado');
  console.log('⚙️  Rate limit customizado por usuário');
  console.log('📋 Popula fila: a cada 1 minuto');
  console.log('🔄 Processa fila: a cada 1 minuto (round-robin)\n');

  // Popula a fila a cada minuto
  cron.schedule('* * * * *', async () => {
    await populateQueue();
  });

  // Processa a fila a cada minuto (round-robin)
  cron.schedule('* * * * *', async () => {
    await processQueueRoundRobin();
  });
}

// ========== 4. TESTE MANUAL ==========

export async function runManualTest() {
  console.log('🧪 TESTE MANUAL DO SISTEMA DE FILA\n');
  await populateQueue();
  await sleep(2000);
  await processQueueRoundRobin();
}