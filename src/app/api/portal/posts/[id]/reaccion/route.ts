import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { puedeAccederAPost } from '@/lib/portalAcceso'

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const postId = Number(id)
  if (!(await puedeAccederAPost(user, postId))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const existente = await prisma.postReaction.findUnique({
    where: { postId_userId: { postId, userId: user.userId } },
  })

  if (existente) {
    await prisma.postReaction.delete({ where: { postId_userId: { postId, userId: user.userId } } })
    return NextResponse.json({ reaccionada: false })
  }

  await prisma.postReaction.create({
    data: { postId, userId: user.userId, tipo: 'LIKE' },
  })
  return NextResponse.json({ reaccionada: true })
}
