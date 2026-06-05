import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const emp = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: { categoria: true },
  })
  if (!emp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(emp)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const body = await req.json()
  const emp = await prisma.employee.update({
    where: { id: Number(id) },
    data: {
      legajo: body.legajo,
      nombre: body.nombre,
      apellido: body.apellido,
      cuil: body.cuil,
      email: body.email,
      telefono: body.telefono ?? null,
      fechaIngreso: new Date(body.fechaIngreso),
      categoriaId: Number(body.categoriaId),
      estado: body.estado,
    },
    include: { categoria: true },
  })
  if (user) await logAction(user.userId, 'MODIFICAR', 'Empleado', `Legajo: ${emp.legajo}`)
  return NextResponse.json(emp)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  const emp = await prisma.employee.delete({ where: { id: Number(id) } })
  if (user) await logAction(user.userId, 'ELIMINAR', 'Empleado', `Legajo: ${emp.legajo}`)
  return NextResponse.json({ ok: true })
}
