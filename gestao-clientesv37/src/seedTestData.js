// gestao-clientesv2/src/seedTestData.js
import bcrypt from 'bcrypt';
import { query } from './config/database.js';
import dotenv from 'dotenv';

dotenv.config();

async function seedTestData() {
  try {
    console.log('🌱 Iniciando população de dados de teste...\n');

    // ========== 1. CRIAR 3 USUÁRIOS ==========
    console.log('👥 Criando usuários...');
    
    const passwordHash = await bcrypt.hash('teste123', 10);
    
    const users = [
      {
        name: 'João Silva',
        email: 'joao@teste.com',
        phone: '85987654321',
        messages_per_minute: 3,
        max_clients: 50,
        description: '3 msgs/min - Muito Seguro'
      },
      {
        name: 'Maria Santos',
        email: 'maria@teste.com',
        phone: '85987654322',
        messages_per_minute: 10,
        max_clients: 30,
        description: '10 msgs/min - Rápido'
      },
      {
        name: 'Pedro Costa',
        email: 'pedro@teste.com',
        phone: '85987654323',
        messages_per_minute: 7,
        max_clients: 20,
        description: '7 msgs/min - Moderado'
      }
    ];

    const createdUsers = [];

    for (const user of users) {
      const subscriptionStart = new Date();
      const subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 6); // 6 meses

      const result = await query(
        `INSERT INTO users 
         (name, email, password_hash, phone, role, subscription_start, subscription_end, 
          max_clients, max_instances, messages_per_minute, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, name, email`,
        [
          user.name,
          user.email,
          passwordHash,
          user.phone,
          'user',
          subscriptionStart,
          subscriptionEnd,
          user.max_clients,
          1,
          user.messages_per_minute,
          true
        ]
      );

      createdUsers.push({ ...result.rows[0], ...user });
      console.log(`   ✅ ${user.name} (${user.email}) - ${user.description}`);
    }

    console.log('\n📋 Credenciais de Login:');
    console.log('   Email: joao@teste.com | maria@teste.com | pedro@teste.com');
    console.log('   Senha: teste123\n');

    // ========== 2. CRIAR PLANOS PARA CADA USUÁRIO ==========
    console.log('💳 Criando planos...');

    const plansData = [
      { name: 'Mensal', duration: 1 },
      { name: 'Trimestral', duration: 3 },
      { name: 'Semestral', duration: 6 },
      { name: 'Anual', duration: 12 }
    ];

    for (const user of createdUsers) {
      for (const plan of plansData) {
        await query(
          `INSERT INTO plans (user_id, name, duration_months)
           VALUES ($1, $2, $3)`,
          [user.id, plan.name, plan.duration]
        );
      }
      console.log(`   ✅ ${user.name}: 4 planos criados`);
    }

    // ========== 3. CRIAR SERVIDORES PARA CADA USUÁRIO ==========
    console.log('\n🖥️  Criando servidores...');

    const serversData = [
      { name: 'Servidor Principal', cost: 5.00 },
      { name: 'Servidor Backup', cost: 3.50 },
      { name: 'Servidor VIP', cost: 8.00 }
    ];

    for (const user of createdUsers) {
      for (const server of serversData) {
        await query(
          `INSERT INTO servers (user_id, name, cost_per_screen)
           VALUES ($1, $2, $3)`,
          [user.id, server.name, server.cost]
        );
      }
      console.log(`   ✅ ${user.name}: 3 servidores criados`);
    }

    // ========== 4. BUSCAR IDs DOS PLANOS E SERVIDORES ==========
    const getUserPlansAndServers = async (userId) => {
      const plans = await query('SELECT id FROM plans WHERE user_id = $1 ORDER BY id', [userId]);
      const servers = await query('SELECT id FROM servers WHERE user_id = $1 ORDER BY id', [userId]);
      return {
        planIds: plans.rows.map(p => p.id),
        serverIds: servers.rows.map(s => s.id)
      };
    };

    // ========== 5. CRIAR CLIENTES COM VENCIMENTOS DISTRIBUÍDOS ==========
    console.log('\n👥 Criando clientes...');

    const clientNames = [
      'Carlos Almeida', 'Ana Oliveira', 'Bruno Pereira', 'Carla Souza', 'Daniel Lima',
      'Eduarda Martins', 'Fernando Costa', 'Gabriela Silva', 'Henrique Rocha', 'Isabela Santos',
      'José Ferreira', 'Larissa Cardoso', 'Marcos Barbosa', 'Natália Araújo', 'Otávio Mendes',
      'Paula Ribeiro', 'Rafael Gomes', 'Sara Dias', 'Thiago Castro', 'Vanessa Moreira',
      'William Pinto', 'Yara Teixeira', 'Zilda Correia', 'André Batista', 'Beatriz Freitas',
      'Caio Monteiro', 'Débora Nogueira', 'Elias Carvalho', 'Flávia Ramos', 'Gustavo Lopes',
      'Helena Medeiros', 'Igor Azevedo', 'Júlia Nunes', 'Kléber Farias', 'Luana Vieira',
      'Márcio Torres', 'Nair Rodrigues', 'Oswaldo Cunha', 'Patrícia Reis', 'Quirino Barros',
      'Renata Soares', 'Sérgio Melo', 'Tatiana Campos', 'Ulisses Xavier', 'Vera Prado',
      'Wagner Duarte', 'Xuxa Moura', 'Yuri Fernandes', 'Zélia Braga', 'Alberto Macedo'
    ];

    let totalClients = 0;

    for (const user of createdUsers) {
      const { planIds, serverIds } = await getUserPlansAndServers(user.id);
      
      // Define quantos clientes criar baseado no rate limit
      let numClients;
      if (user.messages_per_minute === 3) {
        numClients = 50; // João - 50 clientes
      } else if (user.messages_per_minute === 10) {
        numClients = 30; // Maria - 30 clientes
      } else {
        numClients = 20; // Pedro - 20 clientes
      }

      console.log(`   📤 ${user.name}: Criando ${numClients} clientes...`);

      // Distribui clientes em diferentes dias de vencimento
      const today = new Date();
      
      for (let i = 0; i < numClients; i++) {
        const clientName = clientNames[i % clientNames.length];
        
        // Distribui vencimentos: hoje (40%), amanhã (30%), depois (30%)
        let dueDate = new Date(today);
        const rand = Math.random();
        
        if (rand < 0.4) {
          // 40% vencem hoje (para testar envio imediato)
          dueDate.setDate(today.getDate());
        } else if (rand < 0.7) {
          // 30% vencem amanhã
          dueDate.setDate(today.getDate() + 1);
        } else {
          // 30% vencem em 2-5 dias
          dueDate.setDate(today.getDate() + Math.floor(Math.random() * 4) + 2);
        }

        // WhatsApp com 9º dígito variado (alguns com, alguns sem)
        const hasNinthDigit = i % 2 === 0;
        const whatsappBase = `5585${hasNinthDigit ? '9' : ''}`;
        const whatsappNumber = `${whatsappBase}${String(90000000 + i).padStart(8, '0')}`;

        const planId = planIds[i % planIds.length];
        const serverId = serverIds[i % serverIds.length];
        const price = (Math.random() * 50 + 30).toFixed(2); // Entre R$ 30-80

        await query(
          `INSERT INTO clients 
           (user_id, name, whatsapp_number, plan_id, server_id, price_value, due_date, 
            username, password, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            user.id,
            `${clientName} ${i + 1}`,
            whatsappNumber,
            planId,
            serverId,
            price,
            dueDate,
            `user${i + 1}`,
            `pass${i + 1}`,
            true
          ]
        );

        totalClients++;
      }

      console.log(`   ✅ ${user.name}: ${numClients} clientes criados`);
    }

    // ========== 6. CRIAR TEMPLATES PARA CADA USUÁRIO ==========
    console.log('\n📝 Criando templates de mensagem...');

    const templatesData = [
      {
        name: 'Lembrete de Vencimento',
        type: 'vencimento_dia',
        message: `Olá {{nome}}! 👋

Seu plano {{plano}} vence HOJE!

💰 Valor: {{valor}}
📅 Vencimento: {{vencimento}}
🖥️ Servidor: {{servidor}}

Para renovar, entre em contato conosco! 📞`
      },
      {
        name: 'Aviso 1 Dia Antes',
        type: 'pre_vencimento',
        message: `Oi {{nome}}! 😊

Seu plano vence AMANHÃ!

📋 Plano: {{plano}}
💵 Valor: {{valor}}
📆 Vencimento: {{vencimento}}

Renove hoje e não perca o acesso! ✅`
      },
      {
        name: 'Aviso 3 Dias Antes',
        type: 'pre_vencimento',
        message: `Olá {{nome}}!

⚠️ Seu plano vence em {{dias}} dias

📋 Detalhes:
- Plano: {{plano}}
- Valor: {{valor}}
- Vencimento: {{vencimento}}
- Servidor: {{servidor}}

Renove antecipadamente! 🚀`
      }
    ];

    const userTemplates = {}; // Para armazenar os IDs dos templates

    for (const user of createdUsers) {
      userTemplates[user.id] = [];
      
      for (const template of templatesData) {
        const result = await query(
          `INSERT INTO message_templates (user_id, name, type, message, is_active)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [user.id, template.name, template.type, template.message, true]
        );
        
        userTemplates[user.id].push(result.rows[0].id);
      }
      
      console.log(`   ✅ ${user.name}: 3 templates criados`);
    }

    // ========== 7. CRIAR LEMBRETES PARA CADA USUÁRIO ==========
    console.log('\n⏰ Criando lembretes automáticos...');

    // Calcula horário atual + 2 minutos (para teste imediato)
    const now = new Date();
    const testTime = new Date(now.getTime() + 2 * 60000); // +2 minutos
    const sendTime = `${String(testTime.getHours()).padStart(2, '0')}:${String(testTime.getMinutes()).padStart(2, '0')}:00`;

    for (const user of createdUsers) {
      const templateIds = userTemplates[user.id];
      
      // Lembrete 1: Vence hoje (será enviado em ~2 minutos)
      await query(
        `INSERT INTO reminders (user_id, name, template_id, days_offset, send_time, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, 'Aviso - Vence Hoje', templateIds[0], 0, sendTime, true]
      );

      // Lembrete 2: Vence amanhã
      await query(
        `INSERT INTO reminders (user_id, name, template_id, days_offset, send_time, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, 'Aviso - Vence Amanhã', templateIds[1], -1, sendTime, true]
      );

      // Lembrete 3: Vence em 3 dias
      await query(
        `INSERT INTO reminders (user_id, name, template_id, days_offset, send_time, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, 'Aviso - 3 Dias Antes', templateIds[2], -3, sendTime, true]
      );

      console.log(`   ✅ ${user.name}: 3 lembretes configurados`);
    }

    console.log(`\n⏱️  Horário de envio configurado: ${sendTime} (~2 minutos a partir de agora)`);

    // ========== 8. RESUMO FINAL ==========
    console.log('\n' + '='.repeat(60));
    console.log('✅ DADOS DE TESTE CRIADOS COM SUCESSO!');
    console.log('='.repeat(60));

    console.log('\n📊 RESUMO:');
    console.log('   👥 3 usuários criados');
    console.log('   💳 12 planos (4 por usuário)');
    console.log('   🖥️  9 servidores (3 por usuário)');
    console.log(`   👤 ${totalClients} clientes no total`);
    console.log('   📝 9 templates (3 por usuário)');
    console.log('   ⏰ 9 lembretes (3 por usuário)');

    console.log('\n📱 DISTRIBUIÇÃO DE CLIENTES:');
    console.log('   • João (3 msgs/min):  50 clientes');
    console.log('   • Maria (10 msgs/min): 30 clientes');
    console.log('   • Pedro (7 msgs/min):  20 clientes');

    console.log('\n📅 VENCIMENTOS:');
    console.log('   • ~40% vencem HOJE (envio em ~2 minutos)');
    console.log('   • ~30% vencem amanhã');
    console.log('   • ~30% vencem em 2-5 dias');

    console.log('\n🔐 PARA TESTAR:');
    console.log('   1. Faça login com um dos usuários:');
    console.log('      • joao@teste.com | maria@teste.com | pedro@teste.com');
    console.log('      • Senha: teste123');
    console.log('\n   2. Vá em "WhatsApp" e escaneie o QR Code');
    console.log('\n   3. Aguarde ~2 minutos e as mensagens começarão a ser enviadas!');
    console.log('\n   4. Confira os logs do backend:');
    console.log('      docker logs -f gestao_admin_backend');

    console.log('\n💡 DICA: Os números de WhatsApp são fictícios (558590000000+)');
    console.log('   Para testar de verdade, edite alguns clientes com seu número real!\n');

  } catch (error) {
    console.error('\n❌ Erro ao popular dados:', error);
    throw error;
  }
}

// Executa o seed
seedTestData()
  .then(() => {
    console.log('🎉 Script finalizado com sucesso!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
