import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const evaluaciones = await prisma.evaluacion.findMany({
    where: { employeeId: Number(id) },
    include: {
      ronda: {
        include: { plantilla: { include: { criterios: { orderBy: { orden: 'asc' } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(evaluaciones.map(e => ({
    ...e,
    resultados: (() => { try { return JSON.parse(e.resultados) } catch { return {} } })(),
  })))
}
