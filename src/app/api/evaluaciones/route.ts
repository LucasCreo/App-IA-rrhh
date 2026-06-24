import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const evaluaciones = await prisma.evaluacion.findMany({
    orderBy: [{ ronda: { nombre: 'asc' } }, { employee: { apellido: 'asc' } }],
    include: {
      employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
      ronda: {
        select: {
          id: true,
          nombre: true,
          estado: true,
          plantilla: { select: { nombre: true, criterios: true } },
        },
      },
    },
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
