import { isDevLoginEnabled } from './dev-login.js'

export function assertSecureBoot({
  nodeEnv = process.env.NODE_ENV,
  secretKey = process.env.SECRET_KEY,
  allowDevLogin = process.env.ALLOW_DEV_LOGIN,
  databaseUrl = process.env.DATABASE_URL,
} = {}) {
  if (!secretKey || String(secretKey).length < 32) {
    throw new Error('SECRET_KEY debe estar definido y tener al menos 32 caracteres. El servidor no arranca.')
  }

  if (allowDevLogin === 'true' && nodeEnv !== 'development') {
    throw new Error('ALLOW_DEV_LOGIN no puede estar activo fuera de NODE_ENV=development. El servidor no arranca.')
  }

  if (nodeEnv === 'production' && (!databaseUrl || databaseUrl.startsWith('file:'))) {
    throw new Error('DATABASE_URL de producción no puede ser SQLite (file:). Usá Postgres.')
  }

  if (nodeEnv !== 'development' && isDevLoginEnabled({ nodeEnv, allowDevLogin })) {
    throw new Error('Dev-login quedó habilitado fuera de development.')
  }
}
