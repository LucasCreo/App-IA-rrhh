import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const scope = await getScopedEmployeeIds(user.userId)

  const solicitudes = await prisma.solicitudAusencia.findMany({
    where: scope ? { employeeId: { in: [...scope] } } : {},
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
      tipoAusencia: { select: { id: true, nombre: true, color: true, afectaSaldo: true } },
    },
  })
  return NextResponse.json(solicitudes)
}
