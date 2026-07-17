import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { isAncestorOfUser } from '@/lib/scope'

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const actual = await prisma.solicitudModificacion.findUnique({
    where: { id: Number(id) },
    select: { employee: { select: { user: { select: { id: true } } } } },
  })
  const solicitanteUserId = actual?.employee?.user?.id
  if (!solicitanteUserId || !(await isAncestorOfUser(user.userId, solicitanteUserId))) {
    return NextResponse.json({ error: 'Solo un superior en el organigrama puede resolver esta solicitud' }, { status: 403 })
  }

  const updated = await prisma.solicitudModificacion.update({
    where: { id: Number(id) },
    data: { estado: 'REVISADO' },
  })
  return NextResponse.json(updated)
}
