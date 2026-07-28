import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { visible, requerido, visibleEnAlta } = await req.json()
  const data: { visible?: boolean; requerido?: boolean; visibleEnAlta?: boolean } = {}
  if (typeof visible === 'boolean') data.visible = visible
  if (typeof requerido === 'boolean') data.requerido = requerido
  if (typeof visibleEnAlta === 'boolean') data.visibleEnAlta = visibleEnAlta
  const campo = await prisma.campoPersonalizado.update({
    where: { id: Number(id) },
    data,
  })
  return NextResponse.json(campo)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const confirmar = new URL(req.url).searchParams.get('confirmar') === 'true'

  const count = await prisma.valorCampoEmpleado.count({ where: { campoId: Number(id) } })

  if (count > 0 && !confirmar) {
    return NextResponse.json({ requiresConfirmation: true, count }, { status: 200 })
  }

  await prisma.campoPersonalizado.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
