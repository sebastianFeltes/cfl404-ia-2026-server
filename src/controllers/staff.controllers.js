import prisma from '../lib/prisma.js'
import { parsePagination } from '../lib/pagination.js'
import { assertAllowedPhotoUrl } from '../lib/photo-url.js'

const PRIVILEGED_ROLE_IDS = new Set([1, 2])
const ASSIGNABLE_STAFF_ROLE_IDS = new Set([3, 4, 5, 6, 7])
const GOD_ASSIGNABLE_ROLE_IDS = new Set([1, 2, 3, 4, 5, 6, 7])

function assertStaffRoleAssignment(actorRole, targetRoleId, existingRoleId) {
  const actor = String(actorRole || '').toUpperCase()
  const nextId = targetRoleId == null ? existingRoleId : targetRoleId
  const allowed = actor === 'GOD' ? GOD_ASSIGNABLE_ROLE_IDS : ASSIGNABLE_STAFF_ROLE_IDS

  if (targetRoleId != null && !allowed.has(Number(targetRoleId))) {
    const error = new Error('No tenés permiso para asignar ese rol')
    error.statusCode = 403
    throw error
  }

  if (actor !== 'GOD' && existingRoleId != null && PRIVILEGED_ROLE_IDS.has(Number(existingRoleId))) {
    const error = new Error('No tenés permiso para modificar este usuario')
    error.statusCode = 403
    throw error
  }

  return nextId
}

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
        assigned_course_ids: staff.instructedCourses?.map(c => c.id) ?? [],
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
        const { take, skip, page } = parsePagination(req.query)
        const where = { role: { name: { in: STAFF_ROLE_NAMES } } }
        const [staffList, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: STAFF_INCLUDE,
                orderBy: { lastName: 'asc' },
                take,
                skip,
            }),
            prisma.user.count({ where }),
        ])

        res.json({
            success: true,
            data: staffList.map(toClientShape),
            total,
            page,
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

        const staff = await prisma.user.findFirst({
            where: { id, role: { name: { in: STAFF_ROLE_NAMES } } },
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
 *   first_name, last_name, email, dni, status_id, role_id, phone?, address?, profile_photo_url?, assigned_course_ids?
 */
export const createStaff = async (req, res, next) => {
    try {
        const {
            first_name,
            last_name,
            email,
            dni,
            status_id = 1,
            role_id = 7,
            phone,
            address,
            profile_photo_url,
            assigned_course_ids,
        } = req.body

        if (profile_photo_url) assertAllowedPhotoUrl(profile_photo_url)
        const safeRoleId = assertStaffRoleAssignment(req.user?.role, role_id || 7, null) || 7

        const newStaff = await prisma.$transaction(async (tx) => {
            const staff = await tx.user.create({
                data: {
                    firstName: first_name,
                    lastName: last_name,
                    email,
                    dni,
                    statusId: status_id,
                    roleId: safeRoleId,
                    profilePhotoUrl: profile_photo_url || null,
                    userDetail: {
                        create: {
                            phone: phone || null,
                            address: address || null,
                        },
                    },
                },
            })

            // Asignar cursos seleccionados a este nuevo instructor
            if (assigned_course_ids && Array.isArray(assigned_course_ids) && assigned_course_ids.length > 0) {
                await tx.course.updateMany({
                    where: { id: { in: assigned_course_ids } },
                    data: { instructorId: staff.id },
                })
            }

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
            assigned_course_ids,
        } = req.body

        if (profile_photo_url) assertAllowedPhotoUrl(profile_photo_url)

        const updatedStaff = await prisma.$transaction(async (tx) => {
            const existing = await tx.user.findFirst({
                where: { id, role: { name: { in: STAFF_ROLE_NAMES } } },
            })
            if (!existing) {
                const err = new Error('Instructor no encontrado')
                err.statusCode = 404
                throw err
            }

            if (role_id !== undefined) {
                assertStaffRoleAssignment(req.user?.role, role_id, existing.roleId)
            } else {
                assertStaffRoleAssignment(req.user?.role, existing.roleId, existing.roleId)
            }

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

            // Actualizar cursos asignados si se enviaron
            if (assigned_course_ids !== undefined && Array.isArray(assigned_course_ids)) {
                // 1. Asignar los cursos seleccionados a este instructor
                if (assigned_course_ids.length > 0) {
                    await tx.course.updateMany({
                        where: { id: { in: assigned_course_ids } },
                        data: { instructorId: id },
                    })
                }

                // 2. Para cursos que antes estaban asignados a este instructor pero ya no:
                const fallbackInstructor = await tx.user.findFirst({
                    where: {
                        role: { name: { in: ['INSTRUCTOR', 'ADMIN', 'GOD', 'DIRECTOR'] } },
                        id: { not: id },
                    },
                })
                if (fallbackInstructor) {
                    await tx.course.updateMany({
                        where: {
                            instructorId: id,
                            id: { notIn: assigned_course_ids },
                        },
                        data: { instructorId: fallbackInstructor.id },
                    })
                }
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
        const actor = String(req.user?.role || '').toUpperCase()
        const visible = roles.filter((role) => {
            if (['ALUMNO', 'POSTULANTE'].includes(role.name)) return false
            if (actor === 'GOD') return true
            return !['GOD', 'ADMIN'].includes(role.name)
        })

        res.json({
            success: true,
            data: visible,
            message: 'Roles obtenidos exitosamente',
        })
    } catch (error) {
        next(error)
    }
}
