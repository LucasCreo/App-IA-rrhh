import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  const { id } = await params
  const pendientes = await prisma.loteArchivoPendiente.findMany({
    where: { loteId: Number(id) },
    orderBy: { uploadedAt: 'asc' },
  })
  return NextResponse.json({ pendientes })
}
