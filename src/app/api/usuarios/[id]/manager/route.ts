import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const userId = Number(id)
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      managerUserId: true,
      manager: {
        select: {
          id: true,
          email: true,
          employee: { select: { nombre: true, apellido: true, legajo: true } },
        },
      },
    },
  })
  if (!u) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  return NextResponse.json({ managerUserId: u.managerUserId, manager: u.manager })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_ORGANIGRAMA)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const userId = Number(id)
  const body = await req.json()
  const raw = body.managerUserId
  const managerUserId: number | null = raw == null || raw === '' ? null : Number(raw)

  if (managerUserId !== null && !Number.isInteger(managerUserId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }
  if (managerUserId === userId) {
    return NextResponse.json({ error: 'Un usuario no puede ser su propio jefe' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } })
  if (!target?.employeeId) {
    return NextResponse.json({ error: 'Los admins sin legajo están fuera del organigrama' }, { status: 400 })
  }

  if (managerUserId !== null) {
    const cand = await prisma.user.findUnique({ where: { id: managerUserId }, select: { employeeId: true } })
    if (!cand?.employeeId) {
      return NextResponse.json({ error: 'El manager debe tener legajo' }, { status: 400 })
    }
    // Evitar ciclos: managerUserId no puede ser descendiente de userId
    const todos = await prisma.user.findMany({ select: { id: true, managerUserId: true } })
    const managerDe = new Map<number, number | null>()
    todos.forEach(u => managerDe.set(u.id, u.managerUserId))
    let cur: number | null | undefined = managerDe.get(managerUserId) ?? null
    const visto = new Set<number>()
    while (cur != null && !visto.has(cur)) {
      if (cur === userId) {
        return NextResponse.json({ error: 'No se puede: crearía un ciclo en el organigrama' }, { status: 400 })
      }
      visto.add(cur)
      cur = managerDe.get(cur) ?? null
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { managerUserId } })
  await logAction(user.userId, 'MODIFICAR_ORGANIGRAMA', 'Usuario', `User ${userId} manager → ${managerUserId ?? 'ninguno'}`)
  return NextResponse.json({ ok: true })
}
