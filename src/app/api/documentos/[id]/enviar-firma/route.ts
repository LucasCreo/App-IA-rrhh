import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendToSign, checkSignatureStatus } from '@/lib/signature'
import { sendMail } from '@/lib/email'

async function notificarEmpleado(docId: number, accion: string) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: {
        employee: { select: { nombre: true, email: true } },
        tipoDocumento: { select: { nombre: true } },
      },
    })
    console.log('[email/documento] docId=', docId, 'employee.email=', doc?.employee?.email)
    if (!doc?.employee?.email) {
      console.warn('[email/documento] empleado sin email, skip')
      return
    }
    const tipo = doc.tipoDocumento?.nombre ?? 'Documento'
    const requiereFirma = accion === 'FIRMA'
    await sendMail({
      to: doc.employee.email,
      subject: `Nuevo documento disponible: ${tipo}`,
      title: requiereFirma ? 'Tenés un documento pendiente de firma' : 'Nuevo documento disponible',
      bodyHtml: `
        <p>Hola ${doc.employee.nombre},</p>
        <p>Se cargó un nuevo documento en tu portal: <strong>${tipo}</strong>${doc.periodo ? ` (${doc.periodo})` : ''}.</p>
        ${requiereFirma ? '<p>Requiere tu firma para completarse.</p>' : ''}
      `,
      ctaLabel: 'Ver en el portal',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/documentos`,
    })
    console.log('[email/documento] enviado a', doc.employee.email)
  } catch (e) {
    console.error('[email/documento] fallo:', e)
  }
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermiso(PERMISOS.GESTIONAR_DOCUMENTOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const doc = await prisma.document.findUnique({
    where: { id: Number(id) },
    include: { tipoDocumento: { select: { accion: true } } },
  })
  if (!doc) return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })

  const accion = doc.tipoDocumento?.accion ?? 'FIRMA'

  if (accion === 'LECTURA' || accion === 'NINGUNA') {
    await prisma.document.update({
      where: { id: doc.id },
      data: { estado: 'ENVIADO_A_FIRMA' },
    })
    await logAction(user.userId, 'NOTIFICAR', 'Documento', `Doc ${doc.id} notificado para ${accion}`)
    await notificarEmpleado(doc.id, accion)
    return NextResponse.json({ ok: true })
  }

  try {
    const externalId = await sendToSign(doc.id, doc.filePath, doc.nombreArchivo)
    await prisma.document.update({
      where: { id: doc.id },
      data: { estado: 'ENVIADO_A_FIRMA', firmaExternalId: externalId },
    })
    await logAction(user.userId, 'ENVIAR_FIRMA', 'Documento', `ID externo: ${externalId}`)
    await notificarEmpleado(doc.id, accion)
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
