import { prisma } from './prisma'
import type { TokenPayload } from './auth'

/**
 * Puede publicar en el portal si:
 *  - Es ADMIN sin rol custom (permisos full), o
 *  - Tiene un rol custom con el permiso PUBLICAR_FEED
 */
export async function puedePublicarEnPortal(user: TokenPayload): Promise<boolean> {
  if (user.role !== 'ADMIN') return false
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { rolId: true },
  })
  if (!dbUser?.rolId) return true
  const rp = await prisma.rolPermiso.findUnique({
    where: { rolId_permiso: { rolId: dbUser.rolId, permiso: 'PUBLICAR_FEED' } },
  })
  return !!rp
}
