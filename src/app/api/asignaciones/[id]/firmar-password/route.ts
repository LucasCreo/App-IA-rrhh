import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, comparePassword } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { sendMailFromTemplate } from '@/lib/emailTemplates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const asignId = Number(id)

  const body = await req.json().catch(() => ({}))
  const password: string = typeof body.password === 'string' ? body.password : ''
  const conforme: boolean | null = typeof body.conforme === 'boolean' ? body.conforme : null
  const comentario: string = typeof body.comentario === 'string' ? body.comentario.trim() : ''
  if (!password) return NextResponse.json({ error: 'Ingresá tu contraseña para firmar' }, { status: 400 })
  if (conforme === null) return NextResponse.json({ error: 'Indicá si estás conforme o no' }, { status: 400 })

  const asign = await prisma.documentoAsignacion.findUnique({
    where: { id: asignId },
    include: {
      grupo: {
        include: { tipoDocumento: { select: { accion: true, nombre: true } } },
      },
    },
  })
  if (!asign) return NextResponse.json({ error: 'Asignación no encontrada' }, { status: 404 })
  if (asign.employeeId !== user.employeeId) {
    return NextResponse.json({ error: 'Solo el destinatario puede firmar' }, { status: 403 })
  }
  if (asign.grupo.tipoDocumento?.accion !== 'FIRMA') {
    return NextResponse.json({ error: 'Este documento no requiere firma' }, { status: 400 })
  }
  if (asign.estado !== 'ENVIADO_A_FIRMA') {
    return NextResponse.json({ error: 'El documento no está disponible para firmar' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId }, select: { passwordHash: true } })
  if (!dbUser) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  const ok = await comparePassword(password, dbUser.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })

  await prisma.documentoAsignacion.update({
    where: { id: asignId },
    data: {
      estado: 'FIRMADO',
      fechaFirma: new Date(),
      firmaConforme: conforme,
      firmaComentario: comentario || null,
    },
  })

  await logAction(user.userId, 'FIRMAR_DOCUMENTO_ASIGNACION', 'Documento', `Asign ${asignId}`)

  ;(async () => {
    try {
      const [empleado, admins] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: asign.employeeId },
          select: { nombre: true, apellido: true, legajo: true },
        }),
        prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
      ])
      if (!empleado || admins.length === 0) return
      const tipo = asign.grupo.tipoDocumento?.nombre ?? 'Documento'
      const vars = {
        apellido: empleado.apellido,
        nombre: empleado.nombre,
        legajo: empleado.legajo,
        tipo,
        bloquePeriodo: asign.grupo.periodo ? `<li><strong>Período:</strong> ${asign.grupo.periodo}</li>` : '',
        bloqueConformidad: `<li><strong>Firma:</strong> ${conforme ? 'Conforme' : 'No conforme'}</li>`,
        bloqueComentario: comentario
          ? `<blockquote style="border-left:3px solid #16a34a;padding-left:12px;color:#374151;margin:12px 0;">${comentario}</blockquote>`
          : '',
      }
      await Promise.all(admins.map(a => sendMailFromTemplate('RECIBO_FIRMADO', {
        to: a.email, vars,
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/documentos`,
      })))
    } catch (e) { console.error('[email/asignacion-firmada] fallo:', e) }
  })()

  return NextResponse.json({ ok: true })
}
