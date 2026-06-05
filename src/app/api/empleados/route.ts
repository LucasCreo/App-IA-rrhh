import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { logAction } from '@/lib/audit'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? undefined
  const page = Number(searchParams.get('page') ?? '1')
  const limit = 20

  const where = {
    AND: [
      q ? {
        OR: [
          { nombre: { contains: q } },
          { apellido: { contains: q } },
          { legajo: { contains: q } },
          { cuil: { contains: q } },
        ],
      } : {},
      estado ? { estado } : {},
    ],
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { categoria: true },
      orderBy: { apellido: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ employees, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const emp = await prisma.employee.create({
    data: {
      legajo: body.legajo,
      nombre: body.nombre,
      apellido: body.apellido,
      cuil: body.cuil,
      email: body.email,
      telefono: body.telefono ?? null,
      fechaIngreso: new Date(body.fechaIngreso),
      categoriaId: Number(body.categoriaId),
      estado: body.estado ?? 'ACTIVO',
    },
    include: { categoria: true },
  })
  if (user) await logAction(user.userId, 'CREAR', 'Empleado', `Legajo: ${emp.legajo}`)
  return NextResponse.json(emp, { status: 201 })
}
