/* ========================================
   SCRIPT DE DEBUG - KOFFICE LOGIN
   Testar login e captura manualmente
   
   INSTRUÇÕES:
   1. Copiar para: iptv-managerv5/backend/test-koffice-login.js
   2. Executar: node test-koffice-login.js
   ======================================== */

import KofficeService from './src/services/kofficeService.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

// ========== CONFIGURAR AQUI ==========
const DOMAIN = 'https://daily3.news';
const USERNAME = 'seu_usuario';
const PASSWORD = 'sua_senha';
const RESELLER_ID = '8186';
// ======================================

console.log('╔═══════════════════════════════════════════════════════╗');
console.log('║       KOFFICE LOGIN DEBUG                             ║');
console.log('╚═══════════════════════════════════════════════════════╝');
console.log('');
console.log(`Domínio: ${DOMAIN}`);
console.log(`Usuário: ${USERNAME}`);
console.log(`Senha: ${'*'.repeat(PASSWORD.length)}`);
console.log(`Reseller ID: ${RESELLER_ID}`);
console.log(`Anti-Captcha Key: ${process.env.KOFFICE_ANTICAPTCHA_KEY ? '✓ Configurada' : '✗ NÃO configurada'}`);
console.log('═══════════════════════════════════════════════════════');
console.log('');

const service = new KofficeService(DOMAIN, USERNAME, PASSWORD, RESELLER_ID);

(async () => {
    try {
        console.log('🔄 ETAPA 1: Fazendo login...\n');
        const startTime = Date.now();
        
        await service.login();
        
        const loginTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n✅ Login concluído em ${loginTime}s\n`);
        
        console.log('🔄 ETAPA 2: Testando captura de clientes...\n');
        
        // Tentar buscar apenas primeira página (10 clientes)
        console.log('📥 Buscando primeira página (10 clientes)...\n');
        
        const firstPage = await service.fetchClientsPage(RESELLER_ID, 0, 10);
        
        console.log('📊 RESPOSTA DA API:');
        console.log('  • recordsTotal:', firstPage.recordsTotal || 'N/A');
        console.log('  • recordsFiltered:', firstPage.recordsFiltered || 'N/A');
        console.log('  • data.length:', firstPage.data?.length || 0);
        console.log('');
        
        if (firstPage.data && firstPage.data.length > 0) {
            console.log('✅ SUCESSO! Clientes capturados:');
            console.log('─────────────────────────────────────────────────────');
            
            firstPage.data.slice(0, 3).forEach((client, index) => {
                if (Array.isArray(client) && client.length >= 8) {
                    const extracted = {
                        id: client[0],
                        username: client[1],
                        password: client[2],
                        created: client[3],
                        expiry: client[4],
                        reseller: client[5],
                        screens: client[6],
                        name: service.extractNameFromHtml(client[7])
                    };
                    console.log(`\n${index + 1}. Cliente:`);
                    console.log(`   ID: ${extracted.id}`);
                    console.log(`   Nome: ${extracted.name}`);
                    console.log(`   Username: ${extracted.username}`);
                    console.log(`   Expira: ${extracted.expiry}`);
                    console.log(`   Telas: ${extracted.screens}`);
                }
            });
            
            if (firstPage.data.length > 3) {
                console.log(`\n... e mais ${firstPage.data.length - 3} clientes`);
            }
            
            console.log('');
            console.log('═══════════════════════════════════════════════════════');
            console.log('✅ TESTE BEM-SUCEDIDO!');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
            console.log('🎉 O login e a captura estão funcionando corretamente!');
            console.log('   Agora você pode usar a API normalmente.');
            console.log('');
        } else {
            console.log('⚠️ AVISO: API retornou sem dados');
            console.log('   Possíveis causas:');
            console.log('   - Reseller ID incorreto');
            console.log('   - Nenhum cliente cadastrado');
            console.log('   - Filtro de reseller não funcionou');
            console.log('');
            console.log('📋 Dados completos da resposta:');
            console.log(JSON.stringify(firstPage, null, 2));
        }
        
    } catch (error) {
        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('❌ ERRO NO TESTE');
        console.log('═══════════════════════════════════════════════════════');
        console.log('');
        console.log('Mensagem:', error.message);
        console.log('');
        
        if (error.message.includes('Sessão expirou')) {
            console.log('🔍 DIAGNÓSTICO:');
            console.log('  O login foi feito, mas a sessão não está sendo');
            console.log('  mantida corretamente.');
            console.log('');
            console.log('✅ SOLUÇÕES:');
            console.log('  1. Verificar se os cookies estão sendo salvos');
            console.log('  2. Verificar se o domínio está correto');
            console.log('  3. Aplicar a correção do kofficeService-FIXED.js');
            console.log('');
        } else if (error.message.includes('Login falhou')) {
            console.log('🔍 DIAGNÓSTICO:');
            console.log('  As credenciais podem estar incorretas ou');
            console.log('  o captcha não foi resolvido corretamente.');
            console.log('');
            console.log('✅ SOLUÇÕES:');
            console.log('  1. Verificar usuário e senha');
            console.log('  2. Verificar chave Anti-Captcha no .env');
            console.log('  3. Testar login manual no navegador');
            console.log('');
        } else if (error.message.includes('ANTICAPTCHA_KEY')) {
            console.log('🔍 DIAGNÓSTICO:');
            console.log('  A chave do Anti-Captcha não está configurada.');
            console.log('');
            console.log('✅ SOLUÇÃO:');
            console.log('  Adicionar no .env:');
            console.log('  KOFFICE_ANTICAPTCHA_KEY=sua_chave_aqui');
            console.log('');
        }
        
        if (error.stack) {
            console.log('📋 Stack trace:');
            console.log(error.stack);
        }
        
        console.log('');
        process.exit(1);
    }
    
    process.exit(0);
})();