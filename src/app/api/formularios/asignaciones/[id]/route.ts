import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  await prisma.respuestaFormulario.deleteMany({ where: { asignacionId: Number(id) } })
  await prisma.asignacionFormulario.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { nombre, plantillaId, fechaLimite, datosAdmin } = await req.json()

  const current = await prisma.asignacionFormulario.findUnique({ where: { id: Number(id) } })
  if (!current) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const plantillaChanged = plantillaId && Number(plantillaId) !== current.plantillaId

  await prisma.asignacionFormulario.update({
    where: { id: Number(id) },
    data: {
      nombre: nombre.trim(),
      plantillaId: Number(plantillaId),
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
      datosAdmin: JSON.stringify(datosAdmin ?? {}),
    },
  })

  if (plantillaChanged) {
    await prisma.respuestaFormulario.updateMany({
      where: { asignacionId: Number(id) },
      data: { estado: 'PENDIENTE', datos: '{}' },
    })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const asignacion = await prisma.asignacionFormulario.findUnique({
    where: { id: Number(id) },
    include: {
      plantilla: true,
      respuestas: {
        include: {
          employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
        },
        orderBy: { employee: { apellido: 'asc' } },
      },
    },
  })
  if (!asignacion) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json({
    ...asignacion,
    datosAdmin: (() => { try { return JSON.parse(asignacion.datosAdmin) } catch { return {} } })(),
    plantilla: {
      ...asignacion.plantilla,
      campos: (() => { try { return JSON.parse(asignacion.plantilla.campos) } catch { return [] } })(),
    },
    respuestas: asignacion.respuestas.map(r => ({
      ...r,
      datos: (() => { try { return JSON.parse(r.datos) } catch { return {} } })(),
    })),
  })
}
