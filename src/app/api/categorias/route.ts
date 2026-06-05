import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const data = await prisma.category.findMany({
    orderBy: { nombre: 'asc' },
    include: { _count: { select: { employees: true } } },
  })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { nombre } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })
  const cat = await prisma.category.create({ data: { nombre: nombre.trim() } })
  return NextResponse.json(cat, { status: 201 })
}
