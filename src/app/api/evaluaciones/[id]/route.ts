import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { resultados, comentario, completada } = await req.json()

  const evaluacion = await prisma.evaluacion.update({
    where: { id: Number(id) },
    data: {
      resultados: JSON.stringify(resultados ?? {}),
      comentario: comentario?.trim() || null,
      completada: completada ?? true,
    },
  })
  return NextResponse.json(evaluacion)
}
