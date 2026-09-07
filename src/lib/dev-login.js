/**
 * Dev-login solo existe en development con flag explícito.
 * Cualquier otro entorno debe tratar la ruta como inexistente (404).
 */
export function isDevLoginEnabled({
  nodeEnv = process.env.NODE_ENV,
  allowDevLogin = process.env.ALLOW_DEV_LOGIN,
} = {}) {
  return nodeEnv === 'development' && allowDevLogin === 'true'
}

export const DEV_LOGIN_ACCOUNTS = Object.freeze({
  god: 'admin.test@cfl404.edu.ar',
  dios: 'admin.test@cfl404.edu.ar',
  alumno: 'alumno.test@cfl404.edu.ar',
  estudiante: 'alumno.test@cfl404.edu.ar',
  docente: 'docente.test@cfl404.edu.ar',
  profesor: 'docente.test@cfl404.edu.ar',
  admin: 'admin.test@cfl404.edu.ar',
  directivo: 'directivo.test@cfl404.edu.ar',
  postulante: 'laura.g@gmail.com',
})
