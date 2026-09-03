import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  // Scope: qué empleados puede gestionar este admin (null = todos).
  // Se devuelve el organigrama completo pero se marca canManage por nodo
  // para que el cliente sepa cuáles son navegables/editables.
  const scope = await getScopedEmployeeIds(user.userId)

  // Todos los admins ven el organigrama completo (info organizacional).
  // El scope de admin solo restringe edición y datos sensibles, no la estructura.
  const users = await prisma.user.findMany({
    where: {
      employeeId: { not: null },
    },
    select: {
      id: true,
      email: true,
      role: true,
      managerUserId: true,
      employee: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          legajo: true,
          estado: true,
          categoria: { select: { nombre: true } },
        },
      },
    },
  })

  const nodos = users
    .filter(u => u.employee && u.employee.estado === 'ACTIVO')
    .map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      managerUserId: u.managerUserId,
      empleado: u.employee ? {
        id: u.employee.id,
        nombre: u.employee.nombre,
        apellido: u.employee.apellido,
        legajo: u.employee.legajo,
        categoria: u.employee.categoria?.nombre ?? null,
      } : null,
      canManage: u.employee ? (scope ? scope.has(u.employee.id) : true) : false,
    }))
    .sort((a, b) => {
      const aName = a.empleado ? `${a.empleado.apellido} ${a.empleado.nombre}` : a.email
      const bName = b.empleado ? `${b.empleado.apellido} ${b.empleado.nombre}` : b.email
      return aName.localeCompare(bName)
    })

  return NextResponse.json({ nodos, currentUserId: user.userId })
}
