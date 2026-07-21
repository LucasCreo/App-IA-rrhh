import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { extraerRutasMedia, borrarMedia, sanitizePostHtml } from '@/lib/richContent'

const EDIT_WINDOW_MIN = 60 * 24

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { cid } = await params
  const comment = await prisma.postComment.findUnique({ where: { id: Number(cid) } })
  if (!comment) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (comment.autorId !== user.userId && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }
  if (comment.autorId === user.userId && user.role !== 'ADMIN') {
    const minutos = (Date.now() - new Date(comment.createdAt).getTime()) / 60000
    if (minutos > EDIT_WINDOW_MIN) {
      return NextResponse.json({
        error: 'Ya no se puede editar. La ventana de edición es de 24 horas desde la publicación.',
        code: 'EDIT_WINDOW_CLOSED',
      }, { status: 403 })
    }
  }

  const { contenido } = await req.json()
  if (typeof contenido !== 'string' || !contenido.trim()) {
    return NextResponse.json({ error: 'El comentario no puede estar vacío' }, { status: 400 })
  }

  const antes = extraerRutasMedia(comment.contenido)
  const despues = extraerRutasMedia(contenido)
  const eliminadas = antes.filter(r => !despues.includes(r))

  await prisma.postComment.update({
    where: { id: comment.id },
    data: { contenido: sanitizePostHtml(contenido), editedAt: new Date() },
  })
  if (eliminadas.length > 0) await borrarMedia(eliminadas)

  return NextResponse.json({ ok: true })
}

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
