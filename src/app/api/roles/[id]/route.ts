import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS, TODOS_LOS_PERMISOS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { nombre, descripcion, permisos } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const permisosValidos = (permisos ?? []).filter((p: string) => TODOS_LOS_PERMISOS.includes(p as any))

  // Replace all permissions atomically
  await prisma.rolPermiso.deleteMany({ where: { rolId: Number(id) } })
  await prisma.rol.update({
    where: { id: Number(id) },
    data: {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      permisos: {
        create: permisosValidos.map((p: string) => ({ permiso: p })),
      },
    },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params

  const count = await prisma.user.count({ where: { rolId: Number(id) } })
  if (count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: ${count} usuario${count !== 1 ? 's tienen' : ' tiene'} este rol asignado` },
      { status: 409 }
    )
  }

  await prisma.rol.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
