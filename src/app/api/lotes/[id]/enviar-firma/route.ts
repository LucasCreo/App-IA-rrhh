import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendToSign } from '@/lib/signature'
import { sendMail } from '@/lib/email'

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

  let sent = 0
  const errors: string[] = []

  for (const doc of docs) {
    try {
      if (accion === 'LECTURA' || accion === 'NINGUNA') {
        await prisma.document.update({
          where: { id: doc.id },
          data: { estado: 'ENVIADO_A_FIRMA' },
        })
      } else {
        const externalId = await sendToSign(doc.id, doc.filePath, doc.nombreArchivo)
        await prisma.document.update({
          where: { id: doc.id },
          data: { estado: 'ENVIADO_A_FIRMA', firmaExternalId: externalId },
        })
      }
      sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      await prisma.document.update({ where: { id: doc.id }, data: { estado: 'ERROR' } })
      errors.push(`Doc ${doc.id}: ${msg}`)
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
