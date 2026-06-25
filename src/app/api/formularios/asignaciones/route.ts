import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [asignaciones, enviadasRaw] = await Promise.all([
    prisma.asignacionFormulario.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        plantilla: { select: { nombre: true } },
        _count: { select: { respuestas: true } },
        respuestas: {
          select: { employee: { select: { nombre: true, apellido: true } } },
        },
      },
    }),
    prisma.respuestaFormulario.groupBy({
      by: ['asignacionId'],
      where: { estado: 'ENVIADO' },
      _count: true,
    }),
  ])

  const enviadasMap = new Map(enviadasRaw.map(e => [e.asignacionId, e._count]))
  const result = asignaciones.map(a => ({ ...a, enviadas: enviadasMap.get(a.id) ?? 0 }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nombre, plantillaId, fechaLimite, employeeIds, datosAdmin } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!plantillaId) return NextResponse.json({ error: 'La plantilla es requerida' }, { status: 400 })
  if (!Array.isArray(employeeIds) || employeeIds.length === 0)
    return NextResponse.json({ error: 'Seleccioná al menos un empleado' }, { status: 400 })

  const asignacion = await prisma.asignacionFormulario.create({
    data: {
      nombre: nombre.trim(),
      plantillaId: Number(plantillaId),
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
      datosAdmin: datosAdmin ? JSON.stringify(datosAdmin) : '{}',
      respuestas: {
        create: (employeeIds as number[]).map(eid => ({ employeeId: eid })),
      },
    },
  })
  return NextResponse.json(asignacion, { status: 201 })
}
