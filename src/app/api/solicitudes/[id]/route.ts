import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { estado, comentario, comentarioVisible } = await req.json()
  if (!['APROBADO', 'RECHAZADO'].includes(estado)) return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

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
