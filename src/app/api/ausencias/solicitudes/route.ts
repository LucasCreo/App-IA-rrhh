import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const solicitudes = await prisma.solicitudAusencia.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
      tipoAusencia: { select: { id: true, nombre: true, color: true, afectaSaldo: true } },
    },
  })
  return NextResponse.json(solicitudes)
}
