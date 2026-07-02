import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import crypto from 'crypto'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: 'Token o contraseña inválidos (mín. 6 caracteres)' }, { status: 400 })
  }

  const tokenHash = hashToken(token)
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'El link expiró o ya fue usado' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  return NextResponse.json({ ok: true })
}
