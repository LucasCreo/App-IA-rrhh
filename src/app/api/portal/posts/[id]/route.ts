import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { extraerRutasMedia, borrarMedia } from '@/lib/richContent'

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
