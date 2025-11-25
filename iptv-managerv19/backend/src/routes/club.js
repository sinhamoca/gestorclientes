/* ========================================
   ROTAS - CLUB (DASHBOARD.BZ)
   ======================================== */

import express from 'express';
import * as controller from '../controllers/clubController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// ========== CREDENCIAIS ==========
router.post('/credentials', controller.saveCredentials);
router.get('/credentials', controller.getCredentials);
router.delete('/credentials', controller.deleteCredentials);

// ========== CLIENTES ==========
router.post('/capture-clients', controller.captureClients);
router.get('/clients', controller.listClients);

export default router;