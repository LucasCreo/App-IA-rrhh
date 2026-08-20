import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { puedeAccederAPost } from '@/lib/portalAcceso'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const postId = Number(id)
  if (!(await puedeAccederAPost(user, postId))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const reacciones = await prisma.postReaction.findMany({
    where: { postId },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: {
          id: true, email: true, avatarUrl: true, avatarBgColor: true, avatarTextColor: true,
          employee: { select: { nombre: true, apellido: true } },
        },
      },
    },
  })

  return NextResponse.json(reacciones.map(r => ({
    id: r.user.id,
    tipo: r.tipo,
    nombreCompleto: r.user.employee
      ? `${r.user.employee.nombre} ${r.user.employee.apellido}`
      : r.user.email,
    avatarUrl: r.user.avatarUrl,
    avatarBgColor: r.user.avatarBgColor,
    avatarTextColor: r.user.avatarTextColor,
  })))
}
