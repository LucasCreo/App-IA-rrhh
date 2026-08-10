import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS, TODOS_LOS_PERMISOS } from '@/lib/permissions'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { logAction } from '@/lib/audit'
import crypto from 'crypto'

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_USUARIOS)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const employeeIdRaw = body?.employeeId
  const employeeId = employeeIdRaw != null ? Number(employeeIdRaw) : null
  if (!employeeId || !Number.isInteger(employeeId)) {
    return NextResponse.json({ error: 'employeeId requerido' }, { status: 400 })
  }
  const role = body?.role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE'
  const permisosInput: unknown = body?.permisos
  let permisos: string[] | null = null
  if (Array.isArray(permisosInput)) {
    permisos = permisosInput.filter(
      (p): p is string => typeof p === 'string' && (TODOS_LOS_PERMISOS as string[]).includes(p),
    )
  }

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true, invitacion: true },
  })
  if (!employee) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })
  if (employee.user) return NextResponse.json({ error: 'El empleado ya tiene usuario' }, { status: 400 })
  if (!employee.email) return NextResponse.json({ error: 'El empleado no tiene email cargado' }, { status: 400 })

  const token = crypto.randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días

  // Si ya había invitación pendiente, la reemplazamos
  if (employee.invitacion) {
    await prisma.userInvitation.delete({ where: { id: employee.invitacion.id } })
  }

  await prisma.userInvitation.create({
    data: {
      email: employee.email,
      tokenHash,
      employeeId: employee.id,
      role,
      permisos: permisos ? JSON.stringify(permisos) : null,
      createdById: user.userId,
      expiresAt,
    },
  })

  const url = `${process.env.NEXT_PUBLIC_APP_URL}/aceptar-invitacion/${token}`
  sendMailFromTemplate('INVITACION_USUARIO', {
    to: employee.email,
    vars: {
      nombre: employee.nombre,
      expira: expiresAt.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    },
    ctaUrl: url,
  }).catch(e => console.error('[email/invitacion] fallo:', e))

  await logAction(user.userId, 'ENVIAR_INVITACION', 'Usuario', `Empleado ${employee.id} (${employee.email})`)
  return NextResponse.json({ ok: true, expiresAt })
}
