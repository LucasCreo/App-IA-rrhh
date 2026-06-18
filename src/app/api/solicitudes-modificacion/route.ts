import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get('employeeId')

  if (user.role === 'ADMIN') {
    if (!employeeId) return NextResponse.json({ error: 'Falta employeeId' }, { status: 400 })
    const solicitudes = await prisma.solicitudModificacion.findMany({
      where: { employeeId: Number(employeeId) },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(solicitudes)
  }

  return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user?.employeeId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { comentario } = await req.json()
  if (!comentario?.trim()) return NextResponse.json({ error: 'El comentario es requerido' }, { status: 400 })

  const solicitud = await prisma.solicitudModificacion.create({
    data: { employeeId: user.employeeId, comentario: comentario.trim() },
  })
  return NextResponse.json(solicitud, { status: 201 })
}
