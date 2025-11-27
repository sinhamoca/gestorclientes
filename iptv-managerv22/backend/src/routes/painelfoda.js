/* ========================================
   PAINELFODA ROUTES - IPTV MANAGER
   Versão SEM autenticação (requisições internas)
   ======================================== */

import express from 'express';
import { capturePackages } from '../controllers/painelfodaController.js';

const router = express.Router();

/**
 * POST /api/painelfoda/capture-packages
 * Captura packages disponíveis no PainelFoda
 * 
 * Nota: Esta rota recebe requisições do Gestao Clientes (internas)
 * A autenticação já foi feita no Gestao Clientes
 */
router.post('/capture-packages', capturePackages);

export default router;
