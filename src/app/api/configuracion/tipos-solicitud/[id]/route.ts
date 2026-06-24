import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { nombre, descripcion, activo, requiereAprobacion, campos } = await req.json()

  const tipo = await prisma.tipoSolicitud.update({
    where: { id: Number(id) },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(descripcion !== undefined && { descripcion: descripcion?.trim() || null }),
      ...(activo !== undefined && { activo }),
      ...(requiereAprobacion !== undefined && { requiereAprobacion }),
      ...(campos !== undefined && { campos: JSON.stringify(campos) }),
    },
  })
  return NextResponse.json(tipo)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  try {
    await prisma.tipoSolicitud.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'No se puede eliminar: tiene solicitudes asociadas' }, { status: 409 })
  }
}
