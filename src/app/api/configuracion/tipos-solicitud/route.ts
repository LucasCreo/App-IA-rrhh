import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  try {
    const tipos = await prisma.tipoSolicitud.findMany({
      orderBy: { nombre: 'asc' },
      include: { _count: { select: { solicitudes: true } } },
    })
    return NextResponse.json(tipos)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Falta nombre' }, { status: 400 })

  try {
    const tipo = await prisma.tipoSolicitud.create({
      data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null },
    })
    return NextResponse.json(tipo)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : ''
    if (msg.includes('Unique') || msg.includes('unique') || msg.includes('P2002')) {
      return NextResponse.json({ error: 'Ya existe un tipo con ese nombre' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Error al crear el tipo. ¿Se aplicaron los cambios de schema?' }, { status: 500 })
  }
}
