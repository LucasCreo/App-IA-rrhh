import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { visible, requerido } = await req.json()
  const campo = await prisma.campoPersonalizado.update({
    where: { id: Number(id) },
    data: { visible, requerido },
  })
  return NextResponse.json(campo)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const confirmar = new URL(req.url).searchParams.get('confirmar') === 'true'

  const count = await prisma.valorCampoEmpleado.count({ where: { campoId: Number(id) } })

  if (count > 0 && !confirmar) {
    return NextResponse.json({ requiresConfirmation: true, count }, { status: 200 })
  }

  await prisma.campoPersonalizado.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
