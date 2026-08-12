import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const asignId = Number(id)
  const asign = await prisma.documentoAsignacion.findUnique({
    where: { id: asignId },
    include: { grupo: { include: { tipoDocumento: { select: { accion: true } } } } },
  })
  if (!asign) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (asign.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
  if (asign.grupo.tipoDocumento?.accion !== 'LECTURA') {
    return NextResponse.json({ error: 'Este documento no es de tipo lectura' }, { status: 400 })
  }
  if (asign.estado !== 'ENVIADO_A_FIRMA') {
    return NextResponse.json({ error: 'El documento no está disponible' }, { status: 400 })
  }

  await prisma.documentoAsignacion.update({
    where: { id: asignId },
    data: { estado: 'FIRMADO', fechaFirma: new Date() },
  })
  await logAction(user.userId, 'MARCAR_LEIDO_ASIGNACION', 'Documento', `Asign ${asignId}`)
  return NextResponse.json({ ok: true })
}
