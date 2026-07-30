import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { isAncestorOfUser } from '@/lib/scope'
import { sendMailFromTemplate } from '@/lib/emailTemplates'

const patchSchema = z.object({
  estado: z.enum(['APROBADO', 'RECHAZADO']),
  comentario: z.string().max(2000).optional().nullable(),
  comentarioVisible: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const { estado, comentario, comentarioVisible } = parsed.data

  const actual = await prisma.solicitudDocumento.findUnique({
    where: { id: Number(id) },
    select: { employee: { select: { user: { select: { id: true } } } } },
  })
  const solicitanteUserId = actual?.employee?.user?.id
  if (!solicitanteUserId || !(await isAncestorOfUser(user.userId, solicitanteUserId))) {
    return NextResponse.json({ error: 'Solo un superior en el organigrama puede resolver esta solicitud' }, { status: 403 })
  }

  // Lock optimista: solo actualiza si la solicitud sigue PENDIENTE.
  // Previene doble-resolución si dos admins la abren a la vez.
  const claim = await prisma.solicitudDocumento.updateMany({
    where: { id: Number(id), estado: 'PENDIENTE' },
    data: {
      estado,
      comentario: comentario?.trim() || null,
      comentarioVisible: comentario?.trim() ? (comentarioVisible ?? false) : false,
    },
  })
  if (claim.count === 0) {
    return NextResponse.json({ error: 'La solicitud ya fue procesada por otro administrador' }, { status: 409 })
  }
  const solicitud = await prisma.solicitudDocumento.findUnique({
    where: { id: Number(id) },
    include: {
      employee: { select: { nombre: true, apellido: true, legajo: true, email: true } },
      tipo: true,
    },
  })
  if (solicitud?.employee?.email) {
    sendMailFromTemplate('SOLICITUD_DOC_RESUELTA', {
      to: solicitud.employee.email,
      vars: {
        nombre: solicitud.employee.nombre,
        tipo: solicitud.tipo.nombre,
        resultado: estado === 'APROBADO' ? 'aprobada' : 'rechazada',
        bloqueComentario: comentario?.trim() && comentarioVisible
          ? `<p><em>Comentario del administrador:</em> ${comentario.trim()}</p>`
          : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/solicitudes`,
    }).catch(e => console.error('[email/solicitud-resuelta] fallo:', e))
  }
  return NextResponse.json(solicitud)
}
