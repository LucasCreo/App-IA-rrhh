import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const asignaciones = await prisma.asignacionFormulario.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      plantilla: { select: { nombre: true } },
      _count: { select: { respuestas: true } },
    },
  })

  const result = await Promise.all(asignaciones.map(async a => {
    const enviadas = await prisma.respuestaFormulario.count({
      where: { asignacionId: a.id, estado: 'ENVIADO' },
    })
    return { ...a, enviadas }
  }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nombre, plantillaId, fechaLimite, employeeIds } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!plantillaId) return NextResponse.json({ error: 'La plantilla es requerida' }, { status: 400 })
  if (!Array.isArray(employeeIds) || employeeIds.length === 0)
    return NextResponse.json({ error: 'Seleccioná al menos un empleado' }, { status: 400 })

  const asignacion = await prisma.asignacionFormulario.create({
    data: {
      nombre: nombre.trim(),
      plantillaId: Number(plantillaId),
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
      respuestas: {
        create: (employeeIds as number[]).map(eid => ({ employeeId: eid })),
      },
    },
  })
  return NextResponse.json(asignacion, { status: 201 })
}
