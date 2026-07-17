import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pushEventoToGoogleCalendars } from '@/lib/google'
import { sendMail } from '@/lib/email'
import { getScopedEmployeeIds, isAncestorOfUser } from '@/lib/scope'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { estado, comentarioAdmin } = await req.json()

  if (!['APROBADA', 'RECHAZADA'].includes(estado))
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

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

  await prisma.solicitudAusencia.update({
    where: { id: Number(id) },
    data: { estado, comentarioAdmin: comentarioAdmin ?? null },
  })

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
    sendMail({
      to: emp.email,
      subject: `Solicitud de ausencia ${esAprobada ? 'aprobada' : 'rechazada'}`,
      title: `Tu solicitud de ausencia fue ${esAprobada ? 'aprobada' : 'rechazada'}`,
      bodyHtml: `
        <p>Hola ${emp.nombre},</p>
        <p>Tu solicitud de <strong>${solicitud.tipoAusencia.nombre}</strong> para el período <strong>${rango}</strong> fue <strong>${esAprobada ? 'aprobada' : 'rechazada'}</strong>.</p>
        ${comentarioAdmin ? `<p><em>Comentario del administrador:</em> ${comentarioAdmin}</p>` : ''}
      `,
      ctaLabel: 'Ver en el portal',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/ausencias`,
    }).catch(e => console.error('[email/ausencia-resolucion] fallo:', e))
  }

  return NextResponse.json({ ok: true })
}
