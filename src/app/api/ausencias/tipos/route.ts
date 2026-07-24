import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const tipos = await prisma.tipoAusencia.findMany({ orderBy: [{ protegido: 'desc' }, { nombre: 'asc' }] })
  return NextResponse.json(tipos)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { nombre, color, requiereAprobacion, afectaSaldo } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  try {
    const tipo = await prisma.tipoAusencia.create({
      data: { nombre: nombre.trim(), color: color ?? '#6b7280', requiereAprobacion: !!requiereAprobacion, afectaSaldo: !!afectaSaldo },
    })
    return NextResponse.json(tipo, { status: 201 })
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo con ese nombre' }, { status: 409 })
    }
    throw e
  }
}
