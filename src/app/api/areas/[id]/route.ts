import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  try {
    const area = await prisma.area.update({
      where: { id: Number(id) },
      data: { nombre: nombre.trim() },
    })
    return NextResponse.json(area)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })
      if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe un área con ese nombre' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const areaId = Number(id)

  // Chequeo previo: contar empleados y posts asignados
  const [empleadosCount, postsCount] = await Promise.all([
    prisma.employee.count({ where: { areaId } }),
    prisma.post.count({ where: { areaId } }),
  ])

  if (empleadosCount > 0 || postsCount > 0) {
    const dependencias = [
      empleadosCount > 0 && { key: 'empleados', label: 'Empleados asignados', count: empleadosCount, href: `/admin/empleados?areaId=${areaId}` },
      postsCount > 0 && { key: 'posts', label: 'Avisos con esta área', count: postsCount, href: '/admin/portal' },
    ].filter(Boolean)
    return NextResponse.json({
      error: 'El área tiene datos asociados',
      dependencias,
    }, { status: 409 })
  }

  try {
    await prisma.area.delete({ where: { id: areaId } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Área no encontrada' }, { status: 404 })
    }
    throw e
  }
}
