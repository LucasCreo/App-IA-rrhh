import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermiso } from '@/lib/auth'
import { PERMISOS } from '@/lib/permissions'
import { sendMail } from '@/lib/email'

export async function GET() {
  const user = await requirePermiso(PERMISOS.GESTIONAR_EVALUACIONES)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const rondas = await prisma.rondaEvaluacion.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      plantilla: { select: { nombre: true } },
      _count: { select: { evaluaciones: true } },
    },
  })

  const conProgreso = await Promise.all(rondas.map(async r => ({
    ...r,
    completadas: await prisma.evaluacion.count({ where: { rondaId: r.id, completada: true } }),
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
    .map(e => sendMail({
      to: e.email,
      subject: `Nueva evaluación: ${nombre.trim()}`,
      title: 'Tenés una nueva evaluación',
      bodyHtml: `
        <p>Hola ${e.nombre},</p>
        <p>Fuiste incluido en una nueva ronda de evaluación: <strong>${nombre.trim()}</strong>.</p>
        ${descripcion?.trim() ? `<p>${descripcion.trim()}</p>` : ''}
        <p>Los resultados estarán disponibles en tu portal cuando el administrador los cargue.</p>
      `,
      ctaLabel: 'Ver mis evaluaciones',
      ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL}/empleado`,
    }))
  ).catch(err => console.error('[email/ronda-nueva] fallo:', err))

  return NextResponse.json(ronda)
}
