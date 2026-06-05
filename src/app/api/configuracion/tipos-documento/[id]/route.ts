import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { nombre, descripcion } = await req.json()
  const tipo = await prisma.tipoDocumento.update({
    where: { id: Number(id) },
    data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null },
  })
  return NextResponse.json(tipo)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.document.updateMany({ where: { tipoDocumentoId: Number(id) }, data: { tipoDocumentoId: null } })
  await prisma.tipoDocumento.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
