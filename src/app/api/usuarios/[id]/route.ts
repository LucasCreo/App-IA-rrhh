import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { rolId, role } = await req.json()

  const target = await prisma.user.findUnique({ where: { id: Number(id) } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  // Prevent self-demotion
  if (target.id === user.userId && role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'No podés cambiar tu propio rol de acceso' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: Number(id) },
    data: {
      ...(role !== undefined && { role }),
      ...(rolId !== undefined && { rolId: rolId ? Number(rolId) : null }),
    },
    select: { id: true, email: true, role: true, rolId: true },
  })

  await logAction(user.userId, 'MODIFICAR_USUARIO', 'Usuario', target.email)
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params

  if (Number(id) === user.userId) {
    return NextResponse.json({ error: 'No podés eliminar tu propia cuenta' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: Number(id) } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  await prisma.user.delete({ where: { id: Number(id) } })
  await logAction(user.userId, 'ELIMINAR_USUARIO', 'Usuario', target.email)
  return NextResponse.json({ ok: true })
}
