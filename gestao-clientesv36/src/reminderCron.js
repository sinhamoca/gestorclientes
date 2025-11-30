// ==========================================
// REMINDER CRON - COM TRATAMENTO INTELIGENTE
// Arquivo: gestao-clientesv33/src/reminderCron.js
//
// FASE 2: Detecta números inválidos e não reagenda
// + Integração com logs.html via activityLogService
// ==========================================

import { query } from './config/database.js';
import cron from 'node-cron';
import { sendTextMessage, getUserInstance } from './controllers/whatsappController.js';
import { replaceVariables } from './controllers/templatesController.js';
import { logWhatsApp } from './services/activityLogService.js';
import { decryptSystemWhatsApp } from './utils/systemEncryption.js';


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

// ========================================
// FASE 2: FUNÇÕES DE VALIDAÇÃO
// ========================================

/**
 * Verifica se o erro indica número inválido no WhatsApp
 */
function isInvalidNumberError(errorMessage) {
  if (!errorMessage) return false;
  
  const invalidPatterns = [
    'INVALID_WHATSAPP_NUMBER',
    'No LID for user',
    'not registered',
    'número não está cadastrado',
    'number is not registered',
    'wid error',
    'invalid wid',
    'não cadastrado no WhatsApp'
  ];
  
  const lowerMessage = errorMessage.toLowerCase();
  return invalidPatterns.some(pattern => 
    lowerMessage.includes(pattern.toLowerCase())
  );
}

/**
 * Marca o número do cliente como inválido no WhatsApp
 * Evita tentativas futuras de envio
 */
async function markWhatsAppInvalid(clientId, errorMessage) {
  try {
    await query(
      `UPDATE clients 
       SET whatsapp_valid = false, 
           whatsapp_error = $1,
           whatsapp_checked_at = NOW()
       WHERE id = $2`,
      [errorMessage, clientId]
    );
    console.log(`   ⚠️  Cliente ${clientId} marcado com WhatsApp inválido`);
  } catch (error) {
    console.error(`   ❌ Erro ao marcar WhatsApp inválido:`, error);
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
      console.log(`\n   🔍 [DEBUG] Processando lembrete: "${reminder.name}" (ID: ${reminder.id})`);
      
      // Busca instância WhatsApp do usuário
      const userInstance = await getUserInstance(reminder.user_id);
      if (!userInstance) {
        console.log(`   ⚠️  User ${reminder.user_id} - WhatsApp desconectado`);
        continue;
      }

      console.log(`   ✅ WhatsApp conectado: ${userInstance.instance_name}`);

      // 🔐 Busca clientes que devem receber (COM whatsapp_number_internal para descriptografar)
      // FASE 2: Ignora clientes com whatsapp_valid = false
      const clientsResult = await query(
        `SELECT 
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
        AND (c.due_date - (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date) = $2`,
        [reminder.user_id, reminder.days_offset]
      );

      console.log(`   🔍 [DEBUG] Encontrados ${clientsResult.rows.length} clientes com vencimento em ${reminder.days_offset} dias`);

      // 🔐 Descriptografar WhatsApp com chave do sistema
      const clients = clientsResult.rows.map(client => {
        try {
          if (client.whatsapp_number_internal) {
            client.whatsapp_number = decryptSystemWhatsApp(client.whatsapp_number_internal);
            console.log(`   🔓 [CRON] WhatsApp descriptografado: ${client.name} -> ${client.whatsapp_number}`);
          } else {
            console.log(`   ⚠️  [CRON] Cliente ${client.name} sem whatsapp_number_internal`);
          }
          delete client.whatsapp_number_internal;
        } catch (error) {
          console.error(`   ❌ [CRON] Erro ao descriptografar WhatsApp do cliente ${client.client_id}:`, error);
          client.whatsapp_number = null;
        }
        return client;
      });

      // Adiciona à fila
      for (const client of clients) {
        console.log(`\n   🔍 [DEBUG] Processando cliente: ${client.name} (ID: ${client.client_id})`);
        
        // Validar WhatsApp antes de adicionar
        if (!client.whatsapp_number) {
          console.log(`   ⚠️  Cliente ${client.name} sem WhatsApp válido - pulando`);
          continue;
        }

        console.log(`   ✅ WhatsApp válido: ${client.whatsapp_number}`);

        // Se send_once = true, verifica se já foi enviado
        if (reminder.send_once) {
          console.log(`   🔍 [DEBUG] Verificando se já foi enviado (send_once=true)...`);
          
          const alreadySentResult = await query(
            `SELECT id FROM reminder_sent_log 
            WHERE reminder_id = $1 AND client_id = $2`,
            [reminder.id, client.client_id]
          );
          
          if (alreadySentResult.rows.length > 0) {
            console.log(`   ⏭️  Lembrete "${reminder.name}" já foi enviado para ${client.name} - pulando`);
            continue;
          }
          
          console.log(`   ✅ Nunca foi enviado antes`);
        }

        // Verificar se já está na fila
        console.log(`   🔍 [DEBUG] Verificando se já está na fila pendente...`);
        
        const inQueue = await query(
          `SELECT id FROM message_queue 
          WHERE user_id = $1 AND client_id = $2 AND reminder_id = $3 
          AND status = 'pending'`,
          [reminder.user_id, client.client_id, reminder.id]
        );

        if (inQueue.rows.length > 0) {
          console.log(`   ⏭️  Cliente ${client.name} já está na fila - pulando`);
          continue;
        }

        console.log(`   ✅ Não está na fila, pode adicionar`);

        // Substitui variáveis
        console.log(`   🔍 [DEBUG] Substituindo variáveis no template...`);
        const finalMessage = replaceVariables(reminder.template_message, client);
        console.log(`   ✅ Mensagem gerada: ${finalMessage.substring(0, 80)}...`);

        // Adiciona na fila
        console.log(`   🔍 [DEBUG] Tentando inserir na fila...`);
        
        try {
          const insertResult = await query(
            `INSERT INTO message_queue 
            (user_id, instance_name, client_id, reminder_id, template_id, 
              whatsapp_number, message, scheduled_for, status, send_once)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
            RETURNING id`,
            [
              reminder.user_id,
              userInstance.instance_name,
              client.client_id,
              reminder.id,
              reminder.template_id,
              client.whatsapp_number,
              finalMessage,
              'pending',
              reminder.send_once || false
            ]
          );

          console.log(`   ✅ Cliente ${client.name} adicionado à fila! (queue_id: ${insertResult.rows[0].id})`);
          totalQueued++;
          
        } catch (error) {
          console.error(`   ❌ ERRO ao adicionar à fila:`, error);
          console.error(`   📋 Detalhes:`, {
            user_id: reminder.user_id,
            instance_name: userInstance.instance_name,
            client_id: client.client_id,
            whatsapp: client.whatsapp_number,
            error_code: error.code,
            error_message: error.message
          });
        }
      }
    }

    if (totalQueued > 0) {
      console.log(`\n   ✅ Total: ${totalQueued} mensagens adicionadas à fila\n`);
    } else {
      console.log(`\n   ℹ️  Nenhuma mensagem foi adicionada à fila\n`);
    }

  } catch (error) {
    console.error('❌ Erro ao popular fila:', error);
    console.error('Stack:', error.stack);
  }
}

// ========== 2. PROCESSAR FILA (Executa a cada 10 segundos) ==========

export async function processQueue() {
  try {
    console.log(`[${new Date().toISOString()}] 🔍 [DEBUG] Verificando fila...`);
    
    // Busca usuários com mensagens pendentes
    const usersResult = await query(`
      SELECT DISTINCT mq.user_id, u.messages_per_minute
      FROM message_queue mq
      JOIN users u ON mq.user_id = u.id
      WHERE mq.status = 'pending'
      AND mq.scheduled_for <= NOW()
    `);

    const users = usersResult.rows;
    
    console.log(`   🔍 [DEBUG] Encontrados ${users.length} usuários com mensagens pendentes`);
    
    if (users.length === 0) return;

    console.log(`[${new Date().toISOString()}] 📤 Processando fila - ${users.length} usuários com mensagens`);

    let totalSent = 0;
    let totalFailed = 0;

    for (const user of users) {
      const limit = user.messages_per_minute || 5;

      // Busca mensagens do usuário (limitado por rate limit)
      const messagesResult = await query(
        `SELECT mq.*, c.name as client_name 
        FROM message_queue mq
        LEFT JOIN clients c ON mq.client_id = c.id
        WHERE mq.user_id = $1 
        AND mq.status = 'pending'
        AND mq.scheduled_for <= NOW()
        AND mq.attempts < $2
        ORDER BY mq.scheduled_for ASC
        LIMIT $3`,
        [user.user_id, RETRY_ATTEMPTS, limit]
      );

      const messages = messagesResult.rows;
      
      if (messages.length === 0) continue;

      console.log(`   📨 User ${user.user_id}: Enviando ${messages.length} mensagens...`);

      for (const msg of messages) {
        try {
          console.log(`      🔍 Enviando para ${msg.whatsapp_number}...`);
          
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

          // Registra no log antigo (message_logs)
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

          // ✅ Registrar no activity_logs (integração com logs.html)
          await logWhatsApp({
            userId: msg.user_id,
            clientId: msg.client_id,
            clientName: msg.client_name || 'Cliente',
            whatsappNumber: msg.whatsapp_number,
            success: true
          });

          if (msg.send_once) {
            await markReminderAsSent(msg.reminder_id, msg.client_id);
          }

          console.log(`      ✅ ${msg.whatsapp_number} - Enviada com sucesso!`);
          totalSent++;

          // Delay entre mensagens do MESMO usuário (60s / messages_per_minute)
          const delayMs = Math.floor(60000 / limit);
          await sleep(delayMs);

        } catch (error) {
          console.error(`      ❌ ${msg.whatsapp_number}: ${error.message}`);

          // ========================================
          // FASE 2: VERIFICAR SE É ERRO DE NÚMERO INVÁLIDO
          // ========================================
          const isInvalidNumber = isInvalidNumberError(error.message);
          
          if (isInvalidNumber) {
            // NÚMERO INVÁLIDO - NÃO REAGENDAR
            console.log(`      🚫 Número inválido detectado - NÃO reagendando`);
            
            // Marcar mensagem como falha permanente
            await query(
              `UPDATE message_queue 
               SET status = 'failed', 
                   error_message = $1
               WHERE id = $2`,
              [`NÚMERO INVÁLIDO: ${error.message}`, msg.id]
            );

            // Marcar cliente com WhatsApp inválido
            if (msg.client_id) {
              await markWhatsAppInvalid(msg.client_id, error.message);
            }

            // Logar no message_logs
            await logMessage(
              msg.user_id,
              msg.client_id,
              msg.reminder_id,
              msg.template_id,
              msg.message,
              msg.whatsapp_number,
              'failed',
              `NÚMERO INVÁLIDO: ${error.message}`
            );

            // ✅ Registrar no activity_logs (integração com logs.html)
            await logWhatsApp({
              userId: msg.user_id,
              clientId: msg.client_id,
              clientName: msg.client_name || 'Cliente',
              whatsappNumber: msg.whatsapp_number,
              success: false,
              errorMessage: `Número não cadastrado no WhatsApp: ${msg.whatsapp_number}`
            });

            totalFailed++;
            
          } else if (msg.attempts + 1 >= RETRY_ATTEMPTS) {
            // OUTRAS FALHAS - MÁXIMO DE TENTATIVAS ATINGIDO
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

            // ✅ Registrar ERRO no activity_logs (integração com logs.html)
            await logWhatsApp({
              userId: msg.user_id,
              clientId: msg.client_id,
              clientName: msg.client_name || 'Cliente',
              whatsappNumber: msg.whatsapp_number,
              success: false,
              errorMessage: error.message
            });

            totalFailed++;
          } else {
            // Volta para pending para tentar novamente em 5 minutos
            await query(
              `UPDATE message_queue 
              SET status = 'pending', scheduled_for = NOW() + INTERVAL '5 minutes'
              WHERE id = $1`,
              [msg.id]
            );
            
            console.log(`      ⏱️  Reagendada para +5 minutos (tentativa ${msg.attempts + 1}/${RETRY_ATTEMPTS})`);
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
    console.error('Stack:', error.stack);
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
  console.log('🔐 Criptografia em camadas ativada!');
  console.log('   WhatsApp será descriptografado automaticamente para envio.\n');
  console.log('🛡️  FASE 2: Tratamento inteligente de números inválidos ativado!\n');

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