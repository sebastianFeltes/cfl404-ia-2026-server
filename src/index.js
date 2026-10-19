import 'dotenv/config'
import app from './app.js'
import { assertSecureBoot } from './lib/boot.js'
import { startAttendanceCron } from './lib/attendance-cron.js'

assertSecureBoot()

const PORT = process.env.PORT || 4000

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason)
  process.exit(1)
})

if (process.env.NODE_ENV !== 'test') {
  startAttendanceCron()
  app.listen(PORT, () => {
    console.log('Servidor escuchando en el puerto', PORT)
  })
}

export default app
