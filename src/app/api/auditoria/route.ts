import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.VER_AUDITORIA)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') ?? ''
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = 50

  const where = q ? {
    OR: [
      { accion: { contains: q } },
      { entidad: { contains: q } },
      { detalle: { contains: q } },
      { user: { email: { contains: q } } },
    ],
  } : {}

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { email: true } } },
    }),
  ])

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) })
}
