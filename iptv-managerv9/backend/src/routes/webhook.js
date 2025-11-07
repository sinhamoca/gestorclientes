/* ========================================
   WEBHOOK ROUTES - IPTV MANAGER
   Adicionar ao backend do IPTV Manager
   ======================================== */

import express from 'express';
import * as webhookController from '../controllers/webhookController.js';

const router = express.Router();

// ========== ROTAS DE WEBHOOK (PÚBLICAS) ==========
// Estas rotas NÃO precisam de autenticação JWT
// Pois são chamadas pelo sistema principal

/**
 * Webhook de renovação de cliente
 * POST /api/webhooks/client-renewed
 * 
 * Recebe dados do cliente que pagou e
 * processa renovação automática no CloudNation
 */
router.post('/client-renewed', webhookController.handleClientRenewalWebhook);

/**
 * Health check do sistema de webhooks
 * GET /api/webhooks/health
 */
router.get('/health', webhookController.webhookHealthCheck);

export default router;
