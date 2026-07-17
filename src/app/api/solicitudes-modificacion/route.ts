import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendMail } from '@/lib/email'
import { getScopedEmployeeIds, getDescendantEmployeeIds, esTopDelOrganigrama } from '@/lib/scope'

export async function GET(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_SOLICITUDES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')

  if (!employeeId) return NextResponse.json({ error: 'Falta employeeId' }, { status: 400 })
  const empId = Number(employeeId)
  const [scope, descendants] = await Promise.all([
    getScopedEmployeeIds(user.userId),
    getDescendantEmployeeIds(user.userId),
  ])
  if (scope && !scope.has(empId)) return NextResponse.json([], { status: 200 })
  const solicitudes = await prisma.solicitudModificacion.findMany({
    where: { employeeId: empId },
    orderBy: { createdAt: 'desc' },
  })
  const canApprove = descendants.has(empId)
  return NextResponse.json(solicitudes.map(s => ({ ...s, canApprove })))
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { comentario } = await req.json()
  if (!comentario?.trim()) return NextResponse.json({ error: 'El comentario es requerido' }, { status: 400 })

  const autoAprobar = await esTopDelOrganigrama(user.employeeId)
  const solicitud = await prisma.solicitudModificacion.create({
    data: {
      employeeId: user.employeeId,
      comentario: comentario.trim(),
      estado: autoAprobar ? 'REVISADO' : 'PENDIENTE',
    },
  })
  if (autoAprobar) return NextResponse.json(solicitud, { status: 201 })

  // Notificar a admins
  const [empleado, admins] = await Promise.all([
    prisma.employee.findUnique({ where: { id: user.employeeId }, select: { nombre: true, apellido: true, legajo: true } }),
    prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
  ])
  if (empleado) {
    // Fire-and-forget
    Promise.all(admins.map(a => sendMail({
      to: a.email,
      subject: `Solicitud de modificación de datos — ${empleado.apellido}, ${empleado.nombre}`,
      title: 'Nueva solicitud de modificación de datos',
      bodyHtml: `
        <p><strong>${empleado.apellido}, ${empleado.nombre}</strong> (legajo ${empleado.legajo}) solicita modificar sus datos:</p>
        <blockquote style="border-left:3px solid #ccc;margin:12px 0;padding:6px 12px;color:#444">${comentario.trim()}</blockquote>
      `,
      ctaLabel: 'Ver legajo',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/empleados/${user.employeeId}`,
    }))).catch(e => console.error('[email/mod-solicitud] fallo:', e))
  }

  return NextResponse.json(solicitud, { status: 201 })
}
