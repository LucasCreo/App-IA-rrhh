import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'
import { getEmployeeDependencies, getUserDependencies, deletePersona, deletePersonaCascade } from '@/lib/personDependencies'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { role, permisos } = body

  const target = await prisma.user.findUnique({ where: { id: Number(id) } })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  if (target.id === user.userId && role === 'EMPLOYEE') {
    return NextResponse.json({ error: 'No podés cambiar tu propio rol de acceso' }, { status: 400 })
  }

  const data: any = {}
  if (role !== undefined) data.role = role

  if (Array.isArray(permisos)) {
    const cleanPermisos: string[] = permisos.filter((p: unknown) => typeof p === 'string')
    await prisma.$transaction([
      ...(Object.keys(data).length > 0 ? [prisma.user.update({ where: { id: target.id }, data })] : []),
      prisma.userPermiso.deleteMany({ where: { userId: target.id } }),
      ...(cleanPermisos.length > 0
        ? [prisma.userPermiso.createMany({ data: cleanPermisos.map(p => ({ userId: target.id, permiso: p })) })]
        : []),
    ])
  } else if (Object.keys(data).length > 0) {
    await prisma.user.update({ where: { id: target.id }, data })
  }

  await logAction(user.userId, 'MODIFICAR_USUARIO', 'Usuario', target.email)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params

  if (Number(id) === user.userId) {
    return NextResponse.json({ error: 'No podés eliminar tu propia cuenta' }, { status: 400 })
  }

  const force = new URL(req.url).searchParams.get('force') === 'true'

  const target = await prisma.user.findUnique({
    where: { id: Number(id) },
    select: { id: true, email: true, employeeId: true, employee: { select: { legajo: true } } },
  })
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  if (force) {
    await deletePersonaCascade(target.employeeId ?? null, target.id)
    await logAction(user.userId, 'ELIMINAR_CASCADA_USUARIO', 'Usuario', `${target.email}${target.employee ? ` (+ legajo ${target.employee.legajo})` : ''}`)
    return NextResponse.json({ ok: true, empleadoDeleted: !!target.employeeId, cascade: true })
  }

  const [depsUser, depsEmp] = await Promise.all([
    getUserDependencies(target.id),
    target.employeeId ? getEmployeeDependencies(target.employeeId) : Promise.resolve([]),
  ])
  const dependencias = [...depsUser, ...depsEmp]

  if (dependencias.length > 0) {
    return NextResponse.json({
      error: 'El usuario tiene datos asociados',
      dependencias,
      legajoAsociado: target.employee?.legajo ?? null,
    }, { status: 409 })
  }

  await deletePersona(target.employeeId ?? null, target.id)
  await logAction(user.userId, 'ELIMINAR_USUARIO', 'Usuario', `${target.email}${target.employee ? ` (+ legajo ${target.employee.legajo})` : ''}`)
  return NextResponse.json({ ok: true, empleadoDeleted: !!target.employeeId })
}
