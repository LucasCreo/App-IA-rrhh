import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendMailFromTemplate } from '@/lib/emailTemplates'
import { getScopedEmployeeIds } from '@/lib/scope'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const scope = await getScopedEmployeeIds(user.userId)
  const scopeFilter = scope
    ? { evaluaciones: { some: { employeeId: { in: [...scope] } } } }
    : {}

  const rondas = await prisma.rondaEvaluacion.findMany({
    where: scopeFilter,
    orderBy: { createdAt: 'desc' },
    include: {
      plantilla: { select: { nombre: true } },
      _count: {
        select: {
          evaluaciones: scope
            ? { where: { employeeId: { in: [...scope] } } }
            : true,
        },
      },
    },
  })

  const conProgreso = await Promise.all(rondas.map(async r => ({
    ...r,
    completadas: await prisma.evaluacion.count({
      where: {
        rondaId: r.id,
        completada: true,
        ...(scope ? { employeeId: { in: [...scope] } } : {}),
      },
    }),
  })))

  return NextResponse.json(conProgreso)
}

export async function POST(req: NextRequest) {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { nombre, descripcion, plantillaId, employeeIds } = await req.json()
  if (!nombre?.trim() || !plantillaId || !employeeIds?.length) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  }

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

  const ronda = await prisma.rondaEvaluacion.create({
    data: {
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
      plantillaId: Number(plantillaId),
      evaluaciones: {
        create: (employeeIds as number[]).map(eid => ({ employeeId: eid })),
      },
    },
  })

  // Notificar a cada empleado incluido en la ronda
  const empleados = await prisma.employee.findMany({
    where: { id: { in: employeeIds as number[] } },
    select: { nombre: true, email: true },
  })
  Promise.all(empleados
    .filter(e => e.email)
    .map(e => sendMailFromTemplate('EVALUACION_ASIGNADA', {
      to: e.email,
      vars: {
        nombre: e.nombre,
        ronda: nombre.trim(),
        bloqueDescripcion: descripcion?.trim() ? `<p>${descripcion.trim()}</p>` : '',
      },
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado`,
    }))
  ).catch(err => console.error('[email/ronda-nueva] fallo:', err))

  return NextResponse.json(ronda)
}
