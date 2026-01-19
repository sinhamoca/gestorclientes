/* ========================================
   ROTAS - CLOUDNATION
   ======================================== */

import express from 'express';
import * as controller from '../controllers/cloudnationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// Credenciais
router.post('/credentials', controller.saveCredentials);
router.get('/credentials', controller.getCredentials);
router.delete('/credentials', controller.deleteCredentials);

// Importação de clientes
router.post('/import-clients', controller.importClients);
router.get('/clients', controller.listClients);

export default router;
