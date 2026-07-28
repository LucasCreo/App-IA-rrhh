import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const scope = user.role === 'ADMIN' ? await getScopedEmployeeIds(user.userId) : null
  const scopeFilter = scope
    ? { respuestas: { some: { employeeId: { in: [...scope] } } } }
    : {}

  const [asignaciones, enviadasRaw] = await Promise.all([
    prisma.asignacionFormulario.findMany({
      where: scopeFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        plantilla: { select: { nombre: true } },
        _count: { select: { respuestas: true } },
        respuestas: {
          where: scope ? { employeeId: { in: [...scope] } } : {},
          select: { employee: { select: { nombre: true, apellido: true } } },
        },
      },
    }),
    prisma.respuestaFormulario.groupBy({
      by: ['asignacionId'],
      where: {
        estado: 'ENVIADO',
        ...(scope ? { employeeId: { in: [...scope] } } : {}),
      },
      _count: true,
    }),
  ])

  const enviadasMap = new Map(enviadasRaw.map(e => [e.asignacionId, e._count]))
  const result = asignaciones.map(a => ({ ...a, enviadas: enviadasMap.get(a.id) ?? 0 }))

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { nombre, plantillaId, fechaLimite, employeeIds, datosAdmin } = await req.json()
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!plantillaId) return NextResponse.json({ error: 'La plantilla es requerida' }, { status: 400 })
  if (!Array.isArray(employeeIds) || employeeIds.length === 0)
    return NextResponse.json({ error: 'Seleccioná al menos un empleado' }, { status: 400 })

  const scopeCreate = await getScopedEmployeeIds(user.userId)
  if (scopeCreate) {
    const fueraDelScope = (employeeIds as number[]).filter(id => !scopeCreate.has(id))
    if (fueraDelScope.length > 0) {
      return NextResponse.json(
        { error: 'Hay empleados seleccionados fuera de tu alcance' },
        { status: 403 }
      )
    }
  }

  const asignacion = await prisma.asignacionFormulario.create({
    data: {
      nombre: nombre.trim(),
      plantillaId: Number(plantillaId),
      fechaLimite: fechaLimite ? new Date(fechaLimite) : null,
      datosAdmin: datosAdmin ? JSON.stringify(datosAdmin) : '{}',
      respuestas: {
        create: (employeeIds as number[]).map(eid => ({ employeeId: eid })),
      },
    },
  })

  // Notificar a cada empleado asignado
  const empleados = await prisma.employee.findMany({
    where: { id: { in: employeeIds as number[] } },
    select: { nombre: true, email: true },
  })
  const fechaTexto = fechaLimite
    ? new Date(fechaLimite).toLocaleDateString('es-AR')
    : null
  Promise.all(empleados
    .filter(e => e.email)
    .map(e => sendMailFromTemplate('FORMULARIO_ASIGNADO', {
      to: e.email,
      vars: {
        nombre: e.nombre,
        formulario: nombre.trim(),
        bloqueFecha: fechaTexto ? `<p>Fecha límite: <strong>${fechaTexto}</strong>.</p>` : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado/solicitudes?tab=formularios`,
    }))
  ).catch(err => console.error('[email/formulario-asignado] fallo:', err))

  return NextResponse.json(asignacion, { status: 201 })
}
