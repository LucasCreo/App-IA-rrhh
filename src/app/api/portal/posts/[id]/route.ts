import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { extraerRutasMedia, borrarMedia, sanitizePostHtml } from '@/lib/richContent'

// Ventana para que el autor pueda editar su propio post (minutos) — 1 día
const EDIT_WINDOW_MIN = 60 * 24

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const post = await prisma.post.findUnique({ where: { id: Number(id) } })
  if (!post) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (post.autorId !== user.userId && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  // Ventana de edición: solo para el autor (admin puede editar siempre)
  if (post.autorId === user.userId && user.role !== 'ADMIN') {
    const minutos = (Date.now() - new Date(post.createdAt).getTime()) / 60000
    if (minutos > EDIT_WINDOW_MIN) {
      return NextResponse.json({
        error: 'Ya no se puede editar. La ventana de edición es de 24 horas desde la publicación.',
        code: 'EDIT_WINDOW_CLOSED',
      }, { status: 403 })
    }
  }

  const { contenido } = await req.json()
  if (typeof contenido !== 'string' || !contenido.trim()) {
    return NextResponse.json({ error: 'El contenido no puede estar vacío' }, { status: 400 })
  }

  // Detectar medios que ya no están y borrarlos
  const antes = extraerRutasMedia(post.contenido)
  const despues = extraerRutasMedia(contenido)
  const eliminadas = antes.filter(r => !despues.includes(r))

  await prisma.post.update({
    where: { id: post.id },
    data: { contenido: sanitizePostHtml(contenido), editedAt: new Date() },
  })
  if (eliminadas.length > 0) await borrarMedia(eliminadas)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const post = await prisma.post.findUnique({
    where: { id: Number(id) },
    include: { comentarios: { select: { contenido: true } } },
  })
  if (!post) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  // Solo el autor o un ADMIN pueden borrar
  if (post.autorId !== user.userId && user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Prohibido' }, { status: 403 })
  }

  await prisma.post.delete({ where: { id: Number(id) } })

  const rutas: string[] = []
  rutas.push(...extraerRutasMedia(post.contenido))
  for (const c of post.comentarios) rutas.push(...extraerRutasMedia(c.contenido))
  if (rutas.length > 0) await borrarMedia(rutas)

  if (post.imagenUrl?.startsWith('/uploads/posts/')) {
    try { await unlink(join(process.cwd(), 'public', post.imagenUrl)) } catch {}
  }
  return NextResponse.json({ ok: true })
}
