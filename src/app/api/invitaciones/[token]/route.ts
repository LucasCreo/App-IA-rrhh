import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const record = await prisma.userInvitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { employee: { select: { nombre: true, apellido: true, email: true } } },
  })
  if (!record || record.acceptedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'La invitación expiró o ya fue usada' }, { status: 404 })
  }

  return NextResponse.json({
    email: record.email,
    nombre: record.employee?.nombre ?? '',
    apellido: record.employee?.apellido ?? '',
    expiresAt: record.expiresAt,
  })
}
