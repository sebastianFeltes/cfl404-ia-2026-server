import prisma from '../lib/prisma.js'

/**
 * Transforma un registro Staff de Prisma (camelCase + relaciones anidadas)
 * al formato snake_case que espera el frontend.
 */
function toClientShape(staff) {
    return {
        id: staff.id,
        first_name: staff.firstName,
        last_name: staff.lastName,
        email: staff.email,
        dni: staff.dni,
        status_id: staff.statusId,
        role_id: staff.roleId,
        role_name: staff.role?.name ?? null,
        phone: staff.userDetail?.phone ?? null,
        address: staff.userDetail?.address ?? null,
        profile_photo_url: staff.profilePhotoUrl,
        course_name: staff.instructedCourses?.[0]?.name ?? null,
        assigned_courses: staff.instructedCourses?.map(c => c.name) ?? [],
        created_at: staff.createdAt,
    }
}

const STAFF_ROLE_NAMES = ['GOD', 'ADMIN', 'DIRECTOR', 'REGENTE', 'SECRETARIA', 'PRECEPTORIA', 'INSTRUCTOR']

/** Incluir relaciones necesarias en cada query de personal */
const STAFF_INCLUDE = {
    role: true,
    status: true,
    userDetail: true,
    instructedCourses: {
        select: { id: true, name: true },
    },
}

/**
 * GET /api/v1/instructores
 * Lista todos los instructores con sus relaciones.
 */
export const getAllStaff = async (req, res, next) => {
    try {
        const staffList = await prisma.user.findMany({
            where: { role: { name: { in: STAFF_ROLE_NAMES } } },
            include: STAFF_INCLUDE,
            orderBy: { lastName: 'asc' },
        })

        res.json({
            success: true,
            data: staffList.map(toClientShape),
            message: 'Instructores obtenidos exitosamente',
        })
    } catch (error) {
        next(error)
    }
}

/**
 * GET /api/v1/instructores/:id
 * Obtiene un instructor por su UUID.
 */
export const getStaffById = async (req, res, next) => {
    try {
        const { id } = req.params

        const staff = await prisma.user.findUnique({
            where: { id },
            include: STAFF_INCLUDE,
        })

        if (!staff) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NOT_FOUND',
                    details: [],
                },
                message: 'Instructor no encontrado',
            })
        }

        res.json({
            success: true,
            data: toClientShape(staff),
            message: 'Instructor obtenido exitosamente',
        })
    } catch (error) {
        next(error)
    }
}

/**
 * POST /api/v1/instructores
 * Crea un nuevo instructor (Staff + StaffDetail) en una transacción.
 * Body esperado (snake_case desde el frontend):
 *   first_name, last_name, email, dni, status_id, role_id, phone?, address?, profile_photo_url?
 */
export const createStaff = async (req, res, next) => {
    try {
        const {
            first_name,
            last_name,
            email,
            dni,
            status_id,
            role_id,
            phone,
            address,
            profile_photo_url,
        } = req.body

        const newStaff = await prisma.$transaction(async (tx) => {
            const staff = await tx.user.create({
                data: {
                    firstName: first_name,
                    lastName: last_name,
                    email,
                    dni,
                    statusId: status_id,
                    roleId: role_id,
                    profilePhotoUrl: profile_photo_url || null,
                    userDetail: {
                        create: {
                            phone: phone || null,
                            address: address || null,
                        },
                    },
                },
            })

            return tx.user.findUnique({
                where: { id: staff.id },
                include: STAFF_INCLUDE,
            })
        })

        res.status(201).json({
            success: true,
            data: toClientShape(newStaff),
            message: 'Instructor creado exitosamente',
        })
    } catch (error) {
        next(error)
    }
}

/**
 * PUT /api/v1/instructores/:id
 * Actualiza un instructor existente.
 * También se usa para "desactivar" (soft delete) enviando { status_id: 2 }.
 */
export const updateStaff = async (req, res, next) => {
    try {
        const { id } = req.params
        const {
            first_name,
            last_name,
            email,
            dni,
            status_id,
            role_id,
            phone,
            address,
            profile_photo_url,
        } = req.body

        const updatedStaff = await prisma.$transaction(async (tx) => {
            // Verificar que el instructor existe
            const existing = await tx.user.findUnique({ where: { id } })
            if (!existing) {
                const err = new Error('Instructor no encontrado')
                err.statusCode = 404
                throw err
            }

            // Construir datos de actualización del Staff (solo campos que llegan)
            const staffData = {}
            if (first_name !== undefined) staffData.firstName = first_name
            if (last_name !== undefined) staffData.lastName = last_name
            if (email !== undefined) staffData.email = email
            if (dni !== undefined) staffData.dni = dni
            if (status_id !== undefined) staffData.statusId = status_id
            if (role_id !== undefined) staffData.roleId = role_id
            if (profile_photo_url !== undefined) staffData.profilePhotoUrl = profile_photo_url

            // Actualizar Staff si hay campos
            if (Object.keys(staffData).length > 0) {
                await tx.user.update({
                    where: { id },
                    data: staffData,
                })
            }

            // Construir datos de actualización del StaffDetail
            const detailData = {}
            if (phone !== undefined) detailData.phone = phone
            if (address !== undefined) detailData.address = address

            // Actualizar o crear StaffDetail si hay campos
            if (Object.keys(detailData).length > 0) {
                await tx.userDetail.upsert({
                    where: { userId: id },
                    update: detailData,
                    create: {
                        userId: id,
                        ...detailData,
                    },
                })
            }

            // Retornar el staff actualizado con relaciones
            return tx.user.findUnique({
                where: { id },
                include: STAFF_INCLUDE,
            })
        })

        res.json({
            success: true,
            data: toClientShape(updatedStaff),
            message: 'Instructor actualizado exitosamente',
        })
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json({
                success: false,
                error: { code: 'NOT_FOUND', details: [] },
                message: error.message,
            })
        }
        next(error)
    }
}

/**
 * GET /api/v1/roles
 * Lista todos los roles disponibles (para el select del formulario).
 */
export const getAllRoles = async (req, res, next) => {
    try {
        const roles = await prisma.role.findMany({
            orderBy: { name: 'asc' },
        })

        res.json({
            success: true,
            data: roles,
            message: 'Roles obtenidos exitosamente',
        })
    } catch (error) {
        next(error)
    }
}
