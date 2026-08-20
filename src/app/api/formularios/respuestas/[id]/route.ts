import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sendMailFromTemplate } from '@/lib/emailTemplates'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const decoded = await verifyToken(token)

  const { id } = await params
  const { datos } = await req.json()

  const respuesta = await prisma.respuestaFormulario.findUnique({
    where: { id: Number(id) },
    include: { asignacion: { select: { fechaLimite: true } } },
  })
  if (!respuesta) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (!decoded.employeeId || respuesta.employeeId !== decoded.employeeId) {
    return NextResponse.json({ error: 'Solo el empleado dueño puede responder este formulario' }, { status: 403 })
  }

  if (respuesta.estado === 'PENDIENTE' && respuesta.asignacion.fechaLimite && respuesta.asignacion.fechaLimite < new Date()) {
    return NextResponse.json({ error: 'La fecha límite del formulario ya venció. Contactá al administrador para extenderla.' }, { status: 400 })
  }

  const updated = await prisma.respuestaFormulario.update({
    where: { id: Number(id) },
    data: { datos: JSON.stringify(datos), estado: 'ENVIADO' },
  })

  ;(async () => {
    try {
      const [full, admins] = await Promise.all([
        prisma.respuestaFormulario.findUnique({
          where: { id: Number(id) },
          select: {
            employee: { select: { nombre: true, apellido: true, legajo: true } },
            asignacion: { select: { nombre: true } },
          },
        }),
        prisma.user.findMany({ where: { role: 'ADMIN', email: { not: '' } }, select: { email: true } }),
      ])
      if (!full || admins.length === 0) return
      const vars = {
        apellido: full.employee.apellido,
        nombre: full.employee.nombre,
        legajo: full.employee.legajo,
        formulario: full.asignacion.nombre,
      }
      await Promise.all(admins.map(a => sendMailFromTemplate('FORMULARIO_COMPLETADO', {
        to: a.email, vars,
        ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/admin/solicitudes?tab=formularios`,
      })))
    } catch (e) { console.error('[email/formulario-completado] fallo:', e) }
  })()

  return NextResponse.json(updated)
}
