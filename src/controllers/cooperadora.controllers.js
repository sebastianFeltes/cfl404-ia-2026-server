import prisma from '../lib/prisma.js'

/**
 * Obtener todos los pagos de Cooperadora (opcionalmente filtrados por año o alumno)
 */
export const getPayments = async (req, res, next) => {
  try {
    const { year, studentId } = req.query
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear()

    const whereClause = {}
    if (targetYear) {
      whereClause.year = targetYear
    }
    if (studentId) {
      whereClause.userId = studentId
    }

    const payments = await prisma.cooperadoraPayment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dni: true,
            email: true,
          },
        },
      },
      orderBy: [{ month: 'asc' }, { createdAt: 'desc' }],
    })

    // Construir mapa de pagos por alumno para facilitar el renderizado en tablas
    const paymentsMap = {}
    payments.forEach((p) => {
      if (!paymentsMap[p.userId]) {
        paymentsMap[p.userId] = {}
      }
      paymentsMap[p.userId][p.month] = {
        id: p.id,
        pagado: true,
        monto: p.amount,
        year: p.year,
        fecha: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',
        notas: p.notes || '',
      }
    })

    const formattedList = payments.map((p) => ({
      id: p.id,
      student_id: p.userId,
      student_name: p.user ? `${p.user.firstName} ${p.user.lastName}` : '',
      student_dni: p.user?.dni || '',
      month: p.month,
      year: p.year,
      amount: p.amount,
      payment_date: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',
      notes: p.notes || '',
      created_at: p.createdAt,
    }))

    return res.status(200).json({
      status: 'success',
      year: targetYear,
      count: payments.length,
      data: formattedList,
      paymentsMap,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Helper para calcular la distribución del monto entre meses consecutivos
 */
export function calculatePaymentDistribution(startMonth, totalAmount, minFee = 2000, maxMonth = 12) {
  const fullMonths = Math.floor(totalAmount / minFee)
  if (fullMonths <= 1) {
    return [{ month: Math.min(startMonth, maxMonth), amount: totalAmount }]
  }

  const distribution = []
  let currentMonth = startMonth
  let remainingBudget = totalAmount

  while (currentMonth <= maxMonth && remainingBudget >= minFee && distribution.length < fullMonths - 1) {
    distribution.push({ month: currentMonth, amount: minFee })
    remainingBudget -= minFee
    currentMonth++
  }

  if (currentMonth <= maxMonth) {
    distribution.push({ month: currentMonth, amount: remainingBudget })
  } else if (distribution.length > 0) {
    distribution[distribution.length - 1].amount += remainingBudget
  }

  return distribution
}

/**
 * Registrar o actualizar (Upsert) pago de Cooperadora automatizando la distribución de meses
 */
export const savePayment = async (req, res, next) => {
  try {
    const { studentId, month, year, amount, date, notes } = req.body

    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear()
    const targetMonth = parseInt(month, 10)
    const targetAmount = parseFloat(amount)

    // Verificar que el alumno exista
    const student = await prisma.user.findUnique({
      where: { id: studentId },
    })

    if (!student) {
      return res.status(404).json({
        error: 'El alumno especificado no existe en la base de datos',
      })
    }

    const parsedDate = date ? new Date(date + 'T00:00:00') : new Date()

    // Calcular distribución de cuotas
    const distribution = calculatePaymentDistribution(targetMonth, targetAmount, 2000, 12)

    // Ejecutar upserts atómicamente en transacción
    const savedPayments = await prisma.$transaction(
      distribution.map((item) =>
        prisma.cooperadoraPayment.upsert({
          where: {
            userId_month_year: {
              userId: studentId,
              month: item.month,
              year: targetYear,
            },
          },
          update: {
            amount: item.amount,
            paymentDate: parsedDate,
            notes: notes !== undefined ? notes : null,
          },
          create: {
            userId: studentId,
            month: item.month,
            year: targetYear,
            amount: item.amount,
            paymentDate: parsedDate,
            notes: notes || null,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                dni: true,
              },
            },
          },
        })
      )
    )

    const formattedData = savedPayments.map((p) => ({
      id: p.id,
      student_id: p.userId,
      student_name: `${p.user.firstName} ${p.user.lastName}`,
      month: p.month,
      year: p.year,
      amount: p.amount,
      fecha: p.paymentDate ? p.paymentDate.toISOString().split('T')[0] : '',
      notas: p.notes || '',
    }))

    const monthsCoveredNames = distribution.map((d) => d.month).join(', ')

    return res.status(200).json({
      status: 'success',
      message:
        distribution.length > 1
          ? `Monto distribuido en ${distribution.length} meses (Meses: ${monthsCoveredNames})`
          : `Pago del mes ${targetMonth} (${targetYear}) registrado exitosamente`,
      data: formattedData[0], // Compatibilidad con respuesta individual
      allSaved: formattedData,
      distribution,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Eliminar un pago de cooperadora
 */
export const deletePayment = async (req, res, next) => {
  try {
    const { id } = req.params

    const payment = await prisma.cooperadoraPayment.findUnique({
      where: { id },
    })

    if (!payment) {
      return res.status(404).json({
        error: 'Registro de pago no encontrado',
      })
    }

    await prisma.cooperadoraPayment.delete({
      where: { id },
    })

    return res.status(200).json({
      status: 'success',
      message: 'Pago de cooperadora eliminado correctamente',
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Listar todos los movimientos de Buffet (ingresos y egresos)
 */
export const getBuffetMovements = async (req, res, next) => {
  try {
    const { tipo, year } = req.query

    const whereClause = {}
    if (tipo) {
      whereClause.type = tipo
    }
    if (year) {
      const parsedYear = parseInt(year, 10)
      const startDate = new Date(`${parsedYear}-01-01T00:00:00.000Z`)
      const endDate = new Date(`${parsedYear}-12-31T23:59:59.999Z`)
      whereClause.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    const records = await prisma.buffetMovement.findMany({
      where: whereClause,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    const formattedRecords = records.map((r) => ({
      id: r.id,
      fecha: r.date ? r.date.toISOString().split('T')[0] : '',
      monto: r.amount,
      tipo: r.type,
      detalle: r.detail,
      observaciones: r.observations || '',
      created_at: r.createdAt,
    }))

    return res.status(200).json({
      status: 'success',
      count: formattedRecords.length,
      data: formattedRecords,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Registrar un nuevo movimiento de Buffet
 */
export const createBuffetMovement = async (req, res, next) => {
  try {
    const { fecha, date, monto, tipo, detalle, observaciones } = req.body

    const rawDate = fecha || date
    const parsedDate = rawDate ? new Date(rawDate + 'T00:00:00') : new Date()

    const newRecord = await prisma.buffetMovement.create({
      data: {
        date: parsedDate,
        amount: parseFloat(monto),
        type: tipo,
        detail: detalle.trim(),
        observations: observaciones ? observaciones.trim() : null,
      },
    })

    return res.status(201).json({
      status: 'success',
      message: 'Movimiento de buffet registrado exitosamente',
      data: {
        id: newRecord.id,
        fecha: newRecord.date ? newRecord.date.toISOString().split('T')[0] : '',
        monto: newRecord.amount,
        tipo: newRecord.type,
        detalle: newRecord.detail,
        observaciones: newRecord.observations || '',
        created_at: newRecord.createdAt,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Eliminar un movimiento de Buffet
 */
export const deleteBuffetMovement = async (req, res, next) => {
  try {
    const { id } = req.params

    const record = await prisma.buffetMovement.findUnique({
      where: { id },
    })

    if (!record) {
      return res.status(404).json({
        error: 'Movimiento de buffet no encontrado',
      })
    }

    await prisma.buffetMovement.delete({
      where: { id },
    })

    return res.status(200).json({
      status: 'success',
      message: 'Movimiento de buffet eliminado correctamente',
    })
  } catch (error) {
    next(error)
  }
}
