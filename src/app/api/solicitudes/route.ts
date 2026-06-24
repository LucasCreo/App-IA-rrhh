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

      const raw = await prisma.solicitudDocumento.findMany({
        where: estado ? { estado } : {},
        include: {
          employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
          tipo: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(raw.map(s => ({
        ...s,
        tipo: { ...s.tipo, campos: JSON.parse(s.tipo.campos ?? '[]') },
      })))
    }

    if (!user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const raw = await prisma.solicitudDocumento.findMany({
      where: { employeeId: user.employeeId },
      include: { tipo: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(raw.map(s => ({
      ...s,
      tipo: { ...s.tipo, campos: JSON.parse(s.tipo.campos ?? '[]') },
    })))
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { tipoId, nombreArchivo, descripcion, metadata } = await req.json()
  if (!tipoId) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const tipo = await prisma.tipoSolicitud.findUnique({ where: { id: Number(tipoId) } })
  if (!tipo || !tipo.activo) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })

  const estado = tipo.requiereAprobacion ? 'PENDIENTE' : 'APROBADO'
  const solicitud = await prisma.solicitudDocumento.create({
    data: {
      employeeId: user.employeeId,
      tipoId: Number(tipoId),
      nombreArchivo: nombreArchivo?.trim() || null,
      descripcion: descripcion?.trim() || null,
      metadata: metadata ? JSON.stringify(metadata) : '{}',
      estado,
    },
    include: { tipo: true },
  })
  return NextResponse.json(solicitud)
}
