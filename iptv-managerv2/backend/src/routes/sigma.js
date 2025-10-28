/* ========================================
   SIGMA ROUTES
   ======================================== */

import express from 'express';
import * as sigmaController from '../controllers/sigmaController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Credenciais
router.post('/credentials', sigmaController.saveCredential);
router.get('/credentials', sigmaController.listCredentials);
router.delete('/credentials/:domain', sigmaController.deleteCredential);

// Pacotes
router.post('/fetch-packages', sigmaController.fetchPackages);
router.get('/packages', sigmaController.listPackages); // Nova rota com query string
router.get('/packages/:domain', sigmaController.listPackages); // Mantém backward compatibility
router.get('/domains', sigmaController.listDomains);

export default router;