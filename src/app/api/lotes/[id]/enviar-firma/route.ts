import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { sendToProvider } from '@/lib/firmaProvider'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePermiso(PERMISOS.GESTIONAR_LOTES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const rawIds = Array.isArray(body?.documentIds) ? body.documentIds : null
  const idsFiltro = rawIds
    ? rawIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
    : null

  const lote = await prisma.lote.findUnique({
    where: { id: Number(id) },
    include: {
      tipoDocumento: {
        select: {
          accion: true, metodoFirma: true,
          firmaEndpoint: true, firmaBody: true, firmaHeaders: true,
          firmaApiKey: true, firmaApiSecret: true,
        },
      },
    },
  })
  const accion: string = lote?.tipoDocumento?.accion ?? 'FIRMA'
  const metodoFirma: string = lote?.tipoDocumento?.metodoFirma ?? 'CONTRASENA'
  const esProveedor = accion === 'FIRMA' && metodoFirma === 'PROVEEDOR'

  const docs = await prisma.document.findMany({
    where: {
      loteId: Number(id),
      estado: { in: ['BORRADOR', 'ERROR'] },
      ...(idsFiltro && idsFiltro.length > 0 ? { id: { in: idsFiltro } } : {}),
    },
    include: {
      employee: { select: { legajo: true, cuil: true, nombre: true, apellido: true, email: true } },
    },
  })

  const errors: Array<{ documentId: number; error: string }> = []
  let sent = 0

  if (esProveedor && lote?.tipoDocumento) {
    const tipoCfg = lote.tipoDocumento
    for (const doc of docs) {
      try {
        const r = await sendToProvider({
          tipo: {
            firmaEndpoint:  tipoCfg.firmaEndpoint,
            firmaBody:      tipoCfg.firmaBody,
            firmaHeaders:   tipoCfg.firmaHeaders,
            firmaApiKey:    tipoCfg.firmaApiKey,
            firmaApiSecret: tipoCfg.firmaApiSecret,
          },
          ctx: {
            documentId: doc.id,
            empleado: {
              legajo:   doc.employee.legajo,
              cuil:     doc.employee.cuil,
              nombre:   doc.employee.nombre,
              apellido: doc.employee.apellido,
              email:    doc.employee.email ?? '',
            },
            lote: lote ? { nombre: lote.nombre, periodo: lote.periodo } : null,
            aditusId: doc.aditusId,
          },
        })
        if (r.ok) {
          await prisma.document.update({
            where: { id: doc.id },
            data: { estado: 'ENVIADO_A_FIRMA', firmaComentario: null },
          })
          sent++
        } else {
          const msg = `HTTP ${r.status} — ${r.body.slice(0, 500)}`
          await prisma.document.update({
            where: { id: doc.id },
            data: { estado: 'ERROR', firmaComentario: msg },
          })
          errors.push({ documentId: doc.id, error: msg })
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        await prisma.document.update({
          where: { id: doc.id },
          data: { estado: 'ERROR', firmaComentario: msg.slice(0, 500) },
        })
        errors.push({ documentId: doc.id, error: msg })
      }
    }
    await logAction(user.userId, 'ENVIAR_FIRMA_LOTE', 'Lote', `ID ${id}: ${sent} enviados vía proveedor, ${errors.length} con error`)
    return NextResponse.json({ sent, errors })
  }

  // Flujo CONTRASENA (o LECTURA/NINGUNA): sólo cambia estado y notifica
  const res = await prisma.document.updateMany({
    where: { id: { in: docs.map(d => d.id) } },
    data: { estado: 'ENVIADO_A_FIRMA' },
  })
  sent = res.count

  await logAction(user.userId, 'ENVIAR_FIRMA_LOTE', 'Lote', `ID ${id}: ${sent} enviados`)

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
    .map(d => sendMailFromTemplate('DOCUMENTO_A_FIRMA', {
      to: d.employee.email,
      vars: {
        nombre: d.employee.nombre,
        tipo,
        titulo: requiereFirma ? 'Tenés un documento pendiente de firma' : 'Nuevo documento disponible',
        bloquePeriodo: d.periodo ? ` (${d.periodo})` : '',
        bloqueFirma: requiereFirma ? '<p>Requiere tu firma para completarse.</p>' : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/documentos`,
    }))
  ).catch(e => console.error('[email/lote-enviar] fallo:', e))

  return NextResponse.json({ sent, errors: [] })
}
