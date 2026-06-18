import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

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
