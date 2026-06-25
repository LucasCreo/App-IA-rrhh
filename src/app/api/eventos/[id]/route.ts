import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getCalendarWithToken, toGoogleEventBody } from '@/lib/google'

async function canModify(user: Awaited<ReturnType<typeof getCurrentUser>>, eventoId: number) {
  if (!user) return false
  if (user.role !== 'EMPLOYEE') return true
  const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { creadoPorId: true } })
  return evento?.creadoPorId === user.userId
}

async function getGoogleToken(userId: number) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } })
  return u?.googleRefreshToken ?? null
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const body = await req.json()

    if (body.comentarioAdminOnly && user && user.role !== 'EMPLOYEE') {
      const evento = await prisma.evento.update({
        where: { id: Number(id) },
        data: { comentarioAdmin: body.comentarioAdmin ?? null },
      })
      return NextResponse.json(evento)
    }

    if (!await canModify(user, Number(id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const { titulo, descripcion, fechaInicio, fechaFin, todoElDia, tipo, subtipo, employeeIds } = body
    if (!titulo?.trim()) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

    const esEmpleado = user!.role === 'EMPLOYEE'

    const tipoEvento = await prisma.tipoEvento.findUnique({ where: { nombre: tipo ?? '' } })
    if (!tipoEvento) return NextResponse.json({ error: 'Tipo de evento inválido' }, { status: 400 })
    if (esEmpleado && !tipoEvento.permiteEmpleado) return NextResponse.json({ error: 'No permitido' }, { status: 403 })

    const fechaInicioDate = new Date(fechaInicio)
    const fechaFinDate = fechaFin ? new Date(fechaFin) : null

    const evento = await prisma.$transaction(async tx => {
      if (!esEmpleado && Array.isArray(employeeIds)) {
        await tx.eventoEmpleado.deleteMany({ where: { eventoId: Number(id) } })
        await tx.eventoEmpleado.createMany({
          data: employeeIds.map((eid: number) => ({ eventoId: Number(id), employeeId: eid })),
        })
      }
      return tx.evento.update({
        where: { id: Number(id) },
        data: {
          titulo: titulo.trim(),
          descripcion: descripcion?.trim() || null,
          fechaInicio: fechaInicioDate,
          fechaFin: fechaFinDate,
          todoElDia: todoElDia !== false,
          tipo: tipoEvento.nombre,
          subtipo: tipoEvento.nombre === 'AUSENCIA' ? (subtipo?.trim() || null) : null,
        },
        include: { asignados: { include: { employee: { select: { id: true, nombre: true, apellido: true } } } } },
      })
    })

    // Sync a Google Calendar
    if (evento.googleEventId) {
      const token = await getGoogleToken(user!.userId)
      if (token) {
        try {
          const gcal = getCalendarWithToken(token)
          await gcal.events.update({
            calendarId: 'primary',
            eventId: evento.googleEventId,
            requestBody: toGoogleEventBody({ titulo: evento.titulo, descripcion: evento.descripcion, fechaInicio: evento.fechaInicio, fechaFin: evento.fechaFin, todoElDia: evento.todoElDia }),
          })
        } catch { /* Google no disponible */ }
      }
    }

    return NextResponse.json(evento)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    if (!await canModify(user, Number(id))) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const existing = await prisma.evento.findUnique({ where: { id: Number(id) }, select: { googleEventId: true } })
    await prisma.evento.delete({ where: { id: Number(id) } })

    // Eliminar de Google Calendar
    if (existing?.googleEventId) {
      const token = await getGoogleToken(user!.userId)
      if (token) {
        try {
          const gcal = getCalendarWithToken(token)
          await gcal.events.delete({ calendarId: 'primary', eventId: existing.googleEventId })
        } catch { /* Google no disponible */ }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
