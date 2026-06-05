import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tipos = await prisma.tipoDocumento.findMany({ orderBy: { nombre: 'asc' } })
  return NextResponse.json(tipos)
}

export async function POST(req: NextRequest) {
  const { nombre, descripcion } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  const tipo = await prisma.tipoDocumento.create({ data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null } })
  return NextResponse.json(tipo, { status: 201 })
}
