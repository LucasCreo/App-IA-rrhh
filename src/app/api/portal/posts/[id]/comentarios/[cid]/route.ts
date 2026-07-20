import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { extraerRutasMedia, borrarMedia } from '@/lib/richContent'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { cid } = await params
  const comment = await prisma.postComment.findUnique({ where: { id: Number(cid) } })
  if (!comment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  if (comment.autorId !== user.userId && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  await prisma.postComment.delete({ where: { id: Number(cid) } })
  const rutas = extraerRutasMedia(comment.contenido)
  if (rutas.length > 0) await borrarMedia(rutas)
  return NextResponse.json({ ok: true })
}
