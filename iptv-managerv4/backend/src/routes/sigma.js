/* ========================================
   SIGMA ROUTES - COMPLETO
   Rotas para credenciais, pacotes E clientes
   ======================================== */

import express from 'express';
import * as sigmaController from '../controllers/sigmaController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// ========== CREDENCIAIS ==========
router.post('/credentials', sigmaController.saveCredential);
router.get('/credentials', sigmaController.listCredentials);
router.delete('/credentials/:domain', sigmaController.deleteCredential);

// ========== PACOTES ==========
router.post('/fetch-packages', sigmaController.fetchPackages);
router.get('/packages', sigmaController.listPackages);
router.get('/packages/:domain', sigmaController.listPackages);
router.get('/domains', sigmaController.listDomains);

// ========== CLIENTES (NOVO!) ==========
router.post('/capture-clients', sigmaController.captureClients);
router.get('/clients', sigmaController.listClients);
router.get('/domains-with-clients', sigmaController.listDomainsWithClients);

export default router;