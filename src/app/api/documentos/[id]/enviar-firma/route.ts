import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { getScopedEmployeeIds } from '@/lib/scope'

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

  await prisma.document.update({
    where: { id: doc.id },
    data: { estado: 'ENVIADO_A_FIRMA' },
  })
  await logAction(user.userId, 'NOTIFICAR', 'Documento', `Doc ${doc.id} notificado para ${accion}`)
  await notificarEmpleado(doc.id, accion)
  return NextResponse.json({ ok: true })
}
