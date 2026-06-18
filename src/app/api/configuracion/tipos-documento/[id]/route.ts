import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { Prisma } from '@prisma/client'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const { nombre, descripcion } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 })

  try {
    const tipo = await prisma.tipoDocumento.update({
      where: { id: Number(id) },
      data: { nombre: nombre.trim(), descripcion: descripcion?.trim() || null },
    })
    return NextResponse.json(tipo)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })
      if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe un tipo de documento con ese nombre' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_CONFIGURACION)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  try {
    await prisma.document.updateMany({ where: { tipoDocumentoId: Number(id) }, data: { tipoDocumentoId: null } })
    await prisma.tipoDocumento.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Tipo de documento no encontrado' }, { status: 404 })
    }
    throw e
  }
}
