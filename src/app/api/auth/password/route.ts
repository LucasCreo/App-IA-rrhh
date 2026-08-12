import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, comparePassword, hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } })
  if (!dbUser || !(await comparePassword(currentPassword, dbUser.passwordHash))) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash: await hashPassword(newPassword), passwordTemporal: false },
  })

  return NextResponse.json({ ok: true })
}
