import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const decoded = await verifyToken(token)
  if (!decoded.userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  await prisma.user.update({
    where: { id: decoded.userId },
    data: { googleRefreshToken: null },
  })

  await prisma.evento.deleteMany({
    where: { creadoPorId: decoded.userId, googleEventId: { not: null } },
  })

  return NextResponse.json({ ok: true })
}
