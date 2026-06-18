import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const campos = await prisma.campoPersonalizado.findMany({ orderBy: { orden: 'asc' } })
  return NextResponse.json(campos)
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, tipo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const maxOrden = await prisma.campoPersonalizado.aggregate({ _max: { orden: true } })
  const campo = await prisma.campoPersonalizado.create({
    data: { nombre: nombre.trim(), tipo: tipo ?? 'texto', orden: (maxOrden._max.orden ?? 0) + 1 },
  })
  return NextResponse.json(campo, { status: 201 })
}
