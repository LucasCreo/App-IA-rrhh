import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { permisos: { select: { permiso: true } } },
  })
  // null = acceso total; array = restrictivo
  const permisos: string[] | null = (dbUser?.permisos?.length ?? 0) > 0
    ? dbUser!.permisos.map(p => p.permiso)
    : null

  return NextResponse.json({
    userId: user.userId,
    email: user.email,
    role: user.role,
    employeeId: user.employeeId ?? null,
    permisos,
  })
}
