// gestao-clientesv4/src/server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import { verifyToken, requireAdmin } from './middlewares/auth.js';
import * as authController from './controllers/authController.js';
import * as usersController from './controllers/usersController.js';
import * as plansController from './controllers/plansController.js';
import * as serversController from './controllers/serversController.js';
import * as clientsController from './controllers/clientsController.js';
import * as templatesController from './controllers/templatesController.js';
import * as remindersController from './controllers/remindersController.js';
import * as evolutionController from './controllers/evolutionController.js';
import * as financialController from './controllers/financialController.js';
import * as paymentController from './controllers/paymentController.js';
import * as paymentSettingsController from './controllers/paymentSettingsController.js';
import * as subscriptionController from './controllers/subscriptionController.js'; // ← ADICIONADO!
import { startReminderCron, runManualTest } from './reminderCron.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// ========== ROTAS PÚBLICAS ==========
app.post('/api/auth/login', authController.login);

// ========== ROTAS DE PAGAMENTO (PÚBLICAS) ==========
// Página de pagamento
app.get('/pay/:token', paymentController.renderPaymentPage);

// APIs de pagamento
app.post('/api/payment/pix', paymentController.createPixPayment);
app.post('/api/payment/card', paymentController.createCardPayment);
app.get('/api/payment/status/:payment_id', paymentController.checkPaymentStatus);

// Webhook Mercado Pago
app.post('/api/webhooks/mercadopago', paymentController.handleMercadoPagoWebhook);
app.get('/api/payment/history/:token', paymentController.getClientPaymentHistory);

// ========== ROTAS PROTEGIDAS ==========
app.get('/api/auth/me', verifyToken, authController.me);

// Rotas de Planos
app.get('/api/plans', verifyToken, plansController.listPlans);
app.post('/api/plans', verifyToken, plansController.createPlan);
app.put('/api/plans/:id', verifyToken, plansController.updatePlan);
app.delete('/api/plans/:id', verifyToken, plansController.deletePlan);

// Rotas de Servidores
app.get('/api/servers', verifyToken, serversController.listServers);
app.post('/api/servers', verifyToken, serversController.createServer);
app.put('/api/servers/:id', verifyToken, serversController.updateServer);
app.delete('/api/servers/:id', verifyToken, serversController.deleteServer);

// Rotas de Clientes
app.get('/api/clients', verifyToken, clientsController.listClients);
app.get('/api/clients/stats', verifyToken, clientsController.getClientStats);
// ⚠️ IMPORTANTE: Rotas específicas ANTES de rotas genéricas com :id
app.get('/api/clients/:id/invoices', verifyToken, clientsController.getClientInvoices);
app.post('/api/clients/:id/renew', verifyToken, clientsController.renewClient);
// ⚠️ Rota genérica por último
app.get('/api/clients/:id', verifyToken, clientsController.getClient);
app.post('/api/clients', verifyToken, clientsController.createClient);
app.put('/api/clients/:id', verifyToken, clientsController.updateClient);
app.delete('/api/clients/:id', verifyToken, clientsController.deleteClient);

// ========== ROTAS DE TEMPLATES ==========
app.get('/api/templates', verifyToken, templatesController.listTemplates);
app.post('/api/templates', verifyToken, templatesController.createTemplate);
app.put('/api/templates/:id', verifyToken, templatesController.updateTemplate);
app.delete('/api/templates/:id', verifyToken, templatesController.deleteTemplate);
app.get('/api/templates/:id/preview', verifyToken, templatesController.previewTemplate);

// ========== ROTAS DE LEMBRETES ==========
app.get('/api/reminders', verifyToken, remindersController.listReminders);
app.post('/api/reminders', verifyToken, remindersController.createReminder);
app.put('/api/reminders/:id', verifyToken, remindersController.updateReminder);
app.delete('/api/reminders/:id', verifyToken, remindersController.deleteReminder);
app.get('/api/reminders/clients-to-notify', verifyToken, remindersController.getClientsForReminders);

// ========== ROTAS FINANCEIRAS ==========
app.get('/api/financial/dashboard', verifyToken, financialController.getFinancialDashboard);
app.post('/api/financial/payment', verifyToken, financialController.registerPayment);
app.get('/api/financial/transactions', verifyToken, financialController.listTransactions);

// ========== ROTAS EVOLUTION API / WHATSAPP ==========
app.post('/api/whatsapp/connect', verifyToken, evolutionController.createOrConnectInstance);
app.get('/api/whatsapp/qrcode', verifyToken, evolutionController.getQRCode);
app.get('/api/whatsapp/status', verifyToken, evolutionController.checkConnectionStatus);
app.post('/api/whatsapp/disconnect', verifyToken, evolutionController.disconnectInstance);
app.delete('/api/whatsapp/instance', verifyToken, evolutionController.deleteInstance);

// ========== ROTAS DE CONFIGURAÇÕES DE PAGAMENTO ==========
app.get('/api/payment-settings', verifyToken, paymentSettingsController.getPaymentSettings);
app.post('/api/payment-settings/test', verifyToken, paymentSettingsController.testMercadoPagoCredentials);
app.post('/api/payment-settings', verifyToken, paymentSettingsController.savePaymentSettings);
app.patch('/api/payment-settings/toggle', verifyToken, paymentSettingsController.toggleMercadoPago);
app.delete('/api/payment-settings', verifyToken, paymentSettingsController.deletePaymentSettings);

// ========== ROTAS DE RENOVAÇÃO DE ASSINATURA ==========
app.get('/api/subscription/info', verifyToken, subscriptionController.getSubscriptionInfo);
app.post('/api/subscription/create-payment', verifyToken, subscriptionController.createSubscriptionPayment);
app.get('/api/subscription/check-status/:payment_id', verifyToken, subscriptionController.checkSubscriptionPaymentStatus);
app.get('/api/subscription/payment-history', verifyToken, subscriptionController.getPaymentHistory);
app.post('/api/webhooks/subscription-payment', subscriptionController.handleSubscriptionWebhook);

// ========== ROTAS ADMIN ==========
app.get('/api/admin/users', verifyToken, requireAdmin, usersController.listUsers);
app.get('/api/admin/users/:id', verifyToken, requireAdmin, usersController.getUser);
app.post('/api/admin/users', verifyToken, requireAdmin, usersController.createUser);
app.put('/api/admin/users/:id', verifyToken, requireAdmin, usersController.updateUser);
app.delete('/api/admin/users/:id', verifyToken, requireAdmin, usersController.deleteUser);
app.get('/api/admin/stats', verifyToken, requireAdmin, usersController.getDashboardStats);
app.get('/api/admin/users-with-clients', verifyToken, requireAdmin, usersController.getUsersWithClientCount);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rota para teste manual de lembretes (apenas para admins)
app.post('/api/admin/test-reminders', verifyToken, requireAdmin, async (req, res) => {
  try {
    await runManualTest();
    res.json({ message: 'Teste de lembretes executado com sucesso. Veja o console para detalhes.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Inicialização
async function start() {
  try {
    await initDatabase();
    
    // Inicia o cron de lembretes
    startReminderCron();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Admin: admin@sistema.com / admin123`);
      console.log(`📧 Templates e Lembretes: Ativados`);
      console.log(`🔔 Sistema de envio automático: Ativo`);
      console.log(`💳 Sistema de pagamentos Multi-tenant: Ativo`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();