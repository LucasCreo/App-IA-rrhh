import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const plantillas = await prisma.plantillaEvaluacion.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { rondas: true } } },
  })
  return NextResponse.json(plantillas.map(p => ({
    ...p,
    criterios: JSON.parse(p.criterios ?? '[]'),
  })))
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  const plantilla = await prisma.plantillaEvaluacion.create({
    data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null },
  })
  return NextResponse.json(plantilla)
}
