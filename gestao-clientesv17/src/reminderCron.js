  // gestao-clientesv4/src/reminderCron.js
  import { query } from './config/database.js';
  import cron from 'node-cron';
  import { sendTextMessage, getUserInstance } from './controllers/evolutionController.js';
  import { replaceVariables } from './controllers/templatesController.js';

  // ========== CONFIGURAÇÕES ==========
  const RETRY_ATTEMPTS = 3;

  // ========== FUNÇÕES AUXILIARES ==========

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function logMessage(userId, clientId, reminderId, templateId, message, whatsapp, status = 'sent', error = null) {
    await query(
      `INSERT INTO message_logs 
      (user_id, client_id, reminder_id, template_id, message_sent, whatsapp_number, status, error_message)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, clientId, reminderId, templateId, message, whatsapp, status, error]
    );
  }

  async function markReminderAsSent(reminderId, clientId) {
    try {
      await query(
        `INSERT INTO reminder_sent_log (reminder_id, client_id, sent_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (reminder_id, client_id) DO NOTHING`,
        [reminderId, clientId]
      );
    } catch (error) {
      console.error('Erro ao marcar lembrete como enviado:', error);
    }
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

        // Busca clientes que devem receber (COM payment_token para gerar link de fatura)
        const clientsResult = await query(
          `SELECT 
            c.id as client_id,
            c.name,
            c.whatsapp_number,
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
          AND (c.due_date - CURRENT_DATE) = $2`,
          [reminder.user_id, reminder.days_offset]
        );

        const clients = clientsResult.rows;

        // Adiciona à fila
        for (const client of clients) {
          // Se send_once = true, verifica se já foi enviado
          if (reminder.send_once) {
            const alreadySentResult = await query(
              `SELECT id FROM reminder_sent_log 
              WHERE reminder_id = $1 AND client_id = $2`,
              [reminder.id, client.client_id]
            );
            
            if (alreadySentResult.rows.length > 0) {
              console.log(`   ⏭️  Lembrete "${reminder.name}" já foi enviado para ${client.name} - pulando`);
              continue;
            }
          }
                  
          const inQueue = await query(
            `SELECT id FROM message_queue 
            WHERE user_id = $1 AND client_id = $2 AND reminder_id = $3 
            AND status = 'pending'`,
            [reminder.user_id, client.client_id, reminder.id]
          );

          if (inQueue.rows.length > 0) continue;

          // Substitui variáveis (INCLUINDO {{fatura}} AUTOMATICAMENTE!)
          const finalMessage = replaceVariables(reminder.template_message, client);

          // Adiciona na fila
          await query(
            `INSERT INTO message_queue 
            (user_id, instance_name, client_id, reminder_id, template_id, 
              whatsapp_number, message, scheduled_for, status, send_once)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)`,
            [
              reminder.user_id,
              userInstance.instance_name,
              client.client_id,
              reminder.id,
              reminder.template_id,
              client.whatsapp_number,
              finalMessage,
              'pending',
              reminder.send_once || false  // ← ADICIONAR APENAS ISSO!
            ]
          );

          totalQueued++;
        }

        if (totalQueued > 0) {
          console.log(`   ✅ User ${reminder.user_id}: ${totalQueued} mensagens adicionadas à fila`);
        }
      }

    } catch (error) {
      console.error('❌ Erro ao popular fila:', error);
    }
  }

  // ========== 2. PROCESSAR FILA (Executa a cada 10 segundos) ==========

  export async function processQueue() {
    try {
      // Busca usuários com mensagens pendentes
      const usersResult = await query(`
        SELECT DISTINCT mq.user_id, u.messages_per_minute
        FROM message_queue mq
        JOIN users u ON mq.user_id = u.id
        WHERE mq.status = 'pending'
        AND mq.scheduled_for <= NOW()
      `);

      const users = usersResult.rows;
      
      if (users.length === 0) return;

      console.log(`[${new Date().toISOString()}] 📤 Processando fila - ${users.length} usuários com mensagens`);

      let totalSent = 0;
      let totalFailed = 0;

      for (const user of users) {
        const limit = user.messages_per_minute || 5;

        // Busca mensagens do usuário (limitado por rate limit)
        const messagesResult = await query(
          `SELECT * FROM message_queue 
          WHERE user_id = $1 
          AND status = 'pending'
          AND scheduled_for <= NOW()
          AND attempts < $2
          ORDER BY scheduled_for ASC
          LIMIT $3`,
          [user.user_id, RETRY_ATTEMPTS, limit]
        );

        const messages = messagesResult.rows;
        
        if (messages.length === 0) continue;

        console.log(`   📨 User ${user.user_id}: Enviando ${messages.length} mensagens...`);

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

            if (msg.send_once) {
              await markReminderAsSent(msg.reminder_id, msg.client_id);
            }

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

  // ========== 3. LIMPAR MENSAGENS ANTIGAS (Executa 1x por dia às 3h) ==========

  export async function cleanOldMessages() {
    try {
      console.log(`[${new Date().toISOString()}] 🧹 Limpando mensagens antigas...`);

      // Remove mensagens com mais de 30 dias
      const result = await query(
        `DELETE FROM message_queue 
        WHERE (status = 'sent' OR status = 'failed')
        AND sent_at < NOW() - INTERVAL '30 days'
        RETURNING id`
      );

      console.log(`   ✅ ${result.rows.length} mensagens antigas removidas\n`);
    } catch (error) {
      console.error('❌ Erro ao limpar mensagens antigas:', error);
    }
  }

  // ========== INICIAR CRON JOBS ==========

  export function startReminderCron() {
    console.log('⏰ Iniciando sistema de lembretes automáticos...\n');
    console.log('⚠️  ATENÇÃO: Proteção de duplicação DESATIVADA!');
    console.log('   Mensagens serão enviadas SEMPRE, mesmo se já enviadas hoje.\n');

    // 1. Popular fila a cada minuto
    cron.schedule('* * * * *', () => {
      populateQueue();
    });

    // 2. Processar fila a cada 10 segundos
    cron.schedule('*/10 * * * * *', () => {
      processQueue();
    });

    // 3. Limpar mensagens antigas 1x por dia às 3h
    cron.schedule('0 3 * * *', () => {
      cleanOldMessages();
    });

    console.log('✅ Sistema de lembretes ativo!');
    console.log('   📋 Popular fila: a cada 1 minuto');
    console.log('   📤 Processar fila: a cada 10 segundos');
    console.log('   🧹 Limpeza: diariamente às 3h\n');
  }

  // ========== TESTE MANUAL ==========

  export async function runManualTest() {
    console.log('\n🧪 EXECUTANDO TESTE MANUAL\n');
    console.log('='.repeat(50));
    
    await populateQueue();
    console.log('\n⏳ Aguardando 5 segundos...\n');
    await sleep(5000);
    await processQueue();
    
    console.log('='.repeat(50));
    console.log('✅ TESTE CONCLUÍDO\n');
  }