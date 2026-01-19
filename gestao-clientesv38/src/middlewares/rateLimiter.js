// ========================================
// RATE LIMITER MIDDLEWARE
// ========================================

import rateLimit from 'express-rate-limit';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`⚠️  [RATE-LIMIT] IP ${req.ip} excedeu limite de login`);
    res.status(429).json({
      error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

export const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

// API Limiter - Aumentado para suportar buscas em tempo real
// Cada letra digitada dispara ~6 requisições simultâneas
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // Aumentado de 200 para 1000
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas requisições. Aguarde um momento.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.id?.toString() || req.ip;
  }
});

export default {
  authLimiter,
  webhookLimiter,
  apiLimiter,
  paymentLimiter
};