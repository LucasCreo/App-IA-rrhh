import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sanitizePostHtml } from '@/lib/richContent'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const comentarios = await prisma.postComment.findMany({
    where: { postId: Number(id) },
    orderBy: { createdAt: 'asc' },
    include: {
      autor: {
        select: {
          id: true, email: true, avatarUrl: true, avatarBgColor: true, avatarTextColor: true,
          employee: { select: { nombre: true, apellido: true } },
        },
      },
    },
  })

  return NextResponse.json({
    userId: user.userId,
    comentarios: comentarios.map(c => ({
      id: c.id,
      contenido: c.contenido,
      createdAt: c.createdAt,
      autor: {
        id: c.autor.id,
        avatarUrl: c.autor.avatarUrl,
        avatarBgColor: c.autor.avatarBgColor,
        avatarTextColor: c.autor.avatarTextColor,
        nombreCompleto: c.autor.employee
          ? `${c.autor.employee.nombre} ${c.autor.employee.apellido}`
          : c.autor.email,
      },
    })),
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const { contenido } = await req.json()
  if (!contenido?.trim()) return NextResponse.json({ error: 'Comentario vacío' }, { status: 400 })

  const c = await prisma.postComment.create({
    data: { postId: Number(id), autorId: user.userId, contenido: sanitizePostHtml(contenido.trim()) },
  })
  return NextResponse.json({ id: c.id }, { status: 201 })
}
