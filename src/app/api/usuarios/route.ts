import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso, hashPassword } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { logAction } from '@/lib/audit'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      rolId: true,
      createdAt: true,
      employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  })

  // Fetch rol names separately (new model, safe with as any)
  const roles = await prisma.rol.findMany({ select: { id: true, nombre: true } })
  const rolMap = new Map(roles.map((r: any) => [r.id, r.nombre]))

  return NextResponse.json(usuarios.map(u => ({
    ...u,
    rolNombre: u.rolId ? (rolMap.get(u.rolId) ?? null) : null,
  })))
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { email, password, rolId } = await req.json()
  if (!email?.trim() || !password) return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })

  try {
    const nuevo = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
        rolId: rolId ? Number(rolId) : null,
      },
      select: { id: true, email: true, role: true, rolId: true, createdAt: true },
    })
    await logAction(user.userId, 'CREAR_USUARIO', 'Usuario', nuevo.email)
    return NextResponse.json(nuevo, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') return NextResponse.json({ error: 'Ya existe un usuario con ese email' }, { status: 409 })
    throw e
  }
}
