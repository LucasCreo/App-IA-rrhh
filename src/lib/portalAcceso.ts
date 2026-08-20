import { prisma } from './prisma'
import type { TokenPayload } from './auth'

/**
 * Devuelve true si el usuario puede leer/interactuar con el post según su alcance.
 * Admin: siempre. Autor: siempre. GLOBAL: siempre.
 * CATEGORIA/AREA/AREA_CATEGORIA: matchea con employee del usuario.
 */
export async function puedeAccederAPost(user: TokenPayload, postId: number): Promise<boolean> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { alcance: true, areaId: true, categoriaId: true, autorId: true },
  })
  if (!post) return false
  if (user.role === 'ADMIN') return true
  if (post.autorId === user.userId) return true
  if (post.alcance === 'GLOBAL') return true
  if (!user.employeeId) return false

  const emp = await prisma.employee.findUnique({
    where: { id: user.employeeId },
    select: { areaId: true, categoriaId: true },
  })
  if (!emp) return false

  if (post.alcance === 'CATEGORIA') return post.categoriaId === emp.categoriaId
  if (post.alcance === 'AREA') return post.areaId === emp.areaId
  if (post.alcance === 'AREA_CATEGORIA') {
    return post.areaId === emp.areaId && post.categoriaId === emp.categoriaId
  }
  return false
}
