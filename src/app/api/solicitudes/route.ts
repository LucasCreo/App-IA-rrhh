import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { esTopDelOrganigrama, getScopedEmployeeIds, getDescendantEmployeeIds } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const estado = searchParams.get('estado')
  const q = searchParams.get('q')?.trim() ?? ''
  const areaId = searchParams.get('areaId') ? Number(searchParams.get('areaId')) : undefined
  const categoriaId = searchParams.get('categoriaId') ? Number(searchParams.get('categoriaId')) : undefined
  const pageParam = searchParams.get('page')
  const paged = pageParam !== null
  const page = Math.max(1, Number(pageParam ?? 1) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20) || 20))

  try {
    if (user.role === 'ADMIN') {
      const authed = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
      if (!authed) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

      const [scope, descendants] = await Promise.all([
        getScopedEmployeeIds(authed.userId),
        getDescendantEmployeeIds(authed.userId),
      ])
      const where = {
        ...(estado ? { estado } : {}),
        ...(scope ? { employeeId: { in: [...scope] } } : {}),
        ...(areaId || categoriaId
          ? { employee: { ...(areaId ? { areaId } : {}), ...(categoriaId ? { categoriaId } : {}) } }
          : {}),
        ...(q ? {
          OR: [
            { employee: { legajo: { contains: q } } },
            { employee: { nombre: { contains: q } } },
            { employee: { apellido: { contains: q } } },
            { descripcion: { contains: q } },
            { comentario: { contains: q } },
          ],
        } : {}),
      }
      const [total, raw] = await Promise.all([
        paged ? prisma.solicitudDocumento.count({ where }) : Promise.resolve(0),
        prisma.solicitudDocumento.findMany({
          where,
          include: {
            employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
            tipo: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: paged ? (page - 1) * limit : undefined,
          take: paged ? limit : 500,
        }),
      ])
      const items = raw.map(s => ({
        ...s,
        tipo: { ...s.tipo, campos: JSON.parse(s.tipo.campos ?? '[]') },
        canApprove: descendants.has(s.employeeId),
      }))
      if (paged) return NextResponse.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
      return NextResponse.json(items)
    }

    if (!user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const raw = await prisma.solicitudDocumento.findMany({
      where: { employeeId: user.employeeId },
      include: { tipo: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
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

  const autoAprobar = tipo.requiereAprobacion && await esTopDelOrganigrama(user.employeeId)
  const estado = !tipo.requiereAprobacion || autoAprobar ? 'APROBADO' : 'PENDIENTE'
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

  // Notificar a admins
  const [empleado, admins] = await Promise.all([
    prisma.employee.findUnique({ where: { id: user.employeeId }, select: { nombre: true, apellido: true, legajo: true } }),
    prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
  ])
  if (empleado) {
    // Fire-and-forget
    Promise.all(admins.map(a => sendMailFromTemplate('SOLICITUD_NUEVA', {
      to: a.email,
      vars: {
        apellido: empleado.apellido,
        nombre: empleado.nombre,
        legajo: empleado.legajo,
        tipo: tipo.nombre,
        bloqueDescripcion: descripcion?.trim() ? `<li><strong>Detalle:</strong> ${descripcion.trim()}</li>` : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/solicitudes`,
    }))).catch(e => console.error('[email/doc-solicitud] fallo:', e))
  }

  return NextResponse.json(solicitud)
}
