import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const decoded = await verifyToken(token)
  if (!decoded.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const respuestas = await prisma.respuestaFormulario.findMany({
    where: { employeeId: decoded.employeeId },
    include: {
      asignacion: {
        include: { plantilla: { include: { campos: { orderBy: { orden: 'asc' } } } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(respuestas.map(r => ({
    ...r,
    datos: (() => { try { return JSON.parse(r.datos) } catch { return {} } })(),
    asignacion: {
      ...r.asignacion,
      datosAdmin: (() => { try { return JSON.parse(r.asignacion.datosAdmin) } catch { return {} } })(),
    },
  })))
}
