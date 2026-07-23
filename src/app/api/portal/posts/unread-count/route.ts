import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ count: 0 })

  const [me, lastSeen] = await Promise.all([
    user.employeeId
      ? prisma.employee.findUnique({ where: { id: user.employeeId }, select: { categoriaId: true } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: user.userId }, select: { avisosLastSeenAt: true } }),
  ])

  const miCategoriaId = me?.categoriaId ?? null
  const since = lastSeen?.avisosLastSeenAt ?? new Date(0)

  const count = await prisma.post.count({
    where: {
      createdAt: { gt: since },
      autorId: { not: user.userId },
      OR: [
        { alcance: 'GLOBAL' },
        ...(miCategoriaId ? [{ alcance: 'CATEGORIA', categoriaId: miCategoriaId }] : []),
      ],
    },
  })

  return NextResponse.json({ count })
}
