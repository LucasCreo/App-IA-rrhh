import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso, hashPassword } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { Prisma } from '@prisma/client'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const emp = await prisma.employee.findUnique({
    where: { id: Number(id) },
    include: { categoria: true, valoresCampos: true, user: { select: { id: true, email: true, username: true } } },
  })
  if (!emp) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(emp)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  try {
    const emp = await prisma.$transaction(async tx => {
      const updated = await tx.employee.update({
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
          managerId: body.managerId ? Number(body.managerId) : null,
          estado: body.estado,
        },
        include: { categoria: true },
      })
      if (body.camposPersonalizados) {
        await Promise.all(
          (body.camposPersonalizados as Array<{ campoId: number; valor: string }>).map(v =>
            tx.valorCampoEmpleado.upsert({
              where: { employeeId_campoId: { employeeId: updated.id, campoId: v.campoId } },
              update: { valor: v.valor },
              create: { employeeId: updated.id, campoId: v.campoId, valor: v.valor },
            })
          )
        )
      }
      const existingUser = await tx.user.findUnique({ where: { employeeId: updated.id } })
      if (existingUser) {
        const userUpdate: Record<string, unknown> = {}
        if (body.username !== undefined) userUpdate.username = body.username || null
        if (body.email && body.email !== existingUser.email) userUpdate.email = body.email
        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({ where: { id: existingUser.id }, data: userUpdate })
        }
      } else if (body.crearUsuario && body.password) {
        await tx.user.create({
          data: {
            email: body.email,
            username: body.username || null,
            passwordHash: await hashPassword(body.password),
            role: 'EMPLOYEE',
            employeeId: updated.id,
          },
        })
      }
      return updated
    })
    await logAction(user.userId, 'MODIFICAR', 'Empleado', `Legajo: ${emp.legajo}`)
    return NextResponse.json(emp)
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
      if (e.code === 'P2002') return NextResponse.json({ error: 'Ya existe un empleado con ese legajo, CUIL o email' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EMPLEADOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params

  try {
    const emp = await prisma.employee.delete({ where: { id: Number(id) } })
    await logAction(user.userId, 'ELIMINAR', 'Empleado', `Legajo: ${emp.legajo}`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
    }
    throw e
  }
}
