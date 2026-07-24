import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const data = await req.json()
  const existing = await prisma.tipoAusencia.findUnique({ where: { id: Number(id) } })
  if (!existing) return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
  if (existing.protegido && data.afectaSaldo === false) {
    return NextResponse.json({ error: 'No podés desactivar "afecta saldo" en un tipo protegido' }, { status: 400 })
  }
  try {
    const tipo = await prisma.tipoAusencia.update({
      where: { id: Number(id) },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre.trim() }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.requiereAprobacion !== undefined && { requiereAprobacion: data.requiereAprobacion }),
        ...(data.afectaSaldo !== undefined && !existing.protegido && { afectaSaldo: data.afectaSaldo }),
        ...(data.activo !== undefined && { activo: data.activo }),
      },
    })
    return NextResponse.json(tipo)
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un tipo con ese nombre' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const existing = await prisma.tipoAusencia.findUnique({ where: { id: Number(id) } })
  if (!existing) return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
  if (existing.protegido) {
    return NextResponse.json({ error: 'Este tipo está protegido y no puede eliminarse' }, { status: 400 })
  }
  await prisma.tipoAusencia.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
