import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

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

  if (decoded.employeeId && respuesta.employeeId !== decoded.employeeId)
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  if (respuesta.estado === 'PENDIENTE' && respuesta.asignacion.fechaLimite && respuesta.asignacion.fechaLimite < new Date()) {
    return NextResponse.json({ error: 'La fecha límite del formulario ya venció. Contactá al administrador para extenderla.' }, { status: 400 })
  }

  const updated = await prisma.respuestaFormulario.update({
    where: { id: Number(id) },
    data: { datos: JSON.stringify(datos), estado: 'ENVIADO' },
  })
  return NextResponse.json(updated)
}
