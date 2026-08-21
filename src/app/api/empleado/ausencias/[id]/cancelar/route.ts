import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cancelarSolicitudAusencia, puedeEmpleadoCancelar } from '@/lib/licenciasCancelacion'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || !user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id } = await params
  const solicitudId = Number(id)
  if (!Number.isFinite(solicitudId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const solicitud = await prisma.solicitudAusencia.findUnique({
    where: { id: solicitudId },
    select: { employeeId: true, fechaInicio: true, estado: true },
  })
  if (!solicitud) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  if (solicitud.employeeId !== user.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const ventana = puedeEmpleadoCancelar(solicitud.fechaInicio)
  if (!ventana.ok) return NextResponse.json({ error: ventana.error }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { motivo?: string }
  const res = await cancelarSolicitudAusencia({
    solicitudId,
    actor: 'EMPLEADO',
    motivo: body.motivo ?? null,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json({ ok: true, diasDevueltos: res.diasDevueltos })
}
