import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso, hashPassword } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { Prisma } from '@prisma/client'
import { getScopedEmployeeIds } from '@/lib/scope'
import { validarCuil } from '@/lib/cuil'
import { sendMailFromTemplate } from '@/lib/emailTemplates'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const estado = searchParams.get('estado') ?? undefined
  const categoriaId = searchParams.get('categoriaId') ? Number(searchParams.get('categoriaId')) : undefined
  const sinAcceso = searchParams.get('sinAcceso') === 'true'
  const all = searchParams.get('all') === 'true'
  const page = Number(searchParams.get('page') ?? '1')
  const limitRaw = Number(searchParams.get('limit') ?? '20')
  const limit = [20, 50, 100].includes(limitRaw) ? limitRaw : 20
  const sortBy = searchParams.get('sortBy') ?? 'apellido'
  const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc'
  const ALLOWED_SORT: Record<string, Prisma.EmployeeOrderByWithRelationInput> = {
    apellido: { apellido: sortOrder },
    legajo: { legajo: sortOrder },
    fechaIngreso: { fechaIngreso: sortOrder },
    categoria: { categoria: { nombre: sortOrder } },
  }
  const orderBy = ALLOWED_SORT[sortBy] ?? { apellido: 'asc' as const }

  const scope = await getScopedEmployeeIds(user.userId)
  const where: Prisma.EmployeeWhereInput = {
    AND: [
      q ? {
        OR: [
          { nombre: { contains: q } },
          { apellido: { contains: q } },
          { legajo: { contains: q } },
          { cuil: { contains: q } },
          { email: { contains: q } },
        ],
      } : {},
      estado ? { estado } : {},
      categoriaId ? { categoriaId } : {},
      sinAcceso ? { user: { is: null } } : {},
      scope ? { id: { in: [...scope] } } : {},
    ],
  }

  if (all) {
    const employees = await prisma.employee.findMany({
      where,
      select: {
        id: true, nombre: true, apellido: true, legajo: true,
        categoria: { select: { id: true, nombre: true } },
      },
      orderBy: { apellido: 'asc' },
      take: 5000,
    })
    return NextResponse.json({ employees, total: employees.length, page: 1, pages: 1 })
  }

  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        categoria: true,
        user: {
          select: {
            avatarUrl: true, avatarBgColor: true, avatarTextColor: true,
            manager: { select: { employee: { select: { nombre: true, apellido: true } } } },
          },
        },
        _count: { select: { solicitudesModificacion: { where: { estado: 'PENDIENTE' } } } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  return NextResponse.json({ employees, total, page, pages: Math.ceil(total / limit) })
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json()

  if (body.crearUsuario && !body.password) {
    return NextResponse.json({ error: 'Se requiere una contraseña para crear el usuario' }, { status: 400 })
  }

  if (body.cuil && !validarCuil(body.cuil)) {
    return NextResponse.json({ error: 'CUIL inválido' }, { status: 400 })
  }

  // Pre-checks de unicidad con mensajes específicos
  if (body.email) {
    const [empByEmail, userByEmail] = await Promise.all([
      prisma.employee.findFirst({ where: { email: body.email }, select: { id: true } }),
      prisma.user.findFirst({ where: { email: body.email }, select: { id: true } }),
    ])
    if (empByEmail || userByEmail) {
      return NextResponse.json({ error: 'Ya existe una cuenta con ese email', field: 'email' }, { status: 409 })
    }
  }
  if (body.legajo) {
    const dup = await prisma.employee.findFirst({ where: { legajo: body.legajo }, select: { id: true } })
    if (dup) return NextResponse.json({ error: 'Ya existe un empleado con ese legajo', field: 'legajo' }, { status: 409 })
  }
  if (body.cuil) {
    const dup = await prisma.employee.findFirst({ where: { cuil: body.cuil }, select: { id: true } })
    if (dup) return NextResponse.json({ error: 'Ya existe un empleado con ese CUIL', field: 'cuil' }, { status: 409 })
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
      })
      if (body.crearUsuario) {
        await tx.user.create({
          data: {
            email: body.email,
            username: body.username || null,
            passwordHash: await hashPassword(body.password),
            passwordTemporal: true,
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
    if (body.crearUsuario && body.email) {
      sendMailFromTemplate('EMPLEADO_BIENVENIDA', {
        to: body.email,
        vars: { nombre: body.nombre, email: body.email, password: body.password },
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      }).catch(e => console.error('[email/bienvenida] fallo:', e))
    }
    return NextResponse.json(emp, { status: 201 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const target = (e.meta?.target as string[] | undefined) ?? []
      let msg = 'Ya existe un registro con ese valor'
      let field = ''
      if (target.some(t => t.includes('email'))) { msg = 'Ya existe una cuenta con ese email'; field = 'email' }
      else if (target.some(t => t.includes('legajo'))) { msg = 'Ya existe un empleado con ese legajo'; field = 'legajo' }
      else if (target.some(t => t.includes('cuil'))) { msg = 'Ya existe un empleado con ese CUIL'; field = 'cuil' }
      return NextResponse.json({ error: msg, field }, { status: 409 })
    }
    throw e
  }
}
