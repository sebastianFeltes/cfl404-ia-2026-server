import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

export const preinscripcionUserLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Demasiados intentos de preinscripción. Probá de nuevo en un minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.id ? String(req.user.id) : ipKeyGenerator(req.ip)),
  skip: (req) => req.method === 'OPTIONS',
})
