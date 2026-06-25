import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const respuestas = await prisma.respuestaFormulario.findMany({
    where: { employeeId: Number(id) },
    include: {
      asignacion: {
        include: { plantilla: { include: { campos: { orderBy: { orden: 'asc' } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(respuestas.map(r => ({
    ...r,
    datos: (() => { try { return JSON.parse(r.datos) } catch { return {} } })(),
    asignacion: {
      ...r.asignacion,
      datosAdmin: (() => { try { return JSON.parse(r.asignacion.datosAdmin) } catch { return {} } })(),
    },
  })))
}
