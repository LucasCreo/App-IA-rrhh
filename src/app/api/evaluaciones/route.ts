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
        include: {
          plantilla: { include: { criterios: { orderBy: { orden: 'asc' } } } },
        },
      },
    },
  })

  return NextResponse.json(evaluaciones.map(e => ({
    ...e,
    resultados: JSON.parse(e.resultados ?? '{}'),
    ronda: {
      id: e.ronda.id,
      nombre: e.ronda.nombre,
      estado: e.ronda.estado,
      plantilla: {
        nombre: e.ronda.plantilla.nombre,
        criterios: e.ronda.plantilla.criterios,
      },
    },
  })))
}
