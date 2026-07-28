import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pushEventoToGoogleCalendars } from '@/lib/google'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { getScopedEmployeeIds, isAncestorOfUser } from '@/lib/scope'

const patchSchema = z.object({
  estado: z.enum(['APROBADA', 'RECHAZADA']),
  comentarioAdmin: z.string().max(2000).optional().nullable(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const raw = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const { estado, comentarioAdmin } = parsed.data

  const solicitud = await prisma.solicitudAusencia.findUnique({
    where: { id: Number(id) },
    include: { tipoAusencia: true, employee: { select: { user: { select: { id: true } } } } },
  })
  if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  const scope = await getScopedEmployeeIds(user.userId)
  if (scope && !scope.has(solicitud.employeeId)) {
    return NextResponse.json({ error: 'No autorizado sobre esta solicitud' }, { status: 403 })
  }
  if (solicitud.estado !== 'PENDIENTE')
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 })

  // Solo un ancestro en el organigrama puede aprobar/rechazar (nunca uno mismo)
  const solicitanteUserId = solicitud.employee?.user?.id
  if (!solicitanteUserId || !(await isAncestorOfUser(user.userId, solicitanteUserId))) {
    return NextResponse.json({ error: 'Solo un superior en el organigrama puede resolver esta solicitud' }, { status: 403 })
  }

  // updateMany con filtro por estado = 'PENDIENTE' actúa como lock optimista:
  // si otro admin ya la resolvió, count = 0 y abortamos antes de duplicar eventos/saldo.
  const claim = await prisma.solicitudAusencia.updateMany({
    where: { id: Number(id), estado: 'PENDIENTE' },
    data: { estado, comentarioAdmin: comentarioAdmin ?? null },
  })
  if (claim.count === 0) {
    return NextResponse.json({ error: 'La solicitud ya fue procesada por otro administrador' }, { status: 409 })
  }

  if (estado === 'APROBADA') {
    // Crear evento en el calendario
    const evento = await prisma.evento.create({
      data: {
        titulo: `Ausencia — ${solicitud.tipoAusencia.nombre}`,
        descripcion: solicitud.motivo ?? null,
        fechaInicio: solicitud.fechaInicio,
        fechaFin: solicitud.fechaFin,
        todoElDia: true,
        tipo: 'AUSENCIA',
        subtipo: solicitud.tipoAusencia.nombre,
        creadoPorId: user.userId,
        asignados: { create: { employeeId: solicitud.employeeId } },
      },
    })

    // Push a Google Calendar del empleado y del admin que aprueba
    const empleado = await prisma.employee.findUnique({
      where: { id: solicitud.employeeId },
      select: { user: { select: { id: true } } },
    })
    const empleadoUserId = empleado?.user?.id
    await pushEventoToGoogleCalendars(evento.id, [empleadoUserId, user.userId].filter((id): id is number => typeof id === 'number'))

    // Descontar del saldo de vacaciones si aplica
    if (solicitud.tipoAusencia.afectaSaldo) {
      const anio = solicitud.fechaInicio.getFullYear()
      await prisma.saldoVacaciones.upsert({
        where: { employeeId_anio: { employeeId: solicitud.employeeId, anio } },
        update: { diasUsados: { increment: solicitud.dias } },
        create: { employeeId: solicitud.employeeId, anio, diasTotales: 14, diasUsados: solicitud.dias },
      })
    }
  }

  // Notificar al empleado por email
  const emp = await prisma.employee.findUnique({
    where: { id: solicitud.employeeId },
    select: { nombre: true, email: true },
  })
  if (emp?.email) {
    const fmt = (d: Date) => new Date(d).toLocaleDateString('es-AR')
    const rango = `${fmt(solicitud.fechaInicio)} — ${fmt(solicitud.fechaFin)}`
    const esAprobada = estado === 'APROBADA'
    // Fire-and-forget
    sendMailFromTemplate('AUSENCIA_RESUELTA', {
      to: emp.email,
      vars: {
        nombre: emp.nombre,
        tipoAusencia: solicitud.tipoAusencia.nombre,
        rango,
        resultado: esAprobada ? 'aprobada' : 'rechazada',
        bloqueComentario: comentarioAdmin ? `<p><em>Comentario del administrador:</em> ${comentarioAdmin}</p>` : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/ausencias`,
    }).catch(e => console.error('[email/ausencia-resolucion] fallo:', e))
  }

  return NextResponse.json({ ok: true })
}
