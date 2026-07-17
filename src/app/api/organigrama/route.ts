import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const scope = await getScopedEmployeeIds(user.userId)

  const users = await prisma.user.findMany({
    where: {
      employeeId: scope ? { in: [...scope] } : { not: null },
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
    }))
    .sort((a, b) => {
      const aName = a.empleado ? `${a.empleado.apellido} ${a.empleado.nombre}` : a.email
      const bName = b.empleado ? `${b.empleado.apellido} ${b.empleado.nombre}` : b.email
      return aName.localeCompare(bName)
    })

  return NextResponse.json(nodos)
}
