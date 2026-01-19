/* ==========================================
   TESTE STANDALONE - WhatsApp Service
   Testa criação de sessão e envio de mensagem
   ========================================== */

import fetch from 'node-fetch';
import readline from 'readline';

// ========== CONFIGURAÇÕES ==========
const API_URL = 'http://localhost:9000/api';
const API_KEY = 'sua-chave-super-secreta-aqui'; // Mesma do .env
const SESSION_ID = 'test_session';
const TEST_PHONE = '558594021963'; // Seu número para teste

// ========== FUNÇÕES AUXILIARES ==========

const makeRequest = async (endpoint, method = 'GET', body = null) => {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, options);
  return await response.json();
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const askQuestion = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

// ========== TESTES ==========

async function test() {
  console.log('🧪 TESTE DO WHATSAPP SERVICE');
  console.log('=' .repeat(50));
  console.log('');
  
  try {
    // 1. Health Check
    console.log('1️⃣  Testando health check...');
    const health = await fetch('http://localhost:9000/health').then(r => r.json());
    console.log('   ✅ Serviço online:', health);
    console.log('');
    
    // 2. Listar sessões
    console.log('2️⃣  Listando sessões existentes...');
    const sessions = await makeRequest('/sessions');
    console.log('   📋 Sessões:', sessions);
    console.log('');
    
    // 3. Criar sessão
    console.log('3️⃣  Criando sessão de teste...');
    console.log(`   📱 Session ID: ${SESSION_ID}`);
    
    const createResult = await makeRequest('/session/create', 'POST', {
      sessionId: SESSION_ID
    });
    
    if (createResult.needsQR) {
      console.log('   📲 QR Code gerado!');
      console.log('   🔗 Base64 QR:', createResult.qrCode.substring(0, 50) + '...');
      console.log('');
      console.log('   ⚠️  ATENÇÃO: Escaneie o QR Code agora!');
      console.log('   💡 Dica: Salve o base64 em um arquivo .txt e use um');
      console.log('      conversor online para ver o QR Code, ou implemente');
      console.log('      visualização no terminal com qrcode-terminal');
      console.log('');
      
      // Aguardar usuário escanear
      await askQuestion('   ⏳ Pressione ENTER depois de escanear o QR Code...');
      
      // 4. Verificar status
      console.log('');
      console.log('4️⃣  Verificando status da conexão...');
      
      let connected = false;
      let attempts = 0;
      
      while (!connected && attempts < 10) {
        await sleep(2000);
        attempts++;
        
        const status = await makeRequest(`/session/status/${SESSION_ID}`);
        console.log(`   📊 Tentativa ${attempts}: ${status.connected ? '✅ CONECTADO' : '⏳ Aguardando...'}`);
        
        if (status.connected) {
          connected = true;
          console.log('   ✅ WhatsApp conectado!');
          console.log(`   📱 Número: ${status.phoneNumber}`);
          console.log(`   📱 Platform: ${status.platform}`);
          console.log(`   👤 Nome: ${status.pushname}`);
        }
      }
      
      if (!connected) {
        console.log('   ❌ Timeout! Não conectou a tempo.');
        return;
      }
      
      console.log('');
      
      // 5. Enviar mensagem de teste
      console.log('5️⃣  Enviando mensagem de teste...');
      console.log(`   📤 Para: ${TEST_PHONE}`);
      
      const sendResult = await makeRequest('/message/send', 'POST', {
        sessionId: SESSION_ID,
        phoneNumber: TEST_PHONE,
        message: `🧪 TESTE - WhatsApp Service\n\n` +
                 `✅ Serviço funcionando!\n` +
                 `⏰ ${new Date().toLocaleString('pt-BR')}\n\n` +
                 `Este é um teste do sistema WPPConnect.`
      });
      
      if (sendResult.success) {
        console.log('   ✅ Mensagem enviada com sucesso!');
        console.log(`   📬 Message ID: ${sendResult.messageId}`);
      } else {
        console.log('   ❌ Erro ao enviar:', sendResult.error);
      }
      
      console.log('');
      
      // 6. Perguntar se quer manter ou desconectar
      const keepConnected = await askQuestion('   🤔 Manter sessão conectada? (s/N): ');
      
      if (keepConnected.toLowerCase() !== 's') {
        console.log('');
        console.log('6️⃣  Desconectando sessão...');
        
        const disconnectResult = await makeRequest('/session/disconnect', 'POST', {
          sessionId: SESSION_ID
        });
        
        console.log('   ✅ Desconectado:', disconnectResult.message);
      } else {
        console.log('');
        console.log('   ℹ️  Sessão mantida conectada');
        console.log('   💡 Para desconectar depois, use:');
        console.log(`   curl -X POST ${API_URL}/session/disconnect \\`);
        console.log(`     -H "x-api-key: ${API_KEY}" \\`);
        console.log(`     -H "Content-Type: application/json" \\`);
        console.log(`     -d '{"sessionId":"${SESSION_ID}"}'`);
      }
      
    } else if (createResult.connected) {
      console.log('   ✅ Sessão já estava conectada!');
    } else {
      console.log('   ❌ Erro:', createResult);
    }
    
    console.log('');
    console.log('='.repeat(50));
    console.log('✅ TESTE CONCLUÍDO!');
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
  }
}

// Executar teste
test().then(() => process.exit(0));
