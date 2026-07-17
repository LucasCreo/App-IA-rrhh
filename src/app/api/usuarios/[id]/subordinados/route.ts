import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const managerId = Number(id)

  const subs = await prisma.user.findMany({
    where: { managerUserId: managerId },
    select: { id: true },
  })
  return NextResponse.json({ subordinadoIds: subs.map(s => s.id) })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const managerId = Number(id)
  const body = await req.json()
  const subordinadoIds: number[] = Array.isArray(body.subordinadoIds)
    ? body.subordinadoIds.map((n: unknown) => Number(n)).filter(Number.isInteger)
    : []

  if (subordinadoIds.includes(managerId)) {
    return NextResponse.json({ error: 'Un usuario no puede ser su propio jefe' }, { status: 400 })
  }

  const manager = await prisma.user.findUnique({ where: { id: managerId }, select: { employeeId: true } })
  if (!manager?.employeeId) {
    return NextResponse.json({ error: 'Los admins sin legajo están fuera del organigrama' }, { status: 400 })
  }
  if (subordinadoIds.length > 0) {
    const subs = await prisma.user.findMany({ where: { id: { in: subordinadoIds } }, select: { id: true, employeeId: true } })
    const sinLegajo = subs.filter(s => !s.employeeId)
    if (sinLegajo.length > 0) {
      return NextResponse.json({ error: 'Los admins sin legajo no pueden ser subordinados' }, { status: 400 })
    }
  }

  // Evitar ciclos: ninguno de los subordinados propuestos puede ser ancestro del manager
  const todos = await prisma.user.findMany({ select: { id: true, managerUserId: true } })
  const managerDe = new Map<number, number | null>()
  todos.forEach(u => managerDe.set(u.id, u.managerUserId))

  function esAncestro(candidatoAncestroId: number, descendienteId: number): boolean {
    let cur: number | null | undefined = managerDe.get(descendienteId) ?? null
    const visto = new Set<number>()
    while (cur != null && !visto.has(cur)) {
      if (cur === candidatoAncestroId) return true
      visto.add(cur)
      cur = managerDe.get(cur) ?? null
    }
    return false
  }
  for (const sid of subordinadoIds) {
    if (esAncestro(sid, managerId)) {
      return NextResponse.json({ error: 'No se puede: crearía un ciclo en el organigrama' }, { status: 400 })
    }
  }

  await prisma.$transaction([
    // Liberar a los que dejaron de ser subordinados
    prisma.user.updateMany({
      where: { managerUserId: managerId, id: { notIn: subordinadoIds.length > 0 ? subordinadoIds : [0] } },
      data: { managerUserId: null },
    }),
    // Asignar el manager a los nuevos
    ...(subordinadoIds.length > 0 ? [
      prisma.user.updateMany({
        where: { id: { in: subordinadoIds } },
        data: { managerUserId: managerId },
      }),
    ] : []),
  ])

  await logAction(user.userId, 'MODIFICAR_ORGANIGRAMA', 'Usuario', `Manager ${managerId} → ${subordinadoIds.length} sub`)
  return NextResponse.json({ ok: true, count: subordinadoIds.length })
}
