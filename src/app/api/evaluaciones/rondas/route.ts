import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const rondas = await prisma.rondaEvaluacion.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      plantilla: { select: { nombre: true } },
      _count: { select: { evaluaciones: true } },
    },
  })

  const conProgreso = await Promise.all(rondas.map(async r => ({
    ...r,
    completadas: await prisma.evaluacion.count({ where: { rondaId: r.id, completada: true } }),
  })))

  return NextResponse.json(conProgreso)
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion, plantillaId, employeeIds } = await req.json()
  if (!nombre?.trim() || !plantillaId || !employeeIds?.length) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

  const ronda = await prisma.rondaEvaluacion.create({
    data: {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      plantillaId: Number(plantillaId),
      evaluaciones: {
        create: (employeeIds as number[]).map(eid => ({ employeeId: eid })),
      },
    },
  })
  return NextResponse.json(ronda)
}
