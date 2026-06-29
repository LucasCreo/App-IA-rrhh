import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pushEventoToGoogleCalendars } from '@/lib/google'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { estado, comentarioAdmin } = await req.json()

  if (!['APROBADA', 'RECHAZADA'].includes(estado))
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })

  const solicitud = await prisma.solicitudAusencia.findUnique({
    where: { id: Number(id) },
    include: { tipoAusencia: true },
  })
  if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (solicitud.estado !== 'PENDIENTE')
    return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 })

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

  return NextResponse.json({ ok: true })
}
