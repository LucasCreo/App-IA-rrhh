import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { nombre } = await req.json()
  const cat = await prisma.category.update({
    where: { id: Number(id) },
    data: { nombre: nombre.trim() },
  })
  return NextResponse.json(cat)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.category.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
