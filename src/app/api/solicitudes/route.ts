import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendMail } from '@/lib/email'
import { esTopDelOrganigrama, getScopedEmployeeIds, getDescendantEmployeeIds } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const estado = new URL(req.url).searchParams.get('estado')

  try {
    if (user.role === 'ADMIN') {
      // Admin path: check permission
      const authed = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
      if (!authed) return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

      const [scope, descendants] = await Promise.all([
        getScopedEmployeeIds(authed.userId),
        getDescendantEmployeeIds(authed.userId),
      ])
      const raw = await prisma.solicitudDocumento.findMany({
        where: {
          ...(estado ? { estado } : {}),
          ...(scope ? { employeeId: { in: [...scope] } } : {}),
        },
        include: {
          employee: { select: { id: true, nombre: true, apellido: true, legajo: true } },
          tipo: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(raw.map(s => ({
        ...s,
        tipo: { ...s.tipo, campos: JSON.parse(s.tipo.campos ?? '[]') },
        canApprove: descendants.has(s.employeeId),
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
    Promise.all(admins.map(a => sendMail({
      to: a.email,
      subject: `Solicitud de documento — ${empleado.apellido}, ${empleado.nombre}`,
      title: 'Nueva solicitud de documento',
      bodyHtml: `
        <p><strong>${empleado.apellido}, ${empleado.nombre}</strong> (legajo ${empleado.legajo}) solicita:</p>
        <ul>
          <li><strong>Tipo:</strong> ${tipo.nombre}</li>
          ${descripcion?.trim() ? `<li><strong>Detalle:</strong> ${descripcion.trim()}</li>` : ''}
        </ul>
      `,
      ctaLabel: 'Ver solicitudes',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/documentos?tab=solicitudes`,
    }))).catch(e => console.error('[email/doc-solicitud] fallo:', e))
  }

  return NextResponse.json(solicitud)
}
