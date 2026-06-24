import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const plantillas = await prisma.plantillaFormulario.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { asignaciones: true } } },
  })
  return NextResponse.json(plantillas.map(p => ({
    ...p,
    campos: (() => { try { return JSON.parse(p.campos) } catch { return [] } })(),
  })))
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nombre, descripcion } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })

  const plantilla = await prisma.plantillaFormulario.create({
    data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null },
  })
  return NextResponse.json(plantilla, { status: 201 })
}
