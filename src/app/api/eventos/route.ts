import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { pushEventoToGoogleCalendars } from '@/lib/google'

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
