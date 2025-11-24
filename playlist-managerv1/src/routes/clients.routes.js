const express = require('express');
const router = express.Router();
const clientsController = require('../controllers/clients.controller');
const authMiddleware = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar todos os clientes do usuário
router.get('/', clientsController.list);

// Buscar cliente específico
router.get('/:id', clientsController.getById);

module.exports = router;
