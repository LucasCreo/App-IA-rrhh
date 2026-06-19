import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const docId = Number(id)

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { tipoDocumento: { select: { accion: true } } },
  })

  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  if (user.role === 'EMPLOYEE' && doc.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  if (doc.tipoDocumento?.accion !== 'LECTURA') {
    return NextResponse.json({ error: 'Este documento no requiere acuse de recibo' }, { status: 400 })
  }

  if (doc.estado !== 'ENVIADO_A_FIRMA') {
    return NextResponse.json({ error: 'El documento no está disponible para marcar como leído' }, { status: 400 })
  }

  await prisma.document.update({
    where: { id: docId },
    data: { estado: 'FIRMADO', fechaFirma: new Date() },
  })

  await logAction(user.userId, 'MARCAR_LEIDO', 'Documento', `Doc ${docId}`)
  return NextResponse.json({ ok: true })
}
