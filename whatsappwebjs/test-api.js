// ==========================================
// TESTE DA API - WhatsApp-Web.js Service
// ==========================================

const API_URL = 'http://localhost:9100';
const API_KEY = process.env.API_KEY || 'sua-api-key-aqui';

// Cores no terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

async function test(description, fn) {
  try {
    console.log(`\n${colors.blue}🔍 ${description}${colors.reset}`);
    const result = await fn();
    console.log(`${colors.green}✅ Passou!${colors.reset}`);
    if (result) {
      console.log(JSON.stringify(result, null, 2));
    }
    return true;
  } catch (error) {
    console.log(`${colors.red}❌ Falhou: ${error.message}${colors.reset}`);
    return false;
  }
}

async function runTests() {
  console.log('==========================================');
  console.log('🚀 TESTES DA API - WhatsApp-Web.js Service');
  console.log('==========================================');
  
  let passed = 0;
  let failed = 0;

  // Teste 1: Health Check
  if (await test('Teste 1: Health Check (sem autenticação)', async () => {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) throw new Error('Health check falhou');
    return await response.json();
  })) {
    passed++;
  } else {
    failed++;
  }

  // Teste 2: Listar Sessões
  if (await test('Teste 2: Listar Sessões (com autenticação)', async () => {
    const response = await fetch(`${API_URL}/api/session/list`, {
      headers: { 'X-API-Key': API_KEY }
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro desconhecido');
    }
    return await response.json();
  })) {
    passed++;
  } else {
    failed++;
  }

  // Teste 3: Criar Sessão (TESTE INTERATIVO - comentado por padrão)
  console.log(`\n${colors.yellow}⏭️  Teste 3: Criar Sessão - DESATIVADO${colors.reset}`);
  console.log('   Para testar criação de sessão, use o Dashboard');

  // Teste 4: Autenticação Inválida
  if (await test('Teste 4: Autenticação Inválida (deve falhar)', async () => {
    const response = await fetch(`${API_URL}/api/session/list`, {
      headers: { 'X-API-Key': 'chave-invalida' }
    });
    if (response.ok) throw new Error('Deveria ter falhado!');
    return { expected: 'Erro 403' };
  })) {
    passed++;
  } else {
    failed++;
  }

  // Resultado Final
  console.log('\n==========================================');
  console.log('📊 RESULTADO DOS TESTES');
  console.log('==========================================');
  console.log(`${colors.green}✅ Passou: ${passed}${colors.reset}`);
  console.log(`${colors.red}❌ Falhou: ${failed}${colors.reset}`);
  console.log('==========================================\n');

  if (failed === 0) {
    console.log(`${colors.green}🎉 Todos os testes passaram!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}⚠️  Alguns testes falharam.${colors.reset}\n`);
    process.exit(1);
  }
}

runTests();
