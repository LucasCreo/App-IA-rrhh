import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sanitizePostHtml } from '@/lib/richContent'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { puedeAccederAPost } from '@/lib/portalAcceso'

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const postId = Number(id)
  if (!(await puedeAccederAPost(user, postId))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const comentarios = await prisma.postComment.findMany({
    where: { postId },
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
      editedAt: c.editedAt,
      parentCommentId: c.parentCommentId,
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
  const postId = Number(id)
  if (!(await puedeAccederAPost(user, postId))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }
  const body = await req.json()
  const contenido: string = body.contenido
  if (!contenido?.trim()) return NextResponse.json({ error: 'Comentario vacío' }, { status: 400 })

  let parentCommentId: number | null = null
  if (body.parentCommentId != null) {
    const requested = Number(body.parentCommentId)
    const parent = await prisma.postComment.findUnique({
      where: { id: requested },
      select: { id: true, postId: true, parentCommentId: true },
    })
    if (!parent || parent.postId !== postId) {
      return NextResponse.json({ error: 'Comentario padre inválido' }, { status: 400 })
    }
    // Flatten: replies to replies se anclan a la raíz del hilo
    parentCommentId = parent.parentCommentId ?? parent.id
  }

  const c = await prisma.postComment.create({
    data: {
      postId,
      autorId: user.userId,
      contenido: sanitizePostHtml(contenido.trim()),
      parentCommentId,
    },
  })

  // Fire-and-forget: notificar al destinatario correspondiente
  ;(async () => {
    try {
      const [autor, post] = await Promise.all([
        prisma.user.findUnique({
          where: { id: user.userId },
          select: { email: true, employee: { select: { nombre: true, apellido: true } } },
        }),
        prisma.post.findUnique({
          where: { id: postId },
          select: {
            contenido: true,
            autor: { select: { id: true, email: true, employee: { select: { nombre: true } } } },
          },
        }),
      ])
      if (!post) return
      const autorNombre = autor?.employee ? `${autor.employee.nombre} ${autor.employee.apellido}` : autor?.email ?? 'Alguien'
      const postTitulo = post.contenido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || '(aviso)'
      const textoLimpio = contenido.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300)
      const ctaUrl = `${process.env.NEXT_PUBLIC_APP_URL}/empleado/portal`

      if (parentCommentId) {
        // Es una respuesta: notificar al autor del comentario padre
        const parent = await prisma.postComment.findUnique({
          where: { id: parentCommentId },
          select: {
            autorId: true,
            autor: { select: { email: true, employee: { select: { nombre: true } } } },
          },
        })
        if (parent && parent.autorId !== user.userId && parent.autor.email) {
          await sendMailFromTemplate('COMENTARIO_RESPONDIDO', {
            to: parent.autor.email,
            vars: {
              nombre: parent.autor.employee?.nombre ?? '',
              autor: autorNombre,
              postTitulo,
              respuesta: textoLimpio,
            },
            ctaUrl,
          })
        }
      } else {
        // Es un comentario de primer nivel: notificar al autor del post
        if (post.autor.id !== user.userId && post.autor.email) {
          await sendMailFromTemplate('COMENTARIO_NUEVO_EN_POST', {
            to: post.autor.email,
            vars: {
              nombre: post.autor.employee?.nombre ?? '',
              autor: autorNombre,
              postTitulo,
              comentario: textoLimpio,
            },
            ctaUrl,
          })
        }
      }
    } catch (e) {
      console.error('[email/comentario] fallo:', e)
    }
  })()

  return NextResponse.json({ id: c.id, parentCommentId }, { status: 201 })
}
