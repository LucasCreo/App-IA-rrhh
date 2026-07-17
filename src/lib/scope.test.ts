import { describe, it, expect } from 'vitest'
import { computeScope, computeDescendantEmployees, computeIsAncestor, type UserNode } from './scope'

/**
 * Árbol usado en los tests:
 *
 *   ceo (u=1, e=101)                       admin_soporte (u=99, e=null)
 *     ├── gerente_a (u=2, e=102)
 *     │     ├── lider_1 (u=3, e=103)
 *     │     │     └── empleado_x (u=4, e=104)
 *     │     └── lider_2 (u=5, e=105)
 *     └── gerente_b (u=6, e=106)
 *
 *   huerfano (u=7, e=107, sin manager)
 */
const tree: UserNode[] = [
  { id: 1, employeeId: 101, managerUserId: null },  // ceo
  { id: 2, employeeId: 102, managerUserId: 1 },     // gerente_a
  { id: 3, employeeId: 103, managerUserId: 2 },     // lider_1
  { id: 4, employeeId: 104, managerUserId: 3 },     // empleado_x
  { id: 5, employeeId: 105, managerUserId: 2 },     // lider_2
  { id: 6, employeeId: 106, managerUserId: 1 },     // gerente_b
  { id: 7, employeeId: 107, managerUserId: null },  // huerfano
  { id: 99, employeeId: null, managerUserId: null }, // admin de soporte
]

describe('computeScope', () => {
  it('admin puro (sin legajo) → null (acceso total)', () => {
    expect(computeScope(tree, 99)).toBeNull()
  })

  it('user inexistente → set vacío', () => {
    expect(computeScope(tree, 999)).toEqual(new Set())
  })

  it('empleado hoja → solo se ve a sí mismo', () => {
    expect(computeScope(tree, 4)).toEqual(new Set([104]))
  })

  it('líder → él + subordinados directos', () => {
    expect(computeScope(tree, 3)).toEqual(new Set([103, 104]))
  })

  it('gerente → él + subordinados de múltiples niveles', () => {
    expect(computeScope(tree, 2)).toEqual(new Set([102, 103, 104, 105]))
  })

  it('ceo → todo el subárbol pero no al huérfano ni al admin', () => {
    expect(computeScope(tree, 1)).toEqual(new Set([101, 102, 103, 104, 105, 106]))
  })

  it('huérfano (sin manager, sin subordinados) → solo a sí mismo', () => {
    expect(computeScope(tree, 7)).toEqual(new Set([107]))
  })

  it('ciclo → no cuelga y devuelve set finito', () => {
    const conCiclo: UserNode[] = [
      { id: 1, employeeId: 101, managerUserId: 2 },
      { id: 2, employeeId: 102, managerUserId: 1 },
    ]
    const r = computeScope(conCiclo, 1)
    expect(r).toEqual(new Set([101, 102]))
  })
})

describe('computeDescendantEmployees', () => {
  it('admin puro → devuelve TODOS los employeeIds pasados', () => {
    const all = [101, 102, 103, 104, 105, 106, 107]
    expect(computeDescendantEmployees(tree, 99, all)).toEqual(new Set(all))
  })

  it('empleado hoja → set vacío (no tiene descendientes)', () => {
    expect(computeDescendantEmployees(tree, 4, [])).toEqual(new Set())
  })

  it('gerente → solo descendientes estrictos, sin incluirse a sí mismo', () => {
    expect(computeDescendantEmployees(tree, 2, [])).toEqual(new Set([103, 104, 105]))
  })

  it('ceo → todo el subárbol menos él mismo', () => {
    expect(computeDescendantEmployees(tree, 1, [])).toEqual(new Set([102, 103, 104, 105, 106]))
  })
})

describe('computeIsAncestor', () => {
  it('un user NO es ancestro de sí mismo', () => {
    expect(computeIsAncestor(tree, 1, 1)).toBe(false)
  })

  it('admin puro es ancestro de cualquiera', () => {
    expect(computeIsAncestor(tree, 99, 4)).toBe(true)
    expect(computeIsAncestor(tree, 99, 7)).toBe(true)
  })

  it('ancestro directo (padre)', () => {
    expect(computeIsAncestor(tree, 3, 4)).toBe(true)
  })

  it('ancestro indirecto (abuelo)', () => {
    expect(computeIsAncestor(tree, 2, 4)).toBe(true)
    expect(computeIsAncestor(tree, 1, 4)).toBe(true)
  })

  it('no es ancestro de una rama distinta', () => {
    expect(computeIsAncestor(tree, 3, 5)).toBe(false)
    expect(computeIsAncestor(tree, 2, 6)).toBe(false)
  })

  it('un descendiente NO es ancestro de su ancestro', () => {
    expect(computeIsAncestor(tree, 4, 1)).toBe(false)
  })

  it('huérfano no es ancestro de nadie', () => {
    expect(computeIsAncestor(tree, 7, 4)).toBe(false)
  })

  it('ancestro inexistente → false', () => {
    expect(computeIsAncestor(tree, 999, 4)).toBe(false)
  })

  it('ciclo → no cuelga y devuelve resultado consistente', () => {
    const conCiclo: UserNode[] = [
      { id: 1, employeeId: 101, managerUserId: 2 },
      { id: 2, employeeId: 102, managerUserId: 3 },
      { id: 3, employeeId: 103, managerUserId: 1 },
    ]
    expect(computeIsAncestor(conCiclo, 1, 2)).toBe(true)
    expect(computeIsAncestor(conCiclo, 2, 1)).toBe(true)
  })
})
