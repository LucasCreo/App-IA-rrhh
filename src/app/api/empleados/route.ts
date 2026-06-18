import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hashPassword } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import { Prisma } from '@prisma/client'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? undefined
  const categoriaId = searchParams.get('categoriaId') ? Number(searchParams.get('categoriaId')) : undefined
  const all = searchParams.get('all') === 'true'
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
      categoriaId ? { categoriaId } : {},
    ],
  }

  if (all) {
    const employees = await prisma.employee.findMany({
      where,
      select: { id: true, nombre: true, apellido: true, legajo: true },
      orderBy: { apellido: 'asc' },
    })
    return NextResponse.json({ employees, total: employees.length, page: 1, pages: 1 })
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { categoria: true, _count: { select: { solicitudesModificacion: { where: { estado: 'PENDIENTE' } } } } },
      orderBy: { apellido: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ employees, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()

  if (body.crearUsuario && !body.password) {
    return NextResponse.json({ error: 'Se requiere una contraseña para crear el usuario' }, { status: 400 })
  }

  try {
    const emp = await prisma.$transaction(async (tx) => {
      const newEmp = await tx.employee.create({
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
      if (body.crearUsuario) {
        await tx.user.create({
          data: {
            email: body.email,
            username: body.username || null,
            passwordHash: await hashPassword(body.password),
            role: 'EMPLOYEE',
            employeeId: newEmp.id,
          },
        })
      }
      if (body.camposPersonalizados) {
        await Promise.all(
          (body.camposPersonalizados as Array<{ campoId: number; valor: string }>).map(v =>
            tx.valorCampoEmpleado.create({ data: { employeeId: newEmp.id, campoId: v.campoId, valor: v.valor } })
          )
        )
      }
      return newEmp
    })
    await logAction(user.userId, 'CREAR', 'Empleado', `Legajo: ${emp.legajo}${body.crearUsuario ? ' (con usuario)' : ''}`)
    return NextResponse.json(emp, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe un empleado con ese legajo, CUIL o email' }, { status: 409 })
    }
    throw e
  }
}
