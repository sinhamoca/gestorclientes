/* ========================================
   SIGMA ROUTES - ATUALIZADO
   Adicionar a nova rota de verificação de conflitos
   ======================================== */

import express from 'express';
import * as sigmaController from '../controllers/sigmaController.js';
import * as sigmaSyncController from '../controllers/sigmaSyncController.js';
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

// ========== SINCRONIZAÇÃO ==========
router.post('/sync/check', sigmaSyncController.checkSyncConflicts); // NOVA ROTA
router.post('/sync', sigmaSyncController.syncPackages);

// ========== CLIENTES ==========
router.post('/capture-clients', sigmaController.captureClients);
router.get('/clients', sigmaController.listClients);
router.get('/domains-with-clients', sigmaController.listDomainsWithClients);

export default router;