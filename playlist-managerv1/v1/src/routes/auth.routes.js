const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth');

// Validar token e retornar dados do usuário
router.get('/me', authMiddleware, authController.me);

module.exports = router;
