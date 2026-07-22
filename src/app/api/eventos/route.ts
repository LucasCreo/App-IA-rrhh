import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pushEventoToGoogleCalendars } from '@/lib/google'
import { parseClientDate } from '@/lib/dates'

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

    // Filtro de rango para ausencias: solapan si empiezan antes del fin y terminan después del inicio
    const rangoAus = desde && hasta ? { fechaInicio: { lte: hasta }, fechaFin: { gte: desde } } : {}

    const esEmpleado = user.role === 'EMPLOYEE' && user.employeeId

    const eventos = esEmpleado
      ? await prisma.evento.findMany({
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
      : await prisma.evento.findMany({
          where: rangoFiltro,
          include: {
            creadoPor: { select: { email: true, role: true } },
            asignados: { include: { employee: { select: { id: true, nombre: true, apellido: true, legajo: true } } } },
          },
          orderBy: { fechaInicio: 'asc' },
        })

    // Ausencias aprobadas como eventos virtuales (read-only)
    const ausencias = await prisma.solicitudAusencia.findMany({
      where: {
        estado: 'APROBADA',
        ...rangoAus,
        ...(esEmpleado ? { employeeId: user.employeeId! } : {}),
      },
      include: {
        tipoAusencia: { select: { nombre: true, color: true } },
        employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
      },
    })

    const virtuales = ausencias.map(a => ({
      id: -a.id, // ID negativo para evitar colisión con eventos reales
      titulo: `${a.employee.apellido}, ${a.employee.nombre} — ${a.tipoAusencia.nombre}`,
      descripcion: a.motivo ?? null,
      fechaInicio: a.fechaInicio,
      fechaFin: a.fechaFin,
      todoElDia: true,
      // Marker interno para el frontend; NO viene de TipoEvento
      tipo: `__ausencia__:${a.tipoAusencia.nombre}`,
      color: a.tipoAusencia.color,
      subtipo: a.tipoAusencia.nombre,
      comentarioAdmin: a.comentarioAdmin ?? null,
      creadoPorId: 0,
      creadoPor: null,
      asignados: [{ employeeId: a.employee.id, employee: a.employee }],
      virtual: true,
      solicitudAusenciaId: a.id,
    }))

    return NextResponse.json([...eventos, ...virtuales])
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

    const fechaInicioDate = parseClientDate(fechaInicio)
    const fechaFinDate = fechaFin ? parseClientDate(fechaFin) : null

    const evento = await prisma.evento.create({
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

    // Push a Google Calendar: creador + empleados asignados (sus users)
    const asignadosUserIds = asignados.length > 0
      ? (await prisma.employee.findMany({
          where: { id: { in: asignados } },
          select: { user: { select: { id: true } } },
        })).map(e => e.user?.id).filter((id): id is number => typeof id === 'number')
      : []
    await pushEventoToGoogleCalendars(evento.id, [user.userId, ...asignadosUserIds])

    return NextResponse.json(evento, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
