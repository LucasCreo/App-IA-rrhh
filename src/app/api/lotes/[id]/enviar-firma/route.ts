import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendMailFromTemplate } from '@/lib/emailTemplates'

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
    include: { tipoDocumento: { select: { accion: true } } },
  })
  const accion: string = lote?.tipoDocumento?.accion ?? 'FIRMA'

  const docs = await prisma.document.findMany({
    where: {
      loteId: Number(id),
      estado: { in: ['BORRADOR', 'ERROR'] },
      ...(idsFiltro && idsFiltro.length > 0 ? { id: { in: idsFiltro } } : {}),
    },
    select: { id: true },
  })

  const res = await prisma.document.updateMany({
    where: { id: { in: docs.map(d => d.id) } },
    data: { estado: 'ENVIADO_A_FIRMA' },
  })
  const sent = res.count

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
