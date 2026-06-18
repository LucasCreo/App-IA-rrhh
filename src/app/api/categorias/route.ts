import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

export async function GET() {
  const data = await prisma.category.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { employees: true } } },
  })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  try {
    const cat = await prisma.category.create({ data: { nombre: nombre.trim() } })
    return NextResponse.json(cat, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una categoría con ese nombre' }, { status: 409 })
    }
    throw e
  }
}
