import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

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
