import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { nombre, descripcion, activo, campos } = await req.json()

  const data: Record<string, unknown> = {}
  if (nombre !== undefined) data.nombre = nombre.trim()
  if (descripcion !== undefined) data.descripcion = descripcion?.trim() || null
  if (activo !== undefined) data.activo = activo
  if (campos !== undefined) data.campos = JSON.stringify(campos)

  const plantilla = await prisma.plantillaFormulario.update({ where: { id: Number(id) }, data })
  return NextResponse.json(plantilla)
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
