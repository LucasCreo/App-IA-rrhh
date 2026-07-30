import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { sendMailFromTemplate } from '@/lib/emailTemplates'

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

  ;(async () => {
    try {
      const [full, admins] = await Promise.all([
        prisma.document.findUnique({
          where: { id: docId },
          select: {
            periodo: true,
            employee: { select: { nombre: true, apellido: true, legajo: true } },
            tipoDocumento: { select: { nombre: true } },
          },
        }),
        prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
      ])
      if (!full || admins.length === 0) return
      const tipo = full.tipoDocumento?.nombre ?? 'Documento'
      const vars = {
        apellido: full.employee.apellido,
        nombre: full.employee.nombre,
        legajo: full.employee.legajo,
        tipo,
        bloquePeriodo: full.periodo ? `<li><strong>Período:</strong> ${full.periodo}</li>` : '',
        bloqueConformidad: '',
        bloqueComentario: '',
      }
      await Promise.all(admins.map(a => sendMailFromTemplate('RECIBO_FIRMADO', {
        to: a.email, vars,
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/documentos`,
      })))
    } catch (e) { console.error('[email/recibo-leido] fallo:', e) }
  })()

  return NextResponse.json({ ok: true })
}
