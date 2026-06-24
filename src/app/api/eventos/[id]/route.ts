import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

async function canModify(user: Awaited<ReturnType<typeof getCurrentUser>>, eventoId: number) {
  if (!user) return false
  if (user.role !== 'EMPLOYEE') return true
  const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { creadoPorId: true } })
  return evento?.creadoPorId === user.userId
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

    const { titulo, descripcion, fechaInicio, fechaFin, todoElDia, tipo, employeeIds } = body
    if (!titulo?.trim()) return NextResponse.json({ error: 'Título requerido' }, { status: 400 })

    const esEmpleado = user!.role === 'EMPLOYEE'

    const tipoEvento = await prisma.tipoEvento.findUnique({ where: { nombre: tipo ?? 'PERSONAL' } })
    if (!tipoEvento) return NextResponse.json({ error: 'Tipo de evento inválido' }, { status: 400 })
    if (esEmpleado && !tipoEvento.permiteEmpleado) return NextResponse.json({ error: 'No permitido' }, { status: 403 })

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
          fechaInicio: new Date(fechaInicio),
          fechaFin: fechaFin ? new Date(fechaFin) : null,
          todoElDia: todoElDia !== false,
          tipo: tipoEvento.nombre,
        },
        include: { asignados: { include: { employee: { select: { id: true, nombre: true, apellido: true } } } } },
      })
    })
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
    await prisma.evento.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
