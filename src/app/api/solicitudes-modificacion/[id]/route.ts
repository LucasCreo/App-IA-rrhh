import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const updated = await prisma.solicitudModificacion.update({
    where: { id: Number(id) },
    data: { estado: 'REVISADO' },
  })
  return NextResponse.json(updated)
}
