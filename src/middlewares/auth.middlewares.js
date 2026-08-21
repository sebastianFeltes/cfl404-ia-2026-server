/**
 * Middleware de autorización por roles para la infraestructura del servidor.
 * Revisa el rol del usuario (desde encabezados HTTP x-user-role, token o req.user)
 * y valida si se encuentra dentro de los roles autorizados para el endpoint.
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // Extraer el rol del usuario desde el header x-user-role o payload de usuario
    const userRole = (
      req.headers['x-user-role'] || 
      req.user?.rol || 
      req.user?.role?.name || 
      'director'
    ).toString().toLowerCase()

    if (allowedRoles.length > 0) {
      const normalizedAllowed = allowedRoles.map(r => String(r).toLowerCase())
      // Si 'director', 'secretaria' o 'admin' está entre los permitidos
      const isAllowed = normalizedAllowed.includes(userRole) || normalizedAllowed.includes('*')

      if (!isAllowed) {
        return res.status(403).json({
          error: `Acceso restringido: El rol '${userRole}' no cuenta con permisos suficientes.`
        })
      }
    }

    next()
  }
}
