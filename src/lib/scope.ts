import { prisma } from './prisma'

/**
 * Calcula el "scope" de empleados que un admin puede ver/modificar.
 *
 * - Si el usuario no tiene rol custom o su rol NO es scopeJerarquico → null (acceso global, sin restricción).
 * - Si el rol es scopeJerarquico → devuelve un Set con:
 *     - su propio employeeId (si tiene uno)
 *     - todos sus descendientes en el organigrama (transitivo, vía Employee.managerId)
 * - Si es scopeJerarquico pero no tiene employeeId (admin sin legajo) → Set vacío (no ve nada).
 *
 * Devolver null significa "sin restricción". Un Set vacío significa "no ve a nadie".
 */
export async function getScopedEmployeeIds(userId: number): Promise<Set<number> | null> {
  let user: { employeeId: number | null; rol: { scopeJerarquico: boolean } | null } | null
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true, rol: { select: { scopeJerarquico: true } } },
    })
  } catch (e) {
    // El campo scopeJerarquico puede no existir todavía si la migración/generate no corrieron.
    console.error('[scope] fallback a acceso global — falta migración/generate?', e)
    return null
  }
  if (!user) return new Set()
  if (!user.rol?.scopeJerarquico) return null

  if (!user.employeeId) return new Set()

  const todos = await prisma.employee.findMany({
    select: { id: true, managerId: true },
  })

  const hijosDe = new Map<number, number[]>()
  for (const e of todos) {
    if (e.managerId != null) {
      const arr = hijosDe.get(e.managerId) ?? []
      arr.push(e.id)
      hijosDe.set(e.managerId, arr)
    }
  }

  const scope = new Set<number>()
  const stack = [user.employeeId]
  while (stack.length) {
    const id = stack.pop()!
    if (scope.has(id)) continue
    scope.add(id)
    for (const hijo of hijosDe.get(id) ?? []) stack.push(hijo)
  }
  return scope
}
