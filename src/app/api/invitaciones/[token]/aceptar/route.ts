import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { logAction } from '@/lib/audit'
import crypto from 'crypto'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const body = await req.json().catch(() => ({}))
  const username: string | undefined = typeof body?.username === 'string' ? body.username.trim() : undefined
  const password: string | undefined = typeof body?.password === 'string' ? body.password : undefined

  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  if (!password || password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const record = await prisma.userInvitation.findUnique({ where: { tokenHash: hashToken(token) } })
  if (!record || record.acceptedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'La invitación expiró o ya fue usada' }, { status: 400 })
  }

  // Verificar que el email/username no esté ya en uso
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: record.email },
        ...(username ? [{ username }] : []),
      ],
    },
    select: { id: true, email: true, username: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: existing.email === record.email ? 'Ya existe un usuario con ese email' : 'El nombre de usuario ya está en uso' },
      { status: 400 },
    )
  }

  const passwordHash = await hashPassword(password)
  const permisos: string[] = record.permisos ? (JSON.parse(record.permisos) as string[]) : []

  const created = await prisma.$transaction(async tx => {
    const user = await tx.user.create({
      data: {
        email: record.email,
        username: username || null,
        passwordHash,
        role: record.role,
        employeeId: record.employeeId ?? undefined,
      },
    })
    if (permisos.length > 0) {
      await tx.userPermiso.createMany({
        data: permisos.map(p => ({ userId: user.id, permiso: p })),
      })
    }
    await tx.userInvitation.update({
      where: { id: record.id },
      data: { acceptedAt: new Date() },
    })
    return user
  })

  await logAction(created.id, 'ACEPTAR_INVITACION', 'Usuario', `User ${created.id} creado vía invitación`)
  return NextResponse.json({ ok: true })
}
