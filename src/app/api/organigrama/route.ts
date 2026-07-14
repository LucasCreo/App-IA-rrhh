import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const scope = await getScopedEmployeeIds(user.userId)

  const empleados = await prisma.employee.findMany({
    where: {
      estado: 'ACTIVO',
      ...(scope ? { id: { in: [...scope] } } : {}),
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      legajo: true,
      managerId: true,
      categoria: { select: { nombre: true } },
    },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  })

  return NextResponse.json(empleados)
}
