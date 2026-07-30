import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendToSign, checkSignatureStatus, SignatureError } from '@/lib/signature'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { getScopedEmployeeIds } from '@/lib/scope'
import { SIGNATURE_MODE } from '@/lib/features'

async function notificarEmpleado(docId: number, accion: string) {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: {
        employee: { select: { nombre: true, email: true } },
        tipoDocumento: { select: { nombre: true } },
      },
    })
    if (!doc?.employee?.email) return
    const tipo = doc.tipoDocumento?.nombre ?? 'Documento'
    const requiereFirma = accion === 'FIRMA'
    await sendMailFromTemplate('DOCUMENTO_A_FIRMA', {
      to: doc.employee.email,
      vars: {
        nombre: doc.employee.nombre,
        tipo,
        titulo: requiereFirma ? 'Tenés un documento pendiente de firma' : 'Nuevo documento disponible',
        bloquePeriodo: doc.periodo ? ` (${doc.periodo})` : '',
        bloqueFirma: requiereFirma ? '<p>Requiere tu firma para completarse.</p>' : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/documentos`,
    })
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

  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(doc.employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre ese documento' }, { status: 403 })
  }

  const accion = doc.tipoDocumento?.accion ?? 'FIRMA'

  if (accion === 'LECTURA' || accion === 'NINGUNA' || SIGNATURE_MODE === 'password') {
    await prisma.document.update({
      where: { id: doc.id },
      data: { estado: 'ENVIADO_A_FIRMA' },
    })
    const label = SIGNATURE_MODE === 'password' && accion === 'FIRMA' ? 'FIRMA_PASSWORD' : accion
    await logAction(user.userId, 'NOTIFICAR', 'Documento', `Doc ${doc.id} notificado para ${label}`)
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
    const code = e instanceof SignatureError ? e.code : undefined
    await prisma.document.update({ where: { id: Number(id) }, data: { estado: 'ERROR' } })

    ;(async () => {
      try {
        const [full, admins] = await Promise.all([
          prisma.document.findUnique({
            where: { id: Number(id) },
            select: {
              employee: { select: { nombre: true, apellido: true } },
              tipoDocumento: { select: { nombre: true } },
            },
          }),
          prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
        ])
        if (!full || admins.length === 0) return
        const vars = {
          apellido: full.employee.apellido,
          nombre: full.employee.nombre,
          tipo: full.tipoDocumento?.nombre ?? 'Documento',
          error: message,
        }
        await Promise.all(admins.map(a => sendMailFromTemplate('DOCUMENTO_ERROR_FIRMA', {
          to: a.email, vars,
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/documentos`,
        })))
      } catch (err) { console.error('[email/documento-error-firma] fallo:', err) }
    })()

    const status = code === 'SIGNATURE_NOT_CONFIGURED' || code === 'SIGNATURE_INCOMPLETE' ? 400 : 502
    return NextResponse.json({ error: message, code }, { status })
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
    const code = e instanceof SignatureError ? e.code : undefined
    const status = code === 'SIGNATURE_NOT_CONFIGURED' || code === 'SIGNATURE_INCOMPLETE' ? 400 : 502
    return NextResponse.json({ error: message, code }, { status })
  }
}
