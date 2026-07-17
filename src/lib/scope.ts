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
export async function getScopedEmployeeIds(userId: number): Promise<Set<number> | null> {
  let user: { id: number; employeeId: number | null } | null
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, employeeId: true },
    })
  } catch (e) {
    console.error('[scope] fallback a acceso global — falta migración/generate?', e)
    return null
  }
  if (!user) return new Set()
  if (!user.employeeId) return null // admin puro = acceso total

  const todos = await prisma.user.findMany({
    select: { id: true, employeeId: true, managerUserId: true },
  })

  const hijosDe = new Map<number, number[]>()
  for (const u of todos) {
    if (u.managerUserId != null) {
      const arr = hijosDe.get(u.managerUserId) ?? []
      arr.push(u.id)
      hijosDe.set(u.managerUserId, arr)
    }
  }

  const empByUser = new Map<number, number | null>()
  for (const u of todos) empByUser.set(u.id, u.employeeId)

  const usersEnScope = new Set<number>()
  const stack = [user.id]
  while (stack.length) {
    const id = stack.pop()!
    if (usersEnScope.has(id)) continue
    usersEnScope.add(id)
    for (const hijo of hijosDe.get(id) ?? []) stack.push(hijo)
  }

  const scope = new Set<number>()
  for (const uid of usersEnScope) {
    const eid = empByUser.get(uid)
    if (eid) scope.add(eid)
  }
  return scope
}

/**
 * Devuelve el Set de `employeeId` de los subordinados (directos e indirectos)
 * del user dado, SIN incluirse a sí mismo. Se usa para el chequeo de aprobación
 * (solo un ancestro puede aprobar/rechazar solicitudes).
 */
export async function getDescendantEmployeeIds(userId: number): Promise<Set<number>> {
  const self = await prisma.user.findUnique({
    where: { id: userId },
    select: { employeeId: true },
  })
  if (!self?.employeeId) {
    // Admin puro: puede aprobar cualquier solicitud
    const all = await prisma.employee.findMany({ select: { id: true } })
    return new Set(all.map(e => e.id))
  }
  const todos = await prisma.user.findMany({
    select: { id: true, employeeId: true, managerUserId: true },
  })
  const hijosDe = new Map<number, number[]>()
  const empByUser = new Map<number, number | null>()
  for (const u of todos) {
    empByUser.set(u.id, u.employeeId)
    if (u.managerUserId != null) {
      const arr = hijosDe.get(u.managerUserId) ?? []
      arr.push(u.id)
      hijosDe.set(u.managerUserId, arr)
    }
  }
  const descUsers = new Set<number>()
  const stack = [...(hijosDe.get(userId) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (descUsers.has(id)) continue
    descUsers.add(id)
    for (const h of hijosDe.get(id) ?? []) stack.push(h)
  }
  const scope = new Set<number>()
  for (const uid of descUsers) {
    const eid = empByUser.get(uid)
    if (eid) scope.add(eid)
  }
  return scope
}

/**
 * Devuelve true si `ancestorUserId` es ancestro (directo o indirecto) de `descendantUserId`
 * en el organigrama de users. Un user NO es ancestro de sí mismo.
 * Los admins puros (sin legajo, no en el árbol) se consideran ancestros de TODOS
 * para poder aprobar cualquier solicitud (rol de soporte).
 */
export async function isAncestorOfUser(ancestorUserId: number, descendantUserId: number): Promise<boolean> {
  if (ancestorUserId === descendantUserId) return false
  const ancestor = await prisma.user.findUnique({
    where: { id: ancestorUserId },
    select: { employeeId: true },
  })
  if (!ancestor?.employeeId) return true // admin puro puede aprobar cualquier cosa

  const todos = await prisma.user.findMany({ select: { id: true, managerUserId: true } })
  const managerDe = new Map<number, number | null>()
  for (const u of todos) managerDe.set(u.id, u.managerUserId)

  let cur: number | null | undefined = managerDe.get(descendantUserId) ?? null
  const visto = new Set<number>()
  while (cur != null && !visto.has(cur)) {
    if (cur === ancestorUserId) return true
    visto.add(cur)
    cur = managerDe.get(cur) ?? null
  }
  return false
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
