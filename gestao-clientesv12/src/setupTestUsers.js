// gestao-clientesv2/src/scripts/setupTestUsers.js
import { query } from '../config/database.js';
import bcrypt from 'bcrypt';

async function setupTestUsers() {
  try {
    console.log('🚀 Iniciando criação de ambiente de teste...\n');

    // Dados dos 3 usuários de teste
    const testUsers = [
      { 
        name: 'Teste User 1', 
        email: 'teste1@test.com', 
        password: 'teste123',
        messages_per_minute: 2,
        color: '🔵'
      },
      { 
        name: 'Teste User 2', 
        email: 'teste2@test.com', 
        password: 'teste123',
        messages_per_minute: 5,
        color: '🟢'
      },
      { 
        name: 'Teste User 3', 
        email: 'teste3@test.com', 
        password: 'teste123',
        messages_per_minute: 3,
        color: '🟡'
      }
    ];

    const phoneNumber = '558594021963';
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Calcula horário de envio (daqui 5 minutos)
    const sendTime = new Date();
    sendTime.setMinutes(sendTime.getMinutes() + 5);
    const sendTimeFormatted = sendTime.toTimeString().substring(0, 5) + ':00'; // HH:MM:00

    console.log(`⏰ Lembretes configurados para: ${sendTimeFormatted}`);
    console.log(`📅 Vencimento dos clientes: HOJE (${today})`);
    console.log(`📱 Número de teste: ${phoneNumber}\n`);

    for (const userData of testUsers) {
      console.log(`${userData.color} ========== CRIANDO ${userData.name.toUpperCase()} ==========`);

      // 1. CRIAR USUÁRIO
      console.log(`   👤 Criando usuário...`);
      
      // Verifica se já existe
      const existingUser = await query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      let userId;

      if (existingUser.rows.length > 0) {
        console.log(`   ℹ️  Usuário já existe, deletando dados antigos...`);
        userId = existingUser.rows[0].id;
        
        // Deleta dados antigos
        await query('DELETE FROM message_queue WHERE user_id = $1', [userId]);
        await query('DELETE FROM message_logs WHERE user_id = $1', [userId]);
        await query('DELETE FROM reminders WHERE user_id = $1', [userId]);
        await query('DELETE FROM message_templates WHERE user_id = $1', [userId]);
        await query('DELETE FROM clients WHERE user_id = $1', [userId]);
        await query('DELETE FROM plans WHERE user_id = $1', [userId]);
        await query('DELETE FROM servers WHERE user_id = $1', [userId]);
        await query('DELETE FROM whatsapp_instances WHERE user_id = $1', [userId]);
        
        // Atualiza rate limit
        await query(
          'UPDATE users SET messages_per_minute = $1 WHERE id = $2',
          [userData.messages_per_minute, userId]
        );
      } else {
        const passwordHash = await bcrypt.hash(userData.password, 10);
        const subscriptionEnd = new Date();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);

        const userResult = await query(
          `INSERT INTO users 
           (name, email, password_hash, role, subscription_start, subscription_end, 
            is_active, max_clients, messages_per_minute)
           VALUES ($1, $2, $3, $4, NOW(), $5, $6, $7, $8)
           RETURNING id`,
          [
            userData.name,
            userData.email,
            passwordHash,
            'user',
            subscriptionEnd,
            true,
            100,
            userData.messages_per_minute
          ]
        );

        userId = userResult.rows[0].id;
      }

      console.log(`   ✅ Usuário criado (ID: ${userId}) - Rate: ${userData.messages_per_minute} msgs/min`);

      // 2. CRIAR PLANO
      console.log(`   📋 Criando plano...`);
      const planResult = await query(
        `INSERT INTO plans (user_id, name, duration_months)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, 'Plano Teste', 1]
      );
      const planId = planResult.rows[0].id;
      console.log(`   ✅ Plano criado (ID: ${planId})`);

      // 3. CRIAR SERVIDOR
      console.log(`   🖥️  Criando servidor...`);
      const serverResult = await query(
        `INSERT INTO servers (user_id, name, cost_per_screen)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [userId, 'Servidor Teste', 10.00]
      );
      const serverId = serverResult.rows[0].id;
      console.log(`   ✅ Servidor criado (ID: ${serverId})`);

      // 4. CRIAR 10 CLIENTES
      console.log(`   👥 Criando 10 clientes...`);
      for (let i = 1; i <= 10; i++) {
        await query(
          `INSERT INTO clients 
           (user_id, name, whatsapp_number, plan_id, server_id, 
            price_value, due_date, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            userId,
            `Cliente ${i} - ${userData.name}`,
            phoneNumber,
            planId,
            serverId,
            50.00 + i,
            today,
            true
          ]
        );
      }
      console.log(`   ✅ 10 clientes criados (vencimento: HOJE)`);

      // 5. CRIAR TEMPLATE DE MENSAGEM
      console.log(`   💬 Criando template...`);
      const templateResult = await query(
        `INSERT INTO message_templates 
         (user_id, name, type, message, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          userId,
          'Lembrete Teste',
          'vencimento_dia',
          `🔔 TESTE DE ENVIO - ${userData.name}

Olá {{nome}}!

Esta é uma mensagem de TESTE do sistema de lembretes.
Rate limit: ${userData.messages_per_minute} msgs/min

📅 Vencimento: {{vencimento}}
💰 Valor: {{valor}}
🖥️  Servidor: {{servidor}}
📦 Plano: {{plano}}

✅ Se você recebeu esta mensagem, o sistema está funcionando!`,
          true
        ]
      );
      const templateId = templateResult.rows[0].id;
      console.log(`   ✅ Template criado (ID: ${templateId})`);

      // 6. CRIAR LEMBRETE (para daqui 5 minutos)
      console.log(`   ⏰ Criando lembrete para ${sendTimeFormatted}...`);
      await query(
        `INSERT INTO reminders 
         (user_id, name, template_id, days_offset, send_time, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'Lembrete Teste - Vencimento Hoje',
          templateId,
          0, // vencimento hoje
          sendTimeFormatted,
          true
        ]
      );
      console.log(`   ✅ Lembrete criado\n`);
    }

    console.log('✅ ========== AMBIENTE DE TESTE CRIADO COM SUCESSO! ==========\n');
    console.log('📋 CREDENCIAIS DE LOGIN:');
    console.log('   🔵 User 1: teste1@test.com / teste123 (2 msgs/min)');
    console.log('   🟢 User 2: teste2@test.com / teste123 (5 msgs/min)');
    console.log('   🟡 User 3: teste3@test.com / teste123 (3 msgs/min)\n');
    console.log(`⏰ HORÁRIO DE ENVIO: ${sendTimeFormatted}`);
    console.log(`   Você tem ~5 minutos para escanear os 3 QR codes!\n`);
    console.log('🔗 PRÓXIMOS PASSOS:');
    console.log('   1. Acesse: http://37.60.235.47:4000');
    console.log('   2. Faça login com cada conta');
    console.log('   3. Vá em WhatsApp e escaneie o QR code');
    console.log('   4. Aguarde o horário de envio');
    console.log('   5. Verifique seu WhatsApp: 558594021963\n');
    console.log('📊 RESULTADO ESPERADO:');
    console.log('   • User 1: 10 mensagens em ~5 minutos (2/min)');
    console.log('   • User 2: 10 mensagens em ~2 minutos (5/min)');
    console.log('   • User 3: 10 mensagens em ~3-4 minutos (3/min)');
    console.log('   • TOTAL: 30 mensagens no seu WhatsApp!\n');

  } catch (error) {
    console.error('❌ Erro ao criar ambiente de teste:', error);
    throw error;
  }
}

// Executar
setupTestUsers()
  .then(() => {
    console.log('✅ Script finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
