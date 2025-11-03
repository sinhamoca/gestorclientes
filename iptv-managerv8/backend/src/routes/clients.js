/* ========================================
   ROTAS - CLIENTS (PostgreSQL)
   ======================================== */

import express from 'express';
import * as controller from '../controllers/clientsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// Listar clientes do usuário
router.get('/', controller.listClients);

// Sincronizar cliente com CloudNation
router.put('/:id/sync', controller.syncClient);

// Sincronizar cliente com Sigma (NOVO!)
router.put('/:id/sync-sigma', controller.syncClientWithSigma);

// Sincronizar cliente com Koffice
router.put('/:id/sync-koffice', controller.syncClientWithKoffice);

export default router;
