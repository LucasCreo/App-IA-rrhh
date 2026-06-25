import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { nombre, descripcion, activo, campos } = await req.json()

  await prisma.plantillaFormulario.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
      ...(activo !== undefined && { activo }),
    },
  })

  if (campos !== undefined) {
    await prisma.campoFormulario.deleteMany({ where: { plantillaId: Number(id) } })
    if (campos.length > 0) {
      await prisma.campoFormulario.createMany({
        data: campos.map((c: { nombre: string; label: string; tipo: string; opciones?: string; requerido: boolean; rellena?: string }, i: number) => ({
          plantillaId: Number(id),
          nombre: c.nombre,
          label: c.label,
          tipo: c.tipo,
          opciones: c.opciones ?? null,
          requerido: c.requerido,
          rellena: c.rellena ?? 'empleado',
          orden: i,
        })),
      })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const count = await prisma.asignacionFormulario.count({ where: { plantillaId: Number(id) } })
  if (count > 0) return NextResponse.json({ error: 'Tiene asignaciones asociadas' }, { status: 409 })

  await prisma.plantillaFormulario.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
