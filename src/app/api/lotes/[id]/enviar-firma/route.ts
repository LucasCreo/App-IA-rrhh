import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendToSign, SignatureError } from '@/lib/signature'
import { sendMail } from '@/lib/email'
import { SIGNATURE_MODE } from '@/lib/features'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const lote = await prisma.lote.findUnique({
    where: { id: Number(id) },
    include: { tipoDocumento: { select: { accion: true } } },
  })
  const accion: string = lote?.tipoDocumento?.accion ?? 'FIRMA'

  const docs = await prisma.document.findMany({
    where: { loteId: Number(id), estado: { in: ['BORRADOR', 'ERROR'] } },
  })

  // Pre-check: si la firma va por proveedor externo, validar configuración
  if (SIGNATURE_MODE === 'external' && accion !== 'LECTURA' && accion !== 'NINGUNA') {
    const cfg = await prisma.signatureConfig.findFirst()
    if (!cfg) {
      return NextResponse.json({
        error: 'El proveedor de firma electrónica no está configurado.',
        code: 'SIGNATURE_NOT_CONFIGURED',
      }, { status: 400 })
    }
    if (!cfg.providerUrl || !cfg.apiKey) {
      return NextResponse.json({
        error: 'La configuración de firma está incompleta (falta URL o API key).',
        code: 'SIGNATURE_INCOMPLETE',
      }, { status: 400 })
    }
  }

  let sent = 0
  const errors: string[] = []

  if (accion === 'LECTURA' || accion === 'NINGUNA' || SIGNATURE_MODE === 'password') {
    // Batch: todos van al mismo estado, un solo UPDATE
    const res = await prisma.document.updateMany({
      where: { id: { in: docs.map(d => d.id) } },
      data: { estado: 'ENVIADO_A_FIRMA' },
    })
    sent = res.count
  } else {
    // Firma externa: cada doc requiere un roundtrip al proveedor, sí es N+1 por naturaleza
    for (const doc of docs) {
      try {
        const externalId = await sendToSign(doc.id, doc.filePath, doc.nombreArchivo)
        await prisma.document.update({
          where: { id: doc.id },
          data: { estado: 'ENVIADO_A_FIRMA', firmaExternalId: externalId },
        })
        sent++
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        const code = e instanceof SignatureError ? e.code : undefined
        void code
        await prisma.document.update({ where: { id: doc.id }, data: { estado: 'ERROR' } })
        errors.push(`Doc ${doc.id}: ${msg}`)
      }
    }
  }

  await logAction(user.userId, 'ENVIAR_FIRMA_LOTE', 'Lote', `ID ${id}: ${sent} enviados`)

  // Notificar a cada empleado con documentos publicados en este lote
  const publicados = await prisma.document.findMany({
    where: { loteId: Number(id), estado: 'ENVIADO_A_FIRMA' },
    include: {
      employee: { select: { nombre: true, email: true } },
      tipoDocumento: { select: { nombre: true } },
    },
  })
  const requiereFirma = accion === 'FIRMA'
  const tipo = publicados[0]?.tipoDocumento?.nombre ?? 'Documento'
  Promise.all(publicados
    .filter(d => d.employee?.email)
    .map(d => sendMail({
      to: d.employee.email,
      subject: `Nuevo documento disponible: ${tipo}`,
      title: requiereFirma ? 'Tenés un documento pendiente de firma' : 'Nuevo documento disponible',
      bodyHtml: `
        <p>Hola ${d.employee.nombre},</p>
        <p>Se cargó un nuevo documento en tu portal: <strong>${tipo}</strong>${d.periodo ? ` (${d.periodo})` : ''}.</p>
        ${requiereFirma ? '<p>Requiere tu firma para completarse.</p>' : ''}
      `,
      ctaLabel: 'Ver en el portal',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/documentos`,
    }))
  ).catch(e => console.error('[email/lote-enviar] fallo:', e))

  return NextResponse.json({ sent, errors })
}
