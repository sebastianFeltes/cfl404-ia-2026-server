import { Router } from 'express'
import { joinQueue, getQueueStatus, handleQueueWebhook } from '../controllers/queue.controllers.js'

const QueueRouter = Router()

// Endpoints para gestión de tráfico y colas virtuales
QueueRouter.post('/api/queue/join', joinQueue)
QueueRouter.get('/api/queue/status/:ticketId', getQueueStatus)

// Webhook endpoint para integración en tiempo real
QueueRouter.post('/api/webhooks/queue', handleQueueWebhook)

export default QueueRouter
