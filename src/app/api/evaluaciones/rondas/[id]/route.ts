import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const ronda = await prisma.rondaEvaluacion.findUnique({
    where: { id: Number(id) },
    include: {
      plantilla: true,
      evaluaciones: {
        include: {
          employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
        },
        orderBy: [{ employee: { apellido: 'asc' } }],
      },
    },
  })
  if (!ronda) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  return NextResponse.json({
    ...ronda,
    plantilla: { ...ronda.plantilla, criterios: JSON.parse(ronda.plantilla.criterios ?? '[]') },
    evaluaciones: ronda.evaluaciones.map(e => ({
      ...e,
      resultados: JSON.parse(e.resultados ?? '{}'),
    })),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { estado } = await req.json()
  const ronda = await prisma.rondaEvaluacion.update({
    where: { id: Number(id) },
    data: { estado },
  })
  return NextResponse.json(ronda)
}
