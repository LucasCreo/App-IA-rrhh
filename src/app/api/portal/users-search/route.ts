import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().toLowerCase()

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { employee: { OR: [{ nombre: { contains: q } }, { apellido: { contains: q } }] } },
          ],
        }
      : {},
    select: {
      id: true,
      email: true,
      avatarUrl: true,
      avatarBgColor: true,
      avatarTextColor: true,
      employee: { select: { nombre: true, apellido: true } },
    },
    take: 8,
    orderBy: { id: 'asc' },
  })

  return NextResponse.json(users.map(u => ({
    id: u.id,
    label: u.employee ? `${u.employee.nombre} ${u.employee.apellido}` : u.email,
    email: u.email,
    avatarUrl: u.avatarUrl,
    avatarBgColor: u.avatarBgColor,
    avatarTextColor: u.avatarTextColor,
  })))
}
