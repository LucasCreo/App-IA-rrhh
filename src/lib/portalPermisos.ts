import { prisma } from './prisma'
import type { TokenPayload } from './auth'

/**
 * Puede publicar en el portal si:
 *  - Es ADMIN sin permisos custom (acceso total), o
 *  - Tiene el permiso PUBLICAR_FEED asignado
 */
export async function puedePublicarEnPortal(user: TokenPayload): Promise<boolean> {
  if (user.role !== 'ADMIN') return false
  const count = await (prisma as any).userPermiso.count({ where: { userId: user.userId } })
  if (count === 0) return true
  const has = await (prisma as any).userPermiso.findUnique({
    where: { userId_permiso: { userId: user.userId, permiso: 'PUBLICAR_FEED' } },
  })
  return !!has
}
