import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { getCalendarWithToken, toGoogleEventBody } from '@/lib/google'

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const mes = parseInt(searchParams.get('mes') ?? '0')
    const anio = parseInt(searchParams.get('anio') ?? '0')

    const desde = anio && mes ? new Date(anio, mes - 1, 1) : undefined
    const hasta = anio && mes ? new Date(anio, mes, 0, 23, 59, 59) : undefined
    const rangoFiltro = desde && hasta ? { fechaInicio: { gte: desde, lte: hasta } } : {}

    if (user.role === 'EMPLOYEE' && user.employeeId) {
      const eventos = await prisma.evento.findMany({
        where: {
          ...rangoFiltro,
          OR: [
            { creadoPorId: user.userId },
            { asignados: { some: { employeeId: user.employeeId } } },
          ],
        },
        include: {
          creadoPor: { select: { email: true, role: true } },
          asignados: { select: { employeeId: true } },
        },
        orderBy: { fechaInicio: 'asc' },
      })
      return NextResponse.json(eventos)
    }

    const eventos = await prisma.evento.findMany({
      where: rangoFiltro,
      include: {
        creadoPor: { select: { email: true, role: true } },
        asignados: { include: { employee: { select: { id: true, nombre: true, apellido: true, legajo: true } } } },
      },
      orderBy: { fechaInicio: 'asc' },
    })
    return NextResponse.json(eventos)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { titulo, descripcion, fechaInicio, fechaFin, todoElDia, tipo, subtipo, employeeIds } = await req.json()
    if (!titulo?.trim()) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })
    if (!fechaInicio) return NextResponse.json({ error: 'Fecha requerida' }, { status: 400 })

    const esEmpleado = user.role === 'EMPLOYEE'

    const tipoEvento = await prisma.tipoEvento.findUnique({ where: { nombre: tipo ?? '' } })
    if (!tipoEvento) return NextResponse.json({ error: 'Tipo de evento inválido' }, { status: 400 })
    if (esEmpleado && !tipoEvento.permiteEmpleado) return NextResponse.json({ error: 'No permitido' }, { status: 403 })
    if (!esEmpleado && !tipoEvento.permiteAdmin) return NextResponse.json({ error: 'No permitido' }, { status: 403 })

    let asignados: number[] = []
    if (esEmpleado && user.employeeId) {
      asignados = [user.employeeId]
    } else if (Array.isArray(employeeIds)) {
      asignados = employeeIds
    }

    const fechaInicioDate = new Date(fechaInicio)
    const fechaFinDate = fechaFin ? new Date(fechaFin) : null

    let evento = await prisma.evento.create({
      data: {
        titulo: titulo.trim(),
        descripcion: descripcion?.trim() || null,
        fechaInicio: fechaInicioDate,
        fechaFin: fechaFinDate,
        todoElDia: todoElDia !== false,
        tipo: tipoEvento.nombre,
        subtipo: tipoEvento.nombre === 'AUSENCIA' ? (subtipo?.trim() || null) : null,
        creadoPorId: user.userId,
        asignados: { create: asignados.map(id => ({ employeeId: id })) },
      },
      include: { asignados: { select: { employeeId: true } } },
    })

    // Push a Google Calendar si el creador tiene token
    const userRecord = await prisma.user.findUnique({ where: { id: user.userId }, select: { googleRefreshToken: true } })
    if (userRecord?.googleRefreshToken) {
      try {
        const gcal = getCalendarWithToken(userRecord.googleRefreshToken)
        const gEvent = await gcal.events.insert({
          calendarId: 'primary',
          requestBody: toGoogleEventBody({ titulo: evento.titulo, descripcion: evento.descripcion, fechaInicio: evento.fechaInicio, fechaFin: evento.fechaFin, todoElDia: evento.todoElDia }),
        })
        if (gEvent.data.id) {
          await prisma.evento.update({ where: { id: evento.id }, data: { googleEventId: gEvent.data.id } })
        }
      } catch { /* Google no disponible: la operación local persiste */ }
    }

    return NextResponse.json(evento, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
