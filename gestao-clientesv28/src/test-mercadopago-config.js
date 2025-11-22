// ========================================
// TESTE DE CONFIGURAÇÃO MERCADO PAGO
// ========================================

import { MercadoPagoConfig, Preference } from 'mercadopago';

const ACCESS_TOKEN = 'APP_USR-5128076877887202-070808-0072ead2a666432a44ca749aa9c036e7-356289257';
const PUBLIC_KEY = 'APP_USR-58ccf841-ff89-4b6d-a388-2d6ee2a83959';
const PAYMENT_DOMAIN = 'https://pagamentos.comprarecarga.shop';

console.log('🔧 Testando configuração do Mercado Pago...\n');

// 1. Verificar credenciais
console.log('📋 Credenciais:');
console.log('   Access Token:', ACCESS_TOKEN.substring(0, 20) + '...');
console.log('   Public Key:', PUBLIC_KEY.substring(0, 20) + '...');
console.log('   Domain:', PAYMENT_DOMAIN);
console.log('');

// 2. Testar conexão
async function testConnection() {
  try {
    console.log('🔌 Testando conexão com API...');
    
    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN
    });
    
    const preferenceClient = new Preference(client);
    
    // Tentar criar uma preferência de teste simples
    const testPreference = {
      items: [
        {
          title: 'TESTE DE CONEXÃO',
          quantity: 1,
          unit_price: 10.00,
          currency_id: 'BRL'
        }
      ],
      back_urls: {
        success: `${PAYMENT_DOMAIN}/payment/success`,
        failure: `${PAYMENT_DOMAIN}/payment/failure`,
        pending: `${PAYMENT_DOMAIN}/payment/pending`
      },
      notification_url: `${PAYMENT_DOMAIN}/api/webhooks/mercadopago`,
      external_reference: 'TEST-' + Date.now()
    };
    
    console.log('📤 Criando preferência de teste...');
    const preference = await preferenceClient.create({
      body: testPreference
    });
    
    console.log('');
    console.log('✅ SUCESSO! Conexão OK');
    console.log('   Preference ID:', preference.id);
    console.log('   Init Point:', preference.init_point);
    console.log('');
    console.log('🎉 Suas credenciais estão corretas!');
    console.log('');
    
    return true;
    
  } catch (error) {
    console.log('');
    console.log('❌ ERRO na conexão:');
    console.log('   Status:', error.status);
    console.log('   Code:', error.code);
    console.log('   Message:', error.message);
    console.log('');
    
    if (error.code === 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES') {
      console.log('🚨 PROBLEMA IDENTIFICADO:');
      console.log('   O Mercado Pago está bloqueando por POLÍTICAS DE SEGURANÇA');
      console.log('');
      console.log('📋 SOLUÇÕES:');
      console.log('   1. Acesse: https://www.mercadopago.com.br/developers/panel');
      console.log('   2. Selecione sua aplicação');
      console.log('   3. Vá em "Configurações" > "Políticas de segurança"');
      console.log('   4. Verifique se há bloqueios de:');
      console.log('      - IPs não autorizados');
      console.log('      - Domínios não autorizados');
      console.log('      - Limites de transação');
      console.log('   5. Adicione o domínio: pagamentos.comprarecarga.shop');
      console.log('   6. Em "URLs de redirecionamento", adicione:');
      console.log('      - https://pagamentos.comprarecarga.shop/*');
      console.log('');
    }
    
    return false;
  }
}

// 3. Executar teste
testConnection();
