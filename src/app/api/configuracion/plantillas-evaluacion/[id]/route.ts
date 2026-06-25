import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { nombre, descripcion, activo, criterios } = await req.json()

  await prisma.plantillaEvaluacion.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
      ...(activo !== undefined && { activo }),
    },
  })

  if (criterios !== undefined) {
    await prisma.criterioEvaluacion.deleteMany({ where: { plantillaId: Number(id) } })
    if (criterios.length > 0) {
      await prisma.criterioEvaluacion.createMany({
        data: criterios.map((c: { nombre: string; label: string; tipo: string }, i: number) => ({
          plantillaId: Number(id),
          nombre: c.nombre,
          label: c.label,
          tipo: c.tipo,
          orden: i,
        })),
      })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  try {
    await prisma.plantillaEvaluacion.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No se puede eliminar: tiene rondas asociadas' }, { status: 409 })
  }
}
