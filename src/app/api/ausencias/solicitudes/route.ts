import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds, getDescendantEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [scope, descendants] = await Promise.all([
    getScopedEmployeeIds(user.userId),
    getDescendantEmployeeIds(user.userId),
  ])

  const solicitudes = await prisma.solicitudAusencia.findMany({
    where: scope ? { employeeId: { in: [...scope] } } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
      tipoAusencia: { select: { id: true, nombre: true, color: true, afectaSaldo: true } },
    },
    take: 500,
  })
  return NextResponse.json(solicitudes.map(s => ({
    ...s,
    canApprove: descendants.has(s.employeeId),
  })))
}
