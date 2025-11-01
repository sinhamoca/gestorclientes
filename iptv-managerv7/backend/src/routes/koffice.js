/* ========================================
   KOFFICE ROUTES
   Rotas para credenciais e captura de clientes
   ======================================== */

import express from 'express';
import * as kofficeController from '../controllers/kofficeController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// ========== CREDENCIAIS ==========
router.post('/credentials', kofficeController.saveCredential);
router.get('/credentials', kofficeController.listCredentials);
router.put('/credentials/:id', kofficeController.updateCredential);
router.delete('/credentials/:id', kofficeController.deleteCredential);

// ========== CLIENTES ==========
router.post('/capture-clients', kofficeController.captureClients);
router.get('/clients', kofficeController.listClients);
router.get('/domains', kofficeController.listDomainsWithClients);

export default router;
