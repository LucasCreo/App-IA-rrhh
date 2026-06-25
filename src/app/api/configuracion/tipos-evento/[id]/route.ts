import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'EMPLOYEE') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const { id } = await params
    const tipo = await prisma.tipoEvento.findUnique({ where: { id: Number(id) } })
    if (!tipo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    const { nombre, color, permiteAdmin, permiteEmpleado } = await req.json()
    const data: Record<string, unknown> = {}
    if (color) data.color = color
    if (permiteAdmin !== undefined) data.permiteAdmin = permiteAdmin !== false
    if (permiteEmpleado !== undefined) data.permiteEmpleado = !!permiteEmpleado
    if (!tipo.protegido && nombre?.trim()) data.nombre = nombre.trim().toUpperCase()

    const updated = await prisma.tipoEvento.update({ where: { id: Number(id) }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role === 'EMPLOYEE') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    const { id } = await params
    const tipo = await prisma.tipoEvento.findUnique({ where: { id: Number(id) } })
    if (!tipo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    if (tipo.protegido) return NextResponse.json({ error: 'No se puede eliminar un tipo protegido' }, { status: 400 })
    await prisma.tipoEvento.delete({ where: { id: Number(id) } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 })
  }
}
