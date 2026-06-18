import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendToSign, checkSignatureStatus } from '@/lib/signature'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const doc = await prisma.document.findUnique({ where: { id: Number(id) } })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  try {
    const externalId = await sendToSign(doc.id, doc.filePath, doc.nombreArchivo)
    await prisma.document.update({
      where: { id: doc.id },
      data: { estado: 'ENVIADO_A_FIRMA', firmaExternalId: externalId },
    })
    await logAction(user.userId, 'ENVIAR_FIRMA', 'Documento', `ID externo: ${externalId}`)
    return NextResponse.json({ ok: true, externalId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error desconocido'
    await prisma.document.update({ where: { id: Number(id) }, data: { estado: 'ERROR' } })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const doc = await prisma.document.findUnique({ where: { id: Number(id) } })
  if (!doc || !doc.firmaExternalId) {
    return NextResponse.json({ error: 'Documento sin ID externo de firma' }, { status: 400 })
  }

  try {
    const result = await checkSignatureStatus(doc.firmaExternalId)
    let newEstado = doc.estado

    if (result.status === 'signed' || result.status === 'firmado') {
      newEstado = 'FIRMADO'
    } else if (result.status === 'rejected' || result.status === 'rechazado') {
      newEstado = 'RECHAZADO'
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        estado: newEstado,
        fechaFirma: newEstado === 'FIRMADO' ? (result.signedAt ? new Date(result.signedAt) : new Date()) : undefined,
      },
    })

    return NextResponse.json({ ok: true, estado: newEstado, raw: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
