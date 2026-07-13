import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const empleados = await prisma.employee.findMany({
    where: { estado: 'ACTIVO' },
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
