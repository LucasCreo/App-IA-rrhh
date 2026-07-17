import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { isAncestorOfUser } from '@/lib/scope'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { estado, comentario, comentarioVisible } = await req.json()
  if (!['APROBADO', 'RECHAZADO'].includes(estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  const actual = await prisma.solicitudDocumento.findUnique({
    where: { id: Number(id) },
    select: { employee: { select: { user: { select: { id: true } } } } },
  })
  const solicitanteUserId = actual?.employee?.user?.id
  if (!solicitanteUserId || !(await isAncestorOfUser(user.userId, solicitanteUserId))) {
    return NextResponse.json({ error: 'Solo un superior en el organigrama puede resolver esta solicitud' }, { status: 403 })
  }

  const solicitud = await prisma.solicitudDocumento.update({
    where: { id: Number(id) },
    data: {
      estado,
      comentario: comentario?.trim() || null,
      comentarioVisible: comentario?.trim() ? (comentarioVisible ?? false) : false,
    },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true } },
      tipo: true,
    },
  })
  return NextResponse.json(solicitud)
}
