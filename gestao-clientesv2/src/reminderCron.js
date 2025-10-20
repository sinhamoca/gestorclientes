import { query } from './config/database.js';
import cron from 'node-cron';
import { sendTextMessage, getUserInstance } from './controllers/evolutionController.js';

// Função para substituir variáveis na mensagem
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

// Função para verificar se mensagem já foi enviada hoje
async function wasMessageSentToday(userId, clientId, reminderId) {
  const result = await query(
    `SELECT id FROM message_logs 
     WHERE user_id = $1 
     AND client_id = $2 
     AND reminder_id = $3 
     AND DATE(sent_at) = CURRENT_DATE`,
    [userId, clientId, reminderId]
  );
  return result.rows.length > 0;
}

// Função para registrar mensagem enviada
async function logMessage(userId, clientId, reminderId, templateId, message, whatsapp, status = 'sent', error = null) {
  await query(
    `INSERT INTO message_logs 
     (user_id, client_id, reminder_id, template_id, message_sent, whatsapp_number, status, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, clientId, reminderId, templateId, message, whatsapp, status, error]
  );
}

// Função principal de processamento de lembretes
export async function processReminders() {
  try {
    console.log(`[${new Date().toISOString()}] 🔔 Iniciando processamento de lembretes...`);

    // Busca todos os lembretes ativos
    const remindersResult = await query(
      `SELECT r.*, u.id as user_id, t.message as template_message
       FROM reminders r
       JOIN users u ON r.user_id = u.id
       JOIN message_templates t ON r.template_id = t.id
       WHERE r.is_active = true 
       AND t.is_active = true
       AND u.is_active = true
       ORDER BY r.user_id, r.days_offset`
    );

    const reminders = remindersResult.rows;
    console.log(`📋 Encontrados ${reminders.length} lembretes ativos`);

    if (reminders.length === 0) {
      console.log('✅ Nenhum lembrete ativo encontrado');
      return;
    }

    let totalProcessed = 0;
    let totalSent = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    // Processa cada lembrete
    for (const reminder of reminders) {
      const currentTime = new Date().toTimeString().substring(0, 5); // HH:MM
      const reminderTime = reminder.send_time.substring(0, 5);

      // Verifica se é hora de enviar este lembrete
      if (currentTime !== reminderTime) {
        continue; // Não é a hora deste lembrete
      }

      console.log(`\n⏰ Processando lembrete: ${reminder.name} (User ID: ${reminder.user_id})`);

      // Busca clientes que devem receber este lembrete
      const clientsResult = await query(
        `SELECT 
          c.id as client_id,
          c.name,
          c.whatsapp_number,
          c.due_date,
          c.price_value,
          p.name as plan_name,
          s.name as server_name,
          (c.due_date - CURRENT_DATE) as days_until_due
         FROM clients c
         LEFT JOIN plans p ON c.plan_id = p.id
         LEFT JOIN servers s ON c.server_id = s.id
         WHERE c.user_id = $1 
         AND c.is_active = true
         AND (c.due_date - CURRENT_DATE) = $2`,
        [reminder.user_id, reminder.days_offset]
      );

      const clients = clientsResult.rows;
      console.log(`   👥 ${clients.length} clientes encontrados`);

      // Processa cada cliente
      for (const client of clients) {
        totalProcessed++;

        // Verifica se já enviou mensagem hoje
        const alreadySent = await wasMessageSentToday(
          reminder.user_id,
          client.client_id,
          reminder.id
        );

        if (alreadySent) {
          console.log(`   ⏭️  Cliente ${client.name} - Já recebeu mensagem hoje`);
          totalSkipped++;
          continue;
        }

        try {
          // Substitui variáveis na mensagem
          const message = replaceVariables(reminder.template_message, client);

          // Busca instância WhatsApp do usuário
          const userInstance = await getUserInstance(reminder.user_id);

          if (!userInstance) {
            console.log(`   ⚠️  Cliente ${client.name} - Usuário sem WhatsApp conectado`);
            
            await logMessage(
              reminder.user_id,
              client.client_id,
              reminder.id,
              reminder.template_id,
              message,
              client.whatsapp_number,
              'failed',
              'WhatsApp não conectado'
            );
            
            totalErrors++;
            continue;
          }

          console.log(`   📤 Enviando para ${client.name} (${client.whatsapp_number})`);
          console.log(`      📝 Mensagem: ${message.substring(0, 50)}...`);

          // Envia mensagem via Evolution API
          try {
            await sendTextMessage(
              userInstance.instance_name,
              client.whatsapp_number,
              message
            );

            console.log(`   ✅ Mensagem enviada com sucesso!`);

            // Registra no banco como enviada
            await logMessage(
              reminder.user_id,
              client.client_id,
              reminder.id,
              reminder.template_id,
              message,
              client.whatsapp_number,
              'sent',
              null
            );

            totalSent++;

          } catch (sendError) {
            console.error(`   ❌ Erro ao enviar mensagem:`, sendError.message);
            
            await logMessage(
              reminder.user_id,
              client.client_id,
              reminder.id,
              reminder.template_id,
              message,
              client.whatsapp_number,
              'failed',
              sendError.message
            );

            totalErrors++;
          }

        } catch (error) {
          console.error(`   ❌ Erro ao processar cliente ${client.name}:`, error.message);
          
          // Registra erro no banco
          await logMessage(
            reminder.user_id,
            client.client_id,
            reminder.id,
            reminder.template_id,
            reminder.template_message,
            client.whatsapp_number,
            'failed',
            error.message
          );

          totalErrors++;
        }
      }
    }

    console.log('\n📊 Resumo do processamento:');
    console.log(`   Total processado: ${totalProcessed}`);
    console.log(`   ✅ Mensagens enviadas: ${totalSent}`);
    console.log(`   ⏭️  Ignoradas (já enviadas hoje): ${totalSkipped}`);
    console.log(`   ❌ Erros: ${totalErrors}`);
    console.log(`[${new Date().toISOString()}] ✅ Processamento concluído\n`);

  } catch (error) {
    console.error('❌ Erro geral no processamento de lembretes:', error);
  }
}

// Executa a cada minuto (para verificar se algum lembrete deve ser enviado)
export function startReminderCron() {
  console.log('🚀 Sistema de lembretes automáticos iniciado');
  console.log('⏰ Verificando lembretes a cada minuto...\n');

  // Executa a cada minuto
  cron.schedule('* * * * *', async () => {
    await processReminders();
  });

  // Também permite execução manual
  console.log('💡 Para testar manualmente, use: processReminders()');
}

// Função para executar manualmente (útil para testes)
export async function runManualTest() {
  console.log('🧪 TESTE MANUAL - Executando processamento de lembretes...\n');
  await processReminders();
}
