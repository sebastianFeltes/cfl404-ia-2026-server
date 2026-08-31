// Controlador para gestión de la Cola Virtual y Webhooks de inscripción

// In-memory queue state (simulado/producción ready)
const activeQueue = new Map();
let ticketCounter = 100;

export const joinQueue = async (req, res) => {
  try {
    const { courseId, userId } = req.body;
    ticketCounter += 1;
    const ticketId = `TQ-${ticketCounter}`;
    const position = activeQueue.size + 1;
    const estimatedWaitMinutes = Math.ceil(position * 0.5);

    const queueEntry = {
      ticketId,
      courseId: courseId || 'course-default',
      userId: userId || 'anonymous',
      position,
      status: 'WAITING',
      createdAt: new Date().toISOString(),
      estimatedWaitMinutes,
    };

    activeQueue.set(ticketId, queueEntry);

    res.status(201).json({
      success: true,
      message: 'Turno registrado exitosamente en la Cola Virtual',
      ticket: queueEntry,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar turno en la cola virtual' });
  }
};

export const getQueueStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const entry = activeQueue.get(ticketId);

    if (!entry) {
      return res.status(404).json({ error: 'Turno de cola no encontrado' });
    }

    res.json({
      ticketId: entry.ticketId,
      position: entry.position,
      status: entry.status,
      estimatedWaitMinutes: entry.estimatedWaitMinutes,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado de la cola' });
  }
};

export const handleQueueWebhook = async (req, res) => {
  try {
    const { event, ticketId, status } = req.body;

    console.log(`[QUEUE WEBHOOK] Evento recibido: ${event} para Ticket: ${ticketId}`);

    if (ticketId && activeQueue.has(ticketId)) {
      const entry = activeQueue.get(ticketId);
      if (status) entry.status = status;
      activeQueue.set(ticketId, entry);
    }

    res.json({
      received: true,
      event,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error procesando webhook de cola virtual' });
  }
};
