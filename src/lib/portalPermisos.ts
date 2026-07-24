import { prisma } from './prisma'
import type { TokenPayload } from './auth'

/**
 * Puede publicar en el portal si es un admin con permiso o cualquier empleado.
 * Los admins con permisos custom necesitan PUBLICAR_FEED explícito.
 * Los empleados requieren que avisosEmpleadosHabilitados esté activo en la config global.
 */
export async function puedePublicarEnPortal(user: TokenPayload): Promise<boolean> {
  if (user.role !== 'ADMIN') {
    const cfg = await prisma.generalConfig.findFirst({ select: { avisosEmpleadosHabilitados: true } })
    return cfg?.avisosEmpleadosHabilitados ?? true
  }
  const count = await prisma.userPermiso.count({ where: { userId: user.userId } })
  if (count === 0) return true
  const has = await prisma.userPermiso.findUnique({
    where: { userId_permiso: { userId: user.userId, permiso: 'PUBLICAR_FEED' } },
  })
  return !!has
}
