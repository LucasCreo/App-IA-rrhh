import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const evaluaciones = await prisma.evaluacion.findMany({
    where: { employeeId: user.employeeId, completada: true },
    include: {
      ronda: {
        include: { plantilla: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(evaluaciones.map(e => ({
    ...e,
    resultados: JSON.parse(e.resultados ?? '{}'),
    ronda: {
      ...e.ronda,
      plantilla: {
        ...e.ronda.plantilla,
        criterios: JSON.parse(e.ronda.plantilla.criterios ?? '[]'),
      },
    },
  })))
}
