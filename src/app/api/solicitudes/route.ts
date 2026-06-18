import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const estado = new URL(req.url).searchParams.get('estado')

  try {
    if (user.role === 'ADMIN') {
      // Admin path: check permission
      const authed = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
      if (!authed) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

      const solicitudes = await prisma.solicitudDocumento.findMany({
        where: estado ? { estado } : {},
        include: {
          employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
          tipo: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(solicitudes)
    }

    if (!user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const solicitudes = await prisma.solicitudDocumento.findMany({
      where: { employeeId: user.employeeId },
      include: { tipo: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(solicitudes)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipoId, nombreArchivo, descripcion } = await req.json()
  if (!tipoId || !nombreArchivo) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const tipo = await prisma.tipoSolicitud.findUnique({ where: { id: Number(tipoId) } })
  if (!tipo || !tipo.activo) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const solicitud = await prisma.solicitudDocumento.create({
    data: { employeeId: user.employeeId, tipoId: Number(tipoId), nombreArchivo, descripcion: descripcion?.trim() || null },
    include: { tipo: true },
  })
  return NextResponse.json(solicitud)
}
