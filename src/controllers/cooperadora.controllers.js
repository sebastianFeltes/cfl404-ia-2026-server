import prisma from '../lib/prisma.js'
import { parsePagination } from '../lib/pagination.js'

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

    const { take } = parsePagination(req.query, { defaultTake: 100, maxTake: 200 })
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
      take,
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
    const { tipo, year, month } = req.query

    const whereClause = {}
    if (tipo) {
      whereClause.type = tipo
    }
    if (year) {
      const parsedYear = parseInt(year, 10)
      const parsedMonth = month ? parseInt(month, 10) : null

      if (parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
        const monthStr = String(parsedMonth).padStart(2, '0')
        const startDate = new Date(`${parsedYear}-${monthStr}-01T00:00:00.000Z`)
        const endMonth = parsedMonth === 12 ? 1 : parsedMonth + 1
        const endYear = parsedMonth === 12 ? parsedYear + 1 : parsedYear
        const endMonthStr = String(endMonth).padStart(2, '0')
        const endDate = new Date(`${endYear}-${endMonthStr}-01T00:00:00.000Z`)
        whereClause.date = {
          gte: startDate,
          lt: endDate,
        }
      } else {
        const startDate = new Date(`${parsedYear}-01-01T00:00:00.000Z`)
        const endDate = new Date(`${parsedYear}-12-31T23:59:59.999Z`)
        whereClause.date = {
          gte: startDate,
          lte: endDate,
        }
      }
    }

    const { take } = parsePagination(req.query, { defaultTake: 100, maxTake: 200 })
    const records = await prisma.buffetMovement.findMany({
      where: whereClause,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
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

/**
 * Listar movimientos generales de Cooperadora (gastos, donaciones, premios, etc.)
 */
export const getCooperadoraMovements = async (req, res, next) => {
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

    const { take } = parsePagination(req.query, { defaultTake: 100, maxTake: 200 })
    const records = await prisma.cooperadoraMovement.findMany({
      where: whereClause,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take,
    })

    const formattedRecords = records.map((r) => ({
      id: r.id,
      fecha: r.date ? r.date.toISOString().split('T')[0] : '',
      monto: r.amount,
      tipo: r.type,
      category: r.category || '',
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
 * Registrar un nuevo movimiento general de Cooperadora
 */
export const createCooperadoraMovement = async (req, res, next) => {
  try {
    const { fecha, date, monto, tipo, category, detalle, observaciones } = req.body

    const rawDate = fecha || date
    const parsedDate = rawDate ? new Date(rawDate + 'T00:00:00') : new Date()

    const newRecord = await prisma.cooperadoraMovement.create({
      data: {
        date: parsedDate,
        amount: parseFloat(monto),
        type: tipo,
        category: category ? category.trim() : null,
        detail: detalle.trim(),
        observations: observaciones ? observaciones.trim() : null,
      },
    })

    return res.status(201).json({
      status: 'success',
      message: 'Movimiento de cooperadora registrado exitosamente',
      data: {
        id: newRecord.id,
        fecha: newRecord.date ? newRecord.date.toISOString().split('T')[0] : '',
        monto: newRecord.amount,
        tipo: newRecord.type,
        category: newRecord.category || '',
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
 * Eliminar un movimiento general de Cooperadora
 */
export const deleteCooperadoraMovement = async (req, res, next) => {
  try {
    const { id } = req.params

    const record = await prisma.cooperadoraMovement.findUnique({
      where: { id },
    })

    if (!record) {
      return res.status(404).json({
        error: 'Movimiento de cooperadora no encontrado',
      })
    }

    await prisma.cooperadoraMovement.delete({
      where: { id },
    })

    return res.status(200).json({
      status: 'success',
      message: 'Movimiento de cooperadora eliminado correctamente',
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Reporte de Balance Contable Consolidado y Dinámico
 * Autogenera los movimientos a partir de cuotas de alumnos, movimientos de cooperadora y buffet.
 */
export const getBalanceReport = async (req, res, next) => {
  try {
    const { year } = req.query
    const targetYear = year ? parseInt(year, 10) : new Date().getFullYear()

    const startDate = new Date(`${targetYear}-01-01T00:00:00.000Z`)
    const endDate = new Date(`${targetYear}-12-31T23:59:59.999Z`)

    // Consultar las 3 fuentes de ingresos y egresos para el año indicado
    const [payments, coopMovements, buffetMovements] = await Promise.all([
      prisma.cooperadoraPayment.findMany({
        where: { year: targetYear },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              dni: true,
            },
          },
        },
        orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.cooperadoraMovement.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.buffetMovement.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ])

    const MES_NOMBRES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

    // Unificar todos los registros como entradas contables
    const unified = []

    // 1. Cuotas de Alumnos (Ingresos de Cooperadora)
    payments.forEach((p) => {
      const studentName = p.user ? `${p.user.firstName} ${p.user.lastName}`.trim() : 'Alumno'
      const studentDni = p.user?.dni ? ` (DNI: ${p.user.dni})` : ''
      const monthName = MES_NOMBRES[p.month - 1] || `Mes ${p.month}`
      const dateStr = p.paymentDate
        ? p.paymentDate.toISOString().split('T')[0]
        : `${targetYear}-${String(p.month).padStart(2, '0')}-01`
      const rawDate = p.paymentDate || new Date(`${targetYear}-${String(p.month).padStart(2, '0')}-01T12:00:00.000Z`)

      unified.push({
        id: `pay_${p.id}`,
        rawId: p.id,
        entityType: 'payment',
        origen: 'cooperadora',
        tipo: 'ingreso',
        categoria: 'cuota',
        detalle: `Cuota ${monthName} - ${studentName}${studentDni}`,
        observaciones: p.notes || '',
        fecha: dateStr,
        dateObj: rawDate,
        month: p.month,
        ingreso: Number(p.amount),
        egreso: 0,
        canDelete: true,
      })
    })

    // 2. Movimientos Generales de Cooperadora (Gastos o Donaciones/Premios)
    coopMovements.forEach((m) => {
      const isIngreso = m.type === 'ingreso'
      const dateStr = m.date ? m.date.toISOString().split('T')[0] : ''
      const rawDate = m.date || new Date()
      const monthNum = rawDate.getMonth() + 1

      unified.push({
        id: `coop_${m.id}`,
        rawId: m.id,
        entityType: 'coop_movement',
        origen: 'cooperadora',
        tipo: m.type,
        categoria: m.category || (isIngreso ? 'donacion' : 'gasto'),
        detalle: m.detail,
        observaciones: m.observations || '',
        fecha: dateStr,
        dateObj: rawDate,
        month: monthNum,
        ingreso: isIngreso ? Number(m.amount) : 0,
        egreso: !isIngreso ? Number(m.amount) : 0,
        canDelete: true,
      })
    })

    // 3. Movimientos de Buffet (Ventas y Gastos de Cantina)
    buffetMovements.forEach((b) => {
      const isIngreso = b.type === 'ingreso'
      const dateStr = b.date ? b.date.toISOString().split('T')[0] : ''
      const rawDate = b.date || new Date()
      const monthNum = rawDate.getMonth() + 1

      unified.push({
        id: `buf_${b.id}`,
        rawId: b.id,
        entityType: 'buffet',
        origen: 'buffet',
        tipo: b.type,
        categoria: isIngreso ? 'venta_buffet' : 'gasto_buffet',
        detalle: b.detail,
        observaciones: b.observations || '',
        fecha: dateStr,
        dateObj: rawDate,
        month: monthNum,
        ingreso: isIngreso ? Number(b.amount) : 0,
        egreso: !isIngreso ? Number(b.amount) : 0,
        canDelete: true,
      })
    })

    // Ordenar cronológicamente para calcular el saldo acumulado real en cada punto
    unified.sort((a, b) => new Date(a.dateObj).getTime() - new Date(b.dateObj).getTime())

    let runningBalance = 0
    const entriesWithBalance = unified.map((item) => {
      runningBalance += (item.ingreso - item.egreso)
      return {
        ...item,
        saldoAcumulado: runningBalance,
      }
    })

    // Inicializar serie de 12 meses para gráficos y resúmenes
    const monthlyStats = Array.from({ length: 12 }, (_, i) => {
      const monthIndex = i + 1
      return {
        month: monthIndex,
        monthName: MES_NOMBRES[i],
        ingresosCooperadora: 0,
        ingresosBuffet: 0,
        totalIngresos: 0,
        egresosCooperadora: 0,
        egresosBuffet: 0,
        totalEgresos: 0,
        balanceMes: 0,
        balanceAcumulado: 0,
      }
    })

    // Sumarizar por mes
    let cumBalance = 0
    for (let m = 1; m <= 12; m++) {
      const mStats = monthlyStats[m - 1]
      const monthEntries = entriesWithBalance.filter((e) => e.month === m)

      monthEntries.forEach((e) => {
        if (e.origen === 'cooperadora') {
          if (e.tipo === 'ingreso') {
            mStats.ingresosCooperadora += e.ingreso
          } else {
            mStats.egresosCooperadora += e.egreso
          }
        } else if (e.origen === 'buffet') {
          if (e.tipo === 'ingreso') {
            mStats.ingresosBuffet += e.ingreso
          } else {
            mStats.egresosBuffet += e.egreso
          }
        }
      })

      mStats.totalIngresos = mStats.ingresosCooperadora + mStats.ingresosBuffet
      mStats.totalEgresos = mStats.egresosCooperadora + mStats.egresosBuffet
      mStats.balanceMes = mStats.totalIngresos - mStats.totalEgresos
      cumBalance += mStats.balanceMes
      mStats.balanceAcumulado = cumBalance
    }

    // Totales globales y KPIs
    const totalCuotas = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0)
    const totalDonaciones = coopMovements
      .filter((m) => m.type === 'ingreso')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0)
    const totalGastosCooperadora = coopMovements
      .filter((m) => m.type === 'egreso')
      .reduce((acc, m) => acc + Number(m.amount || 0), 0)

    const totalIngresosBuffet = buffetMovements
      .filter((b) => b.type === 'ingreso')
      .reduce((acc, b) => acc + Number(b.amount || 0), 0)
    const totalEgresosBuffet = buffetMovements
      .filter((b) => b.type === 'egreso')
      .reduce((acc, b) => acc + Number(b.amount || 0), 0)

    const totalIngresos = totalCuotas + totalDonaciones + totalIngresosBuffet
    const totalEgresos = totalGastosCooperadora + totalEgresosBuffet
    const balanceFinal = totalIngresos - totalEgresos

    // Para la tabla, devolvemos orden descendente (más recientes arriba) con el saldo acumulado correcto
    const reversedEntries = [...entriesWithBalance].reverse()

    return res.status(200).json({
      status: 'success',
      year: targetYear,
      kpis: {
        totalIngresos,
        totalEgresos,
        balanceFinal,
        totalCuotas,
        totalDonaciones,
        totalGastosCooperadora,
        totalIngresosBuffet,
        totalEgresosBuffet,
        totalMovimientos: unified.length,
      },
      monthlyStats,
      entries: reversedEntries,
    })
  } catch (error) {
    next(error)
  }
}
