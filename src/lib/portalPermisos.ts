import { prisma } from './prisma'
import type { TokenPayload } from './auth'

/**
 * Puede publicar en el portal si es un admin con permiso o cualquier empleado.
 * Los admins con permisos custom necesitan PUBLICAR_FEED explícito.
 */
export async function puedePublicarEnPortal(user: TokenPayload): Promise<boolean> {
  if (user.role !== 'ADMIN') return true // empleados siempre pueden postear
  const count = await prisma.userPermiso.count({ where: { userId: user.userId } })
  if (count === 0) return true
  const has = await prisma.userPermiso.findUnique({
    where: { userId_permiso: { userId: user.userId, permiso: 'PUBLICAR_FEED' } },
  })
  return !!has
}
