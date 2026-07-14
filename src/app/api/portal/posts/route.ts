import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { puedePublicarEnPortal } from '@/lib/portalPermisos'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { logAction } from '@/lib/audit'

const MAX_IMG = 5 * 1024 * 1024

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Categoría del usuario (si es empleado) para filtrar posts con alcance CATEGORIA
  let miCategoriaId: number | null = null
  if (user.employeeId) {
    const emp = await prisma.employee.findUnique({
      where: { id: user.employeeId },
      select: { categoriaId: true },
    })
    miCategoriaId = emp?.categoriaId ?? null
  }

  const posts = await prisma.post.findMany({
    where: {
      OR: [
        { alcance: 'GLOBAL' },
        ...(miCategoriaId ? [{ alcance: 'CATEGORIA', categoriaId: miCategoriaId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      autor: {
        select: {
          id: true, email: true, avatarUrl: true,
          employee: { select: { nombre: true, apellido: true, categoria: { select: { nombre: true } } } },
        },
      },
      categoria: { select: { id: true, nombre: true } },
      reacciones: { select: { userId: true, tipo: true } },
      _count: { select: { comentarios: true } },
    },
  })

  const puedePublicar = await puedePublicarEnPortal(user)

  return NextResponse.json({
    puedePublicar,
    userId: user.userId,
    posts: posts.map(p => ({
      id: p.id,
      contenido: p.contenido,
      imagenUrl: p.imagenUrl,
      alcance: p.alcance,
      categoria: p.categoria,
      createdAt: p.createdAt,
      autor: {
        id: p.autor.id,
        avatarUrl: p.autor.avatarUrl,
        nombreCompleto: p.autor.employee ? `${p.autor.employee.nombre} ${p.autor.employee.apellido}` : p.autor.email,
        rolNombre: p.autor.employee?.categoria?.nombre ?? null,
      },
      reacciones: p.reacciones,
      totalReacciones: p.reacciones.length,
      miReaccion: p.reacciones.find(r => r.userId === user.userId)?.tipo ?? null,
      totalComentarios: p._count.comentarios,
    })),
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (!(await puedePublicarEnPortal(user))) {
    return NextResponse.json({ error: 'No tenés permiso para publicar' }, { status: 403 })
  }

  const formData = await req.formData()
  const contenido = (formData.get('contenido') as string)?.trim()
  const alcance = (formData.get('alcance') as string) || 'GLOBAL'
  const categoriaIdRaw = formData.get('categoriaId')
  const imagen = formData.get('imagen') as File | null

  if (!contenido && !imagen) {
    return NextResponse.json({ error: 'El post no puede estar vacío' }, { status: 400 })
  }
  if (alcance !== 'GLOBAL' && alcance !== 'CATEGORIA') {
    return NextResponse.json({ error: 'Alcance inválido' }, { status: 400 })
  }
  const categoriaId = alcance === 'CATEGORIA' && categoriaIdRaw ? Number(categoriaIdRaw) : null
  if (alcance === 'CATEGORIA' && !categoriaId) {
    return NextResponse.json({ error: 'Seleccioná una categoría para el alcance limitado' }, { status: 400 })
  }

  let imagenUrl: string | null = null
  if (imagen && imagen.size > 0) {
    if (imagen.size > MAX_IMG) {
      return NextResponse.json({ error: 'La imagen supera 5 MB' }, { status: 400 })
    }
    const dir = join(process.cwd(), 'public', 'uploads', 'posts')
    await mkdir(dir, { recursive: true })
    const ext = imagen.name.split('.').pop()?.toLowerCase() || 'bin'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    await writeFile(join(dir, fileName), Buffer.from(await imagen.arrayBuffer()))
    imagenUrl = `/uploads/posts/${fileName}`
  }

  const post = await prisma.post.create({
    data: {
      autorId: user.userId,
      contenido: contenido ?? '',
      imagenUrl,
      alcance,
      categoriaId,
    },
  })

  await logAction(user.userId, 'PUBLICAR', 'Post', `Post ${post.id}`)
  return NextResponse.json({ id: post.id }, { status: 201 })
}
