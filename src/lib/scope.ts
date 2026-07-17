import { prisma } from './prisma'

/**
 * Calcula el "scope" de empleados que un admin puede ver/modificar.
 *
 * Regla:
 * - Users SIN legajo (admin puro/soporte) → null (acceso total, sin restricción).
 * - Users CON legajo → siempre restringido a sí mismo + sus subordinados (directos e indirectos).
 *
 * null = sin restricción. Set vacío = no ve a nadie.
 */

export interface UserNode {
  id: number
  employeeId: number | null
  managerUserId: number | null
}

/**
 * Pura: dado el árbol completo y un userId, devuelve los employeeIds visibles.
 * Regla: user sin legajo → null (acceso total). User con legajo → sí mismo + descendientes.
 * User inexistente → set vacío.
 */
export function computeScope(users: UserNode[], userId: number): Set<number> | null {
  const user = users.find(u => u.id === userId)
  if (!user) return new Set()
  if (!user.employeeId) return null

  const hijosDe = buildChildrenMap(users)
  const usersEnScope = collectDescendants(hijosDe, userId, true)

  const empByUser = new Map(users.map(u => [u.id, u.employeeId]))
  const scope = new Set<number>()
  for (const uid of usersEnScope) {
    const eid = empByUser.get(uid)
    if (eid) scope.add(eid)
  }
  return scope
}

/**
 * Pura: dado el árbol y un userId, devuelve los employeeIds de sus descendientes estrictos
 * (sin incluirse a sí mismo). Si el user no tiene legajo, devuelve el set de todos los employeeIds
 * (admin puro puede aprobar cualquier cosa).
 */
export function computeDescendantEmployees(users: UserNode[], userId: number, allEmployeeIds: number[]): Set<number> {
  const self = users.find(u => u.id === userId)
  if (!self?.employeeId) return new Set(allEmployeeIds)

  const hijosDe = buildChildrenMap(users)
  const descUsers = collectDescendants(hijosDe, userId, false)

  const empByUser = new Map(users.map(u => [u.id, u.employeeId]))
  const scope = new Set<number>()
  for (const uid of descUsers) {
    const eid = empByUser.get(uid)
    if (eid) scope.add(eid)
  }
  return scope
}

/**
 * Pura: true si ancestorUserId es ancestro (directo o indirecto) de descendantUserId.
 * Un user NO es ancestro de sí mismo. Admins puros (sin legajo) se consideran ancestros de todos.
 */
export function computeIsAncestor(users: UserNode[], ancestorUserId: number, descendantUserId: number): boolean {
  if (ancestorUserId === descendantUserId) return false
  const ancestor = users.find(u => u.id === ancestorUserId)
  if (!ancestor) return false
  if (!ancestor.employeeId) return true

  const managerDe = new Map(users.map(u => [u.id, u.managerUserId]))
  let cur: number | null | undefined = managerDe.get(descendantUserId) ?? null
  const visto = new Set<number>()
  while (cur != null && !visto.has(cur)) {
    if (cur === ancestorUserId) return true
    visto.add(cur)
    cur = managerDe.get(cur) ?? null
  }
  return false
}

function buildChildrenMap(users: UserNode[]): Map<number, number[]> {
  const hijosDe = new Map<number, number[]>()
  for (const u of users) {
    if (u.managerUserId != null) {
      const arr = hijosDe.get(u.managerUserId) ?? []
      arr.push(u.id)
      hijosDe.set(u.managerUserId, arr)
    }
  }
  return hijosDe
}

function collectDescendants(hijosDe: Map<number, number[]>, rootId: number, includeRoot: boolean): Set<number> {
  const result = new Set<number>()
  const stack: number[] = includeRoot ? [rootId] : [...(hijosDe.get(rootId) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (result.has(id)) continue
    result.add(id)
    for (const h of hijosDe.get(id) ?? []) stack.push(h)
  }
  return result
}

export async function getScopedEmployeeIds(userId: number): Promise<Set<number> | null> {
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, employeeId: true },
  })
  if (!self) return new Set()
  if (!self.employeeId) return null

  const users = await prisma.user.findMany({
    select: { id: true, employeeId: true, managerUserId: true },
  })
  return computeScope(users, userId)
}

export async function getDescendantEmployeeIds(userId: number): Promise<Set<number>> {
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true },
  })
  if (!self?.employeeId) {
    const all = await prisma.employee.findMany({ select: { id: true } })
    return new Set(all.map(e => e.id))
  }
  const users = await prisma.user.findMany({
    select: { id: true, employeeId: true, managerUserId: true },
  })
  return computeDescendantEmployees(users, userId, [])
}

export async function isAncestorOfUser(ancestorUserId: number, descendantUserId: number): Promise<boolean> {
  if (ancestorUserId === descendantUserId) return false
  const ancestor = await prisma.user.findUnique({
    where: { id: ancestorUserId },
    select: { employeeId: true },
  })
  if (!ancestor) return false
  if (!ancestor.employeeId) return true

  const users = await prisma.user.findMany({
    select: { id: true, employeeId: true, managerUserId: true },
  })
  return computeIsAncestor(users, ancestorUserId, descendantUserId)
}

/**
 * Devuelve true si el user asociado al employee está en el top del organigrama (sin manager).
 * Si el employee no tiene user, devuelve false.
 */
export async function esTopDelOrganigrama(employeeId: number): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { employeeId },
    select: { managerUserId: true },
  })
  return !!user && user.managerUserId == null
}
